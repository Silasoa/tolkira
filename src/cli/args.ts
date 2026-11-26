import { parseArgs } from 'node:util';
import type { CiFormat } from '../ci.js';
import { HISTORY_LIMIT_MAX } from '../history.js';
import { oneLine } from '../text.js';
import { ACCENT_PATTERN } from '../validation.js';
import { DEFAULT_MAX_SIZE_MB } from '../warnings.js';

export function parseCliArgs(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      static: { type: 'boolean' },
      pdf: { type: 'string' },
      'pdf-timeout': { type: 'string' },
      email: { type: 'string' },
      title: { type: 'string' },
      locale: { type: 'string' },
      meta: { type: 'string', multiple: true },
      logo: { type: 'string' },
      accent: { type: 'string' },
      'max-size': { type: 'string' },
      json: { type: 'boolean' },
      ci: { type: 'string' },
      'ci-out': { type: 'string' },
      history: { type: 'string' },
      'history-limit': { type: 'string' },
      baseline: { type: 'string' },
      manifest: { type: 'string' },
      capabilities: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  } as const);
}

export function parseMetadata(
  values: string[] | undefined,
): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const entry of values ?? []) {
    const separator = entry.indexOf('=');
    if (separator <= 0) {
      throw new Error(`Invalid metadata entry "${entry}". Use key=value.`);
    }
    metadata[entry.slice(0, separator)] = entry.slice(separator + 1);
  }
  return metadata;
}

export function parseMaxSize(value: string | undefined): number {
  if (value === undefined) return DEFAULT_MAX_SIZE_MB;
  const megabytes = Number(value);
  if (!Number.isFinite(megabytes) || megabytes <= 0) {
    throw new Error(
      `Invalid --max-size "${value}". Use a positive number of MB.`,
    );
  }
  return megabytes;
}

export function parsePdfTimeout(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  // Leading zeros, signs, fractions and exponents are usage errors, not aliases.
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 2_147_483_647) {
    throw new Error(
      `Invalid --pdf-timeout "${value}". Use a positive integer of milliseconds.`,
    );
  }
  return Number(value);
}

export function parseHistoryLimit(
  value: string | undefined,
): number | undefined {
  if (value === undefined) return undefined;
  // Leading zeros, signs, fractions and whitespace are usage errors, not aliases.
  if (!/^[1-9]\d*$/.test(value) || Number(value) > HISTORY_LIMIT_MAX) {
    throw new Error(
      `Invalid --history-limit "${oneLine(value)}". Use an integer from 1 to ${HISTORY_LIMIT_MAX}.`,
    );
  }
  return Number(value);
}

export function parseCiFormat(value: string | undefined): CiFormat | undefined {
  if (value === undefined) return undefined;
  if (value === 'github' || value === 'azure' || value === 'markdown') {
    return value;
  }
  throw new Error(`Invalid --ci "${value}". Use github, azure or markdown.`);
}

export function parseAccent(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!ACCENT_PATTERN.test(value)) {
    throw new Error(
      `Invalid --accent "${value}". Use a hex colour such as #1b5e20.`,
    );
  }
  return value;
}
