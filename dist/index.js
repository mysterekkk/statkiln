import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// src/action.ts
import { appendFileSync } from "node:fs";

// src/config.ts
import { isAbsolute, normalize, resolve, sep } from "node:path";

// src/errors.ts
var StatKilnError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "StatKilnError";
  }
};
var ConfigError = class extends StatKilnError {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
};
var GitHubApiError = class extends StatKilnError {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "GitHubApiError";
  }
  status;
};

// src/themes.ts
var THEMES = {
  midnight: {
    name: "midnight",
    description: "Elegant dark navy with violet accents",
    bg1: "#0f1030",
    bg2: "#1a1648",
    border: "#2e2a6b",
    title: "#f3f1ff",
    text: "#d9d6f5",
    muted: "#a6a3cf",
    accent: "#a78bfa",
    accent2: "#7c9cff",
    track: "#262260",
    heat: ["#221f55", "#3d32a0", "#5b47d6", "#8b6cf5", "#c4b0ff"]
  },
  light: {
    name: "light",
    description: "Clean, professional light theme",
    bg1: "#ffffff",
    bg2: "#f6f8fb",
    border: "#d0d7de",
    title: "#1f2328",
    text: "#31373d",
    muted: "#59636e",
    accent: "#0a69da",
    accent2: "#8250df",
    track: "#e6eaef",
    heat: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"]
  },
  "github-dark": {
    name: "github-dark",
    description: "Close to the GitHub dark palette",
    bg1: "#0d1117",
    bg2: "#161b22",
    border: "#30363d",
    title: "#f0f6fc",
    text: "#c9d1d9",
    muted: "#9198a1",
    accent: "#58a6ff",
    accent2: "#3fb950",
    track: "#21262d",
    heat: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"]
  },
  aurora: {
    name: "aurora",
    description: "Subtle teal and violet gradients",
    bg1: "#0b1d26",
    bg2: "#1a1838",
    border: "#24455a",
    title: "#eafffb",
    text: "#cfeee9",
    muted: "#93bdb8",
    accent: "#2dd4bf",
    accent2: "#a78bfa",
    track: "#16323f",
    heat: ["#14303d", "#0f6a6e", "#139a9f", "#2dd4bf", "#a7f3e4"]
  },
  minimal: {
    name: "minimal",
    description: "Near-monochrome and quiet",
    bg1: "#0a0a0a",
    bg2: "#141414",
    border: "#2a2a2a",
    title: "#fafafa",
    text: "#d4d4d4",
    muted: "#a3a3a3",
    accent: "#fafafa",
    accent2: "#a3a3a3",
    track: "#262626",
    heat: ["#1c1c1c", "#404040", "#737373", "#a8a8a8", "#f5f5f5"]
  }
};
var THEME_NAMES = Object.keys(THEMES);
function getTheme(name) {
  const theme = THEMES[name];
  if (!theme) throw new Error(`Unknown theme: ${name}`);
  return theme;
}

// src/types.ts
var CARD_NAMES = ["overview", "languages", "streak", "contributions"];

