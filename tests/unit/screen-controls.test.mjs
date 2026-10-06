import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRIFT_DISTANCE,
  brakeBoundary,
  createScreenGestureController,
  screenInput,
  startScreenGesture,
} from '../../src/client/screen-controls.js';

test('screen control steers from the starting side and ramps into handbrake', () => {
  for (const [x, steer] of [
    [20, -1],
    [380, 1],
  ]) {
    const gesture = startScreenGesture(x, 200, 400, 600);
    assert.deepEqual(screenInput(gesture, 200), { throttle: 1, steer, brake: 0, handbrake: 0 });
    assert.deepEqual(screenInput(gesture, 240), { throttle: 0.5, steer, brake: 0, handbrake: 0 });
    assert.deepEqual(screenInput(gesture, 200 + DRIFT_DISTANCE), {
      throttle: 0,
      steer,
      brake: 0,
      handbrake: 1,
    });
    assert.deepEqual(screenInput(gesture, 220), { throttle: 0.75, steer, brake: 0, handbrake: 0 });
  }
});

test('bottom touch brakes and gestures keep their starting command', () => {
  const brake = startScreenGesture(200, 601, 400, 600);
  assert.deepEqual(screenInput(brake, 100), { throttle: 0, steer: 0, brake: 1, handbrake: 0 });
  const turn = startScreenGesture(10, 550, 400, 600);
  assert.equal(screenInput(turn, 650).steer, -1);
  assert.equal(screenInput(null, 650).throttle, 1);
});

test('only the first driving finger controls the car until all fingers lift', () => {
  const controls = createScreenGestureController();
  assert.equal(controls.start(1, 20, 100, 400, 600, true), true);
  assert.equal(controls.start(2, 380, 100, 400, 600, true), false);
  controls.move(2, 200);
  assert.equal(controls.input.steer, -1);
  controls.end(1);
  assert.equal(controls.input.throttle, 1);
  assert.equal(controls.start(3, 380, 100, 400, 600, true), false);
  controls.end(2);
  controls.end(3);
  assert.equal(controls.start(4, 380, 100, 400, 600, true), true);
  assert.equal(controls.input.steer, 1);
  controls.clear();
  assert.equal(controls.input.steer, 0);
});

test('invalid gesture geometry safely returns untouched acceleration', () => {
  for (const args of [
    [NaN, 10, 400, 600],
    [10, 10, 0, 600],
    [10, 10, 400, NaN],
  ])
    assert.equal(startScreenGesture(...args), null);
  assert.equal(screenInput({ command: 'left', startY: 0 }, NaN).steer, 0);
});

test('brake boundary projects below the car and leaves a usable bottom zone', () => {
  const camera = { y: 100, zoom: 80 };
  const straight = brakeBoundary({ y: 100, heading: 0 }, camera, 800);
  assert.equal(straight, 640);
  assert.equal(brakeBoundary({ y: 160, heading: 0 }, camera, 800) > straight, true);
  assert.equal(brakeBoundary({ y: 200, heading: 0 }, camera, 800), 756);
  assert.equal(brakeBoundary({ y: -200, heading: 0 }, camera, 800), 640);
  assert.equal(
    brakeBoundary({ y: 160, heading: Math.PI / 2 }, camera, 800) <
      brakeBoundary({ y: 160, heading: 0 }, camera, 800),
    true,
  );
  assert.equal(brakeBoundary({ y: NaN, heading: 0 }, camera, 800), null);
});
