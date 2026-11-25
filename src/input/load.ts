import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Envelope } from '@cucumber/messages';
import { compareText } from '../text.js';
import { detectInput } from './detect.js';
import { parseLegacyJson, parseLegacyValue } from './legacy.js';
import { collectReportFiles } from './files.js';
import { parseJUnitXml } from './junit.js';
import { parseMessages } from './messages.js';
import { parsePlaywrightJson } from './playwright.js';

export const MAX_TOTAL_INPUT_BYTES = 100 * 1024 * 1024;
const INPUT_CAP_ERROR =
  'Inputs exceed 100 MB in total. Split the run into smaller inputs or reduce the attachment payload.';

export function addInputBytes(totalBytes: number, size: number): number {
  if (totalBytes + size > MAX_TOTAL_INPUT_BYTES) {
    throw new Error(INPUT_CAP_ERROR);
  }
  return totalBytes + size;
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

export interface ResolvedInputFile {
  file: string;
  explicit: boolean;
}

/** The ordered list produced once by `resolveInputFiles` and shared by callers. */
export interface ResolvedInputs {
  files: ResolvedInputFile[];
}

export type InputSource = string | string[];

async function canonicalPath(file: string): Promise<string> {
  try {
    return await realpath(file);
  } catch {
    return path.resolve(file);
  }
}

/** Resolves explicit files and directory scans once, with duplicate paths removed. */
export async function resolveInputFiles(
  inputs: string | string[],
): Promise<ResolvedInputs> {
  const requested = Array.isArray(inputs) ? inputs : [inputs];
  if (requested.length === 0) {
    throw new Error('No input files provided.');
  }

  const files = new Map<string, ResolvedInputFile>();

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
      for (const file of await collectReportFiles(directory)) {
        await add(file, false);
      }
      continue;
    }

    if (!info.isFile()) {
      throw new Error(`Unsupported input: ${input}`);
    }

    await add(input, true);
  }

  return {
    files: [...files.values()].sort((a, b) => compareText(a.file, b.file)),
  };
}

/** Sums resolved file sizes without reading any content. */
export async function scanInputBytes(
  files: ResolvedInputFile[],
): Promise<{ bytes: number }> {
  let bytes = 0;
  for (const input of files) {
    bytes += (await stat(input.file)).size;
  }
  return { bytes };
}

function collectGherkinIds(value: unknown): string[] {
  const ids: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (key === 'id' && typeof child === 'string') ids.push(child);
      else visit(child);
    }
  };
  visit(value);
  return ids;
}

export interface LoadedInput {
  file: string;
  /** Size of this input file in bytes. */
  bytes: number;
  envelopes: Envelope[];
  skippedAttachments: number;
}

export async function loadInputs(inputs: InputSource): Promise<LoadedInput[]> {
  return loadResolvedInputs(await resolveInputFiles(inputs));
}

