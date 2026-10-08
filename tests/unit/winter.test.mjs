import test from 'node:test';
import assert from 'node:assert/strict';
import { physics } from '../helpers.mjs';
import {
  selectCourse,
  loadCourse,
  course,
  track,
  length,
  surfaces,
  physicsSurfaces,
  atDistance,
  aiInput,
} from '../../src/client/track.js';
import { scenery, renderPointAtDistance, ROAD_EXTENSION } from '../../src/client/renderer.js';
import { Race, STEP } from '../../src/client/race.js';

test('Beaufort loads a finite route, bridge, crossable snow and half-road ice', () => {
  const dryLength = length;
  selectCourse('beaufort');
  try {
    assert(length > dryLength);
    assert(track.length < 2048);
    track.forEach((p, i) => {
      assert(Object.values(p).every(Number.isFinite));
      if (i) assert(p.d > track[i - 1].d);
    });
    assert(course.bridges[0][0] > 18 && course.bridges[0][1] < length - 14);
    assert(surfaces.some((p) => p.type === 2));
    assert.deepEqual(
      surfaces.filter((p) => p.type === 1).map((p) => p.variant),
      surfaces.filter((p) => p.type === 1).map((_, i) => i % 4),
    );
    assert(
      surfaces.every((surface) =>
        [surface.d, surface.offset, surface.width, surface.length, surface.type].every(
          Number.isFinite,
        ),
      ),
    );
    const { vertices: mesh } = scenery();
    assert(mesh.length > 1000 && mesh.every(Number.isFinite));
    const end = renderPointAtDistance(length + ROAD_EXTENSION);
    assert(
      Math.abs(Math.hypot(end.x - track.at(-1).x, end.y - track.at(-1).y) - ROAD_EXTENSION) < 0.001,
    );
    assert.throws(() => selectCourse('__proto__'), /Unknown course/);
    assert.equal(course.name, 'BEAUFORT MOUNTAIN');
  } finally {
    selectCourse('kasumi');
  }
  assert.equal(surfaces.length, 0);
  assert.equal(length, dryLength);
});

async function straight(kind, { x = 0, y = -50, vx = 0, vy = -25, steer = 0, steps = 60 } = {}) {
  const { wasm, state } = await physics();
  wasm.setPoint(0, 0, 0, 0);
  wasm.setPoint(1, 0, -1000, 1000);
  wasm.reset(x, y, 0);
  state[3] = vx;
  state[4] = vy;
  if (kind) wasm.setSurface(0, 0, -65, 30, 30, 0, kind);
  for (let i = 0; i < steps; i++) wasm.step(0, 1, steer, 0, 0, STEP);
  return { wasm, state };
}

test('ice gives a modest speed boost, weak turning and retained lateral momentum for both cars', async () => {
  const dry = await straight(0),
    ice = await straight(2);
  assert(ice.state[6] > dry.state[6] + 0.5);
  assert(ice.state[6] < dry.state[6] * 1.12);
  const dryTurn = await straight(0, { steer: 1 }),
    iceTurn = await straight(2, { steer: 1 });
  assert(iceTurn.state[2] < dryTurn.state[2] * 0.4);
  const drySlide = await straight(0, { vx: 4 }),
    iceSlide = await straight(2, { vx: 4 });
  assert(iceSlide.state[3] > drySlide.state[3] * 3);
  for (const car of [0, 1]) {
    const { wasm, state } = await straight(2, { steps: 0 });
    const k = car * 10;
    state[k] = 0;
    state[k + 1] = -65;
    state[k + 3] = 4;
    state[k + 4] = -25;
    wasm.step(car, 1, 1, 0, 0, STEP);
    const slipperyHeading = state[k + 2];
    wasm.clearSurfaces();
    state[k + 2] = 0;
    state[k + 5] = 0;
    wasm.step(car, 1, 1, 0, 0, STEP);
    assert(state[k + 2] > slipperyHeading * 2);
  }
});

