import { describe, expect, it } from 'vitest';
import {
  en as englishCatalog,
  type MessageKey as GeneratedMessageKey,
} from '../src/i18n/catalogs.js';
import {
  SUPPORTED_LOCALES,
  createTranslator,
  formatMessage,
  resolveLocale,
  type MessageKey,
} from '../src/render/i18n.js';

// The message grammar is intentionally small: {name} and plural with `#` and
// `other`. These tests pin the contract the renderer and the catalog check use.
const PLURAL_EN = '{count, plural, one {# scenario} other {# scenarios}}';
const PLURAL_DE = '{count, plural, one {# Szenario} other {# Szenarien}}';

function thrownMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('expected the call to throw');
}

function intlNumber(locale: string, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

// German percent values are compared against Intl, including its no-break
// space; a hand-written string would hide a wrong separator.
function intlPercent(locale: string, value: number): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value / 100);
}

function intlDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('de', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const value = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')}.${value('month')}.${value('year')}, ${value('hour')}:${value('minute')} UTC`;
}

describe('locale resolution', () => {
  it('ships en and de', () => {
    expect(SUPPORTED_LOCALES).toContain('en');
    expect(SUPPORTED_LOCALES).toContain('de');
  });

  it('defaults to English without a tag', () => {
    expect(resolveLocale()).toEqual({
      requested: 'en',
      lang: 'en',
      dir: 'ltr',
      catalog: 'en',
    });
    expect(resolveLocale('en')).toEqual({
      requested: 'en',
      lang: 'en',
      dir: 'ltr',
      catalog: 'en',
    });
  });

  it('resolves de and keeps a regional tag for lang', () => {
    expect(resolveLocale('de')).toEqual({
      requested: 'de',
      lang: 'de',
      dir: 'ltr',
      catalog: 'de',
    });
    expect(resolveLocale('de-AT')).toEqual({
      requested: 'de-AT',
      lang: 'de-AT',
      dir: 'ltr',
      catalog: 'de',
    });
  });

  it('rejects unknown, empty and malformed tags with the supported list', () => {
    for (const tag of ['fr', 'zz-ZZ', '']) {
      const message = thrownMessage(() => resolveLocale(tag));
      expect(message, tag).toMatch(/\ben\b/);
      expect(message, tag).toMatch(/\bde\b/);
    }

    const malformed = thrownMessage(() => resolveLocale('de_AT!'));
    expect(malformed).toMatch(/\ben\b/);
    expect(malformed).toMatch(/\bde\b/);
  });

  it('sanitizes control sequences and truncates the rejected tag', () => {
    const ansi = thrownMessage(() =>
      resolveLocale('\u001b[31mfr\r\ninjected\u001b[0m'),
    );
    expect(ansi).not.toContain('\u001b');
    expect(ansi).not.toContain('\r');
    expect(ansi).not.toContain('\n');
    expect(ansi).toContain('de');

    const long = thrownMessage(() => resolveLocale('z'.repeat(100)));
    expect(long).toContain('z'.repeat(40));
    expect(long).not.toContain('z'.repeat(41));
  });
});

