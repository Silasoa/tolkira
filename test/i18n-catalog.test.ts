import { readdir, readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  catalogs as generatedCatalogs,
  de as generatedDe,
  en as generatedEn,
  type MessageKey,
} from '../src/i18n/catalogs.js';
import { MAX_MESSAGE_LENGTH } from '../src/render/i18n.js';

// Catalog source files; the generated module must mirror these bytes.
const LOCALES = new URL('../src/i18n/locales/', import.meta.url);
const FIXTURES = new URL('./fixtures/i18n/', import.meta.url);

interface EnglishEntry {
  message: string;
  description: string;
}

type EnglishCatalog = Record<string, EnglishEntry>;
type SimpleCatalog = Record<string, string>;

interface CatalogPair {
  en: EnglishCatalog;
  de: SimpleCatalog;
}

async function readJson<T>(url: URL | string): Promise<T> {
  return JSON.parse(await readFile(url, 'utf8')) as T;
}

function readFixture(name: string): Promise<CatalogPair> {
  return readJson<CatalogPair>(new URL(name, FIXTURES));
}

function assertSorted(keys: string[], file: string): void {
  const sorted = [...keys].sort();
  for (let index = 0; index < keys.length; index += 1) {
    const actual = keys[index] as string;
    if (actual !== sorted[index]) {
      throw new Error(`${file}: ${actual}: catalog keys must be sorted`);
    }
  }
}

function assertParity(
  en: Record<string, unknown>,
  target: Record<string, unknown>,
  file: string,
): void {
  for (const key of Object.keys(en)) {
    if (!(key in target)) {
      throw new Error(`${file}: ${key}: missing in the target catalog`);
    }
  }
  for (const key of Object.keys(target)) {
    if (!(key in en)) {
      throw new Error(`${file}: ${key}: not present in English`);
    }
  }
}

function assertShape(
  en: Record<string, unknown>,
  target: Record<string, unknown>,
  file: string,
): void {
  for (const [key, entry] of Object.entries(en)) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`${file}: ${key}: English entry must be an object`);
    }
    const { message, description } = entry as Record<string, unknown>;
    if (typeof message !== 'string' || message.length === 0) {
      throw new Error(`${file}: ${key}: English message must be non-empty`);
    }
    if (typeof description !== 'string' || description.trim().length === 0) {
      throw new Error(`${file}: ${key}: English entry needs a description`);
    }
  }
  for (const [key, value] of Object.entries(target)) {
    if (typeof value !== 'string') {
      throw new Error(`${file}: ${key}: target catalog values must be strings`);
    }
    if (value.length === 0) {
      throw new Error(`${file}: ${key}: target value must not be empty`);
    }
  }
}

