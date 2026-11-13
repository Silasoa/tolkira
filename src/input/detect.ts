import path from 'node:path';
import { looksLikeJUnit } from './junit.js';
import { isEnvelopeLike } from './messages.js';

const MESSAGES_EXTENSIONS = new Set(['.jsonl', '.ndjson']);

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
  | { kind: 'json-validation' }
  | { kind: 'skip' };

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFeatureLike(value: unknown): boolean {
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
    return parsed.every(isFeatureLike)
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

  try {
    return isEnvelopeLike(JSON.parse(firstLine));
  } catch {
    return false;
  }
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

  const extension = path.extname(identity.file).toLowerCase();

  if (identity.explicit) {
    if (extension === '.xml') return { kind: 'junit-validation' };
    if (MESSAGES_EXTENSIONS.has(extension) && content.trim().length === 0) {
      return { kind: 'messages-validation' };
    }
    return { kind: 'json-validation' };
  }

  return MESSAGES_EXTENSIONS.has(extension)
    ? { kind: 'messages-validation' }
    : { kind: 'skip' };
}
