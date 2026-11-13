import { addDays, diffDays, monthShort, prettyDate, weekday } from '../dates';
import {
  computeLanguages,
  computeRepoTotals,
  computeStreaks,
  heatLevel,
  heatThresholds,
  type StreakRange,
} from '../stats';
import type { Theme } from '../themes';
import type { UserData } from '../types';
import { cardHeader, formatNumber, icon, num, safeColor, svgDocument, text, truncate, type IconName } from './common';

export interface RenderOptions {
  theme: Theme;
  showBorder: boolean;
  showIcons: boolean;
  excludeForks: boolean;
  languageCount: number;
  /** "Today" as YYYY-MM-DD in the user's configured time zone. */
  today: string;
}

function displayName(data: UserData): { title: string; subtitle: string } {
  const name = data.name?.trim();
  if (name && name.toLowerCase() !== data.login.toLowerCase()) {
    return { title: truncate(name, 26), subtitle: `@${truncate(data.login, 39)}` };
  }
  return { title: truncate(data.login, 26), subtitle: 'GitHub profile' };
}

// ---------------------------------------------------------------- overview

export function renderOverview(data: UserData, o: RenderOptions): string {
  const t = o.theme;
  const totals = computeRepoTotals(data.repos, o.excludeForks);
  const { title, subtitle } = displayName(data);
  const m = data.last12m;

  const cells: { icon: IconName; value: string; label: string }[] = [
    { icon: 'repo', value: formatNumber(totals.repos), label: 'Public repos' },
    { icon: 'star', value: formatNumber(totals.stars), label: 'Stars earned' },
    { icon: 'fork', value: formatNumber(totals.forks), label: 'Forks' },
    { icon: 'people', value: formatNumber(data.followers), label: 'Followers' },
    { icon: 'activity', value: formatNumber(m.contributions), label: 'Contributions, 12 mo' },
    { icon: 'pr', value: `${formatNumber(m.pullRequests)} / ${formatNumber(m.issues)}`, label: 'PRs / issues, 12 mo' },
  ];

  const parts: string[] = [cardHeader(t, title, subtitle)];
  cells.forEach((c, i) => {
    const x = 24 + (i % 3) * 168;
    const y = 94 + Math.floor(i / 3) * 70;
    const tx = o.showIcons ? x + 44 : x;
    if (o.showIcons) {
      parts.push(`<rect x="${x}" y="${y}" width="34" height="34" rx="9" fill="${t.track}"/>`);
      parts.push(icon(c.icon, x + 9, y + 9, 16, t.accent));
    }
    parts.push(text(tx, y + 15, c.value, { size: 21, weight: 700, fill: t.title }));
    parts.push(text(tx, y + 33, c.label, { size: 10.5, fill: t.muted }));
  });

  const desc =
    `${data.login} has ${totals.repos} public repositories with ${totals.stars} stars and ${totals.forks} forks, ` +
    `${data.followers} followers, and ${m.contributions} contributions in the last 12 months ` +
    `(${m.pullRequests} pull requests, ${m.issues} issues).`;
  return svgDocument({
    width: 540,
    height: 228,
    theme: t,
    title: `GitHub overview for ${data.login}`,
    desc,
    body: parts.join('\n'),
    showBorder: o.showBorder,
  });
}

// --------------------------------------------------------------- languages

