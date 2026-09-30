# Definition of done — every addition

A change is done only when all applicable items below are satisfied. This applies to all contributors, including coding agents.

- [ ] The requested behavior works, with explicit acceptance criteria and scope.
- [ ] Code follows the architecture and performance rules; no unrelated changes.
- [ ] Replaced features have no unused UI, logic, styles, tests, documentation, or implicit fallback left behind.
- [ ] New behavior has meaningful positive, boundary, and failure tests. A bug fix includes a regression test that fails without the fix.
- [ ] A browser-visible change has browser coverage and a visual inspection at desktop and compact widths.
- [ ] Changed trust boundaries, dependencies, data handling, and exported WASM inputs have security checks.
- [ ] `npm run verify` succeeds: **zero lint warnings/errors, a clean build, every unit/browser/security test passing, and zero reported dependency vulnerabilities at any severity**.
- [ ] No skipped/focused tests, secret material, generated build files, or unexplained linter suppressions are added.
- [ ] Rules, README, and the feature/test matrix describe the final behavior.
- [ ] The exact intended files are staged and the installed pre-commit hook passes against that index. Do not use `--no-verify` or bypass a failed gate.
- [ ] Run `npm run verify` locally before committing. GitHub Actions is reserved for building and deploying GitHub Pages because the WebGPU browser suite is not supported reliably on hosted runners.

An unavailable dependency registry, missing browser binary, unsupported test WebGPU adapter, or failed check blocks the gate. It is not a pass or a reason to silently skip checks. Browser dependencies must be installed before committing.

## Change record / PR checklist

Describe the problem, resulting behavior, acceptance criteria, tests run, security impact, performance impact, and documentation changes. Mark non-applicable items with a concrete reason. Never claim performance improvement or complete security assurance without evidence.

Local hooks can be bypassed by Git; they are a convenience and enforcement layer for normal development, not a security boundary. Required CI and branch protection provide the remote merge gate. This project provides CI configuration but cannot configure protection before a remote exists.
