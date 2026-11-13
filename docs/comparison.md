# Comparison with existing projects

Snapshot taken on 2026-11-13 from the public GitHub API and READMEs. Star counts change; check the repos for current numbers. This is an honest orientation, not a claim that StatKiln is better at everything.

| Project | Approach | Notes |
| --- | --- | --- |
| [anuraghazra/github-readme-stats](https://github.com/anuraghazra/github-readme-stats) (~79.8k stars, MIT) | Dynamic image endpoint; can be self-hosted (Vercel) | The reference project and by far the most used. Stats are rendered per request, so you depend on a hosted instance (public instance has had rate-limit outages) or on running your own. |
| [stats-organization/github-stats-extended](https://github.com/stats-organization/github-stats-extended) (~1.7k, MIT) | Fork of the above with more features | Same hosted/self-hosted model, adds extra cards and options. |
| [readme-tools/github-readme-stats-action](https://github.com/readme-tools/github-readme-stats-action) (~326, MIT) | GitHub Action that generates github-readme-stats cards | Static output from an Action, reusing the original card renderer. |
| [jstrieb/github-stats](https://github.com/jstrieb/github-stats) (~3.6k, GPL-3.0) | Python scripts run in Actions, commit SVGs | Can include private repositories (needs a personal token). GPL licence. |
| [cicirello/user-statistician](https://github.com/cicirello/user-statistician) (~136, MIT) | Action producing SVG, configurable | Detailed single-card summary with extensive options. |
| [vn7n24fzkq/github-profile-summary-cards](https://github.com/vn7n24fzkq/github-profile-summary-cards) (~3.7k, MIT) | Action generating several summary cards and themes | Closest in spirit: multiple static cards in Actions. |

`profile-cards-action` named in the brief did not resolve to one clearly canonical repository, so it is not evaluated here.

## Where StatKiln aims to be different

- **Onboarding:** one copy-paste workflow, `username` and token default sensibly, a ready `<picture>` snippet for light/dark.
- **Aesthetics:** a consistent design system, five themes with tested contrast, readable at phone width.
- **Safety:** failed refreshes never overwrite good cards; strict input validation; zero production dependencies; reproducible `dist` verified in CI.
- **Precision:** every number has a documented definition and time range; "longest streak" is never presented as an all-time record.

## Where StatKiln is not (yet) better

- Only public data; no private repository or organization statistics.
- Four cards, no per-repo "pin" cards or custom card editor.
- Much younger and less battle-tested than the projects above.
