import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// One artifact for the whole report: the browser client and the helpers it
// imports. Keep the target explicit so the shipped script does not drift with
// the build environment.
const TARGET = ['chrome100', 'firefox100', 'safari15'];
const MAX_BYTES = 16_000;

const client = await build({
  entryPoints: [
    fileURLToPath(new URL('../src/render/report-client.ts', import.meta.url)),
  ],
  bundle: true,
  platform: 'browser',
  target: TARGET,
  format: 'iife',
  minify: true,
  legalComments: 'none',
  write: false,
});

const code = client.outputFiles[0].text;
if (code.length > MAX_BYTES) {
  throw new Error(
    `client bundle is ${code.length} bytes, above the ${MAX_BYTES}-byte budget`,
  );
}

const output =
  '// Generated from src/render/report-client.ts by scripts/build-search.mjs. Do not edit.\n' +
  `export const CLIENT_SCRIPT: string = ${JSON.stringify(code)};\n`;
await writeFile(
  new URL('../src/render/client-bundle.ts', import.meta.url),
  output,
);
console.log(`client-bundle.ts ${code.length} bytes (budget ${MAX_BYTES})`);
