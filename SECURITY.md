# Security Policy

## Supported versions

The latest `v1.x` release receives security fixes.

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's private reporting:
<https://github.com/mysterekkk/statkiln/security/advisories/new>

Include what you found, how to reproduce it, and the impact. You can expect an initial response within a few days.

## Security model

- **Token handling:** the token is read from the `github-token` input, masked in logs (`::add-mask::`), sent only in the `Authorization` header to `api.github.com`, and never written to files or included in error messages.
- **Permissions:** the action itself only needs a read-capable token. The example workflow requests `contents: write` solely so the *workflow* can commit the generated SVG files.
- **Inputs:** usernames, themes, card names and numbers are validated against allow-lists. `output-dir` must be a relative path inside the workspace (no `..`, absolute paths, or `.git`/`.github`), and the resolved real path is re-checked before writing so symlinks cannot escape.
- **SVG output:** all text from GitHub data is XML-escaped, colours from external data must be plain hex, and every rendered card is checked to be a complete SVG without scripts, event handlers, `foreignObject`, or entity declarations before anything is written.
- **No code execution:** StatKiln never runs shell commands, evals data, or downloads code at runtime. Production dependencies: none.
- **Supply chain:** `dist/index.js` is built deterministically and verified against the sources in CI. Dependabot watches npm and Actions dependencies. Consider pinning the action to a full commit SHA in security-sensitive repositories.
- **Fork pull requests:** CI uses `pull_request` with read-only permissions, never `pull_request_target`.
