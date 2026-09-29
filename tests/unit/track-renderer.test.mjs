import test from 'node:test';
import assert from 'node:assert/strict';
import { track, length, atDistance, aiInput } from '../../src/client/track.js';
import {
  Mesh,
  ROAD_EXTENSION,
  drawCar,
  color,
  renderPointAtDistance,
} from '../../src/client/renderer.js';
test('track fits physics capacity, has increasing progress and normalized normals', () => {
  assert(track.length > 100 && track.length < 2048);
  assert(length > 1900 && length < 2000);
  track.forEach((p, i) => {
    assert(Object.values(p).every(Number.isFinite));
    assert(Math.abs(Math.hypot(p.nx, p.ny) - 1) < 1e-10);
    if (i) assert(p.d > track[i - 1].d);
  });
});
test('distance sampling clamps boundaries and interpolates the road', () => {
  assert.equal(atDistance(-1).x, track[0].x);
  assert.equal(atDistance(length + 10).y, track.at(-1).y);
  for (let d = 0; d < length; d += 13) assert(Object.values(atDistance(d)).every(Number.isFinite));
});
test('rendered road continues smoothly beyond both race endpoints', () => {
  for (const d of [-ROAD_EXTENSION, 0, length, length + ROAD_EXTENSION]) {
    const p = renderPointAtDistance(d);
    assert(Object.values(p).every(Number.isFinite));
    assert(Math.abs(Math.hypot(p.nx, p.ny) - 1) < 1e-10);
  }
  const start = renderPointAtDistance(-ROAD_EXTENSION),
    startEnd = renderPointAtDistance(0),
    finish = renderPointAtDistance(length),
    finishEnd = renderPointAtDistance(length + ROAD_EXTENSION);
  assert(Math.hypot(start.x - startEnd.x, start.y - startEnd.y) > ROAD_EXTENSION - 1);
  assert(Math.hypot(finish.x - finishEnd.x, finish.y - finishEnd.y) > ROAD_EXTENSION - 1);
  assert.equal(startEnd.a, track[0].a);
  assert.equal(finish.a, track.at(-1).a);
});
test('AI outputs bounded controls across the entire track', () => {
  const s = new Float64Array(20);
  for (let d = 0; d < length; d += 7) {
    const p = atDistance(d);
    s[10] = p.x;
    s[11] = p.y;
    s[12] = p.a;
    s[16] = 35;
    s[18] = d;
    const a = aiInput(s);
    assert(Math.abs(a.steer) <= 1);
    assert(a.throttle >= 0 && a.throttle <= 1);
    assert(a.brake >= 0 && a.brake <= 1);
  }
});
test('mesh shapes produce finite triangle vertices, including a zero-length line', () => {
  const m = new Mesh(),
    c = color('f88456');
  m.rect(0, 0, 2, 4, 0, c);
  assert.equal(m.data.length, 36);
  m.disc(0, 0, 1, c, 8);
  m.line(0, 0, 0, 0, 1, c);
  drawCar(m, 0, 0, Math.PI / 2, c, 0.8);
  assert.equal(m.data.length % 18, 0);
  assert(m.data.every(Number.isFinite));
  assert.deepEqual(color('ffffff'), [1, 1, 1]);
});