// src/config.ts
var USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
function parseBool(name, value, fallback) {
  if (value === void 0 || value.trim() === "") return fallback;
  const v = value.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  throw new ConfigError(`Input "${name}" must be "true" or "false" (got "${value}").`);
}
function parseIntInRange(name, value, fallback, min, max) {
  if (value === void 0 || value.trim() === "") return fallback;
  if (!/^\d+$/.test(value.trim())) throw new ConfigError(`Input "${name}" must be an integer (got "${value}").`);
  const n = Number(value);
  if (n < min || n > max) throw new ConfigError(`Input "${name}" must be between ${min} and ${max} (got ${n}).`);
  return n;
}
function validateTheme(name, input) {
  if (!THEME_NAMES.includes(name)) {
    throw new ConfigError(`Input "${input}" has unknown theme "${name}". Available: ${THEME_NAMES.join(", ")}.`);
  }
  return name;
}
function hasProtectedSegment(segments) {
  return segments.some((s) => [".git", ".github"].includes(s.toLowerCase()));
}
function validateOutputDir(dir, root) {
  const trimmed = dir.trim();
  if (trimmed === "") throw new ConfigError('Input "output-dir" must not be empty.');
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) throw new ConfigError('Input "output-dir" contains an invalid character.');
  if (isAbsolute(trimmed) || /^[a-z]:/i.test(trimmed) || trimmed.startsWith("\\\\")) {
    throw new ConfigError('Input "output-dir" must be a relative path inside the repository.');
  }
  const normalized = normalize(trimmed);
  const absRoot = resolve(root);
  const absTarget = resolve(absRoot, normalized);
  if (absTarget !== absRoot && !absTarget.startsWith(absRoot + sep)) {
    throw new ConfigError('Input "output-dir" must stay inside the repository (no "..").');
  }
  if (absTarget === absRoot) {
    throw new ConfigError('Input "output-dir" must be a subdirectory, not the repository root.');
  }
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  if (hasProtectedSegment(segments)) {
    throw new ConfigError('Input "output-dir" must not point into ".git" or ".github".');
  }
  return segments.join("/");
}
function parseCards(value) {
  if (value === void 0 || value.trim() === "") return [...CARD_NAMES];
  const parts = value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (parts.length === 0) return [...CARD_NAMES];
  const out = [];
  for (const p of parts) {
    if (!CARD_NAMES.includes(p)) {
      throw new ConfigError(`Input "cards" has unknown card "${p}". Available: ${CARD_NAMES.join(", ")}.`);
    }
    if (!out.includes(p)) out.push(p);
  }
  return out;
}
function validateTimezone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    throw new ConfigError(`Input "timezone" is not a valid IANA time zone (got "${tz}").`);
  }
}
function parseConfig(raw, workspace) {
  const username = (raw["username"] ?? "").trim();
  if (!username) throw new ConfigError('Input "username" is required.');
  if (!USERNAME_RE.test(username)) throw new ConfigError(`"${username}" is not a valid GitHub username.`);
  const token = (raw["github-token"] ?? "").trim();
  if (!token) {
    throw new ConfigError(
      "No GitHub token found. In a workflow pass `github-token: ${{ secrets.GITHUB_TOKEN }}`."
    );
  }
  const theme = validateTheme((raw["theme"] ?? "midnight").trim() || "midnight", "theme");
  const lightRaw = (raw["theme-light"] ?? "").trim();
  const darkRaw = (raw["theme-dark"] ?? "").trim();
  if (Boolean(lightRaw) !== Boolean(darkRaw)) {
    throw new ConfigError('Inputs "theme-light" and "theme-dark" must be set together.');
  }
  return {
    username,
    token,
    theme,
    themeLight: lightRaw ? validateTheme(lightRaw, "theme-light") : null,
    themeDark: darkRaw ? validateTheme(darkRaw, "theme-dark") : null,
    outputDir: validateOutputDir(raw["output-dir"] ?? "assets/statkiln", workspace),
    cards: parseCards(raw["cards"]),
    languageCount: parseIntInRange("language-count", raw["language-count"], 6, 1, 12),
    excludeForks: parseBool("exclude-forks", raw["exclude-forks"], true),
    showBorder: parseBool("show-border", raw["show-border"], true),
    showIcons: parseBool("show-icons", raw["show-icons"], true),
    timezone: validateTimezone((raw["timezone"] ?? "UTC").trim() || "UTC"),
    historyYears: parseIntInRange("history-years", raw["history-years"], 3, 1, 10)
  };
}

// src/generate.ts
import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve as resolve2, sep as sep2 } from "node:path";

