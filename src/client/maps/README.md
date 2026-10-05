# Authoring a course

For new authored scenery, follow the [design object guide](design-object-guide.md). It requires flat top-down code-generated objects and procedural water; image-backed scenery is not an acceptable implementation.

Each course owns a folder under `src/client/maps/<id>/` with a default export in `config.js`. Map-specific scenery and animation modules belong in the same folder. `npm run build` discovers these folders and generates the ignored `catalog.js` import list for the browser and source tests. No manual registry, renderer switch statement, or home-page button change is needed. Run the build before importing simulation modules directly in Node.

Copy `kasumi/config.js` for a dry course or `beaufort/` for one with custom objects. Folder names use lowercase letters, numbers and hyphens, starting with a letter. Give each config a unique `id` matching its folder.

Required configuration:

- `id`, `name`, `hint`, `weather`, `corners`, `time`: garage labels and descriptions. The displayed distance comes from the route itself.
- `controls`: Catmull–Rom control points in world meters, with an extra tangent point before the start and after the finish. Negative Y travels up the map. Keep sampled geometry below 2,048 points (about one point per 5 meters) and avoid intersecting road sections. Road centers are constrained to 10.4 meters either side.
- `snow`: shared winter ground/shoulder/tree palette; `briefing`: whether to show Ren before the countdown.
- `speedMultiplier`: from 1 to 2; scales engine force and inversely scales aerodynamic drag for both cars. Kasumi uses 1; Beaufort uses 1.4. Resets retain it; changing courses reloads it.
- `preview`: `{x, y, zoom}` for the garage camera.
- `ai`: `{offset, maxSpeed, minSpeed, bendSlowdown, drift}`. Test a complete real-WASM run after changing a route or pace.
- `bridges`: `[startDistance, endDistance]` pairs. Broad shoulders are omitted within these spans so a custom bridge can cross open water.
- `surfaces`: at most 64 oriented patches `{d, offset, width, length, type}`. `d` is route distance and `offset` is signed lateral distance in meters. `width` and `length` are **half** dimensions. Type 1 is elliptical, fully crossable slow snow; type 2 is a rounded rectangle of slippery, gently accelerating ice. Width must be 0–30 meters (exclusive of zero); length 0–60. Keep hazards within the road and out of bridge spans when authoring ice-free bridges. Optional `variant` can choose a map-owned appearance; Beaufort cycles four snowbank designs.

Optional drawing hooks receive a `Mesh` plus a context object with `course`, `atDistance`, and `color`. Static hooks also receive `length`, `surfaces`, and terrain `bounds`:

- `drawTerrain(mesh, context)`: river beds, cliffs, lakes; before the road.
- `drawWater(mesh, context)` plus `waterFragment`: optional static water geometry and map-owned procedural WGSL fragment shader, drawn above terrain and below the road/scenery. The fragment receives `Output.world` in meters and `view.animation.x` in seconds; this clock freezes on pause. Shaders are compiled once per map and cached. Do not sample fixed image assets.
- `drawTree(mesh, {x, y, radius, variation}, context)`: override the shared forest with a compact map-specific canopy. Beaufort uses pointed radial fir branches with snow facets and a small offset shadow.
- `drawRoad(mesh, context)`: decks and surface patches; after asphalt, before lane markings.
- `excludeTree(x, y, context)`: return true to leave water or landmarks clear of generated forest.
- `drawDetails(mesh, context)`: authored roadside buildings/signs after forest generation.

Static scenery and water geometry are uploaded once per course selection and their previous GPU resources are destroyed. Procedural water animation freezes while paused. Shader compilation failures show the existing recovery screen and keep driving disabled. Animation shares the existing reusable dynamic buffer. Avoid allocations in simulation code, unbounded geometry, external assets and renderer/DOM dependencies in map configuration. Regression coverage belongs in `tests/unit/` and real WebGPU coverage in `tests/e2e/`.
