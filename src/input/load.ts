import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Envelope } from '@cucumber/messages';
import { parseLegacyJson } from './legacy.js';
import { isEnvelopeLike, parseMessages } from './messages.js';

const SUPPORTED_EXTENSIONS = new Set(['.ndjson', '.json']);

function looksLikeLegacyJson(content: string): boolean {
  return content.replace(/^\uFEFF/, '').trimStart().startsWith('[');
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

function looksLikeReport(content: string): boolean {
  return looksLikeLegacyJson(content) || looksLikeMessages(content);
}

interface InputFile {
  file: string;
  explicit: boolean;
}

export async function loadEnvelopes(inputs: string | string[]): Promise<Envelope[]> {
  const requested = Array.isArray(inputs) ? inputs : [inputs];
  if (requested.length === 0) {
    throw new Error('No input files provided.');
  }

  const files: InputFile[] = [];

  for (const input of requested) {
    const info = await stat(input);

    if (info.isDirectory()) {
      const entries = await readdir(input, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
        files.push({ file: path.join(input, entry.name), explicit: false });
      }
      continue;
    }

    if (!info.isFile()) {
      throw new Error(`Unsupported input: ${input}`);
    }

    files.push({ file: input, explicit: true });
  }

  files.sort((a, b) => a.file.localeCompare(b.file));

  const envelopes: Envelope[] = [];
  for (const [index, input] of files.entries()) {
    const content = await readFile(input.file, 'utf8');

    if (!looksLikeReport(content)) {
      if (input.explicit) {
        throw new Error(`Unsupported input: ${input.file}`);
      }
      continue;
    }

    if (looksLikeLegacyJson(content)) {
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
