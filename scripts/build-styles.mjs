import { readFile, writeFile } from 'node:fs/promises';
import { transformSync } from 'esbuild';

const css = (await readFile(new URL('../src/render/report.css', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const minified = transformSync(css, {
  loader: 'css',
  minify: true,
  target: 'esnext',
}).code.trimEnd();
const output =
  '// Generated from report.css by scripts/build-styles.mjs. Do not edit.\n' +
  `export const REPORT_CSS: string = ${JSON.stringify(minified)};\n`;
await writeFile(new URL('../src/render/styles.ts', import.meta.url), output);
console.log(`styles.ts ${minified.length} bytes (${css.length} source)`);
