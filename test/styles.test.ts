import { readFile } from 'node:fs/promises';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { REPORT_CSS } from '../src/render/styles.js';

// The shipped form of the readable source: CRLF-normalised and minified the
// same way scripts/build-styles.mjs generates styles.ts.
async function sourceCss(): Promise<string> {
  return (
    await readFile(new URL('../src/render/report.css', import.meta.url), 'utf8')
  ).replace(/\r\n/g, '\n');
}

describe('embedded report stylesheet', () => {
  it('is the minified source stylesheet', async () => {
    const source = await sourceCss();
    const minified = transformSync(source, {
      loader: 'css',
      minify: true,
      target: 'esnext',
    }).code.trimEnd();

    expect(REPORT_CSS).toBe(minified);
  });

  it('is non-empty and smaller than its source', async () => {
    const source = await sourceCss();

    expect(source.trim().length).toBeGreaterThan(0);
    expect(REPORT_CSS.length).toBeGreaterThan(0);
    expect(REPORT_CSS.length).toBeLessThan(source.length);
  });
});
