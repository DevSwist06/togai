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