export function renderLanguages(data: UserData, o: RenderOptions): string {
  const t = o.theme;
  const langs = computeLanguages(data.repos, o.excludeForks, o.languageCount);
  const repoCount = computeRepoTotals(data.repos, o.excludeForks).repos;
  const parts: string[] = [
    cardHeader(
      t,
      'Top languages',
      `By bytes of code across ${formatNumber(repoCount)} public ${repoCount === 1 ? 'repo' : 'repos'}${o.excludeForks ? ', forks excluded' : ''}`,
    ),
  ];
  const rowH = 32;
  const top = 96;

  if (langs.length === 0) {
    parts.push(text(24, top + 14, 'No language data found in public repositories.', { size: 13, fill: t.muted }));
  }
  langs.forEach((l, i) => {
    const y = top + i * rowH;
    const color = safeColor(l.color, t.muted);
    const barW = 220;
    const fillW = Math.max(3, (barW * l.percent) / 100);
    parts.push(`<circle cx="30" cy="${y - 4}" r="5" fill="${color}"/>`);
    parts.push(text(44, y, truncate(l.name, 20), { size: 13, weight: 500, fill: t.text }));
    parts.push(`<rect x="196" y="${y - 10}" width="${barW}" height="8" rx="4" fill="${t.track}"/>`);
    parts.push(`<rect x="196" y="${y - 10}" width="${num(fillW)}" height="8" rx="4" fill="${color}"/>`);
    parts.push(text(496, y, `${l.percent.toFixed(1)}%`, { size: 12, fill: t.muted, anchor: 'end' }));
  });

  const height = top + Math.max(1, langs.length) * rowH + 8;
  const summary = langs.map((l) => `${l.name} ${l.percent.toFixed(1)}%`).join(', ');
  return svgDocument({
    width: 520,
    height,
    theme: t,
    title: `Top languages for ${data.login}`,
    desc: langs.length ? `Language share by code size: ${summary}.` : 'No language data available.',
    body: parts.join('\n'),
    showBorder: o.showBorder,
  });
}

// ------------------------------------------------------------------ streak

function rangeLabel(r: StreakRange): string {
  if (r.length === 0) return 'No streak yet';
  if (r.start === r.end) return prettyDate(r.start);
  const sameYear = r.start.slice(0, 4) === r.end.slice(0, 4);
  const startLabel = sameYear ? prettyDate(r.start).replace(/, \d{4}$/, '') : prettyDate(r.start);
  return `${startLabel} – ${prettyDate(r.end)}`;
}

export function renderStreak(data: UserData, o: RenderOptions): string {
  const t = o.theme;
  const s = computeStreaks(data.days, o.today);
  const created = data.createdAt.slice(0, 10);
  const from = s.rangeStart < created ? created : s.rangeStart;
  const colW = 472 / 3;
  const cx = (i: number) => 24 + colW * i + colW / 2;
  const parts: string[] = [cardHeader(t, 'Contribution streak', 'Consecutive days with at least one contribution')];

  // current
  parts.push(`<circle cx="${num(cx(0))}" cy="124" r="38" fill="none" stroke="${s.current.length > 0 ? 'url(#sk-accent)' : t.track}" stroke-width="4"/>`);
  parts.push(text(cx(0), 133, formatNumber(s.current.length), { size: 28, weight: 800, fill: t.title, anchor: 'middle' }));
  parts.push(text(cx(0), 186, 'Current streak', { size: 12, weight: 600, fill: t.text, anchor: 'middle' }));
  parts.push(text(cx(0), 202, s.current.length > 0 ? rangeLabel(s.current) : 'No active streak', { size: 10.5, fill: t.muted, anchor: 'middle' }));

  // longest
  parts.push(text(cx(1), 133, formatNumber(s.longest.length), { size: 32, weight: 800, fill: t.accent, anchor: 'middle' }));
  parts.push(text(cx(1), 186, 'Longest streak', { size: 12, weight: 600, fill: t.text, anchor: 'middle' }));
  parts.push(text(cx(1), 202, rangeLabel(s.longest), { size: 10.5, fill: t.muted, anchor: 'middle' }));

  // total
  parts.push(text(cx(2), 133, formatNumber(s.total), { size: 32, weight: 800, fill: t.accent2, anchor: 'middle' }));
  parts.push(text(cx(2), 186, 'Contributions', { size: 12, weight: 600, fill: t.text, anchor: 'middle' }));
  parts.push(text(cx(2), 202, `${prettyDate(from).replace(/^\w+ \d+, /, '')} – ${prettyDate(s.rangeEnd).replace(/^\w+ \d+, /, '')}`, { size: 10.5, fill: t.muted, anchor: 'middle' }));

  for (const i of [1, 2]) {
    parts.push(`<line x1="${num(24 + colW * i)}" y1="92" x2="${num(24 + colW * i)}" y2="206" stroke="${t.border}" stroke-width="1"/>`);
  }
  parts.push(text(24, 238, `Analysed range: ${prettyDate(from)} – ${prettyDate(s.rangeEnd)}. "Longest" applies to this range only.`, { size: 10, fill: t.muted }));

  const desc =
    `Current streak ${s.current.length} days, longest streak ${s.longest.length} days, ` +
    `${s.total} contributions between ${from} and ${s.rangeEnd}.`;
  return svgDocument({
    width: 520,
    height: 256,
    theme: t,
    title: `Contribution streak for ${data.login}`,
    desc,
    body: parts.join('\n'),
    showBorder: o.showBorder,
  });
}