// src/dates.ts
var DAY_MS = 864e5;
function parseDate(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function formatDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
function addDays(date, days) {
  return formatDate(parseDate(date) + days * DAY_MS);
}
function diffDays(a, b) {
  return Math.round((parseDate(a) - parseDate(b)) / DAY_MS);
}
function weekday(date) {
  return new Date(parseDate(date)).getUTCDay();
}
function todayIn(timeZone, now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthShort(date) {
  return MONTHS[new Date(parseDate(date)).getUTCMonth()] ?? "";
}
function prettyDate(date) {
  const d = new Date(parseDate(date));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// src/collect.ts
var MAX_REPO_PAGES = 10;
var PROFILE_QUERY = `
query StatKilnProfile($login: String!, $after: String) {
  user(login: $login) {
    login
    name
    createdAt
    followers { totalCount }
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, privacy: PUBLIC, orderBy: {field: PUSHED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        isFork
        stargazerCount
        forkCount
        languages(first: 12, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;
function buildWindows(today, createdAt, years) {
  const created = createdAt.slice(0, 10);
  const windows = [];
  for (let i = 0; i < years; i++) {
    const to = addDays(today, -i * 365);
    const from = addDays(to, -364);
    if (i > 0 && to < created) break;
    windows.push({ from, to });
  }
  return windows;
}
function calendarQuery(n) {
  const vars = Array.from({ length: n }, (_, i) => `$f${i}: DateTime!, $t${i}: DateTime!`).join(", ");
  const fields = Array.from(
    { length: n },
    (_, i) => `
    w${i}: contributionsCollection(from: $f${i}, to: $t${i}) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    }`
  ).join("");
  return `query StatKilnCalendar($login: String!, ${vars}) { user(login: $login) { ${fields} } }`;
}
async function fetchRepos(graphql, login) {
  const repos = [];
  let profile = null;
  let after = null;
  for (let page = 0; page < MAX_REPO_PAGES; page++) {
    const data = await graphql(PROFILE_QUERY, { login, after });
    if (!data.user) throw new GitHubApiError(`GitHub user "${login}" was not found.`, 404);
    profile ??= data.user;
    for (const node of data.user.repositories.nodes) {
      if (!node) continue;
      repos.push({
        isFork: node.isFork,
        stars: node.stargazerCount,
        forks: node.forkCount,
        languages: (node.languages?.edges ?? []).map((e) => ({ name: e.node.name, color: e.node.color, size: e.size }))
      });
    }
    const info = data.user.repositories.pageInfo;
    if (!info.hasNextPage || !info.endCursor) break;
    after = info.endCursor;
  }
  return { profile, repos };
}
async function fetchCalendar(graphql, login, windows) {
  const variables = { login };
  windows.forEach((w, i) => {
    variables[`f${i}`] = `${w.from}T00:00:00Z`;
    variables[`t${i}`] = `${w.to}T23:59:59Z`;
  });
  const data = await graphql(calendarQuery(windows.length), variables);
  if (!data.user) throw new GitHubApiError(`GitHub user "${login}" was not found.`, 404);
  const byDate = /* @__PURE__ */ new Map();
  windows.forEach((w, i) => {
    const win = data.user?.[`w${i}`];
    if (!win) return;
    for (const week of win.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        if (day.date >= w.from && day.date <= w.to) byDate.set(day.date, day.contributionCount);
      }
    }
  });
  const days = [...byDate.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([date, count]) => ({ date, count }));
  const recent = data.user["w0"];
  return {
    days,
    last12m: {
      contributions: recent?.contributionCalendar.totalContributions ?? 0,
      pullRequests: recent?.totalPullRequestContributions ?? 0,
      issues: recent?.totalIssueContributions ?? 0,
      commits: recent?.totalCommitContributions ?? 0
    }
  };
}
async function collectUserData(graphql, login, today, historyYears) {
  parseDate(today);
  const { profile, repos } = await fetchRepos(graphql, login);
  const windows = buildWindows(today, profile.createdAt, historyYears);
  const { days, last12m } = await fetchCalendar(graphql, profile.login, windows);
  const oldest = windows[windows.length - 1];
  return {
    login: profile.login,
    name: profile.name,
    followers: profile.followers.totalCount,
    createdAt: profile.createdAt,
    repos,
    days,
    last12m,
    rangeStart: oldest ? oldest.from : formatDate(parseDate(today)),
    rangeEnd: today
  };
}

// src/github.ts
var defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
function retryDelayMs(res, attempt, maxWaitMs) {
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter.trim())) {
    return Math.min(Number(retryAfter) * 1e3, maxWaitMs);
  }
  const reset = res.headers.get("x-ratelimit-reset");
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (remaining === "0" && reset && /^\d+$/.test(reset)) {
    return Math.min(Math.max(Number(reset) * 1e3 - Date.now(), 1e3), maxWaitMs);
  }
  return Math.min(1e3 * 2 ** attempt, maxWaitMs);
}
function createGraphQLClient(opts) {
  const endpoint = opts.endpoint ?? "https://api.github.com/graphql";
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const maxRetries = opts.maxRetries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 2e4;
  const maxWaitMs = opts.maxWaitMs ?? 6e4;
  return async function graphql(query, variables = {}) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let res;
      try {
        res = await doFetch(endpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${opts.token}`,
            "content-type": "application/json",
            "user-agent": "statkiln"
          },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(timeoutMs)
        });
      } catch (err) {
        const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
        lastError = new GitHubApiError(
          timedOut ? `GitHub API request timed out after ${timeoutMs} ms.` : "Network error while contacting the GitHub API."
        );
        if (attempt < maxRetries) {
          await sleep(Math.min(1e3 * 2 ** attempt, maxWaitMs));
          continue;
        }
        throw lastError;
      }
      if (res.status === 429 || res.status === 403 || res.status >= 500) {
        const rateLimited = res.status === 429 || res.status === 403;
        lastError = new GitHubApiError(
          rateLimited ? `GitHub API rate limit or permission error (HTTP ${res.status}).` : `GitHub API server error (HTTP ${res.status}).`,
          res.status
        );
        const hint = res.headers.get("retry-after") ?? res.headers.get("x-ratelimit-remaining");
        const retryable = res.status !== 403 || hint !== null;
        if (retryable && attempt < maxRetries) {
          await sleep(retryDelayMs(res, attempt, maxWaitMs));
          continue;
        }
        throw lastError;
      }
      if (res.status === 401) {
        throw new GitHubApiError('GitHub rejected the token (HTTP 401). Check the "github-token" input.', 401);
      }
      if (!res.ok) throw new GitHubApiError(`Unexpected GitHub API response (HTTP ${res.status}).`, res.status);
      let body;
      try {
        body = await res.json();
      } catch {
        throw new GitHubApiError("GitHub API returned a response that is not valid JSON.");
      }
      if (body.errors?.length) {
        const first = body.errors[0];
        if (first?.type === "NOT_FOUND") {
          throw new GitHubApiError(first.message ?? "GitHub user not found.", 404);
        }
        const limited = body.errors.some((e) => e.type === "RATE_LIMITED");
        if (limited && attempt < maxRetries) {
          lastError = new GitHubApiError("GitHub GraphQL rate limit reached.", 429);
          await sleep(Math.min(1e3 * 2 ** attempt, maxWaitMs));
          continue;
        }
        throw new GitHubApiError(`GitHub GraphQL error: ${first?.message ?? "unknown error"}`);
      }
      if (!body.data) throw new GitHubApiError("GitHub API returned no data.");
      return body.data;
    }
    throw lastError ?? new GitHubApiError("GitHub API request failed.");
  };
}