describe('formatMessage', () => {
  it('interpolates named placeholders in one pass', () => {
    expect(
      formatMessage('Hallo {name}, {count} Dateien', { name: 'Ada', count: 3 }, 'de'),
    ).toBe('Hallo Ada, 3 Dateien');
    expect(formatMessage('{name} & {name}', { name: 'Ada' }, 'en')).toBe(
      'Ada & Ada',
    );
  });

  it('formats numeric parameters and plural counts for the locale', () => {
    expect(formatMessage('{count} Dateien', { count: 1234 }, 'de')).toBe(
      `${intlNumber('de', 1234)} Dateien`,
    );
    expect(formatMessage('{count} files', { count: 1234 }, 'en')).toBe(
      '1234 files',
    );
    expect(formatMessage('{passed} / {attempted}', { passed: 1234, attempted: 2345 }, 'de')).toBe(
      `${intlNumber('de', 1234)} / ${intlNumber('de', 2345)}`,
    );
  });

  it('reads only own parameters, never prototype members', () => {
    expect(formatMessage('Wert: {constructor}', {}, 'en')).toBe('Wert: ');
    expect(formatMessage('Wert: {toString}', {}, 'en')).toBe('Wert: ');
    expect(
      formatMessage('Wert: {__proto__}', { ['__proto__']: 'x' }, 'de'),
    ).toBe('Wert: x');
  });

  it('selects English plural branches and keeps # raw', () => {
    expect(formatMessage(PLURAL_EN, { count: 0 }, 'en')).toBe('0 scenarios');
    expect(formatMessage(PLURAL_EN, { count: 1 }, 'en')).toBe('1 scenario');
    expect(formatMessage(PLURAL_EN, { count: 2 }, 'en')).toBe('2 scenarios');
    expect(formatMessage(PLURAL_EN, { count: 1234 }, 'en')).toBe(
      '1234 scenarios',
    );
  });

  it('selects German plural branches and formats #', () => {
    expect(formatMessage(PLURAL_DE, { count: 1 }, 'de')).toBe('1 Szenario');
    expect(formatMessage(PLURAL_DE, { count: 2 }, 'de')).toBe('2 Szenarien');
    expect(formatMessage(PLURAL_DE, { count: 1234 }, 'de')).toBe(
      `${intlNumber('de', 1234)} Szenarien`,
    );
  });

  it('supports placeholders inside plural branches', () => {
    expect(
      formatMessage(
        '{count, plural, one {# Datei für {name}} other {# Dateien für {name}}}',
        { count: 2, name: 'Ada' },
        'de',
      ),
    ).toBe('2 Dateien für Ada');
  });

  it('falls back to other when the locale category is missing', () => {
    expect(
      formatMessage('{count, plural, other {# Dinge}}', { count: 1 }, 'de'),
    ).toBe('1 Dinge');
    expect(
      formatMessage('{count, plural, other {# things}}', { count: 1 }, 'en'),
    ).toBe('1 things');
  });

  it('keeps the parse cache invisible across calls and locales', () => {
    const first = formatMessage(PLURAL_EN, { count: 1 }, 'en');
    const second = formatMessage(PLURAL_EN, { count: 2 }, 'en');
    const german = formatMessage(PLURAL_EN, { count: 1234 }, 'de');
    const english = formatMessage(PLURAL_EN, { count: 1234 }, 'en');

    expect(first).toBe('1 scenario');
    expect(second).toBe('2 scenarios');
    expect(german).toBe(`${intlNumber('de', 1234)} scenarios`);
    expect(english).toBe('1234 scenarios');
    expect(formatMessage(PLURAL_DE, { count: 2 }, 'de')).toBe('2 Szenarien');
  });

  it('inserts parameter values literally and does not re-parse them', () => {
    expect(
      formatMessage('Wert: {value}', { value: '<b>{count}</b> & Co.' }, 'de'),
    ).toBe('Wert: <b>{count}</b> & Co.');
  });

  it('rejects malformed messages', () => {
    for (const message of [
      'Hallo {name',
      'Hallo {name}}',
      'Hallo {}',
      'Hallo {name, number}',
      '{count, plural, one {# Datei}}',
    ]) {
      expect(
        () => formatMessage(message, { name: 'Ada', count: 1 }, 'en'),
        message,
      ).toThrow();
    }
  });

  it('rejects select, nested plural, HTML and ASCII double quotes', () => {
    const cases = [
      '{gender, select, other {Es}}',
      '{count, plural, one {{inner, plural, one {a} other {b}}} other {c}}',
      '<b>Hallo</b>',
      '<script>alert(1)</script>',
      '<br/>',
      'Hallo "Welt"',
      'Hallo "Welt',
    ];
    for (const message of cases) {
      expect(
        () => formatMessage(message, { count: 1 }, 'en'),
        message,
      ).toThrow();
    }
  });

  it('rejects a message above the length cap', () => {
    const message = 'x'.repeat(2001);
    expect(() => formatMessage(message, {}, 'en')).toThrow(
      /longer than 2000 characters/,
    );
  });

  it('rejects missing and non-finite plural counts with a clear error', () => {
    const cases: Array<Record<string, string | number>> = [
      {},
      { count: Number.NaN },
      { count: Number.POSITIVE_INFINITY },
    ];
    for (const params of cases) {
      expect(
        () => formatMessage(PLURAL_DE, params, 'de'),
        JSON.stringify(params),
      ).toThrow(/plural parameter "count"/);
    }
    expect(() => formatMessage(PLURAL_DE, { count: 1 }, 'de')).not.toThrow();
  });
});

