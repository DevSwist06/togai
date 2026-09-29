// A point-to-point pass. Units are meters; smaller Y is farther downhill.
const controls = [
  [0, 65],
  [0, 0],
  [5, -120],
  [80, -210],
  [190, -240],
  [260, -300],
  [245, -365],
  [130, -385],
  [35, -440],
  [-10, -525],
  [45, -595],
  [175, -620],
  [245, -685],
  [210, -765],
  [90, -800],
  [-35, -850],
  [-85, -945],
  [-15, -1020],
  [100, -1025],
  [195, -1080],
  [205, -1160],
  [120, -1215],
  [0, -1240],
  [-70, -1320],
  [-35, -1410],
  [60, -1470],
  [90, -1570],
  [90, -1650],
];
for (const point of controls) {
  point[0] *= 0.72;
  point[1] *= 0.72;
}
export const track = [];
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
export const length = track.at(-1).d;
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
  const offset = 3.8;
  const desired = Math.atan2(
    target.x + target.nx * offset - s[10],
    -(target.y + target.ny * offset - s[11]),
  );
  const delta = Math.atan2(Math.sin(desired - s[12]), Math.cos(desired - s[12]));
  const near = atDistance(p + 12),
    far = atDistance(p + 54);
  const bend = Math.abs(Math.atan2(Math.sin(far.a - near.a), Math.cos(far.a - near.a)));
  const targetSpeed = Math.max(19, 39 - bend * 17);
  return {
    steer: Math.max(-1, Math.min(1, delta * 2.7)),
    throttle: speed < targetSpeed ? 1 : 0,
    brake: speed > targetSpeed + 2 ? 0.45 : 0,
  };
}
