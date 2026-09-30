import test from 'node:test';
import assert from 'node:assert/strict';
import { followHeading, headingAlignedInput, joystickInput } from '../../src/client/joystick.js';

test('joystick maps vertical and horizontal drag to analog driving', () => {
  assert.deepEqual(joystickInput(0, -50, 50), {
    x: 0,
    y: -1,
    throttle: 1,
    steer: 0,
    brake: 0,
    handbrake: 0,
  });
  const corner = joystickInput(30, -40, 50);
  assert.equal(corner.throttle, 0.8);
  assert.equal(corner.steer, 0.6);
  assert.equal(corner.brake, 0);
  assert.equal(joystickInput(0, 50, 50).brake, 1);
});

test('joystick has a neutral zone, circular limit, and diagonal handbrake', () => {
  assert.equal(joystickInput(5, -5, 50).throttle, 0);
  assert.equal(joystickInput(5, -5, 50).steer, 0);
  const drift = joystickInput(-100, 100, 50);
  assert.equal(Math.hypot(drift.x, drift.y), 1);
  assert.equal(drift.handbrake, 1);
  assert.equal(drift.brake, 0);
  assert.equal(drift.steer < 0, true);
});

test('invalid joystick geometry releases all controls', () => {
  for (const [x, y, radius] of [
    [Infinity, 0, 50],
    [0, NaN, 50],
    [10, 10, 0],
  ]) {
    const input = joystickInput(x, y, radius);
    assert.deepEqual(input, { x: 0, y: 0, throttle: 0, steer: 0, brake: 0, handbrake: 0 });
  }
});

test('heading-aligned joystick keeps forward stick as straight ahead relative to car heading', () => {
  const facingRight = headingAlignedInput({ x: 1, y: 0 }, Math.PI / 2);
  assert.equal(facingRight.throttle > 0.99, true);
  assert.equal(facingRight.steer, 0);
  const facingUp = headingAlignedInput({ x: 1, y: 0 }, 0);
  assert.equal(facingUp.throttle < 0.01, true);
  assert.equal(facingUp.steer > 0.99, true);
});

test('heading follower delays car turns while using the shortest path across the angle seam', () => {
  const delayed = followHeading(0, Math.PI / 2, 1 / 120);
  assert.equal(delayed > 0 && delayed < Math.PI / 2, true);
  const settled = Array.from({ length: 120 }).reduce(
    (heading) => followHeading(heading, Math.PI / 2, 1 / 120),
    delayed,
  );
  assert.equal(Math.abs(settled - Math.PI / 2) < 0.02, true);
  const acrossSeam = followHeading(Math.PI - 0.01, -Math.PI + 0.01, 1 / 120);
  assert.equal(acrossSeam > Math.PI - 0.01, true);
});

test('heading follower safely holds its last valid heading when its target is invalid', () => {
  assert.equal(followHeading(0.4, NaN, 1 / 120), 0.4);
  assert.equal(followHeading(NaN, 0.4, 1 / 120), 0.4);
});

test('heading-aligned joystick falls back safely when heading is invalid', () => {
  assert.deepEqual(
    headingAlignedInput({ throttle: 0.4, steer: -0.2, brake: 0.1, handbrake: 1 }, NaN),
    {
      throttle: 0.4,
      steer: -0.2,
      brake: 0.1,
      handbrake: 1,
    },
  );
});
