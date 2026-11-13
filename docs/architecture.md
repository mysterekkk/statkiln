# Architecture

StatKiln is a single-process Node.js 24 program. There is no server, database or container. The same engine runs in GitHub Actions (`dist/index.js`) and locally (`npm run generate`).

```
action.yml ──► src/index.ts ─► src/action.ts ─┐
                                              ├─► src/generate.ts ─► collect ─► github (GraphQL)
npm run generate ─► src/cli.ts ───────────────┘          │
                                                         ├─► stats   (streaks, languages, totals)
                                                         ├─► svg/cards + svg/common + themes
                                                         └─► atomic writeFiles
```

| Module | Responsibility |
| --- | --- |
| `config.ts` | Parses and validates raw inputs (allow-lists, ranges, output-dir path safety) |
| `github.ts` | Minimal GraphQL client over built-in `fetch`: timeout, retry/backoff, `Retry-After`, no secrets in errors |
| `collect.ts` | Paginated repository query, contribution calendar in 365-day windows (GitHub limits ranges to one year) |
| `stats.ts` | Pure functions: streaks, language shares, totals, heatmap levels |
| `dates.ts` | `YYYY-MM-DD` arithmetic in UTC plus "today" in a configured time zone |
| `themes.ts` | Design tokens for the five themes |
| `svg/common.ts` | Escaping, number formatting, icons, document wrapper (title/desc, gradients) |
| `svg/cards.ts` | The four card renderers |
| `generate.ts` | Orchestration, SVG validation, atomic file writing |
| `action.ts` / `cli.ts` | Thin entry points: read inputs/flags, call `generate`, report |

## Design decisions

- **Render first, write last.** Every card is rendered and validated in memory. Files are written only if all cards succeeded, via temp file + rename, and only when content differs. A failure leaves old cards intact.
- **Deterministic output.** SVGs contain no timestamps or randomness, so "nothing changed" yields no diff and no commit.
- **Commit happens in the workflow, not the action.** A JavaScript action should not rewrite git history; keeping the commit step in YAML keeps permissions explicit and visible to users.
- **Streak range is explicit.** Calendar data is fetched in `history-years` windows of 365 days; "longest streak" is always labelled as belonging to that range.
- **Static and self-contained SVG.** System font stack, no external resources, no scripts, no animation (so nothing depends on reduced-motion handling).
- **Zero production dependencies.** `esbuild` bundles the sources into one file (dev dependency only).

## Data sources

One GraphQL query (paginated, max 10 pages of 100 repositories) for profile, followers, stars, forks and language bytes, and one aliased query for all contribution windows. Typical runs make 2–3 API calls.