test('ice does not launch a stationary car and normal grip returns beyond its boundary', async () => {
  const { wasm, state } = await straight(2, { vy: 0, steps: 0 });
  wasm.step(0, 0, 0, 0, 0, STEP);
  assert.equal(state[6], 0);
  state[0] = 0;
  state[1] = -110;
  state[3] = 4;
  state[4] = -25;
  wasm.step(0, 1, 0, 0, 0, STEP);
  const dry = await straight(0, { y: -110, vx: 4, steps: 1 });
  assert.deepEqual([...state.slice(0, 10)], [...dry.state.slice(0, 10)]);
});

test('snow piles slow cars but remain fully crossable without a crash', async () => {
  const { wasm, state } = await straight(0, { x: 6, y: -30, steps: 0 });
  wasm.setSurface(0, 6, -50, 5.8, 9, 0, 1);
  let slowest = Infinity;
  for (let i = 0; i < 600; i++) {
    wasm.step(0, 1, 0, 0, 0, STEP);
    if (state[1] < -41 && state[1] > -59) slowest = Math.min(slowest, state[6]);
    assert.equal(state[9], 0);
  }
  assert(slowest < 15);
  assert(state[1] < -65, 'Car must cross the entire pile');
  wasm.reset(-4, -50, 0);
  state[4] = -25;
  wasm.step(0, 1, 0, 0, 0, STEP);
  assert(state[6] > 25, 'Clear half of road keeps its speed');
});

test('winter rival finishes without roadside hits and course reload clears hazards', async () => {
  selectCourse('beaufort');
  try {
    const { wasm, state } = await physics();
    loadCourse(wasm);
    let time = 0,
      hits = 0;
    while (state[18] < length - 14 && time < 180) {
      const a = aiInput(state);
      wasm.step(1, a.throttle, a.steer, a.brake, a.handbrake, STEP);
      if (state[19] > 0) hits++;
      assert([...state].every(Number.isFinite));
      time += STEP;
    }
    assert(time < 180);
    assert.equal(hits, 0);
    const race = new Race(wasm, state);
    race.reset();
    race.phase = 'race';
    const end = atDistance(length - 13);
    state[10] = end.x;
    state[11] = end.y;
    state[12] = end.a;
    race.tick({ throttle: 0, steer: 0, brake: 0, handbrake: 0 });
    assert.equal(race.phase, 'finished');
    assert.notEqual(race.rivalFinish, null);
    selectCourse('kasumi');
    loadCourse(wasm);
    wasm.reset(0, 0, track[0].a);
    const dry = await physics();
    for (let i = 0; i < 240; i++) {
      wasm.step(0, 1, 0, 0, 0, STEP);
      dry.wasm.step(0, 1, 0, 0, 0, STEP);
    }
    assert.deepEqual([...state], [...dry.state]);
  } finally {
    selectCourse('kasumi');
  }
});

test('Beaufort rival shifts away from upcoming snow and ice while staying inside the road', () => {
  selectCourse('beaufort');
  try {
    for (const surface of [
      surfaces.find((item) => item.type === 1 && item.offset > 0),
      surfaces.find((item) => item.type === 2 && item.offset < 0),
    ]) {
      const point = atDistance(surface.d);
      const s = new Float64Array(20);
      s[10] = point.x + point.nx * course.ai.offset;
      s[11] = point.y + point.ny * course.ai.offset;
      s[12] = point.a;
      s[16] = 35;
      s[18] = surface.d;
      const input = aiInput(s);
      assert.equal(Math.sign(input.steer), surface.offset > 0 ? -1 : 1);
      assert.equal(input.brake, 0, 'Hazard avoidance should change the line, not slow Ren');
    }
  } finally {
    selectCourse('kasumi');
  }
});

