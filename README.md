# TOGAI — downhill chase

A top-down drifting proof of concept: two mountain courses, a fast AI rival with an 18 m head start, and instant retries. Fully overtake the rival and hold that clear pass for five seconds before it reaches the finish to win. WebGPU graphics and 120 Hz WebAssembly physics. No accounts, backend data, or external runtime assets.

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

On a phone or tablet, choose **SCREEN** or **JOYSTICK** on the home screen. Screen is selected on first visit and accelerates automatically. Touch the left or right side to steer; drag that finger down to reduce acceleration, reaching the handbrake after 80 pixels. Drag back up to release it. Touch the bottom fifth of the screen to brake, and lift your finger to resume full acceleration. The brake boundary stays below the car if it moves lower on screen. The Left, Right, and Brake zones fade completely to transparent by GO; the touch controls keep working during the race. Each gesture keeps the command where it started. Joystick mode keeps the centered analog stick: drag upward to accelerate, downward to brake, sideways to steer, or toward a lower corner to drift. Its direction guide eases toward the car during turns. The selected mode is saved in a path-scoped cookie; if cookies are blocked it lasts for the current visit. Pause and restart remain available. Touch cancellation, pause, rotation, and focus loss release held driving inputs. Long presses do not select page text or open a callout. Repeated gameplay taps do not zoom the page.

On Kasumi Pass, both cars line up on the course and wait while Ren, your smug AI rival, sizes you up as a rookie. A warm parchment dialogue panel sits over the course, with a painted blond, blue-jacketed Ren leaning over its top-right edge and a compact teal advance button. The transparent artwork is bundled locally and displayed without a clipping mask. Two pages explain the rules: road borders and car contact together, then the passing goal. Click or press Enter/Space to reveal a line, then advance; the countdown starts only after the second page. Escape returns to the garage. The garage menu has one SOUND ON/OFF control for engine and dialogue audio, and sound starts ON. Reduced-motion mode shows complete lines immediately. Audio unavailability leaves the dialogue playable. Instant retries skip the briefing.

Brake before a corner, turn in, tap the handbrake, then release it and countersteer. The forgiving handbrake keeps more speed and rotation under control. You drive the orange car, shown without a trailing marker, and begin behind the faster AI rival; get your rear axle fully past it and hold the clear pass for five seconds to win. Ren has stronger acceleration, reaches about 51 m/s on open stretches, and uses the handbrake to drift through bends. An unopposed Kasumi descent takes roughly 53 seconds. The HUD shows the remaining time and progress while you hold the pass. The home course preview and live minimap place START at the bottom and FINISH at the top. Any contact with the rival or roadside causes a crash and ends the run; the rival reaching the finish also ends it. This is local 1v1 against AI, not online multiplayer. Downhill is represented visually; there is no elevation simulation.

## Beaufort Mountain

Use the **BEAUFORT MOUNTAIN ↗** button beside **01 / THE COURSE** in the garage. It cycles back to Kasumi Pass and also works on phones. Beaufort starts the countdown immediately without Ren’s introduction; retries keep the selected course.

The 7.46 km snow course is nearly four times as long as Kasumi, mixing long sweeping turns with sharp switchbacks. Both cars accelerate faster and have about 40% more open-road cruising speed. Ren uses gentler acceleration and a lower cruising target here, leaving room to overtake on the long straights. Brake early for the hairpins. Snow piles cover part of the road and slow the car, but you can drive all the way through them without triggering a crash. Long blue ice patches cover only one half of the road: they retain lateral momentum, reduce turning response and give a small speed boost. Normal grip returns after leaving a patch.

A solid, ice-free bridge spans a deep-blue alpine river with gently moving, curved caustic highlights generated by a procedural shader. Compact top-down snowy fir canopies, four alternating snowbank designs, long beveled glassy ice patches, roadside cabins, snow poles and bend markers line the route. Water animation freezes while paused. The chase and crash rules remain the same; the rival completes Beaufort in roughly 155 seconds in the deterministic unopposed simulation.

