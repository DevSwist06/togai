import { COURSES } from './progression.js';
import { decodeGhost, encodeGhost, GHOST_MAX_ENCODED_LENGTH } from './time-trial.js';
export const CLOCK_COOKIE_PREFIX = 'togai_clock_';
const MAX_AGE = 60 * 60 * 24 * 365;
const validTime = (time) => Number.isSafeInteger(time) && time >= 5000 && time <= 3_600_000;
const knownCourse = (id) => COURSES.some((course) => course.id === id);

export function parseClockRecord(value) {
  if (typeof value !== 'string' || value.length > GHOST_MAX_ENCODED_LENGTH) return null;
  try {
    const record = JSON.parse(decodeURIComponent(value));
    if (record?.version !== 1 || !validTime(record.time)) return null;
    const ghost = typeof record.ghost === 'string' ? decodeGhost(record.ghost) : null;
    if (record.ghost !== undefined && !ghost) return null;
    return { time: record.time, ghost };
  } catch {
    return null;
  }
}

export function createClockProgress(document, location) {
  const path = new URL('.', location.href).pathname;
  const records = new Map();
  let saved = true;
  function read(id) {
    try {
      const name = `${CLOCK_COOKIE_PREFIX}${id}=`;
      const cookie = document.cookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(name));
      return parseClockRecord(cookie?.slice(name.length));
    } catch {
      return null;
    }
  }
  function refresh(id) {
    const stored = read(id);
    const current = records.get(id);
    if (stored && (!current || stored.time < current.time)) records.set(id, stored);
  }
  function persist(id, record, encodedGhost) {
    const value = encodeURIComponent(
      JSON.stringify({
        version: 1,
        time: record.time,
        ...(encodedGhost ? { ghost: encodedGhost } : {}),
      }),
    );
    try {
      document.cookie = `${CLOCK_COOKIE_PREFIX}${id}=${value}; Max-Age=${MAX_AGE}; Path=${path}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      const confirmed = read(id);
      saved = !!confirmed && confirmed.time === record.time;
    } catch {
      saved = false;
    }
  }
  return {
    get saved() {
      return saved;
    },
    bestTime(id) {
      if (!knownCourse(id)) return null;
      refresh(id);
      return records.get(id)?.time ?? null;
    },
    ghost(id) {
      if (!knownCourse(id)) return null;
      refresh(id);
      return records.get(id)?.ghost ?? null;
    },
    recordRun(id, seconds, samples, intervalTicks) {
      const time = Math.round(seconds * 1000);
      if (!knownCourse(id) || !validTime(time)) return false;
      refresh(id);
      if (time >= (records.get(id)?.time ?? Infinity)) return false;
      const encodedGhost = encodeGhost(samples, seconds, intervalTicks);
      const record = { time, ghost: encodedGhost ? decodeGhost(encodedGhost) : null };
      records.set(id, record);
      persist(id, record, encodedGhost);
      return true;
    },
  };
}
