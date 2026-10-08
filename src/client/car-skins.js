import { drawCar, color } from './renderer.js';

// Cosmetics share the same WASM dimensions, steering and collision behavior.
export const CAR_SKINS = Object.freeze([
  Object.freeze({ id: 'classic', name: 'Original coupe', paint: '#f88456', draw: drawClassic }),
  Object.freeze({
    id: 'peugeot-206-cc',
    name: 'Peugeot 206 CC',
    paint: '#d92d38',
    draw: drawPeugeot,
  }),
]);

export function getCarSkin(id) {
  return CAR_SKINS.find((skin) => skin.id === id) ?? CAR_SKINS[0];
}

function drawClassic(mesh, x, y, angle, steering = 0) {
  drawCar(mesh, x, y, angle, color('f88456'), steering);
}

function drawPeugeot(mesh, x, y, angle, steering = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const point = (lx, ly) => [x + lx * c - ly * s, y + lx * s + ly * c];
  const rect = (lx, ly, w, h, paint, turn = 0) =>
    mesh.rect(...point(lx, ly), w, h, angle + turn, color(paint));
  const quad = (a, b, c, d, paint) =>
    mesh.quad(point(...a), point(...b), point(...c), point(...d), color(paint));

  mesh.rect(x + 0.45, y + 0.65, 2.45, 4.65, angle, color('1b2925'));
  for (const side of [-1, 1]) {
    rect(side * 1.01, -1.3, 0.4, 0.82, '17201e', steering * 0.35);
    rect(side * 1.01, 1.35, 0.4, 0.82, '17201e');
  }
  // Rounded short nose, flared shoulders and the CC's broad rear deck.
  quad([-0.73, -2.17], [0.73, -2.17], [1.06, -1.5], [-1.06, -1.5], 'e53942');
  quad([-1.06, -1.5], [1.06, -1.5], [1.08, 1.65], [-1.08, 1.65], 'd92d38');
  quad([-1.08, 1.65], [1.08, 1.65], [0.86, 2.15], [-0.86, 2.15], 'ba1e30');
  quad([-0.73, -1.91], [0.73, -1.91], [0.81, -0.88], [-0.81, -0.88], 'ef4650');
  rect(0, -2.02, 0.68, 0.13, '273334');
  rect(0, -1.81, 0.14, 0.17, 'd9e1df');
  // Swept almond headlights and mirrors distinguish the 206 nose.
  for (const side of [-1, 1]) {
    quad(
      [side * 0.35, -2.02],
      [side * 0.78, -2.02],
      [side * 0.99, -1.52],
      [side * 0.59, -1.72],
      'fff1c9',
    );
    rect(side * 1.13, -0.6, 0.3, 0.24, 'c42232', side * -0.2);
    rect(side * 0.98, 0.49, 0.08, 2.05, 'fa6970');
    rect(side * 0.86, 1.91, 0.23, 0.34, 'ff7272', side * 0.3);
  }
  // Roof folded: dark cockpit, two front seats and small rear seats.
  quad([-0.88, -0.85], [0.88, -0.85], [0.81, 1.25], [-0.81, 1.25], '182728');
  quad([-0.83, -0.86], [0.83, -0.86], [0.72, -0.25], [-0.72, -0.25], '689496');
  quad([-0.77, -0.79], [0.73, -0.79], [0.65, -0.65], [-0.74, -0.57], 'a9c6c5');
  rect(0, -0.23, 1.5, 0.09, 'b4c7c4');
  for (const side of [-1, 1]) {
    rect(side * 0.43, 0.26, 0.53, 0.69, '52605e');
    rect(side * 0.43, 0.54, 0.54, 0.18, '89908a');
    rect(side * 0.43, 0.69, 0.27, 0.18, '273635');
    rect(side * 0.4, 1.02, 0.49, 0.28, '4e5a57');
    rect(side * 0.4, 1.24, 0.34, 0.09, 'c1c7be');
  }
  rect(0, 0.42, 0.13, 1.17, '303d3b');
  rect(0, 1.47, 1.68, 0.12, 'ed4952');
  rect(0, 1.8, 0.18, 0.12, 'd9e1df');
  rect(0, 2.04, 0.58, 0.13, 'e0e3d6');
}
