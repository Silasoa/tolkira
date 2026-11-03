import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external: Object.keys(pkg.dependencies ?? {}),
  logLevel: 'info',
};

await build({
  ...shared,
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
});

await build({
  ...shared,
  entryPoints: ['src/cli.ts'],
  outfile: 'dist/cli.js',
  banner: {
    js: '#!/usr/bin/env node',
  },
});

await build({
  ...shared,
  entryPoints: ['src/compat/cucumber-html-reporter.ts'],
  outfile: 'dist/compat/cucumber-html-reporter.js',
  // Reuse the public renderer instead of bundling a second copy.
  external: [...Object.keys(pkg.dependencies ?? {}), '../index.js'],
});
