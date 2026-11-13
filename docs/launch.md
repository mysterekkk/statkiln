# Launch copy

Drafts only. Nothing here is published automatically. Post once, in the right place, and answer questions honestly. Do not comment on other authors' issues to promote StatKiln.

Repo: https://github.com/mysterekkk/statkiln

---

## Show HN

**Title:** Show HN: StatKiln – GitHub stats cards built in Actions, committed as static SVG

**Text:**

I wanted profile stats cards without depending on a hosted image endpoint that can hit API rate limits. StatKiln is a GitHub Action (TypeScript, Node 24) that queries the GraphQL API with the workflow's own `GITHUB_TOKEN`, renders four SVG cards (overview, top languages, streak, contribution heatmap) and lets your workflow commit them to your repo. Your README just links to the files.

Technical notes: all cards are rendered and validated in memory and written atomically, so a failed API call leaves the previous cards in place. Output is deterministic, so unchanged data means no commit. There are no production dependencies; the committed `dist/index.js` is verified against the sources in CI. Limits are documented honestly: data is only as fresh as the last scheduled run, only public data is read, and language shares are bytes of code, not skill.

Similar tools exist (github-readme-stats and its action variants, github-profile-summary-cards, user-statistician); there is a short comparison in the repo. Feedback on card design and the numbers' definitions is very welcome.

https://github.com/mysterekkk/statkiln

---

## Reddit

### r/github

**Title:** I made a GitHub Action that generates profile stats cards as static SVGs in your own repo

I got tired of stats images that depend on someone else's server. StatKiln runs on a schedule in your repo, reads public stats with the built-in token, writes SVGs (overview, languages, streak, heatmap, 5 themes, light/dark pairs) and commits them only if something changed. No PAT, no hosting. It's MIT and early, so I'd appreciate bug reports and opinions on the card designs.

https://github.com/mysterekkk/statkiln

### r/programming-adjacent (pick one that allows project posts, e.g. r/opensource or r/typescript)

**Title:** StatKiln: a zero-dependency TypeScript GitHub Action for static profile stats cards

Small project write-up: GraphQL client with retry/backoff on `fetch`, pure stats functions (streak edge cases around today, leap years, year boundaries), an SVG renderer with escaping and validation, atomic writes so failures never clobber existing output, and a deterministic esbuild bundle checked in CI. Source and tests are in the repo; I'm happy to discuss the design trade-offs.

https://github.com/mysterekkk/statkiln

---

## Dev.to

**Title:** Static GitHub stats cards: build them in Actions instead of hosting them

**Body:**

Most profile stats cards are generated on request by a hosted service. That is convenient until the service hits GitHub's API limits and your profile shows a broken image.

StatKiln flips this: a scheduled GitHub Action generates the SVGs and your workflow commits them to your repository. Viewing your profile is just loading files from your own repo.

### How it works

1. A workflow runs daily (or manually).
2. The action queries the GraphQL API with `GITHUB_TOKEN`: repos, stars, forks, language bytes and the contribution calendar.
3. Pure functions compute totals, language shares and streaks.
4. Four SVG renderers produce the cards. Everything is rendered and validated in memory first.
5. Files are written atomically, and only if they changed. The workflow commits.

### Details I cared about

- **Streaks:** a streak stays alive when today has no contributions yet; the "longest" streak is labelled as belonging to the analysed range, not as an all-time record.
- **Failure behaviour:** if the API fails, the job fails and the old cards stay untouched.
- **Safety:** all external text is escaped, colours must be plain hex, `output-dir` can't leave the workspace, and there are no production dependencies.

### Use it

```yaml
- uses: actions/checkout@v7
- uses: mysterekkk/statkiln@v1
  with:
    theme-light: light
    theme-dark: midnight
```

Full workflow, themes and limitations are in the README: https://github.com/mysterekkk/statkiln

---

## GitHub Discussions (Announcements)

**Title:** StatKiln v1.0.0 is out

StatKiln generates static SVG stats cards for your GitHub profile inside GitHub Actions. v1.0.0 includes four cards (overview, languages, streak, heatmap), five themes, light/dark file pairs and a local CLI.

I'd love feedback on:

- Are the card numbers and their definitions clear?
- Which theme or card would you want next?
- Did the quick start work on the first try?

Please open an issue for bugs, and reply here for ideas.
