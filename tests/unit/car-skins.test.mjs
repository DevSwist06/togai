import test from 'node:test';
import assert from 'node:assert/strict';
import { CAR_SKINS, getCarSkin } from '../../src/client/car-skins.js';
import { Mesh, drawCar, color } from '../../src/client/renderer.js';
import { DrivingEffects } from '../../src/client/effects.js';

test('skin catalogue preserves the original car and defaults unknown selections safely', () => {
  assert.equal(new Set(CAR_SKINS.map((skin) => skin.id)).size, 2);
  for (const id of [undefined, null, '', '__proto__', 'draw', {}, 'PEUGEOT-206-CC'])
    assert.equal(getCarSkin(id), CAR_SKINS[0]);
  const original = new Mesh(),
    classic = new Mesh();
  drawCar(original, 3, 4, 0.8, color('f88456'), -1);
  getCarSkin('classic').draw(classic, 3, 4, 0.8, -1);
  assert.deepEqual(classic.data, original.data);
});

test('Peugeot has red bodywork, an open cabin and bounded geometry at steering extremes', () => {
  const skin = getCarSkin('peugeot-206-cc');
  assert.equal(skin.name, 'Peugeot 206 CC');
  for (const angle of [0, Math.PI / 2, Math.PI, -0.7]) {
    for (const steer of [-1, 0, 1]) {
      const mesh = new Mesh();
      skin.draw(mesh, 10, -20, angle, steer);
      assert(mesh.data.every(Number.isFinite));
      assert.equal(mesh.data.length % 18, 0);
      assert(mesh.data.length < 5000, 'car fits within the dynamic geometry budget');
      let red = false,
        cockpit = false;
      for (let i = 0; i < mesh.data.length; i += 6) {
        assert(Math.hypot(mesh.data[i] - 10, mesh.data[i + 1] + 20) < 3.5);
        const rgb = mesh.data.slice(i + 2, i + 5);
        if (rgb.every((v, k) => v === color('d92d38')[k])) red = true;
        if (rgb.every((v, k) => v === color('182728')[k])) cockpit = true;
      }
      assert(red && cockpit);
    }
  }
});

test('selected skin changes only the player geometry and leaves state and rival intact', () => {
  const state = new Float64Array(20);
  state[10] = 30;
  const before = state.slice();
  const fx = new DrivingEffects(),
    original = new Mesh(),
    peugeot = new Mesh(),
    rival = new Mesh();
  drawCar(rival, 30, 0, 0, color('b9d2cd'), 0);
  fx.draw(0, 'paused', state, original);
  fx.draw(0, 'paused', state, peugeot, getCarSkin('peugeot-206-cc'));
  assert.deepEqual(peugeot.data.slice(0, rival.data.length), rival.data);
  assert.notDeepEqual(
    peugeot.data.slice(rival.data.length),
    original.data.slice(rival.data.length),
  );
  assert.deepEqual(state, before);
  fx.reset();
  const restarted = new Mesh();
  fx.draw(0, 'countdown', state, restarted, getCarSkin('peugeot-206-cc'));
  assert.deepEqual(restarted.data, peugeot.data);
});
