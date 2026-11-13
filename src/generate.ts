import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { collectUserData } from './collect';
import { hasProtectedSegment } from './config';
import { todayIn } from './dates';
import { StatKilnError } from './errors';
import { createGraphQLClient, type GraphQLClient } from './github';
import { getTheme } from './themes';
import { renderContributions, renderLanguages, renderOverview, renderStreak, type RenderOptions } from './svg/cards';
import type { CardName, Config, UserData } from './types';

export interface GeneratedFile {
  name: string;
  content: string;
}

const RENDERERS: Record<CardName, (d: UserData, o: RenderOptions) => string> = {
  overview: renderOverview,
  languages: renderLanguages,
  streak: renderStreak,
  contributions: renderContributions,
};

/** Sanity checks so a broken render can never overwrite a good card. */
export function validateSvg(name: string, svg: string): void {
  if (!svg.startsWith('<svg ') || !svg.trimEnd().endsWith('</svg>')) {
    throw new StatKilnError(`Rendered ${name} is not a complete SVG document.`);
  }
  // Text nodes are escaped by esc() and may legitimately contain words like "Infinity";
  // check the markup only (text content stripped).
  const markup = svg.replace(/>[^<]*</g, '><');
  if (/<script|<foreignObject|javascript:|\son\w+\s*=|<!ENTITY|<!DOCTYPE/i.test(markup)) {
    throw new StatKilnError(`Rendered ${name} contains forbidden content.`);
  }
  if (/NaN|undefined|Infinity/.test(markup)) {
    throw new StatKilnError(`Rendered ${name} contains invalid values.`);
  }
}

export function renderAll(
  data: UserData,
  config: Pick<Config, 'cards' | 'theme' | 'themeLight' | 'themeDark' | 'showBorder' | 'showIcons' | 'excludeForks' | 'languageCount'>,
  today: string,
): GeneratedFile[] {
  const variants: { suffix: string; theme: string }[] =
    config.themeLight && config.themeDark
      ? [
          { suffix: '-light', theme: config.themeLight },
          { suffix: '-dark', theme: config.themeDark },
        ]
      : [{ suffix: '', theme: config.theme }];

  const files: GeneratedFile[] = [];
  for (const card of config.cards) {
    for (const v of variants) {
      const name = `${card}${v.suffix}.svg`;
      const content = RENDERERS[card](data, {
        theme: getTheme(v.theme),
        showBorder: config.showBorder,
        showIcons: config.showIcons,
        excludeForks: config.excludeForks,
        languageCount: config.languageCount,
        today,
      });
      validateSvg(name, content);
      files.push({ name, content });
    }
  }
  return files;
}

export interface WriteResult {
  written: string[];
  changed: string[];
}

/**
 * Writes files atomically (temp file + rename). Call only after every card rendered successfully.
 * Files whose content did not change are left untouched.
 */
export async function writeFiles(files: GeneratedFile[], workspace: string, outputDir: string): Promise<WriteResult> {
  const root = await realpath(resolve(workspace));
  const dir = resolve(root, outputDir);
  await mkdir(dir, { recursive: true });
  const realDir = await realpath(dir);
  if (realDir !== root && !realDir.startsWith(root + sep)) {
    throw new StatKilnError('Output directory resolves outside the repository (symlink?). Refusing to write.');
  }

  const rel = realDir.slice(root.length).split(sep).filter(Boolean);
  if (hasProtectedSegment(rel)) {
    throw new StatKilnError('Output directory resolves into ".git" or ".github". Refusing to write.');
  }

  const written: string[] = [];
  const changed: string[] = [];
  for (const f of files) {
    const target = join(realDir, f.name);
    const existing = await readFile(target, 'utf8').catch(() => null);
    written.push(`${outputDir}/${f.name}`);
    if (existing === f.content) continue;
    const tmp = join(realDir, `.${f.name}.tmp`);
    try {
      await rm(tmp, { force: true }); // removes a stale file or a planted symlink (not its target)
      await writeFile(tmp, f.content, { encoding: 'utf8', flag: 'wx' });
      await rename(tmp, target);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
    changed.push(`${outputDir}/${f.name}`);
  }
  return { written, changed };
}

export interface GenerateDeps {
  graphql?: GraphQLClient;
  now?: Date;
}

export interface GenerateResult extends WriteResult {
  data: UserData;
}

/** The shared engine used by both the GitHub Action and the local CLI. */
export async function generate(config: Config, workspace: string, deps: GenerateDeps = {}): Promise<GenerateResult> {
  const graphql = deps.graphql ?? createGraphQLClient({ token: config.token });
  const today = todayIn(config.timezone, deps.now);
  const data = await collectUserData(graphql, config.username, today, config.historyYears);
  // Render everything first: if anything throws, no file on disk is touched.
  const files = renderAll(data, config, today);
  const result = await writeFiles(files, workspace, config.outputDir);
  return { ...result, data };
}
