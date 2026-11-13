import { describe, expect, it } from 'vitest';
import { addDays, todayIn } from '../src/dates';
import { computeLanguages, computeRepoTotals, computeStreaks, heatLevel, heatThresholds } from '../src/stats';
import type { ContributionDay } from '../src/types';
import { makeUser } from './fixtures';

const run = (start: string, counts: number[]): ContributionDay[] =>
  counts.map((count, i) => ({ date: addDays(start, i), count }));

describe('computeStreaks', () => {
  it('counts a streak that includes today', () => {
    const s = computeStreaks(run('2026-03-10', [0, 1, 2, 3, 1, 1, 0, 2, 2, 2, 1]), '2026-03-20');
    expect(s.current).toEqual({ length: 4, start: '2026-03-17', end: '2026-03-20' });
    expect(s.longest.length).toBe(5);
    expect(s.total).toBe(15);
  });

  it('keeps the streak alive when today is still empty but yesterday had activity', () => {
    const s = computeStreaks(run('2026-03-15', [1, 1, 1, 1, 1, 0]), '2026-03-20');
    expect(s.current).toEqual({ length: 5, start: '2026-03-15', end: '2026-03-19' });
  });

  it('resets the current streak after a full empty day', () => {
    const s = computeStreaks(run('2026-03-10', [1, 1, 1, 0, 0, 0]), '2026-03-15');
    expect(s.current.length).toBe(0);
    expect(s.longest).toEqual({ length: 3, start: '2026-03-10', end: '2026-03-12' });
  });

  it('handles users with zero activity', () => {
    const s = computeStreaks(run('2026-01-01', new Array(30).fill(0)), '2026-01-30');
    expect(s.current.length).toBe(0);
    expect(s.longest.length).toBe(0);
    expect(s.total).toBe(0);
  });

  it('handles empty data', () => {
    const s = computeStreaks([], '2026-03-20');
    expect(s).toMatchObject({ total: 0, current: { length: 0 }, longest: { length: 0 } });
  });

  it('continues across a year boundary', () => {
    const s = computeStreaks(run('2025-12-29', [1, 1, 1, 1, 1, 1]), '2026-01-03');
    expect(s.current).toEqual({ length: 6, start: '2025-12-29', end: '2026-01-03' });
  });

  it('handles 29 February in a leap year', () => {
    const s = computeStreaks(run('2024-02-27', [1, 1, 1, 1, 1]), '2024-03-02');
    expect(s.current.length).toBe(5);
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('treats missing days as empty', () => {
    const days = [
      { date: '2026-03-01', count: 1 },
      { date: '2026-03-02', count: 1 },
      { date: '2026-03-05', count: 1 },
    ];
    const s = computeStreaks(days, '2026-03-05');
    expect(s.longest.length).toBe(2);
    expect(s.current.length).toBe(1);
  });
});

describe('todayIn', () => {
  it('respects the time zone', () => {
    const instant = new Date('2026-03-20T23:30:00Z');
    expect(todayIn('UTC', instant)).toBe('2026-03-20');
    expect(todayIn('Asia/Tokyo', instant)).toBe('2026-03-21');
    expect(todayIn('America/Los_Angeles', instant)).toBe('2026-03-20');
  });
});

describe('repo totals', () => {
  it('sums stars and forks, excluding forks by default setting', () => {
    const { repos } = makeUser();
    expect(computeRepoTotals(repos, true)).toEqual({ repos: 2, stars: 150, forks: 16 });
    expect(computeRepoTotals(repos, false)).toEqual({ repos: 3, stars: 5150, forks: 916 });
  });
  it('handles a user without repositories', () => {
    expect(computeRepoTotals([], true)).toEqual({ repos: 0, stars: 0, forks: 0 });
  });
});

describe('computeLanguages', () => {
  it('distributes by bytes and folds the rest into Other', () => {
    const langs = computeLanguages(makeUser().repos, true, 2);
    expect(langs.map((l) => l.name)).toEqual(['TypeScript', 'Go', 'Other']);
    expect(langs[0]?.percent).toBe(69.3);
    expect(langs.reduce((s, l) => s + l.percent, 0)).toBeCloseTo(100, 0);
  });
  it('includes forks when asked', () => {
    expect(computeLanguages(makeUser().repos, false, 3)[0]?.name).toBe('C');
  });
  it('returns nothing without language data', () => {
    expect(computeLanguages([], true, 5)).toEqual([]);
    expect(computeLanguages([{ isFork: false, stars: 0, forks: 0, languages: [] }], true, 5)).toEqual([]);
  });
  it('uses a fallback colour for languages without one', () => {
    const shell = computeLanguages(makeUser().repos, true, 6).find((l) => l.name === 'Shell');
    expect(shell?.color).toMatch(/^#/);
  });
});

describe('heatmap levels', () => {
  it('maps counts to five levels', () => {
    const days = run('2026-01-01', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const t = heatThresholds(days);
    expect(heatLevel(0, t)).toBe(0);
    expect(heatLevel(1, t)).toBe(1);
    expect(heatLevel(11, t)).toBe(4);
  });
  it('stays readable with very low activity', () => {
    const t = heatThresholds(run('2026-01-01', [0, 0, 1, 0]));
    expect(heatLevel(1, t)).toBeGreaterThan(0);
  });
});
