import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClockRecord } from '../../src/client/clock-progress.js';
import { encodeGhost } from '../../src/client/time-trial.js';

const ghost = encodeGhost(
  [
    { x: 0, y: 0, a: 0 },
    { x: 3, y: -3, a: 0.3 },
  ],
  12,
);
const encode = (value) => encodeURIComponent(JSON.stringify(value));

test('clock cookies reject malformed records and retain only a valid bounded ghost', () => {
  for (const value of [
    undefined,
    '',
    '%bad',
    'x'.repeat(4001),
    encode({ version: 2, time: 12000, ghost }),
    encode({ version: 1, time: '<img>', ghost }),
    encode({ version: 1, time: 12000, ghost: 'not-a-ghost' }),
  ])
    assert.equal(parseClockRecord(value), null);
  const record = parseClockRecord(encode({ version: 1, time: 12000, ghost }));
  assert.equal(record.time, 12000);
  assert.equal(record.ghost.samples.length, 2);
});
