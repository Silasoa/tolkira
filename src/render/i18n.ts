import {
  catalogs,
  en as english,
  type MessageKey,
} from '../i18n/catalogs.js';

export type { MessageKey };

export interface ResolvedLocale {
  requested: string;
  lang: string;
  dir: 'ltr' | 'rtl';
  catalog: string;
}

type TextNode = { type: 'text'; value: string };
type ParamNode = { type: 'param'; name: string };
type PluralNode = { type: 'plural'; name: string; branches: Map<string, Node[]> };
type Node = TextNode | ParamNode | PluralNode;

const CATALOGS = catalogs as Record<string, Record<string, string>>;
const ENGLISH = english as Record<string, string>;

const DIRECTIONS: Record<string, 'ltr' | 'rtl'> = {
  en: 'ltr',
  de: 'ltr',
};

export const SUPPORTED_LOCALES: readonly string[] = Object.keys(catalogs);

/** Catalog messages longer than this are a mistake, not a translation. */
export const MAX_MESSAGE_LENGTH = 2000;

const cache = new Map<string, Node[]>();
const pluralRulesCache = new Map<string, Intl.PluralRules>();
const numberFormatCache = new Map<string, Intl.NumberFormat>();

function pluralRules(locale: string): Intl.PluralRules {
  let rules = pluralRulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rules);
  }
  return rules;
}

function numberFormat(locale: string): Intl.NumberFormat {
  let format = numberFormatCache.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale);
    numberFormatCache.set(locale, format);
  }
  return format;
}

// Locale tags can come from argv or an API caller; keep error output on one
// line and free of terminal control sequences.
const ANSI_ESCAPE = new RegExp(
  `${String.fromCodePoint(27)}\\[[0-?]*[ -/]*[@-~]`,
  'g',
);

function cleanTag(tag: string): string {
  let cleaned = '';
  for (const character of tag.replaceAll(ANSI_ESCAPE, '')) {
    const code = character.codePointAt(0) ?? 0;
    if (code >= 0x20 && code !== 0x7f) cleaned += character;
  }
  return cleaned.slice(0, 40) || '(empty)';
}

function supportedError(tag: string): Error {
  return new Error(
    `Unsupported locale "${cleanTag(tag)}". Supported locales: ${SUPPORTED_LOCALES.join(', ')}.`,
  );
}

export function resolveLocale(tag?: string): ResolvedLocale {
  let canonical = 'en';
  if (tag !== undefined) {
    let parsed: string[];
    try {
      parsed = Intl.getCanonicalLocales(tag);
    } catch {
      throw supportedError(tag);
    }
    if (parsed.length !== 1 || !parsed[0]) throw supportedError(tag);
    canonical = parsed[0];
  }
  const lower = canonical.toLowerCase();
  const primary = lower.split('-')[0] ?? lower;
  const exact = SUPPORTED_LOCALES.find(
    (supported) => supported.toLowerCase() === lower,
  );
  const matched =
    exact ??
    SUPPORTED_LOCALES.find((supported) => supported.toLowerCase() === primary);
  if (!matched) throw supportedError(canonical);
  return {
    requested: canonical,
    lang: canonical,
    dir: DIRECTIONS[matched] ?? 'ltr',
    catalog: matched,
  };
}

function invalid(detail: string): never {
  throw new Error(`Invalid message: ${detail}`);
}

function closingBrace(text: string, start: number): number {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function topLevelComma(text: string): number {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '{') depth += 1;
    else if (character === '}') depth -= 1;
    else if (character === ',' && depth === 0) return index;
  }
  return -1;
}

