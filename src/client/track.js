import configs from './maps/catalog.js';
function buildTrack(controls) {
  const track = [];
  for (let i = 1; i < controls.length - 2; i++) {
    const [a, b, c, d] = controls.slice(i - 1, i + 3);
    const steps = Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / 5);
    for (let j = 0; j < steps; j++) {
      const t = j / steps,
        t2 = t * t,
        t3 = t2 * t;
      const f = (k) =>
        0.5 *
        (2 * b[k] +
          (-a[k] + c[k]) * t +
          (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 +
          (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3);
      track.push({ x: f(0), y: f(1), d: 0 });
    }
  }
  track.push({ x: controls.at(-2)[0], y: controls.at(-2)[1], d: 0 });
  for (let i = 0; i < track.length; i++) {
    const p = track[i],
      a = track[Math.max(0, i - 1)],
      b = track[Math.min(track.length - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    p.nx = -(b.y - a.y) / l;
    p.ny = (b.x - a.x) / l;
    p.a = Math.atan2(b.x - a.x, -(b.y - a.y));
    if (i) p.d = a.d + Math.hypot(p.x - a.x, p.y - a.y);
  }
  return track;
}
export const courses = Object.fromEntries(
  configs.map((config) => [config.id, { ...config, points: buildTrack(config.controls) }]),
);
export let course;
export let track;
export let length;
export let finishDistance;
export let surfaces;
export let physicsSurfaces;
export function selectCourse(id) {
  if (!Object.hasOwn(courses, id)) throw new Error('Unknown course');
  course = courses[id];
  track = course.points;
  length = track.at(-1).d;
  finishDistance = length - 14;
  surfaces = course.surfaces.map((surface) => {
    const p = atDistance(surface.d);
    return { ...surface, x: p.x + p.nx * surface.offset, y: p.y + p.ny * surface.offset, a: p.a };
  });
  physicsSurfaces = surfaces.flatMap((surface) => {
    if (surface.type !== 2 || !course.curvedIce) return [surface];
    const segments = [];
    const end = surface.d + surface.length;
    for (let start = surface.d - surface.length; start < end; start += 8) {
      const stop = Math.min(start + 8, end);
      const a = atDistance(start),
        b = atDistance(stop);
      const ax = a.x + Math.cos(a.a) * surface.offset,
        ay = a.y + Math.sin(a.a) * surface.offset,
        bx = b.x + Math.cos(b.a) * surface.offset,
        by = b.y + Math.sin(b.a) * surface.offset;
      segments.push({
        ...surface,
        sourceD: surface.d,
        d: (start + stop) / 2,
        x: (ax + bx) / 2,
        y: (ay + by) / 2,
        a: Math.atan2(bx - ax, -(by - ay)),
        length: Math.hypot(bx - ax, by - ay) / 2 + 0.45,
      });
    }
    return segments;
  });
}
export function loadCourse(wasm) {
  track.forEach((p, i) => wasm.setPoint(i, p.x, p.y, p.d));
  wasm.clearSurfaces();
  wasm.setCourseSpeed(course.speedMultiplier);
  physicsSurfaces.forEach((p, i) => wasm.setSurface(i, p.x, p.y, p.width, p.length, p.a, p.type));
}
export function atDistance(d) {
  d = Math.max(0, Math.min(length, d));
  let lo = 0,
    hi = track.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid].d < d) lo = mid;
    else hi = mid;
  }
  const a = track[lo],
    b = track[hi],
    t = (d - a.d) / (b.d - a.d);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    a: Math.atan2(b.x - a.x, -(b.y - a.y)),
    nx: a.nx,
    ny: a.ny,
  };
}
export function aiInput(s) {
  const speed = s[16],
    p = s[18];
  const target = atDistance(p + 13 + speed * 0.63);
  // The AI holds an outside line, leaving a safe lane for a clean pass.
  let offset = course.ai.offset;
  let nearestHazard = Infinity;
  const hazardLookahead = course.ai.hazardLookahead ?? 42;
  const hazardOffset = course.ai.hazardOffset ?? 3.5;
  for (const surface of surfaces) {
    const ahead = surface.d - p;
    if (
      ahead >= -surface.length &&
      ahead < hazardLookahead &&
      Math.abs(offset - surface.offset) < surface.width + 1.4 &&
      ahead < nearestHazard
    ) {
      nearestHazard = ahead;
      offset = surface.offset > 0 ? -hazardOffset : hazardOffset;
    }
  }
  const desired = Math.atan2(
    target.x + target.nx * offset - s[10],
    -(target.y + target.ny * offset - s[11]),
  );
  const delta = Math.atan2(Math.sin(desired - s[12]), Math.cos(desired - s[12]));
  const near = atDistance(p + 12),
    far = atDistance(p + 54);
  const bend = Math.abs(Math.atan2(Math.sin(far.a - near.a), Math.cos(far.a - near.a)));
  const targetSpeed = Math.max(
    course.ai.minSpeed,
    course.ai.maxSpeed - bend * course.ai.bendSlowdown,
  );
  return {
    steer: Math.max(-1, Math.min(1, delta * 2.7)),
    throttle: speed < targetSpeed ? (course.ai.acceleration ?? 1) : 0,
    brake: speed > targetSpeed + 2 ? 0.45 : 0,
    handbrake:
      course.ai.drift &&
      bend > (course.ai.driftThreshold ?? 0.35) &&
      Math.abs(delta) > 0.08 &&
      speed > 24
        ? (course.ai.driftStrength ?? 1)
        : 0,
  };
}

selectCourse('kasumi');
