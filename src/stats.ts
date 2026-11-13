import { addDays, diffDays } from './dates';
import type { ContributionDay, RepoStat } from './types';

export interface StreakRange {
  length: number;
  /** YYYY-MM-DD, empty string when length is 0 */
  start: string;
  end: string;
}

export interface StreakStats {
  current: StreakRange;
  longest: StreakRange;
  total: number;
  /** Range actually covered by the data. */
  rangeStart: string;
  rangeEnd: string;
}

const EMPTY: StreakRange = { length: 0, start: '', end: '' };

/**
 * Contribution streaks.
 *
 * - A day counts when it has at least one contribution.
 * - The current streak is still alive if today has no contributions yet but yesterday did
 *   (the day is not over), so it only resets after a full empty day.
 * - Days missing from the data are treated as empty.
 * - "Longest" is the longest streak inside the analysed range, not an all-time record.
 */
export function computeStreaks(days: ContributionDay[], today: string): StreakStats {
  const byDate = new Map<string, number>();
  for (const d of days) byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.count);

  const dates = [...byDate.keys()].sort();
  if (dates.length === 0) {
    return { current: EMPTY, longest: EMPTY, total: 0, rangeStart: today, rangeEnd: today };
  }
  const first = dates[0] as string;
  const lastData = dates[dates.length - 1] as string;
  const rangeEnd = lastData > today ? lastData : today;

  let total = 0;
  let longest: StreakRange = EMPTY;
  let runStart = '';
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

  // Current streak: walk back from today (or yesterday if today is still empty).
  let cursor = (byDate.get(today) ?? 0) > 0 ? today : addDays(today, -1);
  let current: StreakRange = EMPTY;
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

export interface RepoTotals {
  repos: number;
  stars: number;
  forks: number;
}

export function computeRepoTotals(repos: RepoStat[], excludeForks: boolean): RepoTotals {
  const list = excludeForks ? repos.filter((r) => !r.isFork) : repos;
  return {
    repos: list.length,
    stars: list.reduce((s, r) => s + r.stars, 0),
    forks: list.reduce((s, r) => s + r.forks, 0),
  };
}

export interface LanguageShare {
  name: string;
  color: string;
  size: number;
  /** 0-100, rounded to one decimal */
  percent: number;
}

export const OTHER_COLOR = '#8b949e';
const FALLBACK_COLOR = '#8b949e';

/**
 * Language distribution by bytes of code, as reported by GitHub's linguist data.
 * The top `count` languages are returned; the remainder is folded into "Other".
 */
export function computeLanguages(repos: RepoStat[], excludeForks: boolean, count: number): LanguageShare[] {
  const list = excludeForks ? repos.filter((r) => !r.isFork) : repos;
  const totals = new Map<string, { color: string; size: number }>();
  for (const repo of list) {
    for (const l of repo.languages) {
      if (l.size <= 0) continue;
      const cur = totals.get(l.name);
      if (cur) cur.size += l.size;
      else totals.set(l.name, { color: l.color ?? FALLBACK_COLOR, size: l.size });
    }
  }
  const all = [...totals.entries()]
    .map(([name, v]) => ({ name, color: v.color, size: v.size }))
    .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
  const sum = all.reduce((s, l) => s + l.size, 0);
  if (sum === 0) return [];

  const pct = (size: number) => Math.round((size / sum) * 1000) / 10;
  const top = all.slice(0, count).map((l) => ({ ...l, percent: pct(l.size) }));
  const rest = all.slice(count);
  if (rest.length > 0) {
    const size = rest.reduce((s, l) => s + l.size, 0);
    top.push({ name: 'Other', color: OTHER_COLOR, size, percent: pct(size) });
  }
  return top;
}

/** Quartile thresholds over non-zero days, used for heatmap intensity levels 1-4. */
export function heatThresholds(days: ContributionDay[]): [number, number, number] {
  const nz = days
    .map((d) => d.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  if (nz.length === 0) return [1, 2, 3];
  const q = (p: number) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] as number;
  return [q(0.25), q(0.5), q(0.75)];
}

export function heatLevel(count: number, t: [number, number, number]): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= t[0]) return 1;
  if (count <= t[1]) return 2;
  if (count <= t[2]) return 3;
  return 4;
}
