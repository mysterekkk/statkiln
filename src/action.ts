import { appendFileSync } from 'node:fs';
import { parseConfig } from './config';
import { StatKilnError } from './errors';
import { generate } from './generate';

export const INPUT_NAMES = [
  'username',
  'github-token',
  'theme',
  'theme-light',
  'theme-dark',
  'output-dir',
  'cards',
  'language-count',
  'exclude-forks',
  'show-border',
  'show-icons',
  'timezone',
  'history-years',
] as const;

function getInputs(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const name of INPUT_NAMES) out[name] = env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`];
  return out;
}

function setOutput(env: NodeJS.ProcessEnv, name: string, value: string): void {
  const file = env['GITHUB_OUTPUT'];
  // Values are single-line by construction; refuse anything else instead of risking output injection.
  if (/[\r\n]/.test(value)) throw new StatKilnError(`Refusing to write multi-line value for output "${name}".`);
  if (file) appendFileSync(file, `${name}=${value}\n`);
}

/** Escape a message for a workflow command (::error::...). */
function cmdEscape(s: string): string {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

export async function run(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const inputs = getInputs(env);
  const token = inputs['github-token']?.trim();
  if (token) console.log(`::add-mask::${cmdEscape(token)}`);

  try {
    const workspace = env['GITHUB_WORKSPACE'] ?? process.cwd();
    const config = parseConfig(inputs, workspace);
    const { written, changed, data } = await generate(config, workspace);
    setOutput(env, 'files', written.join(','));
    setOutput(env, 'changed', changed.length > 0 ? 'true' : 'false');
    console.log(`StatKiln: generated ${written.length} file(s) for ${data.login}; ${changed.length} changed.`);
    for (const f of written) console.log(`  - ${cmdEscape(f)}${changed.includes(f) ? ' (updated)' : ''}`);
    return 0;
  } catch (err) {
    // Only StatKiln errors are known to be free of secrets; show a generic message otherwise.
    const message = err instanceof StatKilnError ? err.message : 'Unexpected internal error.';
    console.log(`::error title=StatKiln failed::${cmdEscape(message)}`);
    console.log('StatKiln left any previously generated files untouched.');
    return 1;
  }
}
