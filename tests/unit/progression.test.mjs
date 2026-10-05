import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES, createProgression, PROGRESS_COOKIE } from '../../src/client/progression.js';

function cookieJar() {
  let value = '';
  return {
    writes: [],
    get cookie() {
      return value;
    },
    set cookie(cookie) {
      this.writes.push(cookie);
      value = cookie.split(';')[0];
    },
  };
}
const COURSE_ID = COURSES.find((course) => course.id === 'kasumi')?.id ?? COURSES[0].id;
const location = { href: 'https://example.com/togai/index.html', protocol: 'https:' };

test('intro and fastest winning time survive a new visit, with ties and slower wins unchanged', () => {
  const jar = cookieJar();
  const progress = createProgression(jar, location);
  assert.equal(progress.introSeen, false);
  assert.equal(progress.bestTime(COURSE_ID), null);
  progress.completeIntro();
  assert.equal(progress.recordWin(COURSE_ID, 40.1234), true);
  assert.equal(progress.recordWin(COURSE_ID, 50), false);
  assert.equal(progress.recordWin(COURSE_ID, 40.123), false);
  assert.equal(progress.recordWin(COURSE_ID, 30.001), true);
  const restored = createProgression(jar, location);
  assert.equal(restored.introSeen, true);
  assert.equal(restored.bestTime(COURSE_ID), 30001);
  assert.equal(progress.saved, true);
  assert.match(jar.writes.at(-1), /Max-Age=31536000; Path=\/togai\/; SameSite=Lax; Secure$/);
});

test('root HTTP cookies work locally and do not add a domain', () => {
  const jar = cookieJar();
  createProgression(jar, { href: 'http://localhost:5173/', protocol: 'http:' }).completeIntro();
  assert.match(jar.writes[0], /Path=\/; SameSite=Lax$/);
  assert.doesNotMatch(jar.writes[0], /Domain=/);
});

test('other tabs refresh the intro and merge better scores before writing', () => {
  const jar = cookieJar();
  const first = createProgression(jar, location);
  const second = createProgression(jar, location);
  first.completeIntro();
  first.recordWin(COURSE_ID, 20);
  assert.equal(second.introSeen, true);
  assert.equal(second.recordWin(COURSE_ID, 30), false);
  assert.equal(createProgression(jar, location).bestTime(COURSE_ID), 20000);
});

test('unavailable or silently blocked cookies keep this visit playable', () => {
  for (const jar of [
    {
      get cookie() {
        throw new Error('blocked');
      },
      set cookie(value) {
        throw new Error(value);
      },
    },
    {
      get cookie() {
        return '';
      },
      set cookie(value) {
        void value;
      },
    },
  ]) {
    const progress = createProgression(jar, location);
    progress.completeIntro();
    progress.recordWin(COURSE_ID, 20);
    assert.equal(progress.introSeen, true);
    assert.equal(progress.bestTime(COURSE_ID), 20000);
    assert.equal(progress.saved, false);
  }
});

test('unrelated cookies are ignored and invalid results never write', () => {
  const jar = cookieJar();
  jar.cookie = `other_${PROGRESS_COOKIE}=bad`;
  const progress = createProgression(jar, location);
  for (const time of [null, '20', NaN, Infinity, -1, 0, 4.99, 3601])
    assert.equal(progress.recordWin(COURSE_ID, time), false);
  assert.equal(progress.recordWin('__proto__', 20), false);
  assert.equal(jar.writes.length, 1);
  assert.equal(progress.recordWin(COURSE_ID, 3600), true);
  assert.equal(progress.recordWin(COURSE_ID, 5), true);
});

test('each discovered course keeps a separate winning time', () => {
  assert.ok(COURSES.length >= 2);
  const jar = cookieJar();
  const progress = createProgression(jar, location);
  const [first, second] = COURSES;
  progress.recordWin(first.id, 32);
  progress.recordWin(second.id, 48);
  const restored = createProgression(jar, location);
  assert.equal(restored.bestTime(first.id), 32000);
  assert.equal(restored.bestTime(second.id), 48000);
});
