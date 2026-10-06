# Architecture and coding

## Boundaries

- `src/client/`: browser entry point, deterministic race lifecycle, course/AI, WebGPU renderer. Keep DOM/audio out of simulation modules.
- `src/client/progression.js`: validated personal course records and first completed briefing state, persisted to a path-scoped browser cookie and kept out of simulation.
- `src/client/screen-controls.js`: pure mobile touch classification, car-relative brake boundary, and four-field driving input. `src/client/control-preference.js` stores the selected mobile control mode separately from progression.
- `src/physics/`: AssemblyScript physics compiled to WASM. Document the shared-memory layout and validate exported inputs. Do not add allocations in the physics loop.
- `src/server/`: loopback static server. Only `dist/` is public; never serve the repository root.
- `public/`: authored HTML/CSS and static assets. No generated binaries.
- `dist/`: disposable build output, ignored by Git. Rebuild from source before tests.
- `tests/unit/`, `tests/e2e/`, `tests/security/`: behavior, real-browser integration, and attack regression checks.
- `scripts/`: build and repository tooling. `rules/`: team policy.

## Code quality

Use ES modules, clear domain names, small responsibilities, strict equality, `const` by default, and explicit failure handling. Explain the reason for non-obvious decisions. Avoid speculative abstractions and additional runtime dependencies. Pin development dependencies and commit the lockfile. Use Node 22.13+ (Node 22 LTS recommended).

When a feature replaces another, remove the superseded UI, handlers, styles, tests, documentation, and configuration. Keep one active implementation for the requested platform; add a fallback only when the requirement explicitly calls for one.

ESLint checks JavaScript, AssemblyScript, and CSS; HTML Validate checks HTML; Prettier owns formatting. All lint warnings are failures. `npm run format` formats files; review changes before staging. Do not disable rules to make a failing change pass without a documented technical reason.

Keep simulation at 120 Hz independently of render rate. Bound particles and history, upload static geometry once, reuse buffers, and measure before optimizing. No accounts, telemetry, network multiplayer, or external runtime assets without a separately scoped change.

CSS uses ESLint's recommended CSS rules and the project class naming rule. Responsive and state selectors intentionally override base components; syntax, validity, conventions, and formatting remain enforced.

## Map modules

Each authored map lives under `src/client/maps/<id>/config.js`, with optional scenery modules beside it. The build discovers folders and generates an ignored `catalog.js`; do not hand-edit or commit that generated module. Shared sampling, road rendering, physics and UI read the selected configuration. Map objects use the drawing hooks described in `src/client/maps/README.md`; adding a map must not require a new renderer or UI branch. Fit the 2,048-point road and 64-surface WASM capacities. Course changes reload speed/surfaces and release the previous static GPU buffer. Maps may supply a static water mesh and procedural fragment shader between terrain and road rendering and a custom tree hook. Water shaders are cached, map changes release static scenery/water buffers, and shader failures use the existing recovery screen. Procedural water uses the paused scenery clock.
