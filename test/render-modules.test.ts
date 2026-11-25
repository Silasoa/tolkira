import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RENDER = fileURLToPath(new URL('../src/render/', import.meta.url));

// A module may import only modules on a lower layer. Same-layer imports are a
// sign that two views started sharing rendering and the seam moved.
const layers: Record<string, number> = {
  html: 0,
  report: 1,
  details: 1,
  trends: 1,
  triage: 2,
  matrix: 2,
  attachments: 2,
  ci: 2,
  format: 3,
  baseline: 2,
  types: 4,
};

// Shared foundation: importable from every layer, but it must not import a
// layered module itself.
const foundation = new Set([
  'ansi',
  'client-bundle',
  'client-i18n',
  'dom-contract',
  'escape',
  'i18n',
  'markdown',
  'print-script',
  'report-client',
  'search',
  'styles',
]);

function source(name: string): string {
  return readFileSync(`${RENDER}${name}.ts`, 'utf8');
}

function localImports(name: string): string[] {
  const specs = [
    ...source(name).matchAll(/\b(?:from|import)\s*(?:\(\s*)?['"]([^'"]+)['"]/g),
  ].map((match) => match[1] as string);
  return specs.flatMap((spec) => {
    if (!spec.startsWith('.')) return [];
    const local = spec.replace(/^\.\//, '').replace(/^\.\.\/render\//, '');
    return local === spec ? [] : [local.replace(/\.js$/, '')];
  });
}

describe('render modules', () => {
  it('has the expected layer module set', () => {
    const actual = readdirSync(RENDER)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => file.slice(0, -3))
      .filter((name) => !foundation.has(name))
      .sort();

    expect(actual).toEqual(Object.keys(layers).sort());
  });

  it.each(Object.keys(layers))('%s imports only lower layers', (name) => {
    const from = layers[name] as number;
    for (const target of localImports(name)) {
      if (foundation.has(target)) continue;
      const to = layers[target];
      if (to === undefined) {
        throw new Error(`${name} imports unknown render module ${target}`);
      }
      expect(from, `${name} -> ${target}`).toBeLessThan(to);
    }
  });

  it.each([...foundation])('%s imports no layered module', (name) => {
    for (const target of localImports(name)) {
      expect(layers[target], `${name} -> ${target}`).toBeUndefined();
    }
  });

  it('keeps html.ts a shell', () => {
    const html = source('html');
    expect(html.split('\n').length).toBeLessThan(100);
    expect(html).not.toMatch(
      /function\s+render\w*View\b|const\s+render\w*View\b/,
    );
  });

  it('keeps the generated catalog a leaf and i18n on it', () => {
    const catalog = readFileSync(
      fileURLToPath(new URL('../src/i18n/catalogs.ts', import.meta.url)),
      'utf8',
    );
    expect(catalog).not.toMatch(/\bimport\b/);

    const specs = [
      ...source('i18n').matchAll(/\bfrom\s*['"]([^'"]+)['"]/g),
    ].map((match) => match[1]);
    expect(specs).toEqual(['../i18n/catalogs.js']);
    expect(source('client-i18n')).not.toMatch(/\bimport\b/);
  });
});
