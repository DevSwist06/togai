# Testing

Run `npm test` for a fresh WASM build, unit tests, and real Chromium/WebGPU browser tests. `npm run security` runs security regressions and the dependency audit. `npm run verify` combines all checks with lint, while `npm run verify:ci` runs the required CI subset (lint/build/unit/security plus CI-stable browser failure-path checks).

Tests must assert observable behavior, not mirror implementation. Prefer deterministic inputs; use the real WASM for driving and full races. Isolated lifecycle tests may stub motion to target exact finish boundaries. Do not mock the GPU in rendering smoke tests. The Linux browser suite uses software WebGPU for portability (macOS uses Chrome’s available adapter), so its frame rate is not a hardware performance benchmark.

The accelerated end-to-end full-race driver replaces only the browser input call and frame accumulator inside a test-only route response. Production files and APIs stay unchanged. Unit tests additionally drive the real lifecycle and WASM without source interception; keyboard tests exercise actual key events in the unmodified browser app.

No `.only`, skipped tests, or ignored failure exits. `forbidOnly` is enabled for Playwright and source policy tests reject focused/skipped tests. Update this matrix whenever behavior is added or changed.

| Feature                                                                                     | Coverage                                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Acceleration, braking, drift grip, steering                                                 | Real-WASM physics tests; browser keyboard test          |
| Phone joystick axes, drift, neutral/cancel/pause, emoji, text selection, responsive layout  | Joystick unit and mobile browser tests                  |
| Road boundaries, AI full course, finite state                                               | Physics stress test and track/AI unit tests             |
| Car contact, roadside crash, exact overlap                                                  | Physics and race regression tests                       |
| Start/countdown, idle states                                                                | Race unit tests and browser countdown                   |
| Pause/resume, restart, focus loss                                                           | Race unit tests and browser lifecycle test              |
| Head-start chase, five-second clear-pass win, rival escape                                  | Race boundary tests and full two-car simulation         |
| Results, replay, garage                                                                     | Browser full race and race reset tests                  |
| Time formatting, drift time, keyboard aliases                                               | Race unit tests                                         |
| HUD, minimap, responsive canvas                                                             | Browser assertions, pixel data and viewport checks      |
| WebGPU geometry/rendering and road endpoint continuation                                    | Mesh/road unit tests and real WebGPU browser smoke test |
| Camera tracking, translucent foreground smoke, trail/crash emission, pause, expiry, budgets | Presentation unit tests                                 |
| Audio toggle                                                                                | Browser UI plus audio graph test                        |
| Missing WASM, unavailable GPU/adapter, device loss                                          | Browser failure-path tests                              |
| Static serving and security headers                                                         | HTTP integration/security tests                         |
| GitHub Pages project-path deployment                                                        | Deployment path regression test and Pages workflow      |
| Traversal, symlink escape, malformed URL, method abuse                                      | Security attack regression suite                        |
| Invalid WASM inputs                                                                         | Compiled-WASM security tests                            |
| Dependency vulnerabilities                                                                  | `npm audit --audit-level=low`                           |
| Pre-commit checks the index and blocks failures                                             | Isolated tooling regression tests                       |

A passed suite means the listed cases pass. It is not a claim of exhaustive input coverage or an independent penetration test. Extend the matrix and tests with every feature.
