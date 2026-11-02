import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Envelope } from '@cucumber/messages';
import { parseLegacyJson } from './legacy.js';
import { isEnvelopeLike, parseMessages } from './messages.js';

const SUPPORTED_EXTENSIONS = new Set(['.json', '.jsonl', '.ndjson']);
const MAX_INPUT_BYTES = 100 * 1024 * 1024;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFeatureLike(value: unknown): boolean {
  return (
    isObject(value) &&
    (Array.isArray(value.elements) || typeof value.uri === 'string')
  );
}

function parseLegacyCandidate(content: string): unknown[] | undefined {
  const trimmed = content.replace(/^\uFEFF/, '').trimStart();
  if (!trimmed.startsWith('[')) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.every(isFeatureLike) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function looksLikeLegacyJson(content: string): boolean {
  return parseLegacyCandidate(content) !== undefined;
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
  for (const [index, input] of ordered.entries()) {
    const info = await stat(input.file);
    if (info.size > MAX_INPUT_BYTES) {
      throw new Error(
        `Input is larger than 100 MB: ${input.file}. Split the report or use external attachments.`,
      );
    }

    const content = await readFile(input.file, 'utf8');
    const legacy = looksLikeLegacyJson(content);
    const messages = looksLikeMessages(content);

    if (!legacy && !messages) {
      const trimmed = content.replace(/^\uFEFF/, '').trimStart();
      if (input.explicit) {
        if (trimmed.startsWith('[')) {
          try {
            JSON.parse(trimmed);
          } catch {
            // Parse to produce a precise error for malformed legacy JSON.
            parseLegacyJson(content, input.file, { idPrefix: `legacy-${index}` });
          }
        } else {
          try {
            JSON.parse(trimmed);
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`Invalid JSON in ${input.file}: ${detail}`);
          }
        }
        throw new Error(`Unsupported input: ${input.file}`);
      }
      continue;
    }

    if (legacy) {
      envelopes.push(
        ...parseLegacyJson(content, input.file, { idPrefix: `legacy-${index}` }),
      );
    } else {
      envelopes.push(...parseMessages(content, input.file));
    }
  }

  if (envelopes.length === 0) {
    throw new Error('No supported report files found.');
  }

  return envelopes;
}
