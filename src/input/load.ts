import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Envelope } from '@cucumber/messages';
import { parseLegacyJson } from './legacy.js';
import { parseMessages } from './messages.js';

const SUPPORTED_EXTENSIONS = new Set(['.ndjson', '.json']);

export async function loadEnvelopes(inputs: string | string[]): Promise<Envelope[]> {
  const requested = Array.isArray(inputs) ? inputs : [inputs];
  if (requested.length === 0) {
    throw new Error('No input files provided.');
  }

  const files: string[] = [];

  for (const input of requested) {
    const info = await stat(input);

    if (info.isDirectory()) {
      const entries = await readdir(input, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
        files.push(path.join(input, entry.name));
      }
      continue;
    }

    if (!info.isFile()) {
      throw new Error(`Unsupported input: ${input}`);
    }

    if (!SUPPORTED_EXTENSIONS.has(path.extname(input).toLowerCase())) {
      throw new Error(`Unsupported input: ${input}`);
    }

    files.push(input);
  }

  files.sort();

  const envelopes: Envelope[] = [];
  for (const [index, file] of files.entries()) {
    const content = await readFile(file, 'utf8');
    if (path.extname(file).toLowerCase() === '.json') {
      envelopes.push(
        ...parseLegacyJson(content, file, { idPrefix: `legacy-${index}` }),
      );
    } else {
      envelopes.push(...parseMessages(content, file));
    }
  }

  return envelopes;
}
