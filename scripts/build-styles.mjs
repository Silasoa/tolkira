import { readFile, writeFile } from 'node:fs/promises';
import { transformSync } from 'esbuild';

function minify(source) {
  return transformSync(source.replaceAll('\r\n', '\n'), {
    loader: 'css',
    minify: true,
    target: 'esnext',
  }).code.trimEnd();
}

const css = await readFile(
  new URL('../src/render/report.css', import.meta.url),
  'utf8',
);
const baselineCss = await readFile(
  new URL('../src/render/baseline.css', import.meta.url),
  'utf8',
);
const minified = minify(css);
const minifiedBaseline = minify(baselineCss);
const output =
  '// Generated from report.css and baseline.css by scripts/build-styles.mjs. Do not edit.\n' +
  `export const REPORT_CSS: string = ${JSON.stringify(minified)};\n` +
  `export const BASELINE_CSS: string = ${JSON.stringify(minifiedBaseline)};\n`;
await writeFile(new URL('../src/render/styles.ts', import.meta.url), output);
console.log(
  `styles.ts ${minified.length} + ${minifiedBaseline.length} bytes ` +
    `(${css.length} + ${baselineCss.length} source)`,
);
