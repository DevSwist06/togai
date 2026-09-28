import test from 'node:test';
import assert from 'node:assert/strict';
import { DrivingEffects } from '../../src/client/effects.js';
import { updateCamera } from '../../src/client/camera.js';
import { Mesh } from '../../src/client/renderer.js';
test('drifting creates finite smoke/trails with bounded storage and reset clears effects', () => {
  const fx = new DrivingEffects(),
    mesh = new Mesh(),
    s = new Float64Array(20);
  s[6] = 30;
  s[7] = 0.2;
  s[16] = 30;
  s[17] = 0.2;
  for (let i = 0; i < 1000; i++) {
    mesh.data.length = 0;
    fx.draw(1 / 30, 'race', s, mesh);
    assert(fx.marks.length <= 800);
    assert(fx.smoke.length <= 150);
  }
  assert(fx.smoke.length > 0);
  assert(fx.marks.length > 0);
  assert(mesh.data.every(Number.isFinite));
  const life = fx.smoke[0].life;
  fx.draw(0, 'paused', s, mesh);
  assert.equal(fx.smoke[0].life, life);
  fx.reset();
  assert.equal(fx.smoke.length, 0);
  assert.equal(fx.marks.length, 0);
});
test('stationary/gripping cars produce no drift effects and particles expire', () => {
  const fx = new DrivingEffects(),
    mesh = new Mesh(),
    s = new Float64Array(20);
  fx.draw(1, 'race', s, mesh);
  assert.equal(fx.marks.length, 0);
  s[6] = 20;
  s[7] = 0.2;
  fx.draw(0.05, 'race', s, mesh);
  assert(fx.smoke.length > 0);
  s[6] = 0;
  fx.draw(8, 'race', s, mesh);
  assert.equal(fx.smoke.length, 0);
  assert.equal(fx.marks.length, 0);
});
test('camera eases toward the car, looks ahead and widens at speed', () => {
  const camera = { x: 0, y: 0, zoom: 83 },
    s = new Float64Array(20);
  s[0] = 50;
  s[1] = -100;
  s[6] = 30;
  updateCamera(camera, s, 0);
  assert.deepEqual(camera, { x: 0, y: 0, zoom: 83 });
  updateCamera(camera, s, 0.016);
  assert(camera.x > 0 && camera.x < 50);
  assert(camera.y < 0 && camera.y > -140);
  assert(camera.zoom > 83);
  assert(Object.values(camera).every(Number.isFinite));
});
