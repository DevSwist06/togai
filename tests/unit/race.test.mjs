import test from 'node:test';
import assert from 'node:assert/strict';
import { Race, STEP, FINISH_DISTANCE, readInput, formatTime } from '../../src/client/race.js';
import { physics } from '../helpers.mjs';
import { aiInput } from '../../src/client/track.js';
const idle = { throttle: 0, steer: 0, brake: 0, handbrake: 0 };
async function setup() {
  const { wasm, state } = await physics();
  return new Race(wasm, state);
}
test('keyboard aliases, simultaneous steering, and handbrake', () => {
  assert.deepEqual(readInput(new Set()), idle);
  assert.deepEqual(readInput(new Set(['KeyW', 'KeyD', 'KeyS', 'Space'])), {
    throttle: 1,
    steer: 1,
    brake: 1,
    handbrake: 1,
  });
  assert.deepEqual(readInput(new Set(['ArrowUp', 'ArrowLeft', 'ArrowDown'])), {
    throttle: 1,
    steer: -1,
    brake: 1,
    handbrake: 0,
  });
  assert.equal(readInput(new Set(['KeyA', 'ArrowRight'])).steer, 0);
});
test('time formatting carries milliseconds over minute boundaries', () => {
  assert.equal(formatTime(0), '00:00.000');
  assert.equal(formatTime(70.4), '01:10.400');
  assert.equal(formatTime(59.9999), '01:00.000');
});
test('intro is inert; countdown freezes cars then starts the race', async () => {
  const r = await setup();
  r.tick(idle);
  assert.equal(r.phase, 'intro');
  r.reset();
  for (let i = 0; i < 383; i++) r.tick({ ...idle, throttle: 1 });
  assert.equal(r.phase, 'countdown');
  assert.equal(r.state[6], 0);
  for (let i = 0; i < 3; i++) r.tick(idle);
  assert.equal(r.phase, 'race');
  assert(r.elapsed < STEP * 3);
});
test('pause/resume preserves countdown and race timing; restart clears all race state', async () => {
  const r = await setup();
  r.reset();
  r.tick(idle);
  const count = r.count;
  r.pause();
  r.tick(idle);
  assert.equal(r.count, count);
  r.resume();
  assert.equal(r.phase, 'countdown');
  r.phase = 'race';
  r.tick(idle);
  r.pause();
  const elapsed = r.elapsed;
  r.tick(idle);
  assert.equal(r.elapsed, elapsed);
  r.resume();
  assert.equal(r.phase, 'race');
  r.driftTime = 5;
  r.overtakeTime = 4;
  r.rivalFinish = 3;
  r.reset();
  assert.equal(r.driftTime, 0);
  assert.equal(r.elapsed, 0);
  assert.equal(r.overtakeTime, null);
  assert.equal(r.rivalFinish, null);
});
test('overtaking wins immediately, while an exact tie does not', async () => {
  const r = await setup();
  r.reset();
  r.phase = 'race';
  // Stub only motion here to isolate overtake boundary semantics.
  r.wasm = { step() {}, resolveCars() {} };
  r.state[8] = 40;
  r.state[18] = 40;
  r.tick(idle);
  assert.equal(r.phase, 'race');
  assert.equal(r.won, false);
  r.state[8] = 40.01;
  r.tick(idle);
  assert.equal(r.phase, 'finished');
  assert.equal(r.won, true);
  assert.equal(r.overtakeTime, STEP * 2);
  const t = r.elapsed;
  r.tick(idle);
  assert.equal(r.elapsed, t);
  r.pause();
  assert.equal(r.phase, 'finished');
});
test('rival reaching the finish ends the run and records drift only at speed', async () => {
  const r = await setup();
  r.reset();
  r.phase = 'race';
  r.wasm = { step() {}, resolveCars() {} };
  r.state[18] = FINISH_DISTANCE;
  r.state[6] = 12;
  r.state[7] = 0.15;
  r.tick(idle);
  assert.equal(r.phase, 'finished');
  assert.equal(r.rivalFinish, STEP);
  assert.equal(r.driftTime, STEP);
  r.state[6] = 0;
  r.tick(idle);
  assert.equal(r.driftTime, STEP);
});
test('full two-car race completes when the player overtakes through the real WASM lifecycle', async () => {
  const r = await setup();
  r.reset();
  const copy = new Float64Array(20);
  for (let i = 0; i < 120 * 110 && r.phase !== 'finished'; i++) {
    copy.set(r.state);
    copy.set(r.state.subarray(0, 10), 10);
    const input = aiInput(copy);
    r.tick({ throttle: 1, steer: input.steer, brake: 0, handbrake: 0 });
  }
  assert.equal(r.phase, 'finished');
  assert.equal(r.won, true);
  assert(r.overtakeTime > 0 && r.overtakeTime < 100);
  assert([...r.state].every(Number.isFinite));
});