Each map has its own configuration folder and optional scenery modules in `src/client/maps/`. Adding a new folder with `config.js` and rebuilding automatically includes it in the garage switch. See [the map authoring guide](src/client/maps/README.md).

The garage leaderboard sits below each course's weather strip and shows the fastest winning time for every course. A win is timed when the five-second overtake is confirmed; crashes and losses do not set records. First-time progression and records use a one-year, first-party cookie scoped to the game path. The record belongs to this browser and is user-editable; blocked cookies keep progress for the current visit only. Ren's briefing runs once when first completed.

## Project layout

```text
src/client/       Browser app, race lifecycle, track/AI, renderer
src/client/maps/  Discovered course configs and map-specific scenery/animation
src/physics/      AssemblyScript physics source
src/server/       Restricted static server
public/           Authored HTML and CSS
scripts/          Build and Git tooling
rules/            Engineering policies and definition of done
tests/unit/       Simulation, geometry, controls, tooling
tests/e2e/        Real Chromium/WebGPU feature tests
tests/security/   HTTP attack, WASM input, source policy checks
.githooks/        Mandatory local pre-commit entry point
.github/workflows/deploy-pages.yml  Pages build and deployment
dist/             Generated output; never commit
```

The renderer uploads scenery once per course selection and uses two draw calls on Kasumi and four on Beaufort (terrain, procedural water, road/scenery, and dynamic effects), a reusable dynamic GPU buffer, bounded translucent foreground smoke, trail, and crash-spark effects, and a 1.5 device-pixel-ratio cap. The authored road continues past both the logical start and finish along their tangent, so the shoulders, markings, and guardrails do not end abruptly in view. Smoke drifts over cars without hiding them completely. The HUD updates independently of physics. Shared WASM memory avoids state serialization. The server and browser have no runtime npm dependencies.

## Quality gate

Read [the rules](rules/README.md) and [definition of done](rules/definition-of-done.md). All additions must pass:

```sh
npm run verify
```

This runs zero-warning ESLint (JS/AssemblyScript/CSS), HTML Validate, Prettier, a fresh WASM build, all unit/browser tests, security regression tests, source-policy checks, and `npm audit --audit-level=low` including development dependencies. Any failure or unavailable dependency registry blocks the gate.

Install the browser before the first test/commit:

- **macOS:** install Google Chrome. Tests use its `chrome` channel by default, including older macOS releases unsupported by bundled Chromium.
- **Linux / CI:** run `npx playwright install --with-deps chromium`.
- **Other supported systems:** run `npx playwright install chromium`.
- Set `PLAYWRIGHT_CHANNEL=chrome` to opt into installed Chrome elsewhere.

Linux tests opt into Chromium's trusted-content SwiftShader software renderer for WebGPU; macOS uses the installed Chrome adapter. They verify rendering behavior, not hardware performance. Failed browser tests retain traces/screenshots in `test-results/`.

`npm ci` installs the Git hook through `prepare`. If Git was initialized later, run `npm run hooks:install`. On commit, the hook exports the complete staged index into a temporary directory, installs its exact lockfile with lifecycle scripts disabled, and runs `npm run verify` there. Unstaged work is untouched. Expect the full gate to take tens of seconds or longer; it requires registry access and the installed test browser. It never commits, stages, or fixes files for you.

Useful individual commands: `npm run format`, `npm run lint`, `npm test`, `npm run test:security`, `npm run security:audit`. `npm test` builds first; run `npm run build` before isolated WASM/security tests after physics edits.

The quality gate runs locally through the installed pre-commit hook. GitHub Actions is used for continuous deployment only: it builds the static site and deploys it to GitHub Pages from `main`. The WebGPU browser suite depends on the local browser and GPU environment, so it is not run on GitHub-hosted runners. See the [feature coverage matrix](rules/testing.md) and [security scope](rules/security.md).
