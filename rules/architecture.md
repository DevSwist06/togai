# Architecture and coding

## Boundaries

- `src/client/`: browser entry point, deterministic race lifecycle, course/AI, WebGPU renderer. Keep DOM/audio out of simulation modules.
- `src/physics/`: AssemblyScript physics compiled to WASM. Document the shared-memory layout and validate exported inputs. Do not add allocations in the physics loop.
- `src/server/`: loopback static server. Only `dist/` is public; never serve the repository root.
- `public/`: authored HTML/CSS and static assets. No generated binaries.
- `dist/`: disposable build output, ignored by Git. Rebuild from source before tests.
- `tests/unit/`, `tests/e2e/`, `tests/security/`: behavior, real-browser integration, and attack regression checks.
- `scripts/`: build and repository tooling. `rules/`: team policy.

## Code quality

Use ES modules, clear domain names, small responsibilities, strict equality, `const` by default, and explicit failure handling. Explain the reason for non-obvious decisions. Avoid speculative abstractions and additional runtime dependencies. Pin development dependencies and commit the lockfile. Use Node 22.13+ (Node 22 LTS recommended).

ESLint checks JavaScript and AssemblyScript; Stylelint checks CSS; HTML Validate checks HTML; Prettier owns formatting. All lint warnings are failures. `npm run format` formats files; review changes before staging. Do not disable rules to make a failing change pass without a documented technical reason.

Keep simulation at 120 Hz independently of render rate. Bound particles and history, upload static geometry once, reuse buffers, and measure before optimizing. No accounts, telemetry, network multiplayer, or external runtime assets without a separately scoped change.

CSS specificity lint is disabled because responsive and state selectors intentionally override base components; syntax, validity, conventions, and formatting remain enforced.