function parseBranches(text: string): Map<string, Node[]> {
  const branches = new Map<string, Node[]>();
  let index = 0;
  while (index < text.length) {
    while (index < text.length && /\s/.test(text[index] ?? '')) index += 1;
    if (index >= text.length) break;
    const match = /^([A-Za-z]+)\s*\{/.exec(text.slice(index));
    if (!match) invalid('malformed plural branch');
    const open = index + match[0].length - 1;
    const close = closingBrace(text, open);
    if (close < 0) invalid('unbalanced plural branch');
    branches.set(
      match[1] ?? '',
      parseNodes(text.slice(open + 1, close), true),
    );
    index = close + 1;
  }
  if (!branches.has('other')) invalid('plural needs an other branch');
  return branches;
}

function parsePlaceholder(inner: string, nested: boolean): Node {
  const comma = topLevelComma(inner);
  const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
  if (!name) invalid('empty placeholder');
  if (!/^[A-Za-z_]\w*$/.test(name)) invalid(`malformed placeholder "${name}"`);
  if (comma < 0) return { type: 'param', name };

  const rest = inner.slice(comma + 1);
  const second = topLevelComma(rest);
  if (second < 0) invalid(`unsupported placeholder type for "${name}"`);
  const type = rest.slice(0, second).trim();
  if (type !== 'plural') {
    invalid(`unsupported placeholder type "${type}"`);
  }
  if (nested) invalid('nested plural is not supported');
  return {
    type: 'plural',
    name,
    branches: parseBranches(rest.slice(second + 1)),
  };
}

function parseNodes(text: string, nested: boolean): Node[] {
  const nodes: Node[] = [];
  let buffer = '';
  const flush = (): void => {
    if (buffer) nodes.push({ type: 'text', value: buffer });
    buffer = '';
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';
    if (character === '}') invalid('stray }');
    if (character !== '{') {
      buffer += character;
      continue;
    }
    flush();
    const end = closingBrace(text, index);
    if (end < 0) invalid('unbalanced {');
    nodes.push(parsePlaceholder(text.slice(index + 1, end), nested));
    index = end;
  }
  flush();
  return nodes;
}

function parse(message: string): Node[] {
  if (message.length > MAX_MESSAGE_LENGTH) {
    invalid(`message is longer than ${MAX_MESSAGE_LENGTH} characters`);
  }
  if (message.includes('<') || message.includes('>')) {
    invalid('HTML is not allowed');
  }
  if (message.includes('"')) invalid('double quotes are not allowed');
  const cached = cache.get(message);
  if (cached) return cached;
  const nodes = parseNodes(message, false);
  cache.set(message, nodes);
  return nodes;
}

function isEnglish(locale: string): boolean {
  return (locale.split('-')[0] ?? locale).toLowerCase() === 'en';
}

function hashValue(value: unknown, locale: string): string {
  const number = Number(value);
  return isEnglish(locale)
    ? String(number)
    : numberFormat(locale).format(number);
}

function paramValue(
  params: Record<string, string | number>,
  name: string,
): string | number | undefined {
  return Object.hasOwn(params, name) ? params[name] : undefined;
}

function pluralValue(
  params: Record<string, string | number>,
  name: string,
): number {
  const value = paramValue(params, name);
  const number = typeof value === 'number' ? value : Number(value);
  if (value === undefined || !Number.isFinite(number)) {
    invalid(`plural parameter "${name}" is missing or not a number`);
  }
  return number;
}

function formatNodes(
  nodes: Node[],
  params: Record<string, string | number>,
  locale: string,
  hash?: string,
): string {
  let output = '';
  for (const node of nodes) {
    if (node.type === 'text') {
      output += hash === undefined ? node.value : node.value.replaceAll('#', hash);
      continue;
    }
    if (node.type === 'param') {
      const value = paramValue(params, node.name);
      if (value === undefined) continue;
      output +=
        typeof value === 'number' ? hashValue(value, locale) : String(value);
      continue;
    }
    const value = pluralValue(params, node.name);
    const category = pluralRules(locale).select(value);
    const branch = node.branches.get(category) ?? node.branches.get('other');
    if (branch) {
      output += formatNodes(branch, params, locale, hashValue(value, locale));
    }
  }
  return output;
}

export function formatMessage(
  message: string,
  params: Record<string, string | number>,
  locale: string,
): string {
  return formatNodes(parse(message), params, locale);
}

export interface TranslatorOptions {
  /** Test seam: replaces the active catalog for the locale. */
  catalog?: Record<string, string>;
}

export interface Translator {
  locale: string;
  lang: string;
  dir: 'ltr' | 'rtl';
  t(key: MessageKey, params?: Record<string, string | number>): string;
  number(value: number): string;
  percent(value: number): string;
  duration(milliseconds: number): string;
  date(iso: string | undefined): string;
  /** Serialized, escaped JSON for the client.* keys only. */
  clientMessages(): string;
}

function escapeJson(json: string): string {
  return json.replaceAll(
    /[<>&\u2028\u2029]/g,
    (character) =>
      `\\u${(character.codePointAt(0) ?? 0).toString(16).padStart(4, '0')}`,
  );
}

export function createTranslator(
  locale?: string,
  options?: TranslatorOptions,
): Translator {
  const resolved = resolveLocale(locale);
  const active = options?.catalog ?? CATALOGS[resolved.catalog] ?? ENGLISH;
  const lang = resolved.lang;
  const englishLocale = isEnglish(lang);

  // One formatter per translator: reports render thousands of values.
  const plainNumber = englishLocale ? null : new Intl.NumberFormat(lang);
  const percentFormat = englishLocale
    ? null
    : new Intl.NumberFormat(lang, {
        style: 'percent',
        maximumFractionDigits: 1,
      });
  const millisecondsFormat = englishLocale
    ? null
    : new Intl.NumberFormat(lang, { maximumFractionDigits: 2 });
  const secondsFormat = englishLocale
    ? null
    : new Intl.NumberFormat(lang, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  const dateFormat = englishLocale
    ? null
    : new Intl.DateTimeFormat(lang, {
        timeZone: 'UTC',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });

  return {
    locale: resolved.requested,
    lang,
    dir: resolved.dir,
    t(key, params = {}) {
      const message = Object.hasOwn(active, key)
        ? (active[key] ?? key)
        : Object.hasOwn(ENGLISH, key)
          ? (ENGLISH[key] ?? key)
          : key;
      return formatMessage(message, params, lang);
    },
    number(value) {
      return plainNumber ? plainNumber.format(value) : String(value);
    },
    percent(value) {
      return percentFormat
        ? percentFormat.format(value / 100)
        : `${value}%`;
    },
    duration(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) return '0 ms';
      if (englishLocale) {
        return milliseconds < 1000
          ? `${Math.round(milliseconds * 100) / 100} ms`
          : `${(milliseconds / 1000).toFixed(2)} s`;
      }
      return milliseconds < 1000
        ? `${millisecondsFormat?.format(milliseconds)} ms`
        : `${secondsFormat?.format(milliseconds / 1000)} s`;
    },
    date(iso) {
      if (!iso) return '';
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';
      if (!dateFormat) {
        return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
      }
      const parts = dateFormat.formatToParts(date);
      const part = (type: string): string =>
        parts.find((entry) => entry.type === type)?.value ?? '';
      return `${part('day')}.${part('month')}.${part('year')}, ${part('hour')}:${part('minute')} UTC`;
    },
    clientMessages() {
      const messages: Record<string, string> = {};
      for (const [key, value] of Object.entries(active)) {
        if (key.startsWith('client.')) messages[key] = value;
      }
      return escapeJson(JSON.stringify(messages));
    },
  };
}
