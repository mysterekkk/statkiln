import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { parseConfig } from './config';
import { StatKilnError } from './errors';
import { generate } from './generate';
import { THEME_NAMES } from './themes';

const HELP = `StatKiln local generator

Usage:
  npm run generate -- --username <login> [options]

Options:
  --username <login>       GitHub user (required)
  --theme <name>           ${THEME_NAMES.join(' | ')} (default: midnight)
  --theme-light <name>     with --theme-dark: write <card>-light.svg / <card>-dark.svg
  --theme-dark <name>
  --out-dir <dir>          output directory, relative to the current directory (default: assets/statkiln)
  --cards <list>           comma list of overview,languages,streak,contributions
  --language-count <n>     1-12 (default: 6)
  --exclude-forks <bool>   default: true
  --show-border <bool>     default: true
  --show-icons <bool>      default: true
  --timezone <iana>        default: UTC
  --history-years <n>      1-10 (default: 3)
  -h, --help

Authentication: set GITHUB_TOKEN (or GH_TOKEN), or log in with the GitHub CLI (gh auth login).
  PowerShell: $env:GITHUB_TOKEN = "<token>"
  Bash:       export GITHUB_TOKEN=<token>
`;

function resolveToken(): string {
  const fromEnv = process.env['GITHUB_TOKEN'] ?? process.env['GH_TOKEN'];
  if (fromEnv) return fromEnv;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      username: { type: 'string' },
      theme: { type: 'string' },
      'theme-light': { type: 'string' },
      'theme-dark': { type: 'string' },
      'out-dir': { type: 'string' },
      cards: { type: 'string' },
      'language-count': { type: 'string' },
      'exclude-forks': { type: 'string' },
      'show-border': { type: 'string' },
      'show-icons': { type: 'string' },
      timezone: { type: 'string' },
      'history-years': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(HELP);
    return 0;
  }
  try {
    const cwd = process.cwd();
    const config = parseConfig(
      {
        ...Object.fromEntries(Object.entries(values).filter(([, v]) => typeof v === 'string')),
        'output-dir': values['out-dir'] ?? 'assets/statkiln',
        'github-token': resolveToken(),
      },
      cwd,
    );
    const { written, changed, data } = await generate(config, cwd);
    console.log(`Generated ${written.length} file(s) for ${data.login} (${changed.length} changed):`);
    for (const f of written) console.log(`  ${f}`);
    return 0;
  } catch (err) {
    console.error(`Error: ${err instanceof StatKilnError ? err.message : 'Unexpected internal error.'}`);
    return 1;
  }
}

process.exitCode = await main();
