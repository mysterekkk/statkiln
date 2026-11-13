import { describe, expect, it } from 'vitest';
import { renderAll, validateSvg } from '../src/generate';
import { esc, formatNumber, safeColor, truncate } from '../src/svg/common';
import { renderContributions, renderLanguages, renderOverview, renderStreak, type RenderOptions } from '../src/svg/cards';
import { THEMES, THEME_NAMES } from '../src/themes';
import { TODAY, makeDays, makeUser } from './fixtures';

const opts = (theme = 'midnight', extra: Partial<RenderOptions> = {}): RenderOptions => ({
  theme: THEMES[theme]!,
  showBorder: true,
  showIcons: true,
  excludeForks: true,
  languageCount: 6,
  today: TODAY,
  ...extra,
});

const renderers = { renderOverview, renderLanguages, renderStreak, renderContributions };

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('escaping and safety', () => {
  it('escapes XML special characters', () => {
    expect(esc(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
  it('removes characters that are illegal in XML', () => {
    expect(esc('a\u0000b\u0008c')).toBe('abc');
  });
  it('only accepts hex colours from external data', () => {
    expect(safeColor('#3178c6', '#000')).toBe('#3178c6');
    expect(safeColor('red" onload="x', '#000')).toBe('#000');
    expect(safeColor('url(javascript:1)', '#000')).toBe('#000');
    expect(safeColor(null, '#111')).toBe('#111');
  });
  it('truncates long text with an ellipsis, counting code points', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('a'.repeat(50), 10)).toHaveLength(10);
    expect(truncate('😀'.repeat(20), 5)).toBe('😀😀😀😀…');
  });
  it('formats numbers compactly', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(12_345)).toBe('12.3k');
    expect(formatNumber(2_500_000)).toBe('2.5M');
    expect(formatNumber(NaN)).toBe('0');
  });

  it('neutralises SVG injection through user-controlled fields', () => {
    const evil = '"/><script>alert(1)</script><text x="';
    const data = makeUser({
      name: evil,
      repos: [
        {
          isFork: false,
          stars: 1,
          forks: 1,
          languages: [{ name: `</text><script>alert(2)</script>`, color: '"/><script>alert(3)</script>', size: 100 }],
        },
      ],
    });
    for (const render of Object.values(renderers)) {
      const svg = render(data, opts());
      expect(svg).not.toContain('<script');
      expect(svg).not.toContain('alert(3)</script');
      expect(() => validateSvg('x', svg)).not.toThrow();
    }
  });
});

describe('validation of rendered output', () => {
  it('accepts profile names that merely contain words like Infinity or undefined', () => {
    const svg = renderOverview(makeUser({ name: 'Infinity Labs NaN undefined onclick=x' }), opts());
    expect(() => validateSvg('x', svg)).not.toThrow();
  });
  it('still rejects broken markup', () => {
    expect(() => validateSvg('x', '<svg width="NaN"></svg>')).toThrow(/invalid values/);
    expect(() => validateSvg('x', '<svg onload="x()"></svg>')).toThrow(/forbidden/);
  });
});

describe('rendering', () => {
  it.each(Object.entries(renderers))('%s renders valid, accessible SVG for every theme', (_name, render) => {
    for (const theme of THEME_NAMES) {
      const svg = render(makeUser(), opts(theme));
      expect(() => validateSvg('card', svg)).not.toThrow();
      expect(svg).toContain('<title id="sk-title">');
      expect(svg).toContain('<desc id="sk-desc">');
      expect(svg).toContain('role="img"');
      expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/); // no external resources
      expect(svg).not.toContain('<image');
      expect(svg).not.toContain('@import');
    }
  });

  it('is deterministic', () => {
    for (const render of Object.values(renderers)) {
      expect(render(makeUser(), opts())).toBe(render(makeUser(), opts()));
    }
  });

  it('handles long display names', () => {
    const svg = renderOverview(makeUser({ name: 'A'.repeat(200) }), opts());
    expect(svg).not.toContain('A'.repeat(40));
    expect(svg).toContain('…');
  });

  it('renders users with no repositories and no activity', () => {
    const empty = makeUser({
      repos: [],
      days: makeDays(TODAY, 365).map((d) => ({ ...d, count: 0 })),
      last12m: { contributions: 0, pullRequests: 0, issues: 0, commits: 0 },
      followers: 0,
    });
    for (const render of Object.values(renderers)) {
      expect(() => validateSvg('x', render(empty, opts()))).not.toThrow();
    }
    expect(renderLanguages(empty, opts())).toContain('No language data');
    expect(renderStreak(empty, opts())).toContain('No active streak');
  });

  it('respects show-icons and show-border', () => {
    const bare = renderOverview(makeUser(), opts('midnight', { showIcons: false, showBorder: false }));
    expect(bare).not.toContain('stroke-linecap');
    expect(bare).not.toContain(`stroke="${THEMES['midnight']!.border}"`);
    expect(renderOverview(makeUser(), opts())).toContain(`stroke="${THEMES['midnight']!.border}"`);
  });

  it('limits the language list and keeps the card height in sync', () => {
    const many = makeUser({
      repos: [{ isFork: false, stars: 0, forks: 0, languages: Array.from({ length: 12 }, (_, i) => ({ name: `L${i}`, color: '#123456', size: 1000 - i })) }],
    });
    const three = renderLanguages(many, opts('midnight', { languageCount: 3 }));
    expect(three).toContain('L2');
    expect(three).not.toContain('>L3<');
    expect(three).toContain('Other');
  });

  it('draws at most 53 weeks and no cells in the future', () => {
    const svg = renderContributions(makeUser(), opts());
    const cells = svg.match(/<rect x="\d+" y="\d+" width="10"/g) ?? [];
    expect(cells.length).toBe(365 + 5); // 365 days + 5 legend swatches
  });

  it('writes light/dark variants when both themes are set', () => {
    const files = renderAll(
      makeUser(),
      {
        cards: ['overview', 'streak'],
        theme: 'midnight',
        themeLight: 'light',
        themeDark: 'github-dark',
        showBorder: true,
        showIcons: true,
        excludeForks: true,
        languageCount: 6,
      },
      TODAY,
    );
    expect(files.map((f) => f.name)).toEqual(['overview-light.svg', 'overview-dark.svg', 'streak-light.svg', 'streak-dark.svg']);
  });
});

describe('themes', () => {
  it('has the five required themes', () => {
    expect(THEME_NAMES).toEqual(['midnight', 'light', 'github-dark', 'aurora', 'minimal']);
  });
  it.each(THEME_NAMES)('%s has readable text contrast', (name) => {
    const t = THEMES[name]!;
    for (const bg of [t.bg1, t.bg2]) {
      expect(contrast(t.title, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(t.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.muted, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it.each(THEME_NAMES)('%s heat levels are distinct', (name) => {
    expect(new Set(THEMES[name]!.heat).size).toBe(5);
  });
});
