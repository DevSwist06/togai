# Security practices

The current threat model is a local static game with no accounts, backend data, secrets, or multiplayer. The main boundaries are HTTP file access, executable browser content, the WASM API, and development dependencies.

- Bind the server to loopback. Serve only built, allowlisted asset types. Check decoded paths and real paths to block traversal, hidden files, and symlink escapes.
- Reject non-read methods and malformed requests. Return generic errors without filesystem paths or stack traces. Set timeouts and a bounded header size.
- Maintain restrictive CSP, no MIME sniffing, no framing, no referrer, and disabled camera/microphone/geolocation. Permit only `wasm-unsafe-eval` for compiled WASM; never add general `unsafe-eval` or inline scripts.
- Use `textContent` for variable/untrusted content. Existing HTML templates must remain application-owned fixed markup. Never insert user input into HTML.
- Validate WASM index bounds and finite inputs before memory access. Keep memory and visual effects bounded.
- Keep secrets out of the repository and logs. Environment files are ignored; policy checks scan source for common credential signatures. These checks are defense in depth, not a complete secret detector.
- Pin dependencies, use `npm ci` in the local pre-commit gate, and audit all dependencies including development tools. Any audit finding or registry failure blocks the local gate. Do not auto-run `npm audit fix --force`.
- Do not skip a security check to ship. Record the attack regression with every security fix.

Before adding hosting, networking, user input, persistence, or multiplayer, update this threat model and review the new trust boundaries. Local checks do not replace a production security review.
