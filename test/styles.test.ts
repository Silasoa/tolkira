import { readFile } from 'node:fs/promises';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { BASELINE_CSS, REPORT_CSS } from '../src/render/styles.js';

// The shipped form of the readable source: CRLF-normalised and minified the
// same way scripts/build-styles.mjs generates styles.ts.
async function sourceCss(): Promise<string> {
  return (
    await readFile(new URL('../src/render/report.css', import.meta.url), 'utf8')
  ).replace(/\r\n/g, '\n');
}

/** Balanced-brace blocks whose header matches the pattern. */
function cssBlocks(css: string, header: RegExp): string[] {
  const blocks: string[] = [];
  for (const match of css.matchAll(header)) {
    let depth = 1;
    let index = (match.index ?? 0) + match[0].length;
    while (index < css.length && depth > 0) {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') depth -= 1;
      index += 1;
    }
    blocks.push(css.slice(match.index, index));
  }
  return blocks;
}

describe('Details metadata container rule', () => {
  it('stacks the metadata list in one start-aligned column in a narrow shell', () => {
    const narrow = cssBlocks(
      REPORT_CSS,
      /@container\s*\(max-width:[^)]+\)\{/g,
    ).filter((block) => block.includes('.metaList'));

    expect(narrow).toHaveLength(1);
    expect(narrow[0]).toMatch(/@container\s*\(max-width:\s*[\d.]+rem\)/);
    expect(narrow[0]).toMatch(
      /\.metaList\{[^}]*grid-template-columns:minmax\(0,\s*1fr\)/,
    );
    expect(narrow[0]).toMatch(
      /\.metaList dd\{[^}]*text-align:\s*(?:left|start)/,
    );
  });

  it('keeps the two-column layout for normal text widths', () => {
    expect(REPORT_CSS).toContain(
      '@media(max-width:560px){html{scroll-padding-top:5.5rem}.metaList{grid-template-columns:minmax(0,2fr) minmax(0,3fr)}',
    );
  });
});

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

  it('appends the minified baseline stylesheet as a separate constant', async () => {
    const source = (
      await readFile(new URL('../src/render/baseline.css', import.meta.url), 'utf8')
    ).replace(/\r\n/g, '\n');
    const minified = transformSync(source, {
      loader: 'css',
      minify: true,
      target: 'esnext',
    }).code.trimEnd();

    expect(BASELINE_CSS).toBe(minified);
    expect(BASELINE_CSS.startsWith('.baselinePanel{')).toBe(true);
    expect(REPORT_CSS).not.toContain('.baselinePanel{');
  });
});