// src/stats.ts
var EMPTY = { length: 0, start: "", end: "" };
function computeStreaks(days, today) {
  const byDate = /* @__PURE__ */ new Map();
  for (const d of days) byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.count);
  const dates = [...byDate.keys()].sort();
  if (dates.length === 0) {
    return { current: EMPTY, longest: EMPTY, total: 0, rangeStart: today, rangeEnd: today };
  }
  const first = dates[0];
  const lastData = dates[dates.length - 1];
  const rangeEnd = lastData > today ? lastData : today;
  let total = 0;
  let longest = EMPTY;
  let runStart = "";
  let runLen = 0;
  const span = diffDays(rangeEnd, first);
  for (let i = 0; i <= span; i++) {
    const date = addDays(first, i);
    const count = byDate.get(date) ?? 0;
    total += count;
    if (count > 0) {
      if (runLen === 0) runStart = date;
      runLen++;
      if (runLen > longest.length) longest = { length: runLen, start: runStart, end: date };
    } else {
      runLen = 0;
    }
  }
  let cursor = (byDate.get(today) ?? 0) > 0 ? today : addDays(today, -1);
  let current = EMPTY;
  if ((byDate.get(cursor) ?? 0) > 0) {
    const end = cursor;
    let len = 0;
    while ((byDate.get(cursor) ?? 0) > 0) {
      len++;
      cursor = addDays(cursor, -1);
    }
    current = { length: len, start: addDays(cursor, 1), end };
  }
  return { current, longest, total, rangeStart: first, rangeEnd };
}
function computeRepoTotals(repos, excludeForks) {
  const list = excludeForks ? repos.filter((r) => !r.isFork) : repos;
  return {
    repos: list.length,
    stars: list.reduce((s, r) => s + r.stars, 0),
    forks: list.reduce((s, r) => s + r.forks, 0)
  };
}
var OTHER_COLOR = "#8b949e";
var FALLBACK_COLOR = "#8b949e";
function computeLanguages(repos, excludeForks, count) {
  const list = excludeForks ? repos.filter((r) => !r.isFork) : repos;
  const totals = /* @__PURE__ */ new Map();
  for (const repo of list) {
    for (const l of repo.languages) {
      if (l.size <= 0) continue;
      const cur = totals.get(l.name);
      if (cur) cur.size += l.size;
      else totals.set(l.name, { color: l.color ?? FALLBACK_COLOR, size: l.size });
    }
  }
  const all = [...totals.entries()].map(([name, v]) => ({ name, color: v.color, size: v.size })).sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
  const sum = all.reduce((s, l) => s + l.size, 0);
  if (sum === 0) return [];
  const pct = (size) => Math.round(size / sum * 1e3) / 10;
  const top = all.slice(0, count).map((l) => ({ ...l, percent: pct(l.size) }));
  const rest = all.slice(count);
  if (rest.length > 0) {
    const size = rest.reduce((s, l) => s + l.size, 0);
    top.push({ name: "Other", color: OTHER_COLOR, size, percent: pct(size) });
  }
  return top;
}
function heatThresholds(days) {
  const nz = days.map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b);
  if (nz.length === 0) return [1, 2, 3];
  const q = (p) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))];
  return [q(0.25), q(0.5), q(0.75)];
}
function heatLevel(count, t) {
  if (count <= 0) return 0;
  if (count <= t[0]) return 1;
  if (count <= t[1]) return 2;
  if (count <= t[2]) return 3;
  return 4;
}

