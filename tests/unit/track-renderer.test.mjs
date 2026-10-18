import test from 'node:test';
import assert from 'node:assert/strict';
import {
  track,
  length,
  atDistance,
  aiInput,
  course,
  selectCourse,
} from '../../src/client/track.js';
import {
  Mesh,
  ROAD_EXTENSION,
  drawCar,
  color,
  renderPointAtDistance,
  scenery,
} from '../../src/client/renderer.js';
import { updateCamera } from '../../src/client/camera.js';
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
for (const id of ['kasumi', 'beaufort']) {
  test(`${id} road ends stay outside start and finish camera views`, () => {
    selectCourse(id);
    try {
      for (const aspect of [1440 / 950, 800 / 600, 390 / 844])
        for (const d of [0, length - 14])
          for (const speed of [0, 90]) {
            const p = atDistance(d),
              state = new Float64Array(20),
              camera = { x: p.x, y: p.y + 32, zoom: 75 };
            state[0] = p.x;
            state[1] = p.y;
            state[2] = p.a;
            state[3] = Math.sin(p.a) * speed;
            state[4] = -Math.cos(p.a) * speed;
            state[6] = speed;
            state[8] = d;
            for (let frame = 0; frame < 240; frame++) {
              for (const end of [-ROAD_EXTENSION, length + ROAD_EXTENSION]) {
                const point = renderPointAtDistance(end);
                // The widest shoulder reaches 35 m sideways, along the road normal.
                assert(
                  Math.abs(point.x - camera.x) > camera.zoom * aspect + 35 * Math.abs(point.nx) ||
                    Math.abs(point.y - camera.y) > camera.zoom + 35 * Math.abs(point.ny),
                  `Road cap must be outside the view at distance ${d}, speed ${speed}`,
                );
              }
              updateCamera(camera, state, 1 / 60, atDistance, aspect);
            }
          }
    } finally {
      selectCourse('kasumi');
    }
  });
  test(`${id} generated trees leave the entire rendered road clear, including both extensions`, () => {
    selectCourse(id);
    const original = course.drawTree,
      trees = [];
    try {
      course.drawTree = (_mesh, tree) => trees.push(tree);
      const scene = scenery();
      assert(scene.vertices.every(Number.isFinite));
      assert(trees.length > 100, 'The roadside forest remains populated');
      for (let d = -ROAD_EXTENSION; d <= length + ROAD_EXTENSION; d += 2) {
        const point = renderPointAtDistance(d);
        for (const tree of trees)
          if (Math.hypot(tree.x - point.x, tree.y - point.y) < 29 - 0.01)
            assert.fail(`Tree at (${tree.x}, ${tree.y}) overlaps the road clearance at ${d}`);
      }
      for (const d of [-150, length + 150]) {
        const point = renderPointAtDistance(d);
        assert(
          trees.some((tree) => Math.hypot(tree.x - point.x, tree.y - point.y) < 100),
          'Trees still border the extended road',
        );
      }
    } finally {
      if (original) course.drawTree = original;
      else delete course.drawTree;
      selectCourse('kasumi');
    }
  });
}
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
test('rival emits bounded controls on a straight section', () => {
  const s = new Float64Array(20),
    start = atDistance(0);
  s[10] = start.x;
  s[11] = start.y;
  s[12] = start.a;
  const input = aiInput(s);
  assert(input.throttle >= 0 && input.throttle <= 1);
  assert(input.brake >= 0 && input.brake <= 1);
  assert(Math.abs(input.steer) <= 1);
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
