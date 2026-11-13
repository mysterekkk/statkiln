import { addDays, formatDate, parseDate } from './dates';
import { GitHubApiError } from './errors';
import type { GraphQLClient } from './github';
import type { ContributionDay, RepoStat, UserData } from './types';

const MAX_REPO_PAGES = 10; // 1000 repositories is plenty for a profile; protects the rate limit.

const PROFILE_QUERY = `
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

interface ProfileResponse {
  user: {
    login: string;
    name: string | null;
    createdAt: string;
    followers: { totalCount: number };
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: ({
        isFork: boolean;
        stargazerCount: number;
        forkCount: number;
        languages: { edges: { size: number; node: { name: string; color: string | null } }[] | null } | null;
      } | null)[];
    };
  } | null;
}

interface CalendarWindow {
  contributionCalendar: { totalContributions: number; weeks: { contributionDays: { date: string; contributionCount: number }[] }[] };
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalIssueContributions: number;
}

export interface Window {
  from: string;
  to: string;
}

/**
 * Contiguous windows of 365 days ending on `today`, newest first.
 * GitHub rejects contribution ranges longer than one year, so we ask for several.
 */
export function buildWindows(today: string, createdAt: string, years: number): Window[] {
  const created = createdAt.slice(0, 10);
  const windows: Window[] = [];
  for (let i = 0; i < years; i++) {
    const to = addDays(today, -i * 365);
    const from = addDays(to, -364);
    if (i > 0 && to < created) break; // account did not exist yet
    windows.push({ from, to });
  }
  return windows;
}

function calendarQuery(n: number): string {
  const vars = Array.from({ length: n }, (_, i) => `$f${i}: DateTime!, $t${i}: DateTime!`).join(', ');
  const fields = Array.from(
    { length: n },
    (_, i) => `
    w${i}: contributionsCollection(from: $f${i}, to: $t${i}) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    }`,
  ).join('');
  return `query StatKilnCalendar($login: String!, ${vars}) { user(login: $login) { ${fields} } }`;
}

export async function fetchRepos(graphql: GraphQLClient, login: string) {
  const repos: RepoStat[] = [];
  let profile: NonNullable<ProfileResponse['user']> | null = null;
  let after: string | null = null;

  for (let page = 0; page < MAX_REPO_PAGES; page++) {
    const data: ProfileResponse = await graphql<ProfileResponse>(PROFILE_QUERY, { login, after });
    if (!data.user) throw new GitHubApiError(`GitHub user "${login}" was not found.`, 404);
    profile ??= data.user;
    for (const node of data.user.repositories.nodes) {
      if (!node) continue;
      repos.push({
        isFork: node.isFork,
        stars: node.stargazerCount,
        forks: node.forkCount,
        languages: (node.languages?.edges ?? []).map((e) => ({ name: e.node.name, color: e.node.color, size: e.size })),
      });
    }
    const info = data.user.repositories.pageInfo;
    if (!info.hasNextPage || !info.endCursor) break;
    after = info.endCursor;
  }
  return { profile: profile as NonNullable<ProfileResponse['user']>, repos };
}

export async function fetchCalendar(graphql: GraphQLClient, login: string, windows: Window[]) {
  const variables: Record<string, unknown> = { login };
  windows.forEach((w, i) => {
    variables[`f${i}`] = `${w.from}T00:00:00Z`;
    variables[`t${i}`] = `${w.to}T23:59:59Z`;
  });
  const data = await graphql<{ user: Record<string, CalendarWindow> | null }>(calendarQuery(windows.length), variables);
  if (!data.user) throw new GitHubApiError(`GitHub user "${login}" was not found.`, 404);

  const byDate = new Map<string, number>();
  windows.forEach((w, i) => {
    const win = data.user?.[`w${i}`];
    if (!win) return;
    for (const week of win.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        // Only keep days inside the requested window; the API pads partial weeks.
        if (day.date >= w.from && day.date <= w.to) byDate.set(day.date, day.contributionCount);
      }
    }
  });
  const days: ContributionDay[] = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({ date, count }));

  const recent = data.user['w0'];
  return {
    days,
    last12m: {
      contributions: recent?.contributionCalendar.totalContributions ?? 0,
      pullRequests: recent?.totalPullRequestContributions ?? 0,
      issues: recent?.totalIssueContributions ?? 0,
      commits: recent?.totalCommitContributions ?? 0,
    },
  };
}

export async function collectUserData(
  graphql: GraphQLClient,
  login: string,
  today: string,
  historyYears: number,
): Promise<UserData> {
  // Sanity check on the date format early.
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
    rangeEnd: today,
  };
}
