import test from 'node:test';
import assert from 'node:assert/strict';
import { physics } from '../helpers.mjs';
test('invalid WASM inputs cannot corrupt state or grow memory', async () => {
  const { wasm, state } = await physics();
  const baseline = [...state],
    bytes = wasm.memory.buffer.byteLength;
  for (const car of [-1, 2, 2147483647]) wasm.step(car, 1, 0, 0, 0, 1 / 120);
  for (const dt of [NaN, Infinity, -1, 0, 100]) wasm.step(0, 1, 0, 0, 0, dt);
  for (const bad of [NaN, Infinity, -Infinity]) {
    wasm.step(0, bad, 0, 0, 0, 1 / 120);
    wasm.reset(bad, 0, 0);
    wasm.setPoint(0, bad, 0, 0);
  }
  for (const i of [-1, 2048, 2147483647]) wasm.setPoint(i, 0, 0, 0);
  assert.deepEqual([...state], baseline);
  assert.equal(wasm.memory.buffer.byteLength, bytes);
  wasm.step(0, 1, 0, 0, 0, 1 / 120);
  assert([...state].every(Number.isFinite));
});
test('overlapping cars separate without dividing by zero', async () => {
  const { wasm, state } = await physics();
  state[10] = state[0];
  state[11] = state[1];
  wasm.resolveCars();
  assert([...state].every(Number.isFinite));
  assert(Math.hypot(state[10] - state[0], state[11] - state[1]) >= 3.09);
});

test('invalid surface records are rejected without changing motion or allocating memory', async () => {
  const { wasm, state } = await physics();
  const control = await physics();
  const bytes = wasm.memory.buffer.byteLength;
  for (const i of [-1, 1, 64, 2147483647]) wasm.setSurface(i, 0, 0, 20, 30, 0, 2);
  for (const bad of [NaN, Infinity, -Infinity, 10001, -10001]) {
    wasm.setSurface(0, bad, 0, 20, 30, 0, 2);
    wasm.setSurface(0, 0, bad, 20, 30, 0, 2);
  }
  for (const r of [NaN, Infinity, -1, 0, 31]) wasm.setSurface(0, 0, 0, r, 30, 0, 2);
  for (const kind of [-1, 0, 3, 2147483647]) wasm.setSurface(0, 0, 0, 20, 30, 0, kind);
  for (const bad of [NaN, Infinity, -Infinity, -1, 0, 61]) wasm.setSurface(0, 0, 0, 20, bad, 0, 2);
  for (const bad of [NaN, Infinity, -Infinity, 101]) wasm.setSurface(0, 0, 0, 20, 30, bad, 2);
  for (const bad of [NaN, Infinity, -1, 0, 0.9, 2.1]) wasm.setCourseSpeed(bad);
  for (let i = 0; i < 120; i++) {
    wasm.step(0, 1, 0, 0, 0, 1 / 120);
    control.wasm.step(0, 1, 0, 0, 0, 1 / 120);
  }
  assert.deepEqual([...state], [...control.state]);
  assert.equal(wasm.memory.buffer.byteLength, bytes);
});
