import { GitHubApiError } from './errors';

export interface GraphQLClientOptions {
  token: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  timeoutMs?: number;
  /** Upper bound for a single wait, so a hostile Retry-After cannot stall the job. */
  maxWaitMs?: number;
}

export type GraphQLClient = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function retryDelayMs(res: Response, attempt: number, maxWaitMs: number): number {
  const retryAfter = res.headers.get('retry-after');
  if (retryAfter && /^\d+$/.test(retryAfter.trim())) {
    return Math.min(Number(retryAfter) * 1000, maxWaitMs);
  }
  const reset = res.headers.get('x-ratelimit-reset');
  const remaining = res.headers.get('x-ratelimit-remaining');
  if (remaining === '0' && reset && /^\d+$/.test(reset)) {
    return Math.min(Math.max(Number(reset) * 1000 - Date.now(), 1000), maxWaitMs);
  }
  // Exponential backoff: 1s, 2s, 4s ...
  return Math.min(1000 * 2 ** attempt, maxWaitMs);
}

export function createGraphQLClient(opts: GraphQLClientOptions): GraphQLClient {
  const endpoint = opts.endpoint ?? 'https://api.github.com/graphql';
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const maxRetries = opts.maxRetries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const maxWaitMs = opts.maxWaitMs ?? 60_000;

  return async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    let lastError: GitHubApiError | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let res: Response;
      try {
        res = await doFetch(endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${opts.token}`,
            'content-type': 'application/json',
            'user-agent': 'statkiln',
          },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
        lastError = new GitHubApiError(
          timedOut ? `GitHub API request timed out after ${timeoutMs} ms.` : 'Network error while contacting the GitHub API.',
        );
        if (attempt < maxRetries) {
          await sleep(Math.min(1000 * 2 ** attempt, maxWaitMs));
          continue;
        }
        throw lastError;
      }

      if (res.status === 429 || res.status === 403 || res.status >= 500) {
        const rateLimited = res.status === 429 || res.status === 403;
        lastError = new GitHubApiError(
          rateLimited
            ? `GitHub API rate limit or permission error (HTTP ${res.status}).`
            : `GitHub API server error (HTTP ${res.status}).`,
          res.status,
        );
        // A plain 403 without any rate-limit hint is a permission problem, not worth retrying.
        const hint = res.headers.get('retry-after') ?? res.headers.get('x-ratelimit-remaining');
        const retryable = res.status !== 403 || hint !== null;
        if (retryable && attempt < maxRetries) {
          await sleep(retryDelayMs(res, attempt, maxWaitMs));
          continue;
        }
        throw lastError;
      }

      if (res.status === 401) {
        throw new GitHubApiError('GitHub rejected the token (HTTP 401). Check the "github-token" input.', 401);
      }
      if (!res.ok) throw new GitHubApiError(`Unexpected GitHub API response (HTTP ${res.status}).`, res.status);

      let body: { data?: T; errors?: { type?: string; message?: string }[] };
      try {
        body = (await res.json()) as typeof body;
      } catch {
        throw new GitHubApiError('GitHub API returned a response that is not valid JSON.');
      }

      if (body.errors?.length) {
        const first = body.errors[0];
        if (first?.type === 'NOT_FOUND') {
          throw new GitHubApiError(first.message ?? 'GitHub user not found.', 404);
        }
        const limited = body.errors.some((e) => e.type === 'RATE_LIMITED');
        if (limited && attempt < maxRetries) {
          lastError = new GitHubApiError('GitHub GraphQL rate limit reached.', 429);
          await sleep(Math.min(1000 * 2 ** attempt, maxWaitMs));
          continue;
        }
        throw new GitHubApiError(`GitHub GraphQL error: ${first?.message ?? 'unknown error'}`);
      }
      if (!body.data) throw new GitHubApiError('GitHub API returned no data.');
      return body.data;
    }
    throw lastError ?? new GitHubApiError('GitHub API request failed.');
  };
}
