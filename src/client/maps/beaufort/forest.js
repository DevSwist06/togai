/** Compact snowy fir canopy. Jagged radial tips read as conifer branches from above. */
export function drawFir(m, { x, y, radius, variation }, { color }) {
  const shadow = [0.08, 0.19, 0.2, 0.35];
  m.disc(x + radius * 0.12, y + radius * 0.1, radius * 1.02, shadow, 6);
  const ring = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6 + variation * 0.18;
    const tip = i % 2 === 0 ? 1 : 0.77;
    const size = radius * tip * (0.97 + 0.06 * Math.sin(i * 3.7 + variation * 5));
    ring.push([x + Math.cos(angle) * size, y + Math.sin(angle) * size]);
  }
  const greens = ['173f38', '275b48', '316d54', '245441'];
  for (let i = 0; i < ring.length; i++)
    m.tri(
      [x, y],
      ring[i],
      ring[(i + 1) % ring.length],
      color(greens[(i + Math.floor(variation * 3)) % greens.length]),
    );
  // Short white facets sit on branch clusters, leaving the pointed green rim visible.
  for (const i of [1, 4, 7, 10]) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    m.tri(
      [x - radius * 0.06, y - radius * 0.08],
      [x + (a[0] - x) * 0.65, y + (a[1] - y) * 0.65],
      [x + (b[0] - x) * 0.59, y + (b[1] - y) * 0.59],
      color(i % 2 ? 'eaf5f8' : 'bedde4'),
    );
  }
  m.tri(
    [x - radius * 0.22, y - radius * 0.1],
    [x + radius * 0.07, y - radius * 0.32],
    [x + radius * 0.28, y + radius * 0.15],
    color('f8fcfd'),
  );
}