// ----------------------------------------------------------------- heatmap

export function renderContributions(data: UserData, o: RenderOptions): string {
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
  const gridStart = addDays(start, -weekday(start)); // Sunday on or before the start date
  const cols = Math.floor(diffDays(end, gridStart) / 7) + 1;
  const width = left + cols * step - (step - cell) + 24;

  const parts: string[] = [
    cardHeader(
      t,
      'Contribution activity',
      `${formatNumber(total)} ${total === 1 ? 'contribution' : 'contributions'} in the last year`,
    ),
  ];

  // month labels
  let lastLabelCol = -10;
  let lastMonth = '';
  for (let c = 0; c < cols; c++) {
    const firstDay = addDays(gridStart, c * 7);
    const month = monthShort(firstDay);
    const day = Number(firstDay.slice(8, 10));
    // Label the column that contains the 1st of a month (or the first visible column).
    const containsFirst = day <= 7;
    if ((containsFirst && month !== lastMonth && c - lastLabelCol >= 3) || c === 0) {
      if (c === 0 && cols > 3 && Number(addDays(gridStart, 7).slice(8, 10)) <= 7) {
        lastMonth = month;
        continue; // the next column starts a new month; avoid a cramped duplicate
      }
      parts.push(text(left + c * step, top - 10, month, { size: 10, fill: t.muted }));
      lastLabelCol = c;
      lastMonth = month;
    }
  }
  // weekday labels
  (['Mon', 'Wed', 'Fri'] as const).forEach((label, i) => {
    parts.push(text(24, top + (1 + i * 2) * step + 8, label, { size: 9, fill: t.muted }));
  });

  // cells
  const cells: string[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 7; r++) {
      const date = addDays(gridStart, c * 7 + r);
      if (date < start || date > end) continue;
      const level = heatLevel(counts.get(date) ?? 0, thresholds);
      cells.push(`<rect x="${left + c * step}" y="${top + r * step}" width="${cell}" height="${cell}" rx="2" fill="${t.heat[level]}"/>`);
    }
  }
  parts.push(`<g>${cells.join('')}</g>`);

  // legend
  const ly = top + 7 * step + 14;
  const legendRight = width - 24;
  parts.push(text(legendRight - 5 * step - 34, ly + 9, 'Less', { size: 10, fill: t.muted, anchor: 'end' }));
  t.heat.forEach((color, i) => {
    parts.push(`<rect x="${legendRight - 5 * step - 28 + i * step}" y="${ly}" width="${cell}" height="${cell}" rx="2" fill="${color}"/>`);
  });
  parts.push(text(legendRight - 5 * step + 38, ly + 9, 'More', { size: 10, fill: t.muted }));

  return svgDocument({
    width,
    height: ly + 28,
    theme: t,
    title: `Contribution activity for ${data.login}`,
    desc: `${total} contributions between ${start} and ${end}, shown as a weekly grid with five intensity levels.`,
    body: parts.join('\n'),
    showBorder: o.showBorder,
  });
}
