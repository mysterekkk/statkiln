export const CARD_NAMES = ['overview', 'languages', 'streak', 'contributions'] as const;
export type CardName = (typeof CARD_NAMES)[number];

export interface ContributionDay {
  /** Calendar date, YYYY-MM-DD */
  date: string;
  count: number;
}

export interface RepoStat {
  isFork: boolean;
  stars: number;
  forks: number;
  languages: { name: string; color: string | null; size: number }[];
}

export interface UserData {
  login: string;
  name: string | null;
  followers: number;
  createdAt: string;
  /** Owned public repositories (forks included; filter with `excludeForks`). */
  repos: RepoStat[];
  /** Sorted, de-duplicated contribution days across the analysed range. */
  days: ContributionDay[];
  /** Counts for the most recent 12-month window. */
  last12m: { contributions: number; pullRequests: number; issues: number; commits: number };
  /** First/last date of the analysed range, YYYY-MM-DD */
  rangeStart: string;
  rangeEnd: string;
}

export interface Config {
  username: string;
  token: string;
  theme: string;
  themeLight: string | null;
  themeDark: string | null;
  outputDir: string;
  cards: CardName[];
  languageCount: number;
  excludeForks: boolean;
  showBorder: boolean;
  showIcons: boolean;
  timezone: string;
  historyYears: number;
}