// src/svg/common.ts
var XML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
function esc(value) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "").replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
}
function truncate(value, max) {
  const chars = [...value];
  if (chars.length <= max) return value;
  return chars.slice(0, Math.max(1, max - 1)).join("").trimEnd() + "…";
}
function safeColor(value, fallback) {
  return value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : fallback;
}
function formatNumber(n) {
  if (!Number.isFinite(n)) return "0";
  const v = Math.round(n);
  if (Math.abs(v) < 1e4) return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (Math.abs(v) < 1e6) return `${(Math.round(v / 100) / 10).toString()}k`;
  return `${(Math.round(v / 1e5) / 10).toString()}M`;
}
function num(n) {
  return String(Math.round(n * 100) / 100);
}
function text(x, y, content, o) {
  const anchor = o.anchor && o.anchor !== "start" ? ` text-anchor="${o.anchor}"` : "";
  const weight = o.weight ? ` font-weight="${o.weight}"` : "";
  return `<text x="${num(x)}" y="${num(y)}" font-size="${o.size ?? 13}"${weight}${anchor} fill="${o.fill}">${esc(content)}</text>`;
}
var ICONS = {
  repo: '<path d="M3.5 2.5h8.5v9.5H4.8a1.3 1.3 0 0 0 0 2.6H12"/><path d="M3.5 2.5v10.1"/>',
  star: '<path d="M8 1.8l1.9 4 4.4.5-3.3 3 .9 4.3L8 11.4 4.1 13.6 5 9.3 1.7 6.3l4.4-.5z"/>',
  fork: '<circle cx="4.5" cy="3.5" r="1.7"/><circle cx="11.5" cy="3.5" r="1.7"/><circle cx="8" cy="12.5" r="1.7"/><path d="M4.5 5.2v.8a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-.8M8 8v2.8"/>',
  people: '<circle cx="6" cy="5" r="2.3"/><path d="M1.6 13.4c0-2.4 1.9-3.9 4.4-3.9s4.4 1.5 4.4 3.9"/><path d="M10.6 3a2.2 2.2 0 0 1 0 4.2M12 9.8c1.6.4 2.6 1.6 2.6 3.6"/>',
  activity: '<path d="M1.5 8.5h3l2-5.5 3 10 2-4.5h3"/>',
  pr: '<circle cx="4" cy="3.5" r="1.6"/><circle cx="4" cy="12.5" r="1.6"/><circle cx="12" cy="12.5" r="1.6"/><path d="M4 5.1v5.8M12 10.9V7a2 2 0 0 0-2-2H8.5"/>'
};
function icon(name, x, y, size, color) {
  const scale = size / 16;
  return `<g transform="translate(${num(x)} ${num(y)}) scale(${num(scale)})" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</g>`;
}
var FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
function svgDocument(o) {
  const { theme: t } = o;
  const stroke = o.showBorder ? ` stroke="${t.border}" stroke-width="1"` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}" role="img" aria-labelledby="sk-title sk-desc">`,
    `<title id="sk-title">${esc(o.title)}</title>`,
    `<desc id="sk-desc">${esc(o.desc)}</desc>`,
    `<defs><linearGradient id="sk-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg1}"/><stop offset="1" stop-color="${t.bg2}"/></linearGradient><linearGradient id="sk-accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient></defs>`,
    `<rect x="0.5" y="0.5" width="${o.width - 1}" height="${o.height - 1}" rx="12" fill="url(#sk-bg)"${stroke}/>`,
    `<g font-family="${FONT}">`,
    o.body,
    "</g>",
    "</svg>",
    ""
  ].join("\n");
}
function cardHeader(theme, title, subtitle) {
  return [
    text(24, 38, title, { size: 18, weight: 700, fill: theme.title }),
    text(24, 58, subtitle, { size: 12, fill: theme.muted }),
    `<rect x="24" y="68" width="40" height="3" rx="1.5" fill="url(#sk-accent)"/>`
  ].join("\n");
}

