// Snow uses local WASM footprints; curved ice samples the same route as its physics segments.
function point(p, x, y) {
  const c = Math.cos(p.a),
    s = Math.sin(p.a);
  return [p.x + x * c - y * s, p.y + x * s + y * c];
}
function polygon(m, p, points, tint) {
  for (let i = 1; i < points.length - 1; i++)
    m.tri(point(p, ...points[0]), point(p, ...points[i]), point(p, ...points[i + 1]), tint);
}
function stroke(m, p, a, b, width, tint) {
  const from = point(p, ...a),
    to = point(p, ...b);
  m.line(...from, ...to, width, tint);
}
function bevel(w, l, corner) {
  return [
    [-w + corner, -l],
    [w - corner, -l],
    [w, -l + corner],
    [w, l - corner],
    [w - corner, l],
    [-w + corner, l],
    [-w, l - corner],
    [-w, -l + corner],
  ];
}
export function drawCurvedIce(m, patch, atDistance, color) {
  const start = patch.d - patch.length,
    end = patch.d + patch.length,
    corner = Math.min(patch.width * 0.22, 1.2);
  const distances = [start, start + corner];
  for (let d = start + corner + 6; d < end - corner; d += 6) distances.push(d);
  distances.push(end - corner, end);
  const edge = (d, lateral) => {
    const p = atDistance(d);
    const offset = patch.offset + lateral;
    return [p.x + Math.cos(p.a) * offset, p.y + Math.sin(p.a) * offset];
  };
  const widthAt = (index, inset = 0) =>
    patch.width - inset - (index === 0 || index === distances.length - 1 ? corner : 0);
  for (let i = 1; i < distances.length; i++) {
    const a = distances[i - 1],
      b = distances[i],
      aw = widthAt(i - 1),
      bw = widthAt(i);
    m.quad(edge(a, -aw), edge(b, -bw), edge(b, bw), edge(a, aw), color('3683a6'));
    m.quad(
      edge(a, -widthAt(i - 1, 0.24)),
      edge(b, -widthAt(i, 0.24)),
      edge(b, widthAt(i, 0.24)),
      edge(a, widthAt(i - 1, 0.24)),
      color('78c0d4'),
    );
    // Irregular translucent panes and short reflections bend with the route.
    m.quad(
      edge(a, -aw * 0.65),
      edge(b, -bw * 0.42),
      edge(b, bw * 0.18),
      edge(a, aw * 0.05),
      i % 2 ? [0.69, 0.91, 0.97, 0.55] : [0.34, 0.67, 0.82, 0.55],
    );
    if (i % 2 === 0) m.line(...edge(b, -bw * 0.56), ...edge(b, bw * 0.3), 0.16, color('e7fbff'));
  }
}
function mound(m, p, x, y, w, l, color) {
  polygon(
    m,
    p,
    [
      [x - w, y - l * 0.45],
      [x - w * 0.4, y - l],
      [x + w * 0.58, y - l * 0.8],
      [x + w, y + l * 0.23],
      [x + w * 0.28, y + l],
      [x - w * 0.7, y + l * 0.76],
    ],
    color('d7e8f0'),
  );
  polygon(
    m,
    p,
    [
      [x - w * 0.55, y - l * 0.45],
      [x - w * 0.17, y - l * 0.83],
      [x + w * 0.54, y - l * 0.45],
      [x + w * 0.37, y + l * 0.35],
      [x - w * 0.3, y + l * 0.42],
    ],
    color('f9fdff'),
  );
  stroke(m, p, [x - w * 0.52, y + l * 0.55], [x + w * 0.26, y + l * 0.7], 0.16, color('a8c8d8'));
}
export function drawSnow(m, p, color) {
  const w = p.width,
    l = p.length;
  polygon(m, p, bevel(w, l, Math.min(w * 0.55, 2.6)), [0.37, 0.52, 0.61, 0.43]);
  switch (p.variant % 4) {
    case 0: // A single wind-sculpted ridge.
      mound(m, p, 0, 0, w * 0.83, l * 0.83, color);
      stroke(m, p, [-w * 0.53, -l * 0.27], [w * 0.25, -l * 0.55], 0.22, color('ffffff'));
      break;
    case 1: // Three rounded plow heaps.
      for (const [x, y, size] of [
        [-0.29, -0.48, 0.38],
        [0.25, 0, 0.46],
        [-0.18, 0.49, 0.35],
      ])
        mound(m, p, x * w, y * l, size * w, l * 0.34, color);
      break;
    case 2: // A sharp zigzag drift with blue shaded cuts.
      polygon(
        m,
        p,
        [
          [-w * 0.78, -l * 0.72],
          [w * 0.55, -l * 0.84],
          [-w * 0.19, -l * 0.05],
          [w * 0.77, l * 0.59],
          [-w * 0.45, l * 0.78],
          [w * 0.02, l * 0.16],
        ],
        color('ecf6fa'),
      );
      polygon(
        m,
        p,
        [
          [-w * 0.19, -l * 0.05],
          [w * 0.55, -l * 0.84],
          [w * 0.16, -l * 0.46],
          [w * 0.77, l * 0.59],
        ],
        color('b1d1df'),
      );
      stroke(m, p, [-w * 0.69, -l * 0.6], [w * 0.01, -l * 0.54], 0.25, color('ffffff'));
      break;
    default: // Two long stepped snow shelves.
      mound(m, p, -w * 0.22, -l * 0.37, w * 0.57, l * 0.38, color);
      mound(m, p, w * 0.19, l * 0.37, w * 0.61, l * 0.38, color);
      for (const y of [-0.62, 0.12, 0.56])
        stroke(m, p, [-w * 0.5, y * l], [w * 0.42, (y + 0.06) * l], 0.22, color('ffffff'));
  }
}
