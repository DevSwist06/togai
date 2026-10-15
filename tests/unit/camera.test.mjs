import test from 'node:test';
import assert from 'node:assert/strict';
import { updateCamera } from '../../src/client/camera.js';
import { atDistance, length, selectCourse } from '../../src/client/track.js';

function view(speed = 0) {
  const s = new Float64Array(20);
  s[4] = -speed;
  s[6] = speed;
  return { camera: { x: 0, y: -12, zoom: 75 }, s };
}
function settle(camera, s, seconds = 4, sampleTrack, aspect = 1) {
  for (let i = 0; i < seconds * 60; i++) updateCamera(camera, s, 1 / 60, sampleTrack, aspect);
}

test('closer framing retains a modest speed zoom and smoothly settles after braking', () => {
  const stopped = view();
  settle(stopped.camera, stopped.s);
  assert(Math.abs(stopped.camera.zoom - 62) < 0.01);
  const { camera, s } = view(60);
  settle(camera, s);
  assert(camera.zoom > 70 && camera.zoom < 74);
  assert(75 / stopped.camera.zoom > 1.2, 'Car is at least 20% larger at rest');
  assert((75 + 60 * 0.65) / camera.zoom > 1.5, 'Car is at least 50% larger at speed');
  const wide = camera.zoom;
  s[4] = s[6] = 0;
  updateCamera(camera, s, 1 / 60);
  assert(Math.abs(camera.zoom - wide) < 0.05, 'Impact/braking cannot snap the zoom');
  settle(camera, s);
  assert(Math.abs(camera.zoom - stopped.camera.zoom) < 0.01);
});

test('acceleration and braking gently change zoom without pumping', () => {
  const { camera, s } = view(30);
  settle(camera, s);
  let previous = camera.zoom;
  for (let frame = 1; frame <= 60; frame++) {
    s[6] = 30 + frame / 6;
    s[4] = -s[6];
    updateCamera(camera, s, 1 / 60);
    assert(camera.zoom >= previous && camera.zoom - previous < 0.05);
    previous = camera.zoom;
  }
  const acceleratingZoom = camera.zoom;
  settle(camera, s);
  assert(Math.abs(camera.zoom - acceleratingZoom) < 1.5);
  for (let frame = 1; frame <= 60; frame++) {
    s[6] = 40 - frame / 6;
    s[4] = -s[6];
    const before = camera.zoom;
    updateCamera(camera, s, 1 / 60);
    assert(camera.zoom <= before && before - camera.zoom < 0.06);
  }
  assert(camera.zoom < acceleratingZoom);
});

test('course look-ahead reveals the bend before the vehicle turns', () => {
  const straight = view(50),
    bend = view(50);
  settle(straight.camera, straight.s);
  settle(bend.camera, bend.s, 4, (d) => ({ x: d * 0.7, y: -d * 0.7 }));
  assert(bend.camera.x > 10, 'Camera leads into the upcoming right bend');
  assert(Math.abs(straight.camera.x) < 0.01);
  assert(bend.camera.y < -20, 'Forward track remains visible');
  const before = { ...bend.camera };
  bend.s[2] = Math.PI / 2;
  bend.s[3] = 50;
  bend.s[4] = 0;
  updateCamera(bend.camera, bend.s, 1 / 60);
  assert(Math.hypot(bend.camera.x - before.x, bend.camera.y - before.y) < 1.2);
});

test('heading wrap and alternating steering do not cause camera snaps or shake', () => {
  const { camera, s } = view(50);
  s[2] = Math.PI - 0.001;
  s[4] = 50;
  settle(camera, s);
  const before = { ...camera };
  for (let i = 0; i < 120; i++) {
    s[2] = i % 2 ? Math.PI - 0.001 : -Math.PI + 0.001;
    s[5] = i % 2 ? -0.1 : 0.1;
    updateCamera(camera, s, 1 / 60);
    assert(Math.abs(camera.x - before.x) < 0.1);
    assert(Math.abs(camera.zoom - before.zoom) < 0.01);
  }
});