// src/svg/cards.ts
function displayName(data) {
  const name = data.name?.trim();
  if (name && name.toLowerCase() !== data.login.toLowerCase()) {
    return { title: truncate(name, 26), subtitle: `@${truncate(data.login, 39)}` };
  }
  return { title: truncate(data.login, 26), subtitle: "GitHub profile" };
}
function renderOverview(data, o) {
  const t = o.theme;
  const totals = computeRepoTotals(data.repos, o.excludeForks);
  const { title, subtitle } = displayName(data);
  const m = data.last12m;
  const cells = [
    { icon: "repo", value: formatNumber(totals.repos), label: "Public repos" },
    { icon: "star", value: formatNumber(totals.stars), label: "Stars earned" },
    { icon: "fork", value: formatNumber(totals.forks), label: "Forks" },
    { icon: "people", value: formatNumber(data.followers), label: "Followers" },
    { icon: "activity", value: formatNumber(m.contributions), label: "Contributions, 12 mo" },
    { icon: "pr", value: `${formatNumber(m.pullRequests)} / ${formatNumber(m.issues)}`, label: "PRs / issues, 12 mo" }
  ];
  const parts = [cardHeader(t, title, subtitle)];
  cells.forEach((c, i) => {
    const x = 24 + i % 3 * 168;
    const y = 94 + Math.floor(i / 3) * 70;
    const tx = o.showIcons ? x + 44 : x;
    if (o.showIcons) {
      parts.push(`<rect x="${x}" y="${y}" width="34" height="34" rx="9" fill="${t.track}"/>`);
      parts.push(icon(c.icon, x + 9, y + 9, 16, t.accent));
    }
    parts.push(text(tx, y + 15, c.value, { size: 21, weight: 700, fill: t.title }));
    parts.push(text(tx, y + 33, c.label, { size: 10.5, fill: t.muted }));
  });
  const desc = `${data.login} has ${totals.repos} public repositories with ${totals.stars} stars and ${totals.forks} forks, ${data.followers} followers, and ${m.contributions} contributions in the last 12 months (${m.pullRequests} pull requests, ${m.issues} issues).`;
  return svgDocument({
    width: 540,
    height: 228,
    theme: t,
    title: `GitHub overview for ${data.login}`,
    desc,
    body: parts.join("\n"),
    showBorder: o.showBorder
  });
}
function renderLanguages(data, o) {
  const t = o.theme;
  const langs = computeLanguages(data.repos, o.excludeForks, o.languageCount);
  const repoCount = computeRepoTotals(data.repos, o.excludeForks).repos;
  const parts = [
    cardHeader(
      t,
      "Top languages",
      `By bytes of code across ${formatNumber(repoCount)} public ${repoCount === 1 ? "repo" : "repos"}${o.excludeForks ? ", forks excluded" : ""}`
    )
  ];
  const rowH = 32;
  const top = 96;
  if (langs.length === 0) {
    parts.push(text(24, top + 14, "No language data found in public repositories.", { size: 13, fill: t.muted }));
  }
  langs.forEach((l, i) => {
    const y = top + i * rowH;
    const color = safeColor(l.color, t.muted);
    const barW = 220;
    const fillW = Math.max(3, barW * l.percent / 100);
    parts.push(`<circle cx="30" cy="${y - 4}" r="5" fill="${color}"/>`);
    parts.push(text(44, y, truncate(l.name, 20), { size: 13, weight: 500, fill: t.text }));
    parts.push(`<rect x="196" y="${y - 10}" width="${barW}" height="8" rx="4" fill="${t.track}"/>`);
    parts.push(`<rect x="196" y="${y - 10}" width="${num(fillW)}" height="8" rx="4" fill="${color}"/>`);
    parts.push(text(496, y, `${l.percent.toFixed(1)}%`, { size: 12, fill: t.muted, anchor: "end" }));
  });
  const height = top + Math.max(1, langs.length) * rowH + 8;
  const summary = langs.map((l) => `${l.name} ${l.percent.toFixed(1)}%`).join(", ");
  return svgDocument({
    width: 520,
    height,
    theme: t,
    title: `Top languages for ${data.login}`,
    desc: langs.length ? `Language share by code size: ${summary}.` : "No language data available.",
    body: parts.join("\n"),
    showBorder: o.showBorder
  });
}
function rangeLabel(r) {
  if (r.length === 0) return "No streak yet";
  if (r.start === r.end) return prettyDate(r.start);
  const sameYear = r.start.slice(0, 4) === r.end.slice(0, 4);
  const startLabel = sameYear ? prettyDate(r.start).replace(/, \d{4}$/, "") : prettyDate(r.start);
  return `${startLabel} – ${prettyDate(r.end)}`;
}
function renderStreak(data, o) {
  const t = o.theme;
  const s = computeStreaks(data.days, o.today);
  const created = data.createdAt.slice(0, 10);
  const from = s.rangeStart < created ? created : s.rangeStart;
  const colW = 472 / 3;
  const cx = (i) => 24 + colW * i + colW / 2;
  const parts = [cardHeader(t, "Contribution streak", "Consecutive days with at least one contribution")];
  parts.push(`<circle cx="${num(cx(0))}" cy="124" r="38" fill="none" stroke="${s.current.length > 0 ? "url(#sk-accent)" : t.track}" stroke-width="4"/>`);
  parts.push(text(cx(0), 133, formatNumber(s.current.length), { size: 28, weight: 800, fill: t.title, anchor: "middle" }));
  parts.push(text(cx(0), 186, "Current streak", { size: 12, weight: 600, fill: t.text, anchor: "middle" }));
  parts.push(text(cx(0), 202, s.current.length > 0 ? rangeLabel(s.current) : "No active streak", { size: 10.5, fill: t.muted, anchor: "middle" }));
  parts.push(text(cx(1), 133, formatNumber(s.longest.length), { size: 32, weight: 800, fill: t.accent, anchor: "middle" }));
  parts.push(text(cx(1), 186, "Longest streak", { size: 12, weight: 600, fill: t.text, anchor: "middle" }));
  parts.push(text(cx(1), 202, rangeLabel(s.longest), { size: 10.5, fill: t.muted, anchor: "middle" }));
  parts.push(text(cx(2), 133, formatNumber(s.total), { size: 32, weight: 800, fill: t.accent2, anchor: "middle" }));
  parts.push(text(cx(2), 186, "Contributions", { size: 12, weight: 600, fill: t.text, anchor: "middle" }));
  parts.push(text(cx(2), 202, `${prettyDate(from).replace(/^\w+ \d+, /, "")} – ${prettyDate(s.rangeEnd).replace(/^\w+ \d+, /, "")}`, { size: 10.5, fill: t.muted, anchor: "middle" }));
  for (const i of [1, 2]) {
    parts.push(`<line x1="${num(24 + colW * i)}" y1="92" x2="${num(24 + colW * i)}" y2="206" stroke="${t.border}" stroke-width="1"/>`);
  }
  parts.push(text(24, 238, `Analysed range: ${prettyDate(from)} – ${prettyDate(s.rangeEnd)}. "Longest" applies to this range only.`, { size: 10, fill: t.muted }));
  const desc = `Current streak ${s.current.length} days, longest streak ${s.longest.length} days, ${s.total} contributions between ${from} and ${s.rangeEnd}.`;
  return svgDocument({
    width: 520,
    height: 256,
    theme: t,
    title: `Contribution streak for ${data.login}`,
    desc,
    body: parts.join("\n"),
    showBorder: o.showBorder
  });
}
function renderContributions(data, o) {
  const t = o.theme;
  const end = o.today;
  const start = addDays(end, -364);
  const counts = new Map(data.days.map((d) => [d.date, d.count]));
  const windowDays = data.days.filter((d) => d.date >= start && d.date <= end);
  const total = windowDays.reduce((s, d) => s + d.count, 0);
  const thresholds = heatThresholds(windowDays);
  const cell = 10;
  const step = 13;
  const left = 54;
  const top = 96;
  const gridStart = addDays(start, -weekday(start));
  const cols = Math.floor(diffDays(end, gridStart) / 7) + 1;
  const width = left + cols * step - (step - cell) + 24;
  const parts = [
    cardHeader(
      t,
      "Contribution activity",
      `${formatNumber(total)} ${total === 1 ? "contribution" : "contributions"} in the last year`
    )
  ];
  let lastLabelCol = -10;
  let lastMonth = "";
  for (let c = 0; c < cols; c++) {
    const firstDay = addDays(gridStart, c * 7);
    const month = monthShort(firstDay);
    const day = Number(firstDay.slice(8, 10));
    const containsFirst = day <= 7;
    if (containsFirst && month !== lastMonth && c - lastLabelCol >= 3 || c === 0) {
      if (c === 0 && cols > 3 && Number(addDays(gridStart, 7).slice(8, 10)) <= 7) {
        lastMonth = month;
        continue;
      }
      parts.push(text(left + c * step, top - 10, month, { size: 10, fill: t.muted }));
      lastLabelCol = c;
      lastMonth = month;
    }
  }
  ["Mon", "Wed", "Fri"].forEach((label, i) => {
    parts.push(text(24, top + (1 + i * 2) * step + 8, label, { size: 9, fill: t.muted }));
  });
  const cells = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 7; r++) {
      const date = addDays(gridStart, c * 7 + r);
      if (date < start || date > end) continue;
      const level = heatLevel(counts.get(date) ?? 0, thresholds);
      cells.push(`<rect x="${left + c * step}" y="${top + r * step}" width="${cell}" height="${cell}" rx="2" fill="${t.heat[level]}"/>`);
    }
  }
  parts.push(`<g>${cells.join("")}</g>`);
  const ly = top + 7 * step + 14;
  const legendRight = width - 24;
  parts.push(text(legendRight - 5 * step - 34, ly + 9, "Less", { size: 10, fill: t.muted, anchor: "end" }));
  t.heat.forEach((color, i) => {
    parts.push(`<rect x="${legendRight - 5 * step - 28 + i * step}" y="${ly}" width="${cell}" height="${cell}" rx="2" fill="${color}"/>`);
  });
  parts.push(text(legendRight - 5 * step + 38, ly + 9, "More", { size: 10, fill: t.muted }));
  return svgDocument({
    width,
    height: ly + 28,
    theme: t,
    title: `Contribution activity for ${data.login}`,
    desc: `${total} contributions between ${start} and ${end}, shown as a weekly grid with five intensity levels.`,
    body: parts.join("\n"),
    showBorder: o.showBorder
  });
}

