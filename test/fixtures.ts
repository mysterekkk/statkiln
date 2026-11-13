import { addDays } from '../src/dates';
import type { ContributionDay, UserData } from '../src/types';

export const TODAY = '2026-03-20';

/** Deterministic pseudo-random contribution days ending on `end`. */
export function makeDays(end: string, count: number, seed = 7): ContributionDay[] {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const days: ContributionDay[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const r = rnd();
    days.push({ date: addDays(end, -i), count: r < 0.35 ? 0 : Math.floor(r * r * 14) });
  }
  return days;
}

export function makeUser(overrides: Partial<UserData> = {}): UserData {
  const days = makeDays(TODAY, 365 * 2);
  return {
    login: 'octocat',
    name: 'The Octocat',
    followers: 1234,
    createdAt: '2020-01-01T00:00:00Z',
    repos: [
      {
        isFork: false,
        stars: 120,
        forks: 14,
        languages: [
          { name: 'TypeScript', color: '#3178c6', size: 70_000 },
          { name: 'CSS', color: '#563d7c', size: 10_000 },
        ],
      },
      {
        isFork: false,
        stars: 30,
        forks: 2,
        languages: [
          { name: 'Go', color: '#00ADD8', size: 20_000 },
          { name: 'Shell', color: null, size: 1_000 },
        ],
      },
      { isFork: true, stars: 5000, forks: 900, languages: [{ name: 'C', color: '#555555', size: 9_000_000 }] },
    ],
    days,
    last12m: { contributions: 1500, pullRequests: 80, issues: 12, commits: 1300 },
    rangeStart: days[0]?.date ?? TODAY,
    rangeEnd: TODAY,
    ...overrides,
  };
}
