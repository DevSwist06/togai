# TOGAI — downhill chase

A top-down drifting proof of concept: a 1.95 km mountain pass, a fast AI rival with an 18 m head start, and instant retries. Fully overtake the rival and hold that clear pass for five seconds before it reaches the finish to win. WebGPU graphics and 120 Hz WebAssembly physics. No accounts, backend data, or external runtime assets.

## Setup and play

Use Node 22.13+ (Node 22 LTS recommended) and npm.

```sh
npm ci
npm start
```

Open http://localhost:5173 in a WebGPU-capable browser. `npm start` builds the static app and WASM first. The server binds only to loopback. On a phone, use an HTTPS deployment or access the server through a secure local origin; WebGPU requires a secure context and a compatible graphics adapter. Unsupported browsers show recovery instructions.

## Deploy to GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`. It builds `dist/` with Node 22 and publishes that directory to GitHub Pages whenever `main` is updated. To enable it, open the repository's **Settings → Pages** and select **GitHub Actions** as the source. The workflow can also be started manually from the Actions tab.

The browser assets intentionally use relative URLs, so the game works both at a domain root and at a project URL such as `https://<user>.github.io/togai/`. GitHub Pages hosts only the static frontend; it does not run the local Node server or a PHP/WebSocket signaling service.

| Key         | Action         |
| ----------- | -------------- |
| W / ↑       | Accelerate     |
| A, D / ←, → | Steer          |
| S / ↓       | Brake          |
| Space       | Handbrake      |
| R           | Restart        |
| Escape      | Pause / resume |
| M           | Sound on/off   |

On a touch screen, hold the on-screen arrows to steer and the GAS, BRAKE, and DRIFT buttons to drive. You can hold several controls at once. The pause and restart buttons remain above the game; controls release when a touch is cancelled, the game pauses, or the page loses focus.

Brake before a corner, turn in, tap the handbrake, then release it and countersteer. The forgiving handbrake keeps more speed and rotation under control. You drive the orange car and begin behind the faster AI rival; get your rear axle fully past it and hold the clear pass for five seconds to win. Any contact with the rival or roadside causes a crash and ends the run; the rival reaching the finish also ends it. This is local 1v1 against AI, not online multiplayer. Downhill is represented visually; there is no elevation simulation.

## Project layout

```text
src/client/       Browser app, race lifecycle, track/AI, renderer
src/physics/      AssemblyScript physics source
src/server/       Restricted static server
public/           Authored HTML and CSS
scripts/          Build and Git tooling
rules/            Engineering policies and definition of done
tests/unit/       Simulation, geometry, controls, tooling
tests/e2e/        Real Chromium/WebGPU feature tests
tests/security/   HTTP attack, WASM input, source policy checks
.githooks/        Mandatory local pre-commit entry point
.github/workflows/quality.yml  CI quality gate
dist/             Generated output; never commit
```

The renderer uploads scenery once and uses two draw calls, a reusable dynamic GPU buffer, bounded translucent foreground smoke, trail, and crash-spark effects, and a 1.5 device-pixel-ratio cap. Smoke drifts over cars without hiding them completely. The HUD updates independently of physics. Shared WASM memory avoids state serialization. The server and browser have no runtime npm dependencies.

## Quality gate

Read [the rules](rules/README.md) and [definition of done](rules/definition-of-done.md). All additions must pass:

```sh
npm run verify
```

This runs zero-warning ESLint (JS/AssemblyScript), Stylelint, HTML Validate, Prettier, a fresh WASM build, all unit/browser tests, security regression tests, source-policy checks, and `npm audit --audit-level=low` including development dependencies. Any failure or unavailable dependency registry blocks the gate.

Install the browser before the first test/commit:

- **macOS:** install Google Chrome. Tests use its `chrome` channel by default, including older macOS releases unsupported by bundled Chromium.
- **Linux / CI:** run `npx playwright install --with-deps chromium`.
- **Other supported systems:** run `npx playwright install chromium`.
- Set `PLAYWRIGHT_CHANNEL=chrome` to opt into installed Chrome elsewhere.

Linux tests use software WebGPU; macOS uses the installed Chrome adapter. They verify rendering behavior, not hardware performance. Failed browser tests retain traces/screenshots in `test-results/`.

`npm ci` installs the Git hook through `prepare`. If Git was initialized later, run `npm run hooks:install`. On commit, the hook exports the complete staged index into a temporary directory, installs its exact lockfile with lifecycle scripts disabled, and runs `npm run verify` there. Unstaged work is untouched. Expect the full gate to take tens of seconds or longer; it requires registry access and the installed test browser. It never commits, stages, or fixes files for you.

Useful individual commands: `npm run format`, `npm run lint`, `npm test`, `npm run test:security`, `npm run security:audit`. `npm test` builds first; run `npm run build` before isolated WASM/security tests after physics edits.

CI runs the same gate. Once a remote exists, require the `quality` job in branch protection. Local Git hooks can be bypassed; required CI is the merge safeguard. See the [feature coverage matrix](rules/testing.md) and [security scope](rules/security.md).
