import { describe, expect, it } from 'vitest';
import { createClientFormatter } from '../src/render/client-i18n.js';

function intlNumber(locale: string, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

const VISIBLE =
  '{visible} of {total, plural, one {# scenario} other {# scenarios}} visible';
const VISIBLE_DE =
  '{visible} von {total, plural, one {# Szenario} other {# Szenarien}} sichtbar';

describe('client message formatting', () => {
  it('keeps English counts raw', () => {
    const english = createClientFormatter('en');
    expect(english.number(1234)).toBe('1234');
    expect(english.format(VISIBLE, { visible: 1234, total: 1234 })).toBe(
      '1234 of 1234 scenarios visible',
    );
    expect(english.format(VISIBLE, { visible: 1, total: 1 })).toBe(
      '1 of 1 scenario visible',
    );
  });

  it('formats German counts and params with the locale', () => {
    const german = createClientFormatter('de');
    expect(german.number(1234)).toBe(intlNumber('de', 1234));
    expect(german.format(VISIBLE_DE, { visible: 1234, total: 1234 })).toBe(
      `${intlNumber('de', 1234)} von ${intlNumber('de', 1234)} Szenarien sichtbar`,
    );
    expect(german.format(VISIBLE_DE, { visible: 1, total: 1 })).toBe(
      '1 von 1 Szenario sichtbar',
    );
    expect(german.format('{count} Treffer', { count: 1234 })).toBe(
      `${intlNumber('de', 1234)} Treffer`,
    );
  });

  it('selects every plural category without an order lock', () => {
    const polish = createClientFormatter('pl');
    const message =
      '{count, plural, many {# plików} other {# pliku} one {# plik} few {# pliki}}';
    expect(polish.format(message, { count: 1 })).toBe('1 plik');
    expect(polish.format(message, { count: 2 })).toBe('2 pliki');
    expect(polish.format(message, { count: 5 })).toBe('5 plików');
    expect(polish.format(message, { count: 1.5 })).toBe('1,5 pliku');
  });

  it('falls back to other and coerces missing or invalid counts to 0', () => {
    const german = createClientFormatter('de');
    const message = '{count, plural, other {# Dinge}}';
    expect(german.format(message, { count: 1 })).toBe('1 Dinge');
    expect(german.format(message, {})).toBe('0 Dinge');
    expect(german.format(message, { count: Number.NaN })).toBe('0 Dinge');
  });
});
