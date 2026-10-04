import test from 'node:test';
import assert from 'node:assert/strict';
import { track, length, aiInput } from '../../src/client/track.js';
import { physics } from '../helpers.mjs';
import { STEP } from '../../src/client/race.js';
test('reset starts a stationary player 18 m behind the stationary rival', async () => {
  const { wasm: w, state: s } = await physics();
  assert.equal(s[6], 0);
  assert.equal(s[16], 0);
  assert.equal(Math.round(Math.hypot(s[0] - s[10], s[1] - s[11])), 18);
  assert(s[11] < s[1]);
  w.step(0, 1, 0, 0, 0, STEP);
  w.reset(0, 0, track[0].a);
  assert.equal(s[8], 0);
  assert.equal(s[18], 0);
  assert.equal(s[6], 0);
});
test('acceleration moves down the pass and braking stops the car', async () => {
  const { wasm: w, state: s } = await physics();
  for (let i = 0; i < 240; i++) w.step(0, 1, 0, 0, 0, STEP);
  assert(s[6] > 20 && s[6] < 30);
  assert(s[8] > 20);
  const speed = s[6];
  for (let i = 0; i < 120; i++) w.step(0, 0, 0, 1, 0, STEP);
  assert(s[6] < speed * 0.1);
});
test('forgiving handbrake keeps a controllable drift compared with normal grip', async () => {
  const { wasm: w, state: s } = await physics();
  function slip(handbrake) {
    w.reset(0, 0, track[0].a);
    for (let i = 0; i < 180; i++) w.step(0, 1, 0, 0, 0, STEP);
    for (let i = 0; i < 30; i++) w.step(0, 1, 1, 0, handbrake, STEP);
    return Math.abs(s[7]);
  }
  const grip = slip(0),
    drift = slip(1);
  assert(drift > grip * 1.15);
});
test('powered rival drifts through bends and finishes quickly without barrier contact', async () => {
  const { wasm: w, state: s } = await physics();
  let time = 0,
    hits = 0,
    maxSpeed = 0,
    driftTime = 0,
    handbrakeTime = 0;
  while (s[18] < length - 14 && time < 120) {
    const a = aiInput(s);
    w.step(1, a.throttle, a.steer, a.brake, a.handbrake, STEP);
    if (s[19] > 0.99) hits++;
    maxSpeed = Math.max(maxSpeed, s[16]);
    if (s[16] > 8 && Math.abs(s[17]) > 0.085) driftTime += STEP;
    if (a.handbrake) handbrakeTime += STEP;
    time += STEP;
    assert([...s].every(Number.isFinite));
  }
  assert(time > 50 && time < 55, `AI finish: ${time}s`);
  assert(maxSpeed > 49, `AI top speed: ${maxSpeed}m/s`);
  assert(driftTime > 25, `AI drift time: ${driftTime}s`);
  assert(handbrakeTime > 20, `AI handbrake time: ${handbrakeTime}s`);
  assert.equal(hits, 0);
});
test('5,000 steps of aggressive driving stay finite and inside guardrails', async () => {
  const { wasm: w, state: s } = await physics();
  for (let i = 0; i < 5000; i++) {
    w.step(0, 1, Math.sin(i / 130), 0, i % 120 < 30 ? 1 : 0, STEP);
    assert([...s].every(Number.isFinite));
    let nearest = Infinity;
    for (const p of track) nearest = Math.min(nearest, Math.hypot(s[0] - p.x, s[1] - p.y));
    assert(nearest < 12);
  }
});
test('contact separates cars and transfers closing velocity', async () => {
  const { wasm: w, state: s } = await physics();
  s[0] = 0;
  s[1] = -20;
  s[10] = 1;
  s[11] = -20;
  s[3] = 10;
  w.resolveCars();
  assert(Math.hypot(s[0] - s[10], s[1] - s[11]) >= 3.09);
  assert(s[3] < 10);
  assert(s[13] > 0);
});
