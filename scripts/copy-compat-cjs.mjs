import { copyFile, mkdir } from 'node:fs/promises';

// tsc also emits unbundled JS for imported modules; copy only the wrapper files
// so the esbuild bundles in dist/ stay intact.
const source = '.tmp/compat-cjs/compat';
const target = 'dist/compat';

await mkdir(target, { recursive: true });
await Promise.all([
  copyFile(`${source}/cucumber-html-reporter.cjs`, `${target}/cucumber-html-reporter.cjs`),
  copyFile(`${source}/cucumber-html-reporter.d.cts`, `${target}/cucumber-html-reporter.d.cts`),
]);
