import { drawIce, drawSnow } from './surfaces.js';

function riverY(x, context) {
  const river = context.atDistance(context.course.river.d);
  return river.y - (x - river.x) * 0.12;
}
export function excludeTree(x, y, context) {
  return Math.abs(y - riverY(x, context)) < 66;
}
export function drawTerrain(m, context) {
  const { color, bounds } = context;
  const left = bounds.minX,
    right = bounds.maxX;
  for (const [width, tint] of [
    [122, '93aab8'],
    [104, 'e8f2f6'],
    [91, '315f73'],
    [76, '407f95'],
  ]) {
    m.line(left, riverY(left, context), right, riverY(right, context), width, color(tint));
  }
}
export function drawWater(m, context) {
  const { bounds, color } = context;
  m.line(
    bounds.minX,
    riverY(bounds.minX, context),
    bounds.maxX,
    riverY(bounds.maxX, context),
    91,
    color('ffffff'),
  );
}
export function drawRoad(m, { course, atDistance, surfaces, color }) {
  for (const [start, end] of course.bridges) {
    for (let d = start; d < end; d += 3) {
      const p = atDistance(d);
      m.rect(p.x, p.y, 25, 3.1, p.a, color('747f86'));
      m.rect(p.x, p.y, 23, 0.18, p.a, color('9eaaae'));
      for (const side of [-1, 1]) {
        const x = p.x + p.nx * side * 12,
          y = p.y + p.ny * side * 12;
        m.rect(x + 1, y + 1, 1.8, 3.2, p.a, color('354653'));
        m.rect(x, y, 1.1, 3.2, p.a, color('dce7eb'));
        if ((d - start) % 15 === 0) m.rect(x, y, 2.3, 2.3, p.a, color('e4b67b'));
      }
    }
  }
  for (const p of surfaces) {
    if (p.type === 2) drawIce(m, p, color);
    else drawSnow(m, p, color);
  }
}
export function drawDetails(m, context) {
  const { atDistance, length, color } = context;
  // Roadside cabins, avalanche rocks, snow poles and hairpin chevrons.
  for (let d = 60; d < length; d += 90) {
    const p = atDistance(d);
    for (const side of [-1, 1]) {
      const x = p.x + p.nx * side * 16,
        y = p.y + p.ny * side * 16;
      m.rect(x, y, 0.7, 3.3, p.a, color('e46e4e'));
      m.rect(x, y - 0.5, 0.7, 1.2, p.a, color('ffffff'));
    }
  }
  for (let d = 450; d < length - 50; d += 420) {
    const p = atDistance(d),
      x = p.x + p.nx * 48,
      y = p.y + p.ny * 48;
    m.rect(x + 3, y + 4, 20, 15, p.a, color('8ca4b3'));
    m.rect(x, y, 18, 13, p.a, color('68574b'));
    m.rect(x, y - 1, 20, 11, p.a, color('edf6fa'));
    m.rect(x - 4, y + 5, 3, 2, p.a, color('e7bb74'));
    m.rect(x + 4, y + 5, 3, 2, p.a, color('e7bb74'));
    m.rect(x + 5, y - 5, 2, 4, p.a, color('6e7f8c'));
  }
  for (let d = 500; d < length - 50; d += 65) {
    const p = atDistance(d),
      q = atDistance(d + 35);
    if (Math.abs(Math.atan2(Math.sin(q.a - p.a), Math.cos(q.a - p.a))) < 0.5) continue;
    const x = p.x - p.nx * 16,
      y = p.y - p.ny * 16;
    m.rect(x, y, 4, 2, p.a, color('e8c477'));
    m.line(x - 1, y - 0.6, x, y, 0.4, color('283d49'));
    m.line(x, y, x - 1, y + 0.6, 0.4, color('283d49'));
  }
}
