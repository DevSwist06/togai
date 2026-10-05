import { courses } from './track.js';
export const COURSES = Object.values(courses).map(({ id, name }) => ({ id, name }));
export const PROGRESS_COOKIE = 'togai_progress';
const MAX_AGE = 60 * 60 * 24 * 365;
const empty = () => ({ version: 1, introSeen: false, best: {} });
const validTime = (time) => Number.isSafeInteger(time) && time >= 5000 && time <= 3_600_000;

// Cookies are editable input. Copy only known fields and bounded integer scores.
export function parseProgress(value) {
  if (typeof value !== 'string' || value.length > 2048) return empty();
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    if (parsed?.version !== 1 || typeof parsed.introSeen !== 'boolean') return empty();
    const progress = empty();
    progress.introSeen = parsed.introSeen;
    for (const { id } of COURSES) {
      if (validTime(parsed.best?.[id])) progress.best[id] = parsed.best[id];
    }
    return progress;
  } catch {
    return empty();
  }
}

export function createProgression(document, location) {
  const path = new URL('.', location.href).pathname;
  const progress = empty();
  let saved = true;
  function read() {
    try {
      const cookie = document.cookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${PROGRESS_COOKIE}=`));
      return parseProgress(cookie?.slice(PROGRESS_COOKIE.length + 1));
    } catch {
      return empty();
    }
  }
  function refresh() {
    const stored = read();
    progress.introSeen ||= stored.introSeen;
    for (const { id } of COURSES) {
      if (stored.best[id] !== undefined)
        progress.best[id] = Math.min(progress.best[id] ?? Infinity, stored.best[id]);
    }
  }
  function persist() {
    const value = encodeURIComponent(JSON.stringify(progress));
    try {
      document.cookie = `${PROGRESS_COOKIE}=${value}; Max-Age=${MAX_AGE}; Path=${path}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      saved = JSON.stringify(read()) === JSON.stringify(progress);
    } catch {
      saved = false;
    }
  }
  refresh();
  return {
    get introSeen() {
      refresh();
      return progress.introSeen;
    },
    get saved() {
      return saved;
    },
    bestTime(id) {
      refresh();
      return progress.best[id] ?? null;
    },
    completeIntro() {
      refresh();
      progress.introSeen = true;
      persist();
    },
    recordWin(id, seconds) {
      const time = Math.round(seconds * 1000);
      if (
        !COURSES.some((course) => course.id === id) ||
        typeof seconds !== 'number' ||
        !validTime(time)
      )
        return false;
      refresh();
      const improved = time < (progress.best[id] ?? Infinity);
      if (improved) progress.best[id] = time;
      persist();
      return improved;
    },
  };
}
