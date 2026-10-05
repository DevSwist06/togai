# Design Object Guide

Use this guide before adding a new map object, custom tree, landmark, terrain feature, or water feature.

## Reference Style

The shared renderer uses a flat, top-down treatment. Kasumi's simple ground-plane shapes and compact offset shadows are a useful reference, but the same language applies to every course. New objects should read as shapes placed on the ground plane. A shadow is part of the footprint, not a second upright object or a perspective cast across the map.

The renderer uses `Mesh` triangles, quads, rectangles, discs, and lines in world-space X/Y coordinates. Design objects for that vocabulary and for the same camera as the course. A viewer should be able to understand the object's footprint from above without needing a side view, horizon, or implied vertical depth.

## Hard Rules

- Replace every reference image with generated code. Do not ship a PNG, JPEG, SVG, canvas snapshot, or other fixed image as the visual representation of a new object.
- Water must be generated with mesh geometry and, when animation needs it, procedural WGSL. Do not add a `waterTexture` or sample a fixed water image.
- Keep objects flat and top-down. Do not draw trees, buildings, rocks, or signs as tall front-facing illustrations with a dominant vertical axis.
- Objects that represent trees or other vertical subjects must use a compact ground footprint with a small, offset shadow. They must not become tall front-facing silhouettes that imply a side view.
- Shadows must stay underneath or immediately beside the object, use a restrained dark translucent shape, and remain inside the object's local footprint. Do not use a long directional shadow that makes the object look elevated.
- Use layered polygons, discs, low-poly facets, lines, and color changes to communicate material. Perspective can be suggested through overlapping flat shapes, never through a side elevation.
- Keep the object deterministic, bounded, and allocation-light. Derive placement from the supplied context and variation value; do not use external state, DOM APIs, or random values that change between renders.
- Respect draw order: terrain first, water below the road and scenery, road details next, and dynamic effects last. Do not hide a road, bridge, or collision-relevant surface with decorative geometry.
- Keep authored geometry small enough for repeated placement. A repeated object should have a clear vertex budget and should not grow with course length or animation time.

## Object Recipe

For each object, implement this sequence in code:

1. Draw a compact shadow or grounding footprint with a small X/Y offset.
2. Draw the main top-down silhouette as one or more flat polygons.
3. Add a few material facets or highlights that follow the footprint.
4. Keep every point in world meters and finite for all supported sizes and variations.
5. Check the result at the normal desktop and compact camera views. If it reads as a standing cutout, a side profile, or a pasted image, redesign it.

## Water Recipe

Water should be a map-owned procedural shape. Use `drawWater` for bounded static geometry and a procedural shader for motion such as ripples. Use solid colors and generated facets or lines for the base appearance. If a shader is needed, calculate the pattern from world coordinates and time in WGSL; do not load an image to provide the pattern.

Keep water clear of the road and bridge deck, and keep animated geometry within a documented bound. A water feature is not complete if it only looks correct from one camera position or if its visual identity depends on a bundled reference image.

## Review Checklist

- [ ] The implementation contains no new image asset or fixed-image sampling.
- [ ] The object is recognizably top-down and flat at normal gameplay zoom.
- [ ] Any shadow is compact, offset, translucent, and grounded.
- [ ] Trees use a canopy footprint rather than a tall upright silhouette.
- [ ] Geometry is deterministic, finite, bounded, and inexpensive when repeated.
- [ ] Layering keeps terrain, water, road, scenery, and animation in the intended order.
- [ ] Unit tests cover geometry bounds and finite vertex data; browser coverage checks the object at desktop and compact widths.
