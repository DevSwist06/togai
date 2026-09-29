import test from 'node:test';
import assert from 'node:assert/strict';
import { joystickInput } from '../../src/client/joystick.js';

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
