# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0]

### Added

- GitHub Action (`node24`) that generates static SVG cards: overview, top languages, contribution streak, contribution heatmap.
- Five themes (`midnight`, `light`, `github-dark`, `aurora`, `minimal`) and light/dark file pairs for `<picture>`.
- Inputs: `username`, `github-token`, `theme`, `theme-light`, `theme-dark`, `output-dir`, `cards`, `language-count`, `exclude-forks`, `show-border`, `show-icons`, `timezone`, `history-years`.
- GraphQL client with pagination, timeouts, retry with backoff, `Retry-After` support.
- Atomic writes: existing cards are never replaced by a failed or partial run.
- Local CLI (`npm run generate`) sharing the same engine.
