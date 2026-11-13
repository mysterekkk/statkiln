import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INPUT_NAMES } from '../src/action';
import { parseConfig, validateOutputDir } from '../src/config';
import { ConfigError } from '../src/errors';
import { generate } from '../src/generate';
import type { GraphQLClient } from '../src/github';
import { makeUser } from './fixtures';

const ROOT = join(import.meta.dirname, '..');
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'statkiln-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const base = { username: 'octocat', 'github-token': 'tok' };
const cfg = (extra: Record<string, string> = {}) => parseConfig({ ...base, ...extra }, dir);

function fakeGraphql(): GraphQLClient {
  const u = makeUser();
  return (async (query: string) => {
    if (query.includes('StatKilnProfile')) {
      return {
        user: {
          login: u.login,
          name: u.name,
          createdAt: u.createdAt,
          followers: { totalCount: u.followers },
          repositories: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: u.repos.map((r) => ({
              isFork: r.isFork,
              stargazerCount: r.stars,
              forkCount: r.forks,
              languages: { edges: r.languages.map((l) => ({ size: l.size, node: { name: l.name, color: l.color } })) },
            })),
          },
        },
      };
    }
    return {
      user: {
        w0: {
          totalCommitContributions: 1,
          totalPullRequestContributions: 1,
          totalIssueContributions: 1,
          contributionCalendar: { totalContributions: 3, weeks: [{ contributionDays: [{ date: '2026-03-20', contributionCount: 3 }] }] },
        },
      },
    };
  }) as GraphQLClient;
}

describe('config validation', () => {
  it('applies safe defaults', () => {
    const c = cfg();
    expect(c).toMatchObject({
      theme: 'midnight',
      outputDir: 'assets/statkiln',
      languageCount: 6,
      excludeForks: true,
      showBorder: true,
      showIcons: true,
      cards: ['overview', 'languages', 'streak', 'contributions'],
    });
  });

  it.each([
    [{ username: '' }, /required/],
    [{ username: 'bad name!' }, /not a valid GitHub username/],
    [{ username: '-lead' }, /not a valid/],
    [{ theme: 'neon' }, /unknown theme/],
    [{ cards: 'overview,nope' }, /unknown card/],
    [{ 'language-count': '0' }, /between 1 and 12/],
    [{ 'language-count': 'abc' }, /integer/],
    [{ 'exclude-forks': 'yes' }, /"true" or "false"/],
    [{ timezone: 'Mars/Base' }, /time zone/],
    [{ 'theme-light': 'light' }, /set together/],
    [{ 'github-token': '' }, /No GitHub token/],
  ])('rejects invalid input %j', (extra, message) => {
    expect(() => parseConfig({ ...base, ...extra }, dir)).toThrow(message);
  });

  it.each(['../evil', '/etc', 'C:\\Windows', '\\\\server\\share', 'a/../../b', '.', '', '.git/x', '.github/workflows', 'x\0y', 'a\nb', 'x\r::add-mask::', '.GIT/x', '.GitHub/workflows', 'a/.Git'])(
    'rejects unsafe output-dir %j',
    (d) => {
      expect(() => validateOutputDir(d, dir)).toThrow(ConfigError);
    },
  );

  it('accepts nested relative output dirs', () => {
    expect(validateOutputDir('./assets//statkiln/', dir)).toBe('assets/statkiln');
  });

  it('declares every input in action.yml', async () => {
    const yml = await readFile(join(ROOT, 'action.yml'), 'utf8');
    for (const name of INPUT_NAMES) expect(yml).toMatch(new RegExp(`^  ${name}:`, 'm'));
  });
});

