import { describe, expect, it, vi } from 'vitest';
import { buildWindows, collectUserData } from '../src/collect';
import { GitHubApiError } from '../src/errors';
import { createGraphQLClient } from '../src/github';

const SECRET = 'ghs_supersecrettoken123';

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
}

function client(responses: (Response | Error)[], extra: Record<string, unknown> = {}) {
  const sleeps: number[] = [];
  const fetchImpl = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('no more mocked responses');
    if (next instanceof Error) throw next;
    return next;
  });
  const graphql = createGraphQLClient({
    token: SECRET,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep: async (ms) => void sleeps.push(ms),
    ...extra,
  });
  return { graphql, sleeps, fetchImpl };
}

describe('GraphQL client', () => {
  it('returns data on success and sends the token only in the header', async () => {
    const { graphql, fetchImpl } = client([json({ data: { ok: 1 } })]);
    await expect(graphql('query { a }')).resolves.toEqual({ ok: 1 });
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((call[1].headers as Record<string, string>)['authorization']).toBe(`Bearer ${SECRET}`);
    expect(String(call[1].body)).not.toContain(SECRET);
  });

  it('honours Retry-After on 429', async () => {
    const { graphql, sleeps } = client([json({}, { status: 429, headers: { 'retry-after': '7' } }), json({ data: { ok: 1 } })]);
    await expect(graphql('q')).resolves.toEqual({ ok: 1 });
    expect(sleeps).toEqual([7000]);
  });

  it('caps absurd Retry-After values', async () => {
    const { graphql, sleeps } = client([json({}, { status: 429, headers: { 'retry-after': '99999' } }), json({ data: {} })], { maxWaitMs: 5000 });
    await graphql('q');
    expect(sleeps).toEqual([5000]);
  });

  it('retries 5xx with exponential backoff, then gives up', async () => {
    const { graphql, sleeps } = client([json({}, { status: 502 }), json({}, { status: 502 }), json({}, { status: 502 }), json({}, { status: 502 })]);
    await expect(graphql('q')).rejects.toMatchObject({ name: 'GitHubApiError', status: 502 });
    expect(sleeps).toEqual([1000, 2000, 4000]);
  });

  it('does not retry a plain 403 permission error', async () => {
    const { graphql, fetchImpl } = client([json({}, { status: 403 })]);
    await expect(graphql('q')).rejects.toBeInstanceOf(GitHubApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a 403 that carries rate-limit headers', async () => {
    const { graphql } = client([json({}, { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 2) } }), json({ data: { ok: 1 } })]);
    await expect(graphql('q')).resolves.toEqual({ ok: 1 });
  });

  it('retries GraphQL RATE_LIMITED errors', async () => {
    const { graphql } = client([json({ errors: [{ type: 'RATE_LIMITED', message: 'slow down' }] }), json({ data: { ok: 1 } })]);
    await expect(graphql('q')).resolves.toEqual({ ok: 1 });
  });

  it('reports timeouts and network errors without leaking the token', async () => {
    const timeout = Object.assign(new Error(`boom ${SECRET}`), { name: 'TimeoutError' });
    const net = new Error(`ECONNRESET ${SECRET}`);
    const a = client([timeout, timeout, timeout, timeout]);
    await expect(a.graphql('q')).rejects.toThrow(/timed out/);
    const b = client([net, net, net, net]);
    const err = await b.graphql('q').catch((e: Error) => e);
    expect((err as Error).message).toMatch(/Network error/);
    expect((err as Error).message).not.toContain(SECRET);
  });

  it('recovers from a transient network error', async () => {
    const { graphql } = client([new Error('reset'), json({ data: { ok: 1 } })]);
    await expect(graphql('q')).resolves.toEqual({ ok: 1 });
  });

  it('maps 401 and NOT_FOUND to clear errors', async () => {
    await expect(client([json({}, { status: 401 })]).graphql('q')).rejects.toMatchObject({ status: 401 });
    await expect(client([json({ errors: [{ type: 'NOT_FOUND', message: 'Could not resolve to a User' }] })]).graphql('q')).rejects.toMatchObject({ status: 404 });
  });

  it('rejects invalid JSON and empty data', async () => {
    await expect(client([new Response('<html>', { status: 200 })]).graphql('q')).rejects.toThrow(/not valid JSON/);
    await expect(client([json({})]).graphql('q')).rejects.toThrow(/no data/);
  });
});

describe('data collection', () => {
  const repoNode = (i: number) => ({
    isFork: false,
    stargazerCount: i,
    forkCount: 1,
    languages: { edges: [{ size: 100 * i, node: { name: 'TypeScript', color: '#3178c6' } }] },
  });

  it('paginates repositories and sums everything', async () => {
    const calls: Record<string, unknown>[] = [];
    const graphql = (async (query: string, vars: Record<string, unknown>) => {
      calls.push(vars);
      if (query.includes('StatKilnProfile')) {
        const page2 = vars['after'] === 'cursor1';
        return {
          user: {
            login: 'octocat',
            name: null,
            createdAt: '2020-01-01T00:00:00Z',
            followers: { totalCount: 5 },
            repositories: {
              pageInfo: { hasNextPage: !page2, endCursor: page2 ? null : 'cursor1' },
              nodes: page2 ? [repoNode(3), null] : [repoNode(1), repoNode(2)],
            },
          },
        };
      }
      return {
        user: {
          w0: {
            totalCommitContributions: 3,
            totalPullRequestContributions: 1,
            totalIssueContributions: 0,
            contributionCalendar: {
              totalContributions: 4,
              weeks: [{ contributionDays: [{ date: '2026-03-19', contributionCount: 1 }, { date: '2026-03-20', contributionCount: 3 }, { date: '2099-01-01', contributionCount: 9 }] }],
            },
          },
        },
      };
    }) as never;

    const data = await collectUserData(graphql, 'octocat', '2026-03-20', 1);
    expect(data.repos).toHaveLength(3);
    expect(data.repos.reduce((s, r) => s + r.stars, 0)).toBe(6);
    expect(data.followers).toBe(5);
    expect(data.days).toEqual([{ date: '2026-03-19', count: 1 }, { date: '2026-03-20', count: 3 }]); // out-of-window padding dropped
    expect(data.last12m).toEqual({ contributions: 4, pullRequests: 1, issues: 0, commits: 3 });
    expect(calls.filter((c) => 'after' in c)).toHaveLength(2);
  });

  it('throws a clear error for an unknown user', async () => {
    const graphql = (async () => ({ user: null })) as never;
    await expect(collectUserData(graphql, 'ghost', '2026-03-20', 1)).rejects.toThrow(/not found/);
  });

  it('builds contiguous 365-day windows and stops before account creation', () => {
    const w = buildWindows('2026-03-20', '2020-01-01T00:00:00Z', 3);
    expect(w).toHaveLength(3);
    expect(w[0]).toEqual({ from: '2025-03-21', to: '2026-03-20' });
    expect(w[1]?.to).toBe('2025-03-20');
    const young = buildWindows('2026-03-20', '2026-01-15T00:00:00Z', 5);
    expect(young).toHaveLength(1);
  });
});