// src/generate.ts
var RENDERERS = {
  overview: renderOverview,
  languages: renderLanguages,
  streak: renderStreak,
  contributions: renderContributions
};
function validateSvg(name, svg) {
  if (!svg.startsWith("<svg ") || !svg.trimEnd().endsWith("</svg>")) {
    throw new StatKilnError(`Rendered ${name} is not a complete SVG document.`);
  }
  const markup = svg.replace(/>[^<]*</g, "><");
  if (/<script|<foreignObject|javascript:|\son\w+\s*=|<!ENTITY|<!DOCTYPE/i.test(markup)) {
    throw new StatKilnError(`Rendered ${name} contains forbidden content.`);
  }
  if (/NaN|undefined|Infinity/.test(markup)) {
    throw new StatKilnError(`Rendered ${name} contains invalid values.`);
  }
}
function renderAll(data, config, today) {
  const variants = config.themeLight && config.themeDark ? [
    { suffix: "-light", theme: config.themeLight },
    { suffix: "-dark", theme: config.themeDark }
  ] : [{ suffix: "", theme: config.theme }];
  const files = [];
  for (const card of config.cards) {
    for (const v of variants) {
      const name = `${card}${v.suffix}.svg`;
      const content = RENDERERS[card](data, {
        theme: getTheme(v.theme),
        showBorder: config.showBorder,
        showIcons: config.showIcons,
        excludeForks: config.excludeForks,
        languageCount: config.languageCount,
        today
      });
      validateSvg(name, content);
      files.push({ name, content });
    }
  }
  return files;
}
async function writeFiles(files, workspace, outputDir) {
  const root = await realpath(resolve2(workspace));
  const dir = resolve2(root, outputDir);
  await mkdir(dir, { recursive: true });
  const realDir = await realpath(dir);
  if (realDir !== root && !realDir.startsWith(root + sep2)) {
    throw new StatKilnError("Output directory resolves outside the repository (symlink?). Refusing to write.");
  }
  const rel = realDir.slice(root.length).split(sep2).filter(Boolean);
  if (hasProtectedSegment(rel)) {
    throw new StatKilnError('Output directory resolves into ".git" or ".github". Refusing to write.');
  }
  const written = [];
  const changed = [];
  for (const f of files) {
    const target = join(realDir, f.name);
    const existing = await readFile(target, "utf8").catch(() => null);
    written.push(`${outputDir}/${f.name}`);
    if (existing === f.content) continue;
    const tmp = join(realDir, `.${f.name}.tmp`);
    try {
      await rm(tmp, { force: true });
      await writeFile(tmp, f.content, { encoding: "utf8", flag: "wx" });
      await rename(tmp, target);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
    changed.push(`${outputDir}/${f.name}`);
  }
  return { written, changed };
}
async function generate(config, workspace, deps = {}) {
  const graphql = deps.graphql ?? createGraphQLClient({ token: config.token });
  const today = todayIn(config.timezone, deps.now);
  const data = await collectUserData(graphql, config.username, today, config.historyYears);
  const files = renderAll(data, config, today);
  const result = await writeFiles(files, workspace, config.outputDir);
  return { ...result, data };
}

// src/action.ts
var INPUT_NAMES = [
  "username",
  "github-token",
  "theme",
  "theme-light",
  "theme-dark",
  "output-dir",
  "cards",
  "language-count",
  "exclude-forks",
  "show-border",
  "show-icons",
  "timezone",
  "history-years"
];
function getInputs(env) {
  const out = {};
  for (const name of INPUT_NAMES) out[name] = env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`];
  return out;
}
function setOutput(env, name, value) {
  const file = env["GITHUB_OUTPUT"];
  if (/[\r\n]/.test(value)) throw new StatKilnError(`Refusing to write multi-line value for output "${name}".`);
  if (file) appendFileSync(file, `${name}=${value}
`);
}
function cmdEscape(s) {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
async function run(env = process.env) {
  const inputs = getInputs(env);
  const token = inputs["github-token"]?.trim();
  if (token) console.log(`::add-mask::${cmdEscape(token)}`);
  try {
    const workspace = env["GITHUB_WORKSPACE"] ?? process.cwd();
    const config = parseConfig(inputs, workspace);
    const { written, changed, data } = await generate(config, workspace);
    setOutput(env, "files", written.join(","));
    setOutput(env, "changed", changed.length > 0 ? "true" : "false");
    console.log(`StatKiln: generated ${written.length} file(s) for ${data.login}; ${changed.length} changed.`);
    for (const f of written) console.log(`  - ${cmdEscape(f)}${changed.includes(f) ? " (updated)" : ""}`);
    return 0;
  } catch (err) {
    const message = err instanceof StatKilnError ? err.message : "Unexpected internal error.";
    console.log(`::error title=StatKiln failed::${cmdEscape(message)}`);
    console.log("StatKiln left any previously generated files untouched.");
    return 1;
  }
}

// src/index.ts
process.exitCode = await run();
