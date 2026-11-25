import path from 'node:path';
import { looksLikeJUnit } from './junit.js';
import { ENVELOPE_KEYS, isEnvelopeLike } from './messages.js';

const MESSAGES_EXTENSIONS = new Set(['.jsonl', '.ndjson']);
const FIRST_KEY = /^\{\s*"((?:\\.|[^"\\])*)"\s*:/;

export interface InputIdentity {
  file: string;
  explicit: boolean;
}

export type InputDecision =
  | { kind: 'legacy'; parsed: unknown[] }
  | { kind: 'legacy-validation' }
  | { kind: 'junit' }
  | { kind: 'junit-validation' }
  | { kind: 'messages' }
  | { kind: 'messages-validation' }
  | { kind: 'playwright'; parsed: unknown }
  | { kind: 'json-validation' }
  | { kind: 'skip' };

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isFeatureLike(value: unknown): boolean {
  return (
    isObject(value) &&
    (Array.isArray(value.elements) ||
      (typeof value.keyword === 'string' && typeof value.name === 'string'))
  );
}

type LegacySniff =
  | { kind: 'legacy'; parsed: unknown[] }
  | { kind: 'malformed' }
  | undefined;

function sniffLegacy(content: string): LegacySniff {
  const trimmed = content.replace(/^\uFEFF/, '').trimStart();
  if (!trimmed.startsWith('[')) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.every((entry) => isFeatureLike(entry))
      ? { kind: 'legacy', parsed }
      : undefined;
  } catch {
    return { kind: 'malformed' };
  }
}

function looksLikeMessages(content: string): boolean {
  const firstLine = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/, 20)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return false;

  // Only parse a first line that names an envelope key; the Playwright sniffer
  // parses every other one-line document, so a report is read once.
  const rawKey = FIRST_KEY.exec(firstLine)?.[1];
  if (!rawKey) return false;
  const key = rawKey.includes('\\') ? decodeKey(rawKey) : rawKey;
  if (key === undefined || !ENVELOPE_KEYS.has(key)) return false;

  try {
    return isEnvelopeLike(JSON.parse(firstLine));
  } catch {
    return false;
  }
}

function decodeKey(raw: string): string | undefined {
  try {
    const key: unknown = JSON.parse(`"${raw}"`);
    return typeof key === 'string' ? key : undefined;
  } catch {
    return undefined;
  }
}

function sniffPlaywright(content: string): unknown {
  const trimmed = content.replace(/^\uFEFF/, '').trimStart();
  if (!trimmed.startsWith('{')) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return undefined;
  }
  if (!isObject(parsed)) return undefined;
  if (!isObject(parsed.config) || !isObject(parsed.stats)) return undefined;
  return Object.hasOwn(parsed, 'suites') || Array.isArray(parsed.errors)
    ? parsed
    : undefined;
}

/**
 * Pure decision table over content and file identity. It performs no I/O and
 * throws no validation errors; the loader runs the selected adapter.
 */
export function detectInput(
  content: string,
  identity: InputIdentity,
): InputDecision {
  const legacy = sniffLegacy(content);
  if (legacy?.kind === 'legacy') {
    return { kind: 'legacy', parsed: legacy.parsed };
  }
  if (legacy?.kind === 'malformed') return { kind: 'legacy-validation' };
  if (looksLikeJUnit(content)) return { kind: 'junit' };
  if (looksLikeMessages(content)) return { kind: 'messages' };

  const playwright = sniffPlaywright(content);
  if (playwright !== undefined) return { kind: 'playwright', parsed: playwright };

  const extension = path.extname(identity.file).toLowerCase();

  if (identity.explicit) {
    if (extension === '.xml') return { kind: 'junit-validation' };
    if (MESSAGES_EXTENSIONS.has(extension) && content.trim().length === 0) {
      return { kind: 'messages-validation' };
    }
    return { kind: 'json-validation' };
  }

  if (!MESSAGES_EXTENSIONS.has(extension)) return { kind: 'skip' };
  // A scanned shard with no non-empty line is empty, not a report: skip it
  // without a group or warning. An explicitly named empty file still fails.
  if (content.replace(/^\uFEFF/, '').trim().length === 0) {
    return { kind: 'skip' };
  }
  return { kind: 'messages-validation' };
}
