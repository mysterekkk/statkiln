import { isAbsolute, normalize, resolve, sep } from 'node:path';
import { ConfigError } from './errors';
import { THEME_NAMES } from './themes';
import { CARD_NAMES, type CardName, type Config } from './types';

const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

function parseBool(name: string, value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  const v = value.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  throw new ConfigError(`Input "${name}" must be "true" or "false" (got "${value}").`);
}

function parseIntInRange(name: string, value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  if (!/^\d+$/.test(value.trim())) throw new ConfigError(`Input "${name}" must be an integer (got "${value}").`);
  const n = Number(value);
  if (n < min || n > max) throw new ConfigError(`Input "${name}" must be between ${min} and ${max} (got ${n}).`);
  return n;
}

export function validateTheme(name: string, input: string): string {
  if (!THEME_NAMES.includes(name)) {
    throw new ConfigError(`Input "${input}" has unknown theme "${name}". Available: ${THEME_NAMES.join(', ')}.`);
  }
  return name;
}

/** `.git` and `.github` are off limits (case-insensitive: Windows and macOS file systems are). */
export function hasProtectedSegment(segments: string[]): boolean {
  return segments.some((s) => ['.git', '.github'].includes(s.toLowerCase()));
}

/**
 * Validates an output directory: it must be relative and stay inside `root`.
 * Returns the normalised relative path (POSIX separators).
 */
export function validateOutputDir(dir: string, root: string): string {
  const trimmed = dir.trim();
  if (trimmed === '') throw new ConfigError('Input "output-dir" must not be empty.');
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) throw new ConfigError('Input "output-dir" contains an invalid character.');
  if (isAbsolute(trimmed) || /^[a-z]:/i.test(trimmed) || trimmed.startsWith('\\\\')) {
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
  return segments.join('/');
}

export function parseCards(value: string | undefined): CardName[] {
  if (value === undefined || value.trim() === '') return [...CARD_NAMES];
  const parts = value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return [...CARD_NAMES];
  const out: CardName[] = [];
  for (const p of parts) {
    if (!(CARD_NAMES as readonly string[]).includes(p)) {
      throw new ConfigError(`Input "cards" has unknown card "${p}". Available: ${CARD_NAMES.join(', ')}.`);
    }
    if (!out.includes(p as CardName)) out.push(p as CardName);
  }
  return out;
}

export function validateTimezone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    throw new ConfigError(`Input "timezone" is not a valid IANA time zone (got "${tz}").`);
  }
}

/** Build a validated Config from raw string inputs (action inputs or CLI flags). */
export function parseConfig(raw: Record<string, string | undefined>, workspace: string): Config {
  const username = (raw['username'] ?? '').trim();
  if (!username) throw new ConfigError('Input "username" is required.');
  if (!USERNAME_RE.test(username)) throw new ConfigError(`"${username}" is not a valid GitHub username.`);

  const token = (raw['github-token'] ?? '').trim();
  if (!token) {
    throw new ConfigError(
      'No GitHub token found. In a workflow pass `github-token: ${{ secrets.GITHUB_TOKEN }}`.',
    );
  }

  const theme = validateTheme((raw['theme'] ?? 'midnight').trim() || 'midnight', 'theme');
  const lightRaw = (raw['theme-light'] ?? '').trim();
  const darkRaw = (raw['theme-dark'] ?? '').trim();
  if (Boolean(lightRaw) !== Boolean(darkRaw)) {
    throw new ConfigError('Inputs "theme-light" and "theme-dark" must be set together.');
  }

  return {
    username,
    token,
    theme,
    themeLight: lightRaw ? validateTheme(lightRaw, 'theme-light') : null,
    themeDark: darkRaw ? validateTheme(darkRaw, 'theme-dark') : null,
    outputDir: validateOutputDir(raw['output-dir'] ?? 'assets/statkiln', workspace),
    cards: parseCards(raw['cards']),
    languageCount: parseIntInRange('language-count', raw['language-count'], 6, 1, 12),
    excludeForks: parseBool('exclude-forks', raw['exclude-forks'], true),
    showBorder: parseBool('show-border', raw['show-border'], true),
    showIcons: parseBool('show-icons', raw['show-icons'], true),
    timezone: validateTimezone((raw['timezone'] ?? 'UTC').trim() || 'UTC'),
    historyYears: parseIntInRange('history-years', raw['history-years'], 3, 1, 10),
  };
}