test('30, 60 and 144 Hz movement keeps a consistent frame without accumulated follow lag', () => {
  const views = [30, 60, 144].map((hz) => {
    const { camera, s } = view(50);
    for (let i = 1; i <= hz * 4; i++) {
      s[1] = (-i * 50) / hz;
      updateCamera(camera, s, 1 / hz);
    }
    assert(s[1] - camera.y > 29 && s[1] - camera.y < 33);
    return camera;
  });
  for (const camera of views) {
    assert(Math.abs(camera.y - views[0].y) < 0.05);
    assert(Math.abs(camera.zoom - views[0].zoom) < 0.01);
  }
});

test('narrow hairpins and resize keep the vehicle inside the central frame', () => {
  const { camera, s } = view(70);
  s[2] = Math.PI / 2;
  s[3] = 70;
  s[4] = 0;
  for (let i = 0; i < 240; i++) {
    s[0] += 70 / 60;
    updateCamera(camera, s, 1 / 60, undefined, 1440 / 950);
  }
  let previous = camera.x;
  for (let i = 0; i < 240; i++) {
    s[0] += 70 / 60;
    updateCamera(camera, s, 1 / 60, undefined, 390 / 844);
    assert(Math.abs(camera.x - previous) < 1.6, 'Resize eases the framing');
    previous = camera.x;
  }
  assert(Math.abs(camera.x - s[0]) / (camera.zoom * (390 / 844)) < 0.5);
  assert(camera.zoom < 77, 'Phone keeps the closer scale');
});

test('impacts are damped, stationary terrain adds no motion, and new views reset history', () => {
  const { camera, s } = view();
  settle(camera, s);
  const before = { ...camera };
  s[0] += 2;
  s[9] = 1;
  updateCamera(camera, s, 1 / 60);
  assert(camera.x > before.x && camera.x < before.x + 0.6);
  settle(camera, s);
  const resting = { ...camera };
  settle(camera, s);
  assert(Math.hypot(camera.x - resting.x, camera.y - resting.y) < 0.00001);
  const retry = view();
  settle(retry.camera, retry.s);
  assert(Math.abs(retry.camera.x) < 0.00001);
  assert(Math.abs(retry.camera.zoom - 62) < 0.01);
});

test('invalid input freezes the view and long stalls are bounded without poisoning history', () => {
  const { camera, s } = view(50);
  const before = { ...camera };
  for (const dt of [0, -1, NaN, Infinity]) updateCamera(camera, s, dt);
  for (const aspect of [0, -1, NaN, Infinity]) updateCamera(camera, s, 1 / 60, undefined, aspect);
  for (let field = 0; field < 7; field++) {
    const saved = s[field];
    s[field] = NaN;
    updateCamera(camera, s, 1 / 60);
    s[field] = saved;
  }
  assert.deepEqual(camera, before);
  const shortFrame = view(50);
  updateCamera(camera, s, 10);
  updateCamera(shortFrame.camera, shortFrame.s, 0.05);
  assert.deepEqual(camera, shortFrame.camera);
  settle(camera, s, 4, () => ({ x: NaN, y: Infinity }));
  assert(Object.values(camera).every(Number.isFinite));
});

test('both complete courses retain finite close framing and visible track at every heading', () => {
  try {
    for (const id of ['kasumi', 'beaufort']) {
      selectCourse(id);
      for (const aspect of [1440 / 950, 800 / 600, 390 / 844]) {
        const { camera, s } = view(60);
        for (let d = 0; d <= length + 60; d += 1) {
          const p = atDistance(d);
          s[0] = p.x;
          s[1] = p.y;
          s[2] = p.a;
          s[3] = Math.sin(p.a) * 60;
          s[4] = -Math.cos(p.a) * 60;
          s[8] = d;
          updateCamera(camera, s, 1 / 60, atDistance, aspect);
          assert(Object.values(camera).every(Number.isFinite));
          assert(camera.zoom >= 62 && camera.zoom <= 75);
          assert(Math.abs(s[0] - camera.x) / (camera.zoom * aspect) < 0.65);
          assert(Math.abs(s[1] - camera.y) / camera.zoom < 0.65);
          const ahead = atDistance(d + 32);
          assert(Math.abs(ahead.x - camera.x) / (camera.zoom * aspect) < 0.95);
          assert(Math.abs(ahead.y - camera.y) / camera.zoom < 0.95);
        }
      }
    }
  } finally {
    selectCourse('kasumi');
  }
});