describe('generate', () => {
  it('writes cards and reports unchanged files on a second identical run', async () => {
    const now = new Date('2026-03-20T12:00:00Z');
    const first = await generate(cfg(), dir, { graphql: fakeGraphql(), now });
    expect(first.changed).toHaveLength(4);
    expect((await readdir(join(dir, 'assets/statkiln'))).sort()).toEqual(['contributions.svg', 'languages.svg', 'overview.svg', 'streak.svg']);
    const before = await readFile(join(dir, 'assets/statkiln/overview.svg'), 'utf8');

    const second = await generate(cfg(), dir, { graphql: fakeGraphql(), now });
    expect(second.changed).toEqual([]);
    expect(await readFile(join(dir, 'assets/statkiln/overview.svg'), 'utf8')).toBe(before);
  });

  it('only writes the requested cards', async () => {
    const r = await generate(cfg({ cards: 'streak' }), dir, { graphql: fakeGraphql(), now: new Date('2026-03-20T12:00:00Z') });
    expect(r.written).toEqual(['assets/statkiln/streak.svg']);
  });

  it('leaves existing cards untouched when the API fails', async () => {
    const out = join(dir, 'assets/statkiln');
    await mkdir(out, { recursive: true });
    await writeFile(join(out, 'overview.svg'), '<svg>previous good card</svg>');
    const failing = (async () => {
      throw new Error('boom');
    }) as unknown as GraphQLClient;
    await expect(generate(cfg(), dir, { graphql: failing })).rejects.toThrow('boom');
    expect(await readFile(join(out, 'overview.svg'), 'utf8')).toBe('<svg>previous good card</svg>');
    expect((await readdir(out)).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('does not follow a planted symlink at the temp-file path', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'statkiln-outside-'));
    try {
      const out = join(dir, 'assets/statkiln');
      await mkdir(out, { recursive: true });
      try {
        await symlink(join(outside, 'victim'), join(out, '.streak.svg.tmp'), 'file');
      } catch {
        return; // symlinks unavailable on this machine
      }
      await generate(cfg({ cards: 'streak' }), dir, { graphql: fakeGraphql(), now: new Date('2026-03-20T12:00:00Z') });
      expect(await readdir(outside)).toEqual([]);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('refuses to write into .git or .github through a symlink', async () => {
    await mkdir(join(dir, '.github'));
    await mkdir(join(dir, 'assets'));
    try {
      await symlink(join(dir, '.github'), join(dir, 'assets/statkiln'), 'junction');
    } catch {
      return;
    }
    await expect(generate(cfg(), dir, { graphql: fakeGraphql(), now: new Date('2026-03-20T12:00:00Z') })).rejects.toThrow(/\.github/);
    expect(await readdir(join(dir, '.github'))).toEqual([]);
  });

  it('refuses to write through a symlink that escapes the workspace', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'statkiln-outside-'));
    try {
      await mkdir(join(dir, 'assets'));
      try {
        await symlink(outside, join(dir, 'assets/statkiln'), 'junction');
      } catch {
        return; // symlinks unavailable on this machine
      }
      await expect(generate(cfg(), dir, { graphql: fakeGraphql(), now: new Date('2026-03-20T12:00:00Z') })).rejects.toThrow(/outside the repository/);
      expect(await readdir(outside)).toEqual([]);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

describe('action packaging', () => {
  it('action.yml runs the committed bundle on node24', async () => {
    const yml = await readFile(join(ROOT, 'action.yml'), 'utf8');
    expect(yml).toMatch(/using: 'node24'/);
    const main = /main: '([^']+)'/.exec(yml)?.[1];
    expect(main).toBe('dist/index.js');
    const bundle = await readFile(join(ROOT, main as string), 'utf8');
    expect(bundle.length).toBeGreaterThan(1000);
    expect(bundle).toContain('StatKiln');
  });

  it('declares branding for the Marketplace', async () => {
    const yml = await readFile(join(ROOT, 'action.yml'), 'utf8');
    expect(yml).toMatch(/branding:\n {2}icon: '[a-z0-9-]+'\n {2}color: '[a-z]+'/);
    expect(yml).toMatch(/^name: '[^']+'/m);
    expect(yml).toMatch(/^description: '[^']{20,}'/m);
  });

  it('dist/index.js is up to date with the sources (deterministic build)', async () => {
    const result = await build({
      entryPoints: [join(ROOT, 'src/index.ts')],
      bundle: true,
      platform: 'node',
      target: 'node24',
      format: 'esm',
      legalComments: 'none',
      charset: 'utf8',
      write: false,
      logLevel: 'silent',
      absWorkingDir: ROOT,
      banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
      outfile: 'dist/index.js',
    });
    const fresh = result.outputFiles[0]?.text.replace(/\r\n/g, '\n');
    const committed = (await readFile(join(ROOT, 'dist/index.js'), 'utf8')).replace(/\r\n/g, '\n');
    expect(fresh).toBe(committed);
  });
});
