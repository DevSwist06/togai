// Surface art uses the same local half-width and half-length as the WASM hazards.
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
export function drawIce(m, p, color) {
  const w = p.width,
    l = p.length,
    corner = Math.min(w * 0.22, 1.2);
  polygon(m, p, bevel(w, l, corner), color('3683a6'));
  polygon(m, p, bevel(w - 0.24, l - 0.36, corner), color('78c0d4'));
  // Long, uneven glass panes and a broken white reflection stay inside the bevel.
  polygon(
    m,
    p,
    [
      [-w * 0.72, -l * 0.88],
      [w * 0.2, -l * 0.72],
      [w * 0.66, l * 0.15],
      [-w * 0.46, l * 0.1],
    ],
    [0.69, 0.91, 0.97, 0.55],
  );
  polygon(
    m,
    p,
    [
      [-w * 0.44, l * 0.18],
      [w * 0.65, l * 0.23],
      [w * 0.36, l * 0.86],
      [-w * 0.65, l * 0.73],
    ],
    [0.34, 0.67, 0.82, 0.55],
  );
  polygon(
    m,
    p,
    [
      [-w * 0.75, -l * 0.38],
      [-w * 0.25, -l * 0.44],
      [-w * 0.05, l * 0.73],
      [-w * 0.53, l * 0.64],
    ],
    [0.88, 0.97, 1, 0.43],
  );
  for (const [a, b] of [
    [
      [-w * 0.6, -l * 0.74],
      [-w * 0.18, -l * 0.51],
    ],
    [
      [-w * 0.18, -l * 0.51],
      [w * 0.34, -l * 0.57],
    ],
    [
      [w * 0.34, -l * 0.57],
      [w * 0.58, -l * 0.27],
    ],
    [
      [-w * 0.49, l * 0.32],
      [w * 0.16, l * 0.24],
    ],
    [
      [w * 0.16, l * 0.24],
      [w * 0.53, l * 0.5],
    ],
  ])
    stroke(m, p, a, b, 0.16, color('e7fbff'));
  stroke(m, p, [-w * 0.72, -l * 0.92], [w * 0.4, -l * 0.92], 0.22, color('e9fcff'));
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
