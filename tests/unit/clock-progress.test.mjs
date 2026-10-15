import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOCK_COOKIE_PREFIX, createClockProgress } from '../../src/client/clock-progress.js';
import { COURSES, PROGRESS_COOKIE } from '../../src/client/progression.js';
import { interpolateGhost } from '../../src/client/time-trial.js';

function cookieJar() {
  const values = new Map();
  return {
    writes: [],
    get cookie() {
      return [...values.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
    },
    set cookie(cookie) {
      this.writes.push(cookie);
      const [name, value] = cookie.split(';')[0].split('=');
      values.set(name, value);
    },
  };
}
const location = { href: 'https://example.com/togai/index.html', protocol: 'https:' };
const course = COURSES[0];
const samples = [
  { x: 0, y: 0, a: 0 },
  { x: 4, y: -4, a: 0.4 },
];

test('clock records persist separately, retain the fastest time and replace its ghost', () => {
  const jar = cookieJar();
  jar.cookie = `${PROGRESS_COOKIE}=takeover-data`;
  const records = createClockProgress(jar, location);
  assert.equal(records.bestTime(course.id), null);
  assert.equal(records.recordRun(course.id, 20, samples, 40), true);
  const firstGhost = records.ghost(course.id);
  assert(firstGhost);
  assert.equal(firstGhost.samples.length, samples.length);
  assert.deepEqual(interpolateGhost(firstGhost, 0), firstGhost.samples[0]);
  assert.deepEqual(createClockProgress(jar, location).ghost(course.id), firstGhost);
  assert.equal(records.recordRun(course.id, 25, samples, 40), false);
  assert.equal(records.bestTime(course.id), 20000);
  assert.equal(records.ghost(course.id), firstGhost);
  assert.equal(
    records.recordRun(
      course.id,
      15,
      [
        { x: 0, y: 0, a: 0 },
        { x: 8, y: -8, a: 0.8 },
      ],
      40,
    ),
    true,
  );
  assert.equal(records.bestTime(course.id), 15000);
  assert.notDeepEqual(records.ghost(course.id), firstGhost);
  assert(jar.writes.at(-1).startsWith(`${CLOCK_COOKIE_PREFIX}${course.id}=`));
  assert.equal(createClockProgress(jar, location).bestTime(course.id), 15000);
  assert.equal(jar.cookie.includes(`${PROGRESS_COOKIE}=takeover-data`), true);
});