describe('createTranslator', () => {
  it('defaults to English and exposes locale, lang and dir', () => {
    const translator = createTranslator();
    expect(translator.locale).toBe('en');
    expect(translator.lang).toBe('en');
    expect(translator.dir).toBe('ltr');
    expect(translator.t('report.tab')).toBe('Report');
  });

  it('uses the German catalog and keeps a regional tag', () => {
    const translator = createTranslator('de');
    expect(translator.locale).toBe('de');
    expect(translator.dir).toBe('ltr');
    expect(translator.t('report.tab')).toBe('Bericht');

    expect(createTranslator('de-AT').lang).toBe('de-AT');
    expect(createTranslator('de-AT').t('report.tab')).toBe('Bericht');
  });

  it('formats plurals with the locale', () => {
    const german = createTranslator('de');
    expect(german.t('report.scenarioCount', { count: 1 })).toBe('1 Szenario');
    expect(german.t('report.scenarioCount', { count: 2 })).toBe('2 Szenarien');
    expect(german.t('report.scenarioCount', { count: 1234 })).toBe(
      `${intlNumber('de', 1234)} Szenarien`,
    );
    expect(createTranslator().t('report.scenarioCount', { count: 1 })).toBe(
      '1 scenario',
    );
  });

  it('falls back to English, then to the key, for a partial catalog', () => {
    const partial = createTranslator('de', {
      catalog: { 'report.tab': 'Bericht' },
    });
    // A parameter-free English key keeps the fallback call unambiguous.
    const otherKey = Object.keys(englishCatalog).find(
      (key) =>
        key !== 'report.tab' && !/[{}]/.test(englishCatalog[key as MessageKey]),
    ) as MessageKey | undefined;
    expect(otherKey, 'a second English key').toBeDefined();

    expect(partial.t('report.tab')).toBe('Bericht');
    expect(partial.t(otherKey as MessageKey)).toBe(
      englishCatalog[otherKey as MessageKey],
    );
    const loose = partial.t as unknown as (
      key: string,
      params?: Record<string, string | number>,
    ) => string;
    expect(loose('missing.key')).toBe('missing.key');
    expect(loose('constructor')).toBe('constructor');
    expect(loose('__proto__')).toBe('__proto__');
  });

  it('keeps MessageKey re-exported and aligned with the generated catalogs', () => {
    const key: MessageKey = 'report.tab';
    const generated: GeneratedMessageKey = key;
    expect(generated).toBe('report.tab');
  });

  it('formats numbers, percentages and durations for German', () => {
    const german = createTranslator('de');
    expect(german.number(1234.5)).toBe(intlNumber('de', 1234.5));
    expect(german.number(1234.5)).toBe('1.234,5');

    expect(german.percent(44.4)).toBe(intlPercent('de', 44.4));
    expect(german.percent(44.4)).toContain('\u00a0');
    expect(german.percent(100)).toBe(intlPercent('de', 100));

    expect(german.duration(1500)).toBe('1,50 s');
    expect(german.duration(12.345)).toBe('12,35 ms');
    expect(german.duration(Number.NaN)).toBe('0 ms');
    expect(german.duration(-1)).toBe('0 ms');
  });

  it('keeps the English number, percentage and duration output stable', () => {
    const english = createTranslator();
    expect(english.number(1234.5)).toBe('1234.5');
    expect(english.percent(44.4)).toBe('44.4%');
    expect(english.duration(1500)).toBe('1.50 s');
    expect(english.duration(12.345)).toBe('12.35 ms');
  });

  it('formats German dates from Intl parts in UTC and keeps English stable', () => {
    const iso = '2026-01-05T09:30:00.000Z';
    const german = createTranslator('de');
    expect(german.date(iso)).toBe(intlDate(iso));
    expect(german.date(iso)).toBe('05.01.2026, 09:30 UTC');

    expect(createTranslator().date(iso)).toBe('2026-01-05 09:30 UTC');
    expect(german.date('not-a-date')).toBe('');
    expect(german.date('')).toBe('');
  });

  it('serializes only client messages as escaped JSON', () => {
    const german = createTranslator('de');
    const json = german.clientMessages();
    const map = JSON.parse(json) as Record<string, string>;

    expect(Object.keys(map).length).toBeGreaterThan(0);
    for (const [key, value] of Object.entries(map)) {
      expect(key, key).toMatch(/^client\./);
      expect(value.length, key).toBeGreaterThan(0);
    }
    expect(map).not.toEqual(
      JSON.parse(createTranslator().clientMessages()) as Record<string, string>,
    );
    expect(json).not.toContain('<');
    expect(json).not.toContain('&');
  });

  it('escapes hostile client translations so the block stays inert', () => {
    const translator = createTranslator('de', {
      catalog: {
        'client.hostile': '</script><script>alert("x")</script> & <b>',
        'client.separator': 'Zeile\u2028Ende\u2029Weiter',
      },
    });
    const json = translator.clientMessages();

    expect(json).not.toContain('</script');
    expect(json).not.toContain('&');
    expect(json).not.toContain('\u2028');
    expect(json).not.toContain('\u2029');

    const map = JSON.parse(json) as Record<string, string>;
    expect(map['client.hostile']).toBe(
      '</script><script>alert("x")</script> & <b>',
    );
    expect(map['client.separator']).toBe('Zeile\u2028Ende\u2029Weiter');
  });
});
