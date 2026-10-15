export const GHOST_INTERVAL_TICKS = 40;
export const GHOST_MAX_SAMPLES = 480;
export const GHOST_MAX_ENCODED_LENGTH = 4000;
const VERSION = 1;
const HEADER_BYTES = 8;
const SAMPLE_BYTES = 6;
const MIN_TIME_MS = 5000;
const MAX_TIME_MS = 3_600_000;
const toBase64Url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
function fromBase64Url(value) {
  if (
    typeof value !== 'string' ||
    !new RegExp(`^[A-Za-z0-9_-]{1,${GHOST_MAX_ENCODED_LENGTH}}$`).test(value)
  )
    return null;
  try {
    const padded =
      value.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((value.length + 3) % 4);
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}
function validTime(time) {
  return Number.isSafeInteger(time) && time >= MIN_TIME_MS && time <= MAX_TIME_MS;
}
function normalizedAngle(angle) {
  return ((((angle + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
}
function writeUint24(bytes, offset, value) {
  bytes[offset] = value >>> 16;
  bytes[offset + 1] = value >>> 8;
  bytes[offset + 2] = value;
}
function readUint24(bytes, offset) {
  return bytes[offset] * 65536 + bytes[offset + 1] * 256 + bytes[offset + 2];
}

// The fixed-rate path is binary-packed so even the long Beaufort record fits in one cookie.
export function encodeGhost(samples, finishSeconds, intervalTicks = GHOST_INTERVAL_TICKS) {
  const finishMs = Math.round(finishSeconds * 1000);
  if (
    !validTime(finishMs) ||
    !Number.isSafeInteger(intervalTicks) ||
    intervalTicks < 1 ||
    intervalTicks > 65535 ||
    !Array.isArray(samples) ||
    samples.length < 2 ||
    samples.length > GHOST_MAX_SAMPLES
  )
    return null;
  const bytes = new Uint8Array(HEADER_BYTES + samples.length * SAMPLE_BYTES);
  bytes[0] = VERSION;
  bytes[1] = intervalTicks >>> 8;
  bytes[2] = intervalTicks;
  writeUint24(bytes, 3, finishMs);
  bytes[6] = samples.length >>> 8;
  bytes[7] = samples.length;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (!sample || ![sample.x, sample.y, sample.a].every(Number.isFinite)) return null;
    const x = Math.round(sample.x * 10);
    const y = Math.round(sample.y * 10);
    if (x < -32768 || x > 32767 || y < -32768 || y > 32767) return null;
    const angle = Math.round(((normalizedAngle(sample.a) + Math.PI) / (Math.PI * 2)) * 65535);
    const offset = HEADER_BYTES + i * SAMPLE_BYTES;
    bytes[offset] = x >>> 8;
    bytes[offset + 1] = x;
    bytes[offset + 2] = y >>> 8;
    bytes[offset + 3] = y;
    bytes[offset + 4] = angle >>> 8;
    bytes[offset + 5] = angle;
  }
  return toBase64Url(bytes);
}

export function decodeGhost(value) {
  const bytes = fromBase64Url(value);
  if (!bytes || bytes.length < HEADER_BYTES || bytes[0] !== VERSION) return null;
  const intervalTicks = bytes[1] * 256 + bytes[2];
  const finishMs = readUint24(bytes, 3);
  const count = bytes[6] * 256 + bytes[7];
  if (
    !validTime(finishMs) ||
    intervalTicks < 1 ||
    count < 2 ||
    count > GHOST_MAX_SAMPLES ||
    bytes.length !== HEADER_BYTES + count * SAMPLE_BYTES
  )
    return null;
  const samples = [];
  for (let i = 0; i < count; i++) {
    const offset = HEADER_BYTES + i * SAMPLE_BYTES;
    const x = bytes[offset] * 256 + bytes[offset + 1];
    const y = bytes[offset + 2] * 256 + bytes[offset + 3];
    const signedX = x > 32767 ? x - 65536 : x;
    const signedY = y > 32767 ? y - 65536 : y;
    const angle = bytes[offset + 4] * 256 + bytes[offset + 5];
    samples.push({
      x: signedX / 10,
      y: signedY / 10,
      a: (angle / 65535) * Math.PI * 2 - Math.PI,
    });
  }
  return { finishSeconds: finishMs / 1000, intervalTicks, samples };
}

export function interpolateGhost(ghost, elapsed) {
  if (!ghost || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > ghost.finishSeconds)
    return null;
  const interval = ghost.intervalTicks / 120;
  const last = ghost.samples.length - 1;
  if (elapsed >= ghost.finishSeconds) return ghost.samples[last];
  const index = Math.min(last - 1, Math.floor(elapsed / interval));
  const start = ghost.samples[index];
  const end = ghost.samples[index + 1];
  const endTime = index + 1 === last ? ghost.finishSeconds : (index + 1) * interval;
  const startTime = index * interval;
  const amount = Math.max(
    0,
    Math.min(1, (elapsed - startTime) / Math.max(0.001, endTime - startTime)),
  );
  const delta = Math.atan2(Math.sin(end.a - start.a), Math.cos(end.a - start.a));
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
    a: start.a + delta * amount,
  };
}

export function createGhostRecorder() {
  let samples = [];
  let intervalTicks = GHOST_INTERVAL_TICKS;
  let nextTick = 0;
  let lastTick = 0;
  function capture(state) {
    samples.push({ x: state[0], y: state[1], a: state[2] });
  }
  return {
    reset(state) {
      samples = [];
      intervalTicks = GHOST_INTERVAL_TICKS;
      nextTick = 0;
      capture(state);
      lastTick = 0;
      nextTick = intervalTicks;
    },
    sample(elapsed, state) {
      const tick = Math.round(elapsed * 120);
      if (tick < nextTick) return;
      capture(state);
      lastTick = tick;
      nextTick += intervalTicks;
      if (samples.length > GHOST_MAX_SAMPLES - 1) {
        samples = samples.filter((_, index) => index % 2 === 0);
        intervalTicks *= 2;
        nextTick = tick + intervalTicks;
      }
    },
    finish(elapsed, state) {
      const tick = Math.round(elapsed * 120);
      if (tick !== lastTick) {
        if (samples.length >= GHOST_MAX_SAMPLES) {
          samples = samples.filter((_, index) => index % 2 === 0);
          intervalTicks *= 2;
        }
        capture(state);
        lastTick = tick;
      }
      return { samples, intervalTicks };
    },
  };
}
