import { build, transform } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// One artifact for the whole report: the tag-expression API and the inline
// report script. Keep the target explicit so the shipped script does not drift
// with the build environment.
const TARGET = ['chrome100', 'firefox100', 'safari15'];
const MAX_BYTES = 16_000;

const search = await build({
  entryPoints: [
    fileURLToPath(new URL('../src/render/search.ts', import.meta.url)),
  ],
  bundle: true,
  platform: 'browser',
  target: TARGET,
  format: 'iife',
  globalName: 'TolkiraSearch',
  minify: true,
  legalComments: 'none',
  write: false,
});

const clientSource = await readFile(
  new URL('../src/render/report-client.js', import.meta.url),
  'utf8',
);
const client = await transform(clientSource, {
  loader: 'js',
  minify: true,
  target: TARGET,
  legalComments: 'none',
});

const code = `${search.outputFiles[0].text}\n${client.code}`;
if (code.length > MAX_BYTES) {
  throw new Error(
    `client bundle is ${code.length} bytes, above the ${MAX_BYTES}-byte budget`,
  );
}

const output =
  '// Generated from src/render/search.ts and report-client.js by scripts/build-search.mjs. Do not edit.\n' +
  `export const CLIENT_SCRIPT: string = ${JSON.stringify(code)};\n`;
await writeFile(
  new URL('../src/render/client-bundle.ts', import.meta.url),
  output,
);
console.log(`client-bundle.ts ${code.length} bytes (budget ${MAX_BYTES})`);
