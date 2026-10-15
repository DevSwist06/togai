import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGhostRecorder,
  decodeGhost,
  encodeGhost,
  GHOST_MAX_ENCODED_LENGTH,
  GHOST_INTERVAL_TICKS,
  GHOST_MAX_SAMPLES,
  interpolateGhost,
} from '../../src/client/time-trial.js';

test('packed ghosts restore a bounded trajectory and interpolate by race elapsed time', () => {
  const encoded = encodeGhost(
    [
      { x: 1.04, y: -2.06, a: 3.1 },
      { x: 4.96, y: -5.04, a: -3.1 },
      { x: 9, y: -8, a: -2.8 },
    ],
    5.1,
  );
  const ghost = decodeGhost(encoded);
  assert.equal(ghost.intervalTicks, GHOST_INTERVAL_TICKS);
  assert.equal(ghost.finishSeconds, 5.1);
  assert.deepEqual(ghost.samples[0], { x: 1, y: -2.1, a: ghost.samples[0].a });
  const point = interpolateGhost(ghost, GHOST_INTERVAL_TICKS / 240);
  assert(point.x > 2.9 && point.x < 3.1);
  assert(Math.abs(Math.abs(point.a) - Math.PI) < 0.2);
  assert.equal(interpolateGhost(ghost, 5.2), null);
});

test('ghost recorder bounds a long run by thinning samples without losing its endpoints', () => {
  const recorder = createGhostRecorder();
  const state = [0, 0, 0];
  recorder.reset(state);
  for (
    let tick = GHOST_INTERVAL_TICKS;
    tick < GHOST_INTERVAL_TICKS * (GHOST_MAX_SAMPLES + 40);
    tick += GHOST_INTERVAL_TICKS
  ) {
    state[0] = tick / 10;
    state[1] = -tick / 20;
    state[2] = tick / 200;
    recorder.sample(tick / 120, state);
  }
  const recorded = recorder.finish((GHOST_INTERVAL_TICKS * (GHOST_MAX_SAMPLES + 40)) / 120, state);
  assert(recorded.samples.length <= GHOST_MAX_SAMPLES);
  assert.equal(recorded.samples[0].x, 0);
  assert.equal(recorded.samples.at(-1).x, state[0]);
  assert(recorded.intervalTicks > GHOST_INTERVAL_TICKS);
});

test('malformed, oversized and out-of-bounds ghosts are discarded', () => {
  for (const value of ['', 'not base64!', 'x'.repeat(GHOST_MAX_ENCODED_LENGTH + 1)])
    assert.equal(decodeGhost(value), null);
  assert.equal(encodeGhost([{ x: 0, y: 0, a: 0 }], 10), null);
  assert.equal(
    encodeGhost(
      [
        { x: 4000, y: 0, a: 0 },
        { x: 0, y: 0, a: 0 },
      ],
      10,
    ),
    null,
  );
});