/** Loads a list the caller already resolved, without resolving it again. */
export async function loadResolvedInputs(
  resolved: ResolvedInputs,
): Promise<LoadedInput[]> {
  const ordered = resolved.files;

  const groups: LoadedInput[] = [];
  const seenContent = new Set<string>();
  let totalBytes = 0;

  for (const [index, input] of ordered.entries()) {
    const info = await stat(input.file);
    // Re-check after stat so a path swapped since resolution cannot be read.
    if (!info.isFile()) {
      throw new Error(`Unsupported input: ${input.file}`);
    }
    // Per-file DoS guard before the read; the total cap applies later to
    // unique loaded content only.
    if (info.size > MAX_TOTAL_INPUT_BYTES) {
      throw new Error(INPUT_CAP_ERROR);
    }
    const content = await readFile(input.file, 'utf8');
    const hash = createHash('sha256').update(content).digest('hex');
    if (seenContent.has(hash)) {
      // A scanned copy may already have seen the content. An explicitly named
      // duplicate still takes its explicit validation-only branch, so an empty
      // or malformed file cannot hide behind a skipped or valid copy.
      if (input.explicit) {
        switch (detectInput(content, input).kind) {
          case 'messages-validation':
            parseMessages(content, input.file);
            break;
          case 'junit':
          case 'junit-validation':
            await parseJUnitXml(content, input.file, {
              idPrefix: `junit-${index}`,
            });
            break;
          case 'legacy-validation':
            parseLegacyJson(content, input.file, {
              idPrefix: `legacy-${index}`,
            });
            break;
          case 'json-validation':
            invalidJson(content, input.file);
        }
      }
      continue;
    }
    seenContent.add(hash);

    const decision = detectInput(content, input);
    // A skip creates no group, so a skipped or empty-shard file counts in
    // neither inputFiles nor the total cap.
    if (decision.kind === 'skip') continue;
    totalBytes = addInputBytes(totalBytes, info.size);
    let parsed: Envelope[] = [];
    let skippedAttachments = 0;

    switch (decision.kind) {
      case 'legacy':
        parsed = parseLegacyValue(decision.parsed, input.file, {
          idPrefix: `legacy-${index}`,
        });
        break;
      case 'legacy-validation':
        // Validation-only: throws on malformed JSON; there is no result to add.
        parseLegacyJson(content, input.file, { idPrefix: `legacy-${index}` });
        break;
      case 'junit':
        parsed = await parseJUnitXml(content, input.file, {
          idPrefix: `junit-${index}`,
          allowEmptyDocument: !input.explicit,
        });
        break;
      case 'junit-validation':
        // Validation-only: throws when the explicit XML is not usable JUnit.
        await parseJUnitXml(content, input.file, {
          idPrefix: `junit-${index}`,
        });
        break;
      case 'messages':
        parsed = parseMessages(content, input.file);
        break;
      case 'messages-validation':
        // Validation-only fallback; valid Messages are handled above.
        parseMessages(content, input.file);
        break;
      case 'playwright':
        ({
          envelopes: parsed,
          skippedAttachments,
        } = await parsePlaywrightJson(decision.parsed, input.file, {
          idPrefix: `playwright-${index}`,
          // One earlier image only fits a single-input report's byte budget.
          allowRetryImages: ordered.length === 1,
        }));
        break;
      case 'json-validation':
        invalidJson(content, input.file);
    }

    groups.push({
      file: input.file,
      bytes: info.size,
      envelopes: parsed,
      skippedAttachments,
    });
  }

  if (groups.every((group) => group.envelopes.length === 0)) {
    throw new Error('No supported report files found.');
  }

  const seenIds = new Map<string, string>();
  for (const group of groups) {
    const file = path.basename(group.file);
    for (const envelope of group.envelopes) {
      const ids: Array<[string, string | undefined]> = [
        ['pickle', envelope.pickle?.id],
        ['testCase', envelope.testCase?.id],
        ['testCaseStarted', envelope.testCaseStarted?.id],
        ['hook', envelope.hook?.id],
      ];
      for (const step of envelope.testCase?.testSteps ?? []) {
        ids.push(['testStep', step.id]);
      }
      for (const id of collectGherkinIds(envelope.gherkinDocument)) {
        ids.push(['gherkin', id]);
      }
      for (const [kind, id] of ids) {
        if (!id) continue;
        const key = `${kind}:${id}`;
        const previous = seenIds.get(key);
        if (previous) {
          throw new Error(
            `Duplicate Cucumber Messages ${kind} id in ${previous} and ${file}. Merge the streams before splitting or use unique ids.`,
          );
        }
        seenIds.set(key, file);
      }
    }
  }

  return groups;
}

// Test seam: adapters and model tests load one flat envelope list. Production
// paths use loadResolvedInputs (or loadInputs) so provenance survives.
export async function loadEnvelopes(
  inputs: InputSource,
): Promise<Envelope[]> {
  return (await loadInputs(inputs)).flatMap((group) => group.envelopes);
}

/**
 * Maps a feature URI to its input file name, but only when the URI belongs to
 * exactly one file. Shared or missing provenance is omitted so the report can
 * render a flat list instead of an invented group.
 */
export function provenanceFor(groups: LoadedInput[]): Map<string, string> {
  const names = new Map<string, Set<string>>();
  for (const group of groups) {
    if (
      !group.envelopes.some(
        (envelope) => envelope.gherkinDocument || envelope.pickle,
      )
    ) {
      continue;
    }
    const name = path.basename(group.file);
    const set = names.get(name) ?? new Set<string>();
    set.add(group.file);
    names.set(name, set);
  }
  const ambiguous = new Set(
    [...names.entries()]
      .filter(([, files]) => files.size > 1)
      .map(([name]) => name),
  );

  const uriFiles = new Map<string, Set<string>>();
  for (const group of groups) {
    const name = path.basename(group.file);
    if (ambiguous.has(name)) continue;
    for (const envelope of group.envelopes) {
      for (const uri of [envelope.gherkinDocument?.uri, envelope.pickle?.uri]) {
        if (!uri) continue;
        const set = uriFiles.get(uri) ?? new Set<string>();
        set.add(name);
        uriFiles.set(uri, set);
      }
    }
  }

  const provenance = new Map<string, string>();
  for (const [uri, files] of uriFiles) {
    if (files.size === 1) provenance.set(uri, [...files][0] as string);
  }
  return provenance;
}
