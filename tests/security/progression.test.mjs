import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProgress } from '../../src/client/progression.js';
const encode = (value) => encodeURIComponent(JSON.stringify(value));
const empty = { version: 1, introSeen: false, best: {} };

test('malformed, oversized and unknown-version cookies are discarded', () => {
  for (const value of [
    undefined,
    '',
    '%E0%A4%A',
    '{}',
    'null',
    'x'.repeat(2049),
    encode({ version: 2, introSeen: true }),
    encode({ version: 1, introSeen: 'false' }),
  ])
    assert.deepEqual(parseProgress(value), empty);
});

test('cookie scores reject executable text, out-of-range and nonnumeric values', () => {
  for (const time of [
    '<img src=x onerror=alert(1)>',
    '20000',
    null,
    {},
    [],
    -1,
    4999,
    3600001,
    5000.1,
  ]) {
    const result = parseProgress(encode({ version: 1, introSeen: true, best: { kasumi: time } }));
    assert.deepEqual(result, { ...empty, introSeen: true });
  }
});

test('cookie schema copies only known course IDs and ignores prototype payloads', () => {
  const input =
    '{"version":1,"introSeen":true,"best":{"kasumi":25000,"unknown":12000,"__proto__":{"polluted":true}},"__proto__":{"polluted":true}}';
  assert.deepEqual(parseProgress(encodeURIComponent(input)), {
    version: 1,
    introSeen: true,
    best: { kasumi: 25000 },
  });
  assert.equal(Object.prototype.polluted, undefined);
});
