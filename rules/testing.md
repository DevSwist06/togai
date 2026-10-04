# Testing

Run `npm test` for a fresh WASM build, unit tests, and real Chromium/WebGPU browser tests. `npm run security` runs security regressions and the dependency audit. `npm run verify` combines all checks with lint.

Run `npm run verify` locally before committing; the installed pre-commit hook enforces this gate. GitHub Actions only builds and deploys the static site to GitHub Pages. The WebGPU browser suite is not run on hosted runners because their adapter behavior is unreliable for this project.

Tests must assert observable behavior, not mirror implementation. Prefer deterministic inputs; use the real WASM for driving and full races. Isolated lifecycle tests may stub motion to target exact finish boundaries. Do not mock the GPU in rendering smoke tests. The Linux browser suite uses software WebGPU for portability (macOS uses Chrome’s available adapter), so its frame rate is not a hardware performance benchmark.

The accelerated end-to-end full-race driver replaces only the browser input call and frame accumulator inside a test-only route response. Production files and APIs stay unchanged. Unit tests additionally drive the real lifecycle and WASM without source interception; keyboard tests exercise actual key events in the unmodified browser app.

No `.only`, skipped tests, or ignored failure exits. `forbidOnly` is enabled for Playwright and source policy tests reject focused/skipped tests. Update this matrix whenever behavior is added or changed.

| Feature                                                                                                                                                  | Coverage                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Acceleration, braking, drift grip, steering                                                                                                              | Real-WASM physics tests; browser keyboard test                                      |
| Phone joystick axes, delayed heading follow, drift, neutral/cancel/pause, emoji, text selection, responsive layout                                       | Joystick unit and mobile browser tests                                              |
| Road boundaries, powered AI full course, faster speed, bend drifting, finite state                                                                       | Physics stress, rival pace/drift and full race tests; track/AI controls             |
| Car contact, roadside crash, exact overlap                                                                                                               | Physics and race regression tests                                                   |
| Start/countdown, idle states                                                                                                                             | Race unit tests and browser countdown                                               |
| Pause/resume, restart, focus loss                                                                                                                        | Race unit tests and browser lifecycle test                                          |
| Head-start chase, five-second clear-pass win and visible confirmation progress without duplicate HUD text, rival escape                                  | Race boundary tests, HUD progress browser test and full two-car simulation          |
| Results, replay, garage                                                                                                                                  | Browser full race and race reset tests                                              |
| Time formatting, drift time, keyboard aliases                                                                                                            | Race unit tests                                                                     |
| HUD position starts at 2/2, speed display without helper message, both maps with start below finish, platform-specific intro controls, responsive canvas | Browser map labels, live marker pixel, screenshots and viewport checks              |
| WebGPU geometry/rendering, player car without trailing triangle, and road endpoint continuation                                                          | Mesh/road and presentation unit tests; real WebGPU browser smoke and screenshots    |
| Camera tracking, translucent foreground smoke, trail/crash emission, pause, expiry, budgets                                                              | Presentation unit tests                                                             |
| Two-page starting-line briefing, combined border/contact warnings, passing goal, compact button, keyboard/touch, cancel, reduced motion, audio failure   | Browser dialogue and desktop/phone screenshots; race lifecycle and voice unit tests |
| Garage menu sound starts on, controls engine and dialogue audio; text reveals automatically when sound is off                                            | Browser UI, auto-reveal, audio failure and graph tests                              |
| Missing WASM, unavailable GPU/adapter, device loss                                                                                                       | Browser failure-path tests                                                          |
| Static serving and security headers                                                                                                                      | HTTP integration/security tests                                                     |
| GitHub Pages project-path deployment                                                                                                                     | Deployment path regression test and Pages workflow                                  |
| Traversal, symlink escape, malformed URL, method abuse                                                                                                   | Security attack regression suite                                                    |
| Invalid WASM inputs                                                                                                                                      | Compiled-WASM security tests                                                        |
| Dependency vulnerabilities                                                                                                                               | `npm audit --audit-level=low`                                                       |
| Pre-commit checks the index and blocks failures                                                                                                          | Isolated tooling regression tests                                                   |

A passed suite means the listed cases pass. It is not a claim of exhaustive input coverage or an independent penetration test. Extend the matrix and tests with every feature.
