# Engineering rules

These rules apply to every addition, fix, refactor, dependency change, and documentation update. Start with the [definition of done](definition-of-done.md).

- [Architecture and coding](architecture.md)
- [Testing and feature coverage](testing.md)
- [Security](security.md)
- [Definition of done](definition-of-done.md)

`npm run verify` is the full local/pre-commit gate, and `npm run verify:ci` is the required GitHub Actions merge gate. The pre-commit hook tests an isolated copy of the Git index, including partially staged files. It does not stash changes, edit files, auto-stage fixes, or create commits.
