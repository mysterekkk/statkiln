// Deterministic bundling: no timestamps, no absolute paths, fixed target.
import process from 'node:process';
import { build } from 'esbuild';

const cli = process.argv.includes('--cli');

const common = {
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'info',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
};

if (cli) {
  await build({ ...common, entryPoints: ['src/cli.ts', 'src/gallery.ts'], outdir: 'dist-cli' });
} else {
  await build({ ...common, entryPoints: ['src/index.ts'], outfile: 'dist/index.js', minify: false });
}
