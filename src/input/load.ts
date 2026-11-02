import { createHash } from 'node:crypto';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Envelope } from '@cucumber/messages';
import { parseLegacyJson, parseLegacyValue } from './legacy.js';
import { isEnvelopeLike, parseMessages } from './messages.js';

const SUPPORTED_EXTENSIONS = new Set(['.json', '.jsonl', '.ndjson']);
const MESSAGES_EXTENSIONS = new Set(['.jsonl', '.ndjson']);
const MAX_TOTAL_INPUT_BYTES = 100 * 1024 * 1024;

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
    .split(/\r?\n/)
    .map((line) => line.replace(/^\uFEFF/, '').trim())
    .find(Boolean);
  if (!firstLine) return false;

  try {
    return isEnvelopeLike(JSON.parse(firstLine));
  } catch {
    return false;
  }
}

function invalidJson(content: string, file: string): never {
  try {
    JSON.parse(content.replace(/^\uFEFF/, '').trimStart());
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${file}: ${detail}`);
  }
  throw new Error(`Unsupported input: ${file}`);
}

interface InputFile {
  file: string;
  explicit: boolean;
}

async function canonicalPath(file: string): Promise<string> {
  try {
    return await realpath(file);
  } catch {
    return path.resolve(file);
  }
}

export async function loadEnvelopes(inputs: string | string[]): Promise<Envelope[]> {
  const requested = Array.isArray(inputs) ? inputs : [inputs];
  if (requested.length === 0) {
    throw new Error('No input files provided.');
  }

  const files = new Map<string, InputFile>();

  const add = async (file: string, explicit: boolean): Promise<void> => {
    const resolved = await canonicalPath(file);
    const existing = files.get(resolved);
    files.set(resolved, {
      file: resolved,
      explicit: explicit || existing?.explicit === true,
    });
  };

  for (const input of requested) {
    const info = await stat(input);

    if (info.isDirectory()) {
      const directory = await canonicalPath(input);
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          continue;
        }
        await add(path.join(directory, entry.name), false);
      }
      continue;
    }

    if (!info.isFile()) {
      throw new Error(`Unsupported input: ${input}`);
    }

    await add(input, true);
  }

  const ordered = [...files.values()].sort((a, b) =>
    a.file.localeCompare(b.file),
  );

  const envelopes: Envelope[] = [];
  const seenContent = new Set<string>();
  let totalBytes = 0;

  for (const [index, input] of ordered.entries()) {
    const info = await stat(input.file);
    if (totalBytes + info.size > MAX_TOTAL_INPUT_BYTES) {
      throw new Error(
        'Inputs exceed 100 MB in total. Split the report or use external attachments.',
      );
    }
    const content = await readFile(input.file, 'utf8');
    const hash = createHash('sha256').update(content).digest('hex');
    if (seenContent.has(hash)) continue;
    seenContent.add(hash);

    totalBytes += info.size;

    const extension = path.extname(input.file).toLowerCase();
    const legacy = sniffLegacy(content);

    if (legacy?.kind === 'legacy') {
      envelopes.push(
        ...parseLegacyValue(legacy.parsed, input.file, {
          idPrefix: `legacy-${index}`,
        }),
      );
      continue;
    }

    if (legacy?.kind === 'malformed') {
      parseLegacyJson(content, input.file, { idPrefix: `legacy-${index}` });
      continue;
    }

    if (looksLikeMessages(content)) {
      envelopes.push(...parseMessages(content, input.file));
      continue;
    }

    if (input.explicit) {
      invalidJson(content, input.file);
    }

    if (MESSAGES_EXTENSIONS.has(extension)) {
      parseMessages(content, input.file);
    }
  }

  if (envelopes.length === 0) {
    throw new Error('No supported report files found.');
  }

  return envelopes;
}
