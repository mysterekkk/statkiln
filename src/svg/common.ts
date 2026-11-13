import type { Theme } from '../themes';

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape text for use in XML text nodes and attribute values. Also drops characters illegal in XML 1.0. */
export function esc(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/[&<>"']/g, (c) => XML_ESCAPES[c] as string)
  );
}

/** Truncate to a maximum number of characters (code points), adding an ellipsis. */
export function truncate(value: string, max: number): string {
  const chars = [...value];
  if (chars.length <= max) return value;
  return chars.slice(0, Math.max(1, max - 1)).join('').trimEnd() + '…';
}

/** Only allow plain hex colours from external data (e.g. GitHub language colours). */
export function safeColor(value: string | null | undefined, fallback: string): string {
  return value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : fallback;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const v = Math.round(n);
  if (Math.abs(v) < 10_000) return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (Math.abs(v) < 1_000_000) return `${(Math.round(v / 100) / 10).toString()}k`;
  return `${(Math.round(v / 100_000) / 10).toString()}M`;
}

export function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export interface TextOpts {
  size?: number;
  weight?: number | string;
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
}

export function text(x: number, y: number, content: string, o: TextOpts): string {
  const anchor = o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : '';
  const weight = o.weight ? ` font-weight="${o.weight}"` : '';
  return `<text x="${num(x)}" y="${num(y)}" font-size="${o.size ?? 13}"${weight}${anchor} fill="${o.fill}">${esc(content)}</text>`;
}

export type IconName = 'repo' | 'star' | 'fork' | 'people' | 'activity' | 'pr';

const ICONS: Record<IconName, string> = {
  repo: '<path d="M3.5 2.5h8.5v9.5H4.8a1.3 1.3 0 0 0 0 2.6H12"/><path d="M3.5 2.5v10.1"/>',
  star: '<path d="M8 1.8l1.9 4 4.4.5-3.3 3 .9 4.3L8 11.4 4.1 13.6 5 9.3 1.7 6.3l4.4-.5z"/>',
  fork: '<circle cx="4.5" cy="3.5" r="1.7"/><circle cx="11.5" cy="3.5" r="1.7"/><circle cx="8" cy="12.5" r="1.7"/><path d="M4.5 5.2v.8a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-.8M8 8v2.8"/>',
  people:
    '<circle cx="6" cy="5" r="2.3"/><path d="M1.6 13.4c0-2.4 1.9-3.9 4.4-3.9s4.4 1.5 4.4 3.9"/><path d="M10.6 3a2.2 2.2 0 0 1 0 4.2M12 9.8c1.6.4 2.6 1.6 2.6 3.6"/>',
  activity: '<path d="M1.5 8.5h3l2-5.5 3 10 2-4.5h3"/>',
  pr: '<circle cx="4" cy="3.5" r="1.6"/><circle cx="4" cy="12.5" r="1.6"/><circle cx="12" cy="12.5" r="1.6"/><path d="M4 5.1v5.8M12 10.9V7a2 2 0 0 0-2-2H8.5"/>',
};

export function icon(name: IconName, x: number, y: number, size: number, color: string): string {
  const scale = size / 16;
  return `<g transform="translate(${num(x)} ${num(y)}) scale(${num(scale)})" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</g>`;
}

export interface DocOpts {
  width: number;
  height: number;
  theme: Theme;
  title: string;
  desc: string;
  body: string;
  showBorder: boolean;
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export function svgDocument(o: DocOpts): string {
  const { theme: t } = o;
  const stroke = o.showBorder ? ` stroke="${t.border}" stroke-width="1"` : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}" role="img" aria-labelledby="sk-title sk-desc">`,
    `<title id="sk-title">${esc(o.title)}</title>`,
    `<desc id="sk-desc">${esc(o.desc)}</desc>`,
    `<defs><linearGradient id="sk-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg1}"/><stop offset="1" stop-color="${t.bg2}"/></linearGradient>` +
      `<linearGradient id="sk-accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient></defs>`,
    `<rect x="0.5" y="0.5" width="${o.width - 1}" height="${o.height - 1}" rx="12" fill="url(#sk-bg)"${stroke}/>`,
    `<g font-family="${FONT}">`,
    o.body,
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}

export function cardHeader(theme: Theme, title: string, subtitle: string): string {
  return [
    text(24, 38, title, { size: 18, weight: 700, fill: theme.title }),
    text(24, 58, subtitle, { size: 12, fill: theme.muted }),
    `<rect x="24" y="68" width="40" height="3" rx="1.5" fill="url(#sk-accent)"/>`,
  ].join('\n');
}
