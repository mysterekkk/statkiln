# Contributing to StatKiln

Thanks for helping! StatKiln is intentionally small: a TypeScript GitHub Action that renders static SVG cards. No server, no database.

## Setup

Requires Node.js 24.

```bash
npm ci
npm run check   # lint + typecheck + tests + build
```

## Workflow

1. Open an issue for anything bigger than a small fix, so we can agree on scope.
2. Branch from `main`, make your change, add or update tests (`test/`). Tests use fixtures; they must never call the real GitHub API.
3. Run `npm run check`. **Commit the rebuilt `dist/index.js`**; CI fails if it is out of date.
4. Open a pull request using the template.

## Guidelines

- Keep production dependencies at zero unless there is a strong reason.
- Every new number on a card needs a precise definition and time range in the README.
- SVG output must stay self-contained: no external fonts, images or scripts, no `foreignObject`. Any text or colour from external data must go through `esc()` / `safeColor()`.
- Output must be deterministic (no timestamps or randomness in SVG).
- Never log tokens or write them to disk.

## Adding a theme

Add an entry to `src/themes.ts`, run `npm run gallery`, and make sure the contrast test in `test/svg.test.ts` passes.

## Code of conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
