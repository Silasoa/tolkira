import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const result = await build({
  entryPoints: [
    fileURLToPath(new URL('../src/render/search.ts', import.meta.url)),
  ],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'TolkiraSearch',
  minify: true,
  legalComments: 'none',
  write: false,
});

const code = result.outputFiles[0].text;
const output =
  '// Generated from src/render/search.ts by scripts/build-search.mjs. Do not edit.\n' +
  `export const SEARCH_BUNDLE: string = ${JSON.stringify(code)};\n`;
await writeFile(new URL('../src/render/search-bundle.ts', import.meta.url), output);
console.log(`search-bundle.ts ${code.length} bytes`);