test('Beaufort ice hazards load as finite authored surfaces outside the bridge', () => {
  selectCourse('beaufort');
  try {
    const ice = surfaces.filter((p) => p.type === 2);
    assert.equal(new Set(ice.map((p) => p.length)).size, ice.length);
    assert(physicsSurfaces.length <= 128);
    for (const p of ice) {
      assert(p.length > 0 && p.width > 0);
      assert(p.d - p.length > 0 && p.d + p.length < length);
      for (const [start, end] of course.bridges)
        assert(p.d + p.length < start || p.d - p.length > end);
      assert(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.a));
      const segments = physicsSurfaces.filter((item) => item.sourceD === p.d);
      assert(segments.length >= 4);
      for (let d = p.d - p.length + 4; d < p.d + p.length - 3; d += 4) {
        const road = atDistance(d),
          x = road.x + Math.cos(road.a) * p.offset,
          y = road.y + Math.sin(road.a) * p.offset;
        assert(
          segments.some((segment) => {
            const dx = x - segment.x,
              dy = y - segment.y;
            return (
              Math.abs(dx * Math.cos(segment.a) + dy * Math.sin(segment.a)) < segment.width &&
              Math.abs(-dx * Math.sin(segment.a) + dy * Math.cos(segment.a)) < segment.length
            );
          }),
          `Ice at ${p.d} must stay slippery along the road at ${d}`,
        );
      }
    }
  } finally {
    selectCourse('kasumi');
  }
});

test('curved Beaufort ice reduces steering at a bend and clears beyond its end', async () => {
  selectCourse('beaufort');
  try {
    const patch = surfaces.find((p) => p.type === 2 && p.d === 2110);
    const icy = await physics(),
      dry = await physics();
    loadCourse(icy.wasm);
    loadCourse(dry.wasm);
    dry.wasm.clearSurfaces();
    for (const d of [patch.d + 12, patch.d + patch.length + 8]) {
      const road = atDistance(d),
        x = road.x + Math.cos(road.a) * patch.offset,
        y = road.y + Math.sin(road.a) * patch.offset;
      for (const { wasm, state } of [icy, dry]) {
        wasm.reset(x, y, road.a);
        state[3] = Math.sin(road.a) * 25;
        state[4] = -Math.cos(road.a) * 25;
        wasm.step(0, 1, 1, 0, 0, STEP);
      }
      const icyTurn = icy.state[2] - road.a,
        dryTurn = dry.state[2] - road.a;
      if (d < patch.d + patch.length) assert(icyTurn < dryTurn * 0.4);
      else assert(Math.abs(icyTurn - dryTurn) < 0.000001);
    }
  } finally {
    selectCourse('kasumi');
  }
});

test('oriented ice affects only the occupied lane, including rotated road sections', async () => {
  for (const angle of [0, Math.PI / 3]) {
    const { wasm, state } = await physics();
    wasm.setPoint(0, 0, 0, 0);
    wasm.setPoint(1, Math.sin(angle) * 1000, -Math.cos(angle) * 1000, 1000);
    const center = { x: Math.sin(angle) * 50, y: -Math.cos(angle) * 50 };
    wasm.setSurface(
      0,
      center.x + Math.cos(angle) * 5.7,
      center.y + Math.sin(angle) * 5.7,
      4.3,
      25,
      angle,
      2,
    );
    const headings = [];
    for (const offset of [-5.7, 5.7]) {
      wasm.reset(center.x + Math.cos(angle) * offset, center.y + Math.sin(angle) * offset, angle);
      state[3] = Math.sin(angle) * 25;
      state[4] = -Math.cos(angle) * 25;
      wasm.step(0, 1, 1, 0, 0, STEP);
      headings.push(state[2] - angle);
    }
    assert(headings[1] < headings[0] * 0.4);
  }
});

test('beveled ice physics includes its long flat edges but excludes clipped corners', async () => {
  const headings = [];
  for (const [x, y] of [
    [3.5, 0],
    [4.1, 24.9],
    [4.3, 0],
  ]) {
    const { wasm, state } = await physics();
    wasm.setPoint(0, 0, 0, 0);
    wasm.setPoint(1, 0, -1000, 1000);
    wasm.setSurface(0, 0, -65, 4.3, 25, 0, 2);
    wasm.reset(x, -65 + y, 0);
    state[4] = -25;
    wasm.step(0, 1, 1, 0, 0, STEP);
    headings.push(state[2]);
  }
  assert(headings[0] < headings[1] * 0.4);
  assert(Math.abs(headings[1] - headings[2]) < 0.000001);
});
