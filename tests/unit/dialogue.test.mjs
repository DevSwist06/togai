import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RivalVoice } from '../../src/client/dialogue.js';

test('voice schedules bounded syllables, ignores punctuation, mutes and reuses its graph', () => {
  const notes = [];
  const levels = [];
  let created = 0;
  const parameter = (values) => ({
    value: 0,
    setValueAtTime: (value) => values.push(value),
    linearRampToValueAtTime: (value) => values.push(value),
    exponentialRampToValueAtTime: (value) => values.push(value),
    cancelScheduledValues: () => {},
  });
  const voice = new RivalVoice(() => {
    created++;
    return {
      currentTime: 0,
      destination: {},
      resume: () => Promise.resolve(),
      createOscillator: () => ({ frequency: parameter(notes), connect() {}, start() {} }),
      createGain: () => ({ gain: parameter(levels), connect() {} }),
    };
  });
  voice.speak('a');
  assert.equal(notes.length, 0);
  voice.unlock();
  voice.unlock();
  assert.equal(created, 1);
  voice.speak('a');
  voice.speak('b');
  assert.notEqual(notes[0], notes[2]);
  assert.equal(levels.at(-1), 0);
  assert.ok(Math.max(...levels) <= 0.045);
  const count = notes.length;
  voice.speak(' ');
  voice.speak('.');
  voice.enabled = false;
  voice.stop();
  voice.speak('c');
  assert.equal(notes.length, count);
  assert.equal(levels.at(-1), 0);
});

test('unavailable audio does not block dialogue or retry context creation', () => {
  let attempts = 0;
  const voice = new RivalVoice(() => {
    attempts++;
    throw new Error('Unavailable');
  });
  voice.unlock();
  voice.speak('a');
  voice.unlock();
  voice.stop();
  assert.equal(attempts, 1);
  assert.equal(voice.failed, true);
});

test('rejected audio resume is handled without an unhandled rejection', async () => {
  const voice = new RivalVoice();
  voice.context = { resume: () => Promise.reject(new Error('Blocked')) };
  voice.unlock();
  await Promise.resolve();
  assert.equal(voice.failed, true);
});
