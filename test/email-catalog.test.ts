import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';

// The email renders these keys through createTranslator(locale). Keep the list
// in sync with the copy contract in tdd-red.md; the existing catalog checker
// covers sorting, HTML, plurals and the generated module.
const REQUIRED_EMAIL_KEYS = [
  'email.attachments',
  'email.duration',
  'email.empty',
  'email.failedTitle',
  'email.features',
  'email.footer',
  'email.generated',
  'email.moreFailures',
  'email.noFailures',
  'email.noFailuresStatus',
  'email.passRate',
  'email.passRateNote',
  'email.reportMissing',
  'email.reportNote',
  'email.steps',
  'email.title',
  'email.unexecuted',
] as const;

interface EnglishEntry {
  message: string;
  description: string;
}

type EnglishCatalog = Record<string, EnglishEntry>;
type SimpleCatalog = Record<string, string>;

const enUrl = new URL('../src/i18n/locales/en.json', import.meta.url);
const deUrl = new URL('../src/i18n/locales/de.json', import.meta.url);

let en: EnglishCatalog;
let de: SimpleCatalog;

beforeAll(async () => {
  en = JSON.parse(await readFile(enUrl, 'utf8')) as EnglishCatalog;
  de = JSON.parse(await readFile(deUrl, 'utf8')) as SimpleCatalog;
});

function placeholders(message: string): string[] {
  return [
    ...new Set(
      [...message.matchAll(/\{([A-Za-z_]\w*)/g)].map(
        (match) => match[1] as string,
      ),
    ),
  ].sort();
}

describe('email catalog keys', () => {
  it('has every required key with an English description and a German value', () => {
    for (const key of REQUIRED_EMAIL_KEYS) {
      const entry = en[key];
      expect(entry, `en.json: ${key}`).toBeDefined();
      expect(entry?.message.trim(), `en.json: ${key}`).not.toBe('');
      expect(entry?.description.trim(), `en.json: ${key}`).not.toBe('');
      expect(de[key], `de.json: ${key}`).toBeTypeOf('string');
      expect(de[key]?.trim(), `de.json: ${key}`).not.toBe('');
    }
  });

  it('keeps every email key in English/German parity', () => {
    const englishKeys = Object.keys(en)
      .filter((key) => key.startsWith('email.'))
      .sort();
    const germanKeys = Object.keys(de)
      .filter((key) => key.startsWith('email.'))
      .sort();

    expect(englishKeys).toEqual(
      expect.arrayContaining([...REQUIRED_EMAIL_KEYS]),
    );
    expect(germanKeys).toEqual(englishKeys);
  });

  it('keeps the placeholders identical in both catalogs', () => {
    for (const key of Object.keys(en).filter((entry) =>
      entry.startsWith('email.'),
    )) {
      expect(placeholders(de[key] as string), key).toEqual(
        placeholders(en[key]?.message as string),
      );
    }
  });

  it('keeps HTML, quotes and select out of the email copy', () => {
    for (const key of Object.keys(en).filter((entry) =>
      entry.startsWith('email.'),
    )) {
      expect(en[key]?.message, `en.json: ${key}`).not.toMatch(/[<>"]/);
      expect(en[key]?.message, `en.json: ${key}`).not.toMatch(/\bselect\b/i);
      expect(de[key], `de.json: ${key}`).not.toMatch(/[<>"]/);
      expect(de[key], `de.json: ${key}`).not.toMatch(/\bselect\b/i);
    }
  });

  it('keeps the reviewed recipient-facing copy', () => {
    expect(en['email.attachments']?.message).toBe('Attachments in the run');
    expect(de['email.attachments']).toBe('Anhänge im Lauf');
    expect(en['email.passRateNote']?.message).toBe(
      'The pass rate counts only executed (non-skipped) scenarios.',
    );
    expect(de['email.passRateNote']).toBe(
      'Die Erfolgsquote zählt nur ausgeführte (nicht übersprungene) Szenarien.',
    );
    expect(en['email.reportMissing']?.message).toBe(
      'No full report is attached.',
    );
    expect(de['email.reportMissing']).toBe(
      'Es ist kein vollständiger Bericht angehängt.',
    );
    expect(en['email.title']?.description).toContain(
      'Email document title and heading',
    );
    expect(en['email.duration']?.description).toContain('summed test time');
  });
});