function closingBrace(text: string, start: number): number {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

interface Scan {
  placeholders: string[];
  categories: string[];
}

const HEADER = /^\s*([A-Za-z_]\w*)\s*(?:,\s*([a-z]+)\s*,?)?/;

function pluralBranches(
  inner: string,
  where: string,
): Array<{ category: string; body: string }> {
  const header = /^\s*[A-Za-z_]\w*\s*,\s*plural\s*,/.exec(inner);
  if (!header) throw new Error(`${where}: malformed plural`);
  const rest = inner.slice(header[0].length);
  const branches: Array<{ category: string; body: string }> = [];
  let index = 0;
  while (index < rest.length) {
    while (index < rest.length && /\s/.test(rest[index] as string)) index += 1;
    if (index >= rest.length) break;
    const match = /^([A-Za-z]+)\s*\{/.exec(rest.slice(index));
    if (!match) throw new Error(`${where}: malformed plural branch`);
    const open = index + match[0].length - 1;
    const close = closingBrace(rest, open);
    if (close < 0) throw new Error(`${where}: unbalanced plural branch`);
    branches.push({
      category: match[1] as string,
      body: rest.slice(open + 1, close),
    });
    index = close + 1;
  }
  if (branches.length === 0) throw new Error(`${where}: plural has no branches`);
  return branches;
}

function scanMessage(
  message: string,
  locale: string,
  where: string,
  nested = false,
): Scan {
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(
      `${where}: message is longer than ${MAX_MESSAGE_LENGTH} characters`,
    );
  }
  const placeholders: string[] = [];
  const categories: string[] = [];
  for (let index = 0; index < message.length; index += 1) {
    const character = message[index];
    if (character === '<' || character === '>') {
      throw new Error(`${where}: HTML is not allowed in a message`);
    }
    if (character === '"') {
      throw new Error(`${where}: double quotes are not allowed in a message`);
    }
    if (character !== '{') continue;
    const end = closingBrace(message, index);
    if (end < 0) throw new Error(`${where}: unbalanced placeholder`);
    const inner = message.slice(index + 1, end);
    const header = HEADER.exec(inner);
    if (!header || !header[1]) {
      throw new Error(`${where}: malformed placeholder`);
    }
    const name = header[1];
    const type = header[2];
    if (type === 'plural') {
      if (nested) throw new Error(`${where}: nested plural is not supported`);
      placeholders.push(name);
      const branches = pluralBranches(inner, where);
      const active = new Set<string>(
        new Intl.PluralRules(locale).resolvedOptions().pluralCategories,
      );
      if (!branches.some((branch) => branch.category === 'other')) {
        throw new Error(`${where}: plural needs an other branch`);
      }
      for (const branch of branches) {
        if (!active.has(branch.category)) {
          throw new Error(
            `${where}: plural category ${branch.category} is not active in ${locale}`,
          );
        }
        categories.push(branch.category);
        const innerScan = scanMessage(branch.body, locale, where, true);
        placeholders.push(...innerScan.placeholders);
        categories.push(...innerScan.categories);
      }
    } else {
      if (type !== undefined) {
        throw new Error(`${where}: unsupported placeholder type ${type}`);
      }
      placeholders.push(name);
    }
    index = end;
  }
  return { placeholders, categories };
}

function placeholdersOf(message: string, locale: string, where: string): string[] {
  return [...new Set(scanMessage(message, locale, where).placeholders)].sort();
}

function assertMessages(
  en: EnglishCatalog,
  target: SimpleCatalog,
  file: string,
  tag: string,
): void {
  for (const [key, entry] of Object.entries(en)) {
    const where = `${file}: ${key}`;
    scanMessage(entry.message, 'en', where);
    scanMessage(target[key] as string, tag, where);
    expect(
      placeholdersOf(target[key] as string, tag, where),
      where,
    ).toEqual(placeholdersOf(entry.message, 'en', where));
  }
}

function validatePair(pair: CatalogPair, file: string, tag: string): void {
  const en = pair.en as unknown as Record<string, unknown>;
  const target = pair.de as unknown as Record<string, unknown>;
  assertSorted(Object.keys(en), file);
  assertSorted(Object.keys(target), file);
  assertParity(en, target, file);
  assertShape(en, target, file);
  assertMessages(pair.en, pair.de, file, tag);
}

interface Shipped {
  tags: string[];
  en: EnglishCatalog;
  targets: Map<string, SimpleCatalog>;
}

const shipped: Shipped = { tags: [], en: {}, targets: new Map() };

beforeAll(async () => {
  const names = (await readdir(LOCALES)).filter((name) => name.endsWith('.json'));
  shipped.tags = names.map((name) => name.slice(0, -'.json'.length)).sort();
  shipped.en = await readJson<EnglishCatalog>(new URL('en.json', LOCALES));
  for (const tag of shipped.tags) {
    if (tag === 'en') continue;
    shipped.targets.set(
      tag,
      await readJson<SimpleCatalog>(new URL(`${tag}.json`, LOCALES)),
    );
  }
});

describe('shipped catalogs', () => {
  it('keeps English and every target in key parity', () => {
    for (const [tag, target] of shipped.targets) {
      expect(Object.keys(target).sort(), tag).toEqual(
        Object.keys(shipped.en).sort(),
      );
    }
  });

  it('describes every English message and keeps values non-empty', () => {
    for (const [tag, target] of shipped.targets) {
      expect(
        () =>
          assertShape(
            shipped.en as unknown as Record<string, unknown>,
            target as unknown as Record<string, unknown>,
            tag,
          ),
        tag,
      ).not.toThrow();
    }
  });

  it('keeps every catalog sorted', () => {
    expect(() => assertSorted(Object.keys(shipped.en), 'en.json')).not.toThrow();
    for (const [tag, target] of shipped.targets) {
      expect(() => assertSorted(Object.keys(target), `${tag}.json`), tag).not.toThrow();
    }
  });

  it('keeps placeholders identical', () => {
    for (const [tag, target] of shipped.targets) {
      expect(
        () => assertMessages(shipped.en, target, 'src/i18n/locales', tag),
        tag,
      ).not.toThrow();
    }
  });

  it('uses only active plural categories and always other', () => {
    const plurals = Object.entries(shipped.en)
      .filter(([, entry]) => scanMessage(entry.message, 'en', 'en').categories.length > 0)
      .map(([key]) => key);
    expect(plurals.length).toBeGreaterThan(0);
    for (const [tag, target] of shipped.targets) {
      const active = new Set(
        new Intl.PluralRules(tag).resolvedOptions().pluralCategories,
      );
      for (const key of plurals) {
        const scan = scanMessage(target[key] as string, tag, key);
        expect(scan.categories, key).toContain('other');
        for (const category of scan.categories) {
          expect(active, `${tag}: ${key}: ${category}`).toContain(category);
        }
      }
    }
  });

  it('keeps HTML, select and ASCII quotes out of every value', () => {
    for (const [key, entry] of Object.entries(shipped.en)) {
      expect(entry.message, key).not.toMatch(/[<>"]/);
      expect(entry.message, key).not.toMatch(/\bselect\b/);
    }
    for (const [tag, target] of shipped.targets) {
      for (const [key, value] of Object.entries(target)) {
        expect(value, `${tag}: ${key}`).not.toMatch(/[<>"]/);
        expect(value, `${tag}: ${key}`).not.toMatch(/\bselect\b/);
      }
    }
  });

  it('is complete: every English key has a value in every target', () => {
    for (const [tag, target] of shipped.targets) {
      expect(
        Object.keys(shipped.en).filter((key) => !(key in target)),
        tag,
      ).toEqual([]);
      expect(
        Object.values(target).filter((value) => value.trim().length === 0),
        tag,
      ).toEqual([]);
    }
  });

  it('matches the generated catalogs module', () => {
    const expectedEn: Record<string, string> = Object.fromEntries(
      Object.entries(shipped.en).map(([key, entry]) => [key, entry.message]),
    );

    expect(Object.keys(generatedEn)).toEqual(Object.keys(expectedEn));
    expect(generatedEn).toEqual(expectedEn);
    expect(generatedDe).toEqual(shipped.targets.get('de'));

    const key: MessageKey = Object.keys(expectedEn)[0] as MessageKey;
    expect(Object.keys(generatedEn)).toContain(key);
  });

  it('discovers every catalog file and keeps the generated map complete', () => {
    const generated = generatedCatalogs as Record<
      string,
      Record<string, string>
    >;

    for (const tag of shipped.tags) {
      if (tag === 'en') continue;
      const target = shipped.targets.get(tag) as SimpleCatalog;
      expect(
        () => validatePair({ en: shipped.en, de: target }, `${tag}.json`, tag),
        tag,
      ).not.toThrow();
      expect(generated[tag], tag).toEqual(target);
    }
    expect(Object.keys(generated).sort()).toEqual(shipped.tags);
  });
});

describe('catalog checker fixtures', () => {
  it('accepts a valid pair', () => {
    validatePair(
      {
        en: {
          'report.greeting': {
            message: 'Hello {name}',
            description: 'Greeting',
          },
          'report.scenarioCount': {
            message:
              '{count, plural, one {# scenario for {name}} other {# scenarios for {name}}}',
            description: 'Scenario count',
          },
        },
        de: {
          'report.greeting': 'Hallo {name}',
          'report.scenarioCount':
            '{count, plural, one {# Szenario für {name}} other {# Szenarien für {name}}}',
        },
      },
      'valid.json',
      'de',
    );
  });

  const cases: Array<{ file: string; key: string }> = [
    { file: 'bad-missing-key.json', key: 'report.views' },
    { file: 'bad-missing-description.json', key: 'report.tab' },
    { file: 'bad-empty-value.json', key: 'report.tab' },
    { file: 'bad-placeholder.json', key: 'report.greeting' },
    { file: 'bad-missing-other.json', key: 'report.fileCount' },
    { file: 'bad-category.json', key: 'report.fileCount' },
    { file: 'bad-unsorted.json', key: 'report.views' },
    { file: 'bad-html.json', key: 'report.tab' },
    { file: 'bad-select.json', key: 'report.tab' },
    { file: 'bad-quote.json', key: 'report.tab' },
    { file: 'bad-long.json', key: 'report.tab' },
  ];

  it.each(cases)('rejects $file and names $key', async ({ file, key }) => {
    const pair = await readFixture(file);
    let message = '';
    try {
      validatePair(pair, file, 'de');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message, file).toContain(file);
    expect(message, file).toContain(key);
  });
});
