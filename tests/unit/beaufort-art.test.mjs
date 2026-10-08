import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, color, scenery } from '../../src/client/renderer.js';
import { selectCourse, atDistance, course } from '../../src/client/track.js';
import { drawDetails } from '../../src/client/maps/beaufort/scenery.js';
import { drawFir } from '../../src/client/maps/beaufort/forest.js';
import { drawCurvedIce, drawSnow } from '../../src/client/maps/beaufort/surfaces.js';
import { waterFragment } from '../../src/client/maps/beaufort/water.js';

test('fir canopies stay compact and grounded, with pointed green branches and snow caps', () => {
  for (const radius of [3, 6, 10])
    for (const variation of [0, 0.5, 1]) {
      const mesh = new Mesh();
      drawFir(mesh, { x: 30, y: -50, radius, variation }, { color });
      assert(mesh.data.every(Number.isFinite));
      const vertices = [];
      for (let i = 0; i < mesh.data.length; i += 6)
        if (mesh.data[i + 5] === 1) vertices.push(mesh.data.slice(i, i + 6));
      const xs = vertices.map((v) => v[0]),
        ys = vertices.map((v) => v[1]);
      const spanX = Math.max(...xs) - Math.min(...xs),
        spanY = Math.max(...ys) - Math.min(...ys);
      assert(spanY / spanX > 0.75 && spanY / spanX < 1.25);
      assert(xs.every((x) => Math.abs(x - 30) < radius * 1.05));
      assert(ys.every((y) => Math.abs(y + 50) < radius * 1.05));
      assert(vertices.some((v) => v[2] > 0.9 && v[3] > 0.9 && v[4] > 0.9));
      assert(vertices.some((v) => v[3] > v[2] * 1.5 && v[3] < 0.5));
      assert(mesh.data.length < 500, 'Fir geometry stays small enough for a forest');
    }
});

test('four alternating snow designs stay finite inside their footprints', () => {
  const p = { x: 30, y: -50, a: Math.PI / 3, width: 5.8, length: 9 };
  const variants = [];
  for (let variant = 0; variant < 4; variant++) {
    const mesh = new Mesh();
    drawSnow(mesh, { ...p, variant }, color);
    assert(mesh.data.length > 0 && mesh.data.length < 1200);
    assert(mesh.data.every(Number.isFinite));
    variants.push(mesh.data.join(','));
    for (let i = 0; i < mesh.data.length; i += 6) {
      const dx = mesh.data[i] - p.x,
        dy = mesh.data[i + 1] - p.y;
      assert(Math.abs(dx * Math.cos(p.a) + dy * Math.sin(p.a)) < p.width + 0.25);
      assert(Math.abs(-dx * Math.sin(p.a) + dy * Math.cos(p.a)) < p.length + 0.25);
    }
  }
  assert.equal(new Set(variants).size, 4);
});

test('a long ice mesh follows a Beaufort bend within its authored lane and length', () => {
  selectCourse('beaufort');
  try {
    const patch = course.surfaces.find((p) => p.type === 2 && p.d === 2110);
    const mesh = new Mesh();
    drawCurvedIce(mesh, patch, atDistance, color);
    assert(mesh.data.length > 0 && mesh.data.length < 5000);
    assert(mesh.data.every(Number.isFinite));
    assert(
      mesh.data.some((value, i) => i % 6 === 5 && value < 1),
      'Translucent glass facets',
    );
    const centerline = [];
    for (let d = patch.d - patch.length; d <= patch.d + patch.length; d += 0.5) {
      const road = atDistance(d);
      centerline.push([
        road.x + Math.cos(road.a) * patch.offset,
        road.y + Math.sin(road.a) * patch.offset,
      ]);
    }
    for (let i = 0; i < mesh.data.length; i += 6) {
      const x = mesh.data[i],
        y = mesh.data[i + 1];
      assert(
        centerline.some(([cx, cy]) => Math.hypot(x - cx, y - cy) < patch.width + 0.6),
        'Visible ice must remain inside the curved lane',
      );
    }
    for (const d of [patch.d - patch.length, patch.d, patch.d + patch.length]) {
      const road = atDistance(d),
        x = road.x + Math.cos(road.a) * patch.offset,
        y = road.y + Math.sin(road.a) * patch.offset;
      assert(
        mesh.data.some(
          (value, i) =>
            i % 6 === 0 && Math.hypot(value - x, mesh.data[i + 1] - y) < patch.width + 0.6,
        ),
        `Visible ice must cover route distance ${d}`,
      );
    }
  } finally {
    selectCourse('kasumi');
  }
});

test('Beaufort caustics use procedural world coordinates and the paused animation clock', () => {
  assert.match(waterFragment, /input\.world/);
  assert.match(waterFragment, /view\.animation\.x/);
  assert.doesNotMatch(waterFragment, /textureSample|texture_2d/);
});

test('Beaufort water has a bounded static layer below road and trees; switching to Kasumi removes it', () => {
  selectCourse('beaufort');
  try {
    const scene = scenery();
    assert(scene.water.length > 0 && scene.water.length <= 36);
    assert(scene.water.every(Number.isFinite));
    assert(scene.terrainVertices > 0 && scene.terrainVertices < scene.vertices.length / 6);
    selectCourse('kasumi');
    assert.equal(scenery().water.length, 0);
  } finally {
    selectCourse('kasumi');
  }
});

test('Beaufort river has no waterfall or plunge-pool geometry', () => {
  selectCourse('beaufort');
  try {
    assert.equal(course.river.waterfallX, undefined);
    assert.equal(course.drawAnimated, undefined);
    const mesh = new Mesh();
    drawDetails(mesh, { course, atDistance, length: 0, color });
    assert.equal(mesh.data.length, 0);
  } finally {
    selectCourse('kasumi');
  }
});
