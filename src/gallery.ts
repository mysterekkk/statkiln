/**
 * Generates the theme gallery from clearly synthetic SAMPLE data (not real statistics).
 * Used for the README theme previews: `npm run gallery`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { addDays } from './dates';
import { renderAll } from './generate';
import { THEME_NAMES } from './themes';
import type { ContributionDay, UserData } from './types';

const TODAY = '2026-06-30';

function sampleDays(): ContributionDay[] {
  let s = 42;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const days: ContributionDay[] = [];
  for (let i = 3 * 365 - 1; i >= 0; i--) {
    const date = addDays(TODAY, -i);
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const r = rnd();
    const busy = dow !== 0 && dow !== 6;
    days.push({ date, count: r < (busy ? 0.18 : 0.6) ? 0 : Math.floor(r * r * (busy ? 16 : 6)) + 1 });
  }
  return days;
}

export function sampleUser(): UserData {
  const days = sampleDays();
  const last = days.slice(-365);
  return {
    login: 'sample-user',
    name: 'Sample User',
    followers: 482,
    createdAt: '2019-04-01T00:00:00Z',
    repos: [
      { isFork: false, stars: 1280, forks: 164, languages: [{ name: 'TypeScript', color: '#3178c6', size: 640_000 }, { name: 'CSS', color: '#663399', size: 52_000 }] },
      { isFork: false, stars: 342, forks: 41, languages: [{ name: 'Rust', color: '#dea584', size: 310_000 }] },
      { isFork: false, stars: 96, forks: 8, languages: [{ name: 'Python', color: '#3572A5', size: 220_000 }, { name: 'Shell', color: '#89e051', size: 18_000 }] },
      { isFork: false, stars: 54, forks: 3, languages: [{ name: 'Go', color: '#00ADD8', size: 150_000 }] },
      { isFork: false, stars: 12, forks: 1, languages: [{ name: 'HTML', color: '#e34c26', size: 60_000 }, { name: 'JavaScript', color: '#f1e05a', size: 90_000 }] },
    ],
    days,
    last12m: {
      contributions: last.reduce((s, d) => s + d.count, 0),
      pullRequests: 138,
      issues: 47,
      commits: 1620,
    },
    rangeStart: days[0]?.date ?? TODAY,
    rangeEnd: TODAY,
  };
}

const outDir = 'assets/themes';
await mkdir(outDir, { recursive: true });
for (const theme of THEME_NAMES) {
  const files = renderAll(
    sampleUser(),
    { cards: ['overview', 'contributions'], theme, themeLight: null, themeDark: null, showBorder: true, showIcons: true, excludeForks: true, languageCount: 6 },
    TODAY,
  );
  for (const f of files) await writeFile(`${outDir}/${theme}-${f.name}`, f.content, 'utf8');
}
console.log(`Wrote theme gallery to ${outDir}/ (sample data).`);
