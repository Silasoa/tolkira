import { constants } from 'node:fs';
import { open, stat, type FileHandle } from 'node:fs/promises';
import {
  displayUri,
  type SummaryScenarioIdentity,
  type SummaryStatus,
} from './summary.js';
import { compareText, oneLine } from './text.js';

/** A baseline summary is one JSON document; the input cap does not apply. */
export const BASELINE_MAX_BYTES = 10_485_760;
const MAX_DEPTH = 64;
const NOT_IN_THIS_RUN_LIMIT = 50;

const STATUSES: ReadonlySet<string> = new Set([
  'passed',
  'failed',
  'skipped',
  'pending',
  'undefined',
  'ambiguous',
  'unknown',
]);
const FAILING = new Set<SummaryStatus>(['failed', 'undefined', 'ambiguous']);
const PROTO_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

export type BaselineChange =
  'new-failure' | 'fixed' | 'still-failing' | 'added';

/** One validated baseline row; only identity, status and execution are trusted. */
export interface BaselineScenario {
  feature: string;
  name: string;
  uri: string;
  status: SummaryStatus;
  executed: boolean;
  example?: string;
}

/** The read-only projection the CLI reads and the API accepts. */
export interface BaselineSummary {
  schemaVersion: 2;
  status: SummaryStatus;
  scenarios: BaselineScenario[];
}

export interface BaselineCounts {
  newFailures: number;
  fixed: number;
  stillFailing: number;
  other: number;
  notInThisRun: number;
  added: number;
  ambiguous: number;
}

export interface BaselineBlock {
  status: SummaryStatus;
  counts: BaselineCounts;
  notInThisRun: BaselineScenario[];
}

export interface BaselineComparison {
  block: BaselineBlock;
  /** Classified current rows keyed by the report model's pickle id. */
  changes: Map<string, BaselineChange>;
}

class BaselineValidationError extends Error {}

function fail(file: string, reason: string): never {
  throw new BaselineValidationError(
    `Invalid baseline ${oneLine(file)}: ${reason}`,
  );
}

function readError(file: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`Cannot read baseline ${oneLine(file)}: ${oneLine(detail)}`);
}

function excerpt(value: unknown): string {
  let text: string;
  try {
    text =
      typeof value === 'string'
        ? value
        : typeof value === 'number'
          ? String(value)
          : (JSON.stringify(value) ?? String(value));
  } catch {
    text = String(value);
  }
  const flat = oneLine(text);
  return JSON.stringify(flat.length > 40 ? `${flat.slice(0, 40)}…` : flat);
}

async function readBounded(handle: FileHandle, size: number): Promise<Buffer> {
  const buffer = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const { bytesRead } = await handle.read(
      buffer,
      offset,
      size - offset,
      offset,
    );
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return buffer.subarray(0, offset);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSummaryStatus(value: string): value is SummaryStatus {
  return STATUSES.has(value);
}

function decodeText(file: string, bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return fail(file, 'not valid UTF-8');
  }
}

async function readText(file: string): Promise<string> {
  let size: number;
  try {
    const info = await stat(file);
    if (!info.isFile()) fail(file, 'not a regular file');
    if (info.size > BASELINE_MAX_BYTES) {
      fail(file, `file is larger than ${BASELINE_MAX_BYTES} bytes (10 MiB)`);
    }
    size = info.size;
  } catch (error) {
    if (error instanceof BaselineValidationError) throw error;
    throw readError(file, error);
  }

  let handle: FileHandle;
  try {
    // O_NONBLOCK is undefined on Windows; the regular-file checks do the work.
    handle = await open(file, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch (error) {
    throw readError(file, error);
  }
  try {
    // The pre-open stat guards a directory or device; this one closes TOCTOU.
    const info = await handle.stat().catch((error: unknown) => {
      throw readError(file, error);
    });
    if (!info.isFile()) fail(file, 'not a regular file');
    if (info.size > BASELINE_MAX_BYTES) {
      fail(file, `file is larger than ${BASELINE_MAX_BYTES} bytes (10 MiB)`);
    }
    const bytes = await readBounded(handle, size).catch((error: unknown) => {
      throw readError(file, error);
    });
    return decodeText(file, bytes);
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function assertDepth(value: unknown, depth: number, file: string): void {
  if (depth > MAX_DEPTH) {
    fail(file, `value is nested deeper than ${MAX_DEPTH} levels`);
  }
  if (Array.isArray(value)) {
    for (const item of value) assertDepth(item, depth + 1, file);
  } else if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) assertDepth(item, depth + 1, file);
  }
}

function stringField(
  row: Record<string, unknown>,
  field: string,
  index: number,
  file: string,
): string {
  const value = row[field];
  if (typeof value !== 'string') {
    fail(file, `scenarios[${index}].${field} must be a string`);
  }
  return value;
}

function parseScenario(
  entry: unknown,
  index: number,
  file: string,
): BaselineScenario {
  if (!isRecord(entry) || Array.isArray(entry)) {
    fail(file, `scenarios[${index}] must be an object`);
  }
  const row = entry;
  for (const key of PROTO_KEYS) {
    if (Object.hasOwn(row, key)) {
      fail(file, `scenarios[${index}] has the unsupported key ${key}`);
    }
  }
  const feature = stringField(row, 'feature', index, file);
  const name = stringField(row, 'name', index, file);
  const uri = stringField(row, 'uri', index, file);
  if (typeof row.status !== 'string' || !isSummaryStatus(row.status)) {
    fail(
      file,
      `scenarios[${index}].status is not a documented scenario status`,
    );
  }
  if (typeof row.executed !== 'boolean') {
    fail(file, `scenarios[${index}].executed must be a boolean`);
  }
  if (row.example !== undefined && typeof row.example !== 'string') {
    fail(file, `scenarios[${index}].example must be a string`);
  }
  return {
    feature,
    name,
    uri: displayUri(uri),
    status: row.status,
    executed: row.executed,
    ...(row.example === undefined ? {} : { example: row.example }),
  };
}

/**
 * Reads and validates a schema-2 summary. The file is opened read-only, checked
 * before and after opening, capped before any content is read and never
 * rewritten.
 */
export async function readBaseline(file: string): Promise<BaselineSummary> {
  let text = await readText(file);
  if (text.codePointAt(0) === 0xfeff) text = text.slice(1);

  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    if (error instanceof RangeError) {
      fail(file, 'value is nested too deeply to parse');
    }
    fail(file, 'not valid JSON');
  }
  if (!isRecord(document) || Array.isArray(document)) {
    fail(file, 'expected a JSON object');
  }
  const data = document;
  for (const key of PROTO_KEYS) {
    if (Object.hasOwn(data, key)) {
      fail(file, `unsupported key ${key}`);
    }
  }
  if (Array.isArray(data.runs) && !Array.isArray(data.scenarios)) {
    fail(file, 'is a history sidecar; expected a schema-2 report summary');
  }
  if (data.schemaVersion !== 2) {
    fail(
      file,
      `unsupported schema version ${excerpt(data.schemaVersion)}; expected 2`,
    );
  }
  if (typeof data.status !== 'string' || !isSummaryStatus(data.status)) {
    fail(file, 'status is not a documented scenario status');
  }
  if (!Array.isArray(data.scenarios)) {
    fail(file, 'scenarios must be an array');
  }
  assertDepth(document, 0, file);

  const scenarios = data.scenarios.map((entry, index) =>
    parseScenario(entry, index, file),
  );
  return {
    schemaVersion: 2,
    status: data.status,
    scenarios,
  };
}

interface Pair {
  base: BaselineScenario;
  current: SummaryScenarioIdentity;
}

interface Pairing {
  pairs: Pair[];
  unmatchedBase: BaselineScenario[];
  unmatchedCurrent: SummaryScenarioIdentity[];
}

function groupKey(feature: string, name: string): string {
  return JSON.stringify([feature, name]);
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}

function normalizeBaselineRow(row: BaselineScenario): BaselineScenario {
  return {
    feature: row.feature,
    name: row.name,
    uri: displayUri(row.uri),
    status: row.status,
    executed: row.executed,
    ...(row.example === undefined ? {} : { example: row.example }),
  };
}

function exampleParts(value: string | undefined): [number, number] | undefined {
  if (value === undefined) return undefined;
  const match = /^#(\d+)\.(\d+)$/.exec(value);
  return match ? [Number(match[1]), Number(match[2])] : undefined;
}

function compareExamples(
  left: string | undefined,
  right: string | undefined,
): number {
  const a = exampleParts(left);
  const b = exampleParts(right);
  if (a && b) return a[0] - b[0] || a[1] - b[1];
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function compareBaselineRows(a: BaselineScenario, b: BaselineScenario): number {
  return (
    compareText(a.feature, b.feature) ||
    compareText(a.name, b.name) ||
    compareExamples(a.example, b.example) ||
    compareText(a.uri, b.uri)
  );
}

/**
 * Pairs only keys that occur exactly once on each side. A duplicate or missing
 * key leaves both rows unmatched for the next pass. O(base + current).
 */
function pairByKey(
  baseRows: BaselineScenario[],
  currentRows: SummaryScenarioIdentity[],
  key: (row: { uri: string; example?: string }) => string | undefined,
): Pairing {
  const baseCounts = new Map<string, number>();
  for (const row of baseRows) {
    const id = key(row);
    if (id !== undefined) baseCounts.set(id, (baseCounts.get(id) ?? 0) + 1);
  }
  const currentCounts = new Map<string, number>();
  const currentIndex = new Map<string, number>();
  currentRows.forEach((row, index) => {
    const id = key(row);
    if (id === undefined) return;
    currentCounts.set(id, (currentCounts.get(id) ?? 0) + 1);
    currentIndex.set(id, index);
  });

  const pairs: Pair[] = [];
  const matched = new Set<number>();
  const unmatchedBase: BaselineScenario[] = [];
  for (const base of baseRows) {
    const id = key(base);
    if (
      id === undefined ||
      baseCounts.get(id) !== 1 ||
      currentCounts.get(id) !== 1
    ) {
      unmatchedBase.push(base);
      continue;
    }
    const index = currentIndex.get(id);
    const current = index === undefined ? undefined : currentRows[index];
    if (index === undefined || current === undefined || matched.has(index)) {
      unmatchedBase.push(base);
      continue;
    }
    pairs.push({ base, current });
    matched.add(index);
  }
  const unmatchedCurrent = currentRows.filter(
    (_, index) => !matched.has(index),
  );
  return { pairs, unmatchedBase, unmatchedCurrent };
}

/**
 * Two passes: the example coordinate when every row on both sides carries it,
 * then display URI for the genuinely unmatched remainder. Any row left over
 * makes the whole group ambiguous.
 */
function pairRepeated(
  baseRows: BaselineScenario[],
  currentRows: SummaryScenarioIdentity[],
): Pair[] | undefined {
  const coordinates =
    baseRows.every((row) => row.example !== undefined) &&
    currentRows.every((row) => row.example !== undefined);
  const first = coordinates
    ? pairByKey(baseRows, currentRows, (row) => row.example)
    : {
        pairs: [] as Pair[],
        unmatchedBase: baseRows,
        unmatchedCurrent: currentRows,
      };
  const second = pairByKey(first.unmatchedBase, first.unmatchedCurrent, (row) =>
    displayUri(row.uri),
  );
  if (second.unmatchedBase.length > 0 || second.unmatchedCurrent.length > 0) {
    return undefined;
  }
  return [...first.pairs, ...second.pairs];
}

function classifyPair(
  base: BaselineScenario,
  current: SummaryScenarioIdentity,
  counts: BaselineCounts,
  changes: Map<string, BaselineChange>,
): void {
  if (!current.executed) {
    counts.other += 1;
    return;
  }
  const currentFails = FAILING.has(current.status);
  const baseFails = base.executed && FAILING.has(base.status);
  if (currentFails) {
    if (baseFails) {
      counts.stillFailing += 1;
      changes.set(current.id, 'still-failing');
    } else {
      counts.newFailures += 1;
      changes.set(current.id, 'new-failure');
    }
    return;
  }
  if (current.status === 'passed' && baseFails) {
    counts.fixed += 1;
    changes.set(current.id, 'fixed');
    return;
  }
  counts.other += 1;
}

function classifyUnmatched(
  current: SummaryScenarioIdentity,
  counts: BaselineCounts,
  changes: Map<string, BaselineChange>,
): void {
  if (!current.executed) return;
  if (FAILING.has(current.status)) {
    counts.newFailures += 1;
    changes.set(current.id, 'new-failure');
  } else {
    counts.added += 1;
    changes.set(current.id, 'added');
  }
}

/**
 * Compares the current run with a validated baseline once. A repeated base key
 * that cannot be reduced to unique pairs is ambiguous and makes no claim.
 */
export function compareBaseline(
  baseline: BaselineSummary,
  current: SummaryScenarioIdentity[],
): BaselineComparison {
  const counts: BaselineCounts = {
    newFailures: 0,
    fixed: 0,
    stillFailing: 0,
    other: 0,
    notInThisRun: 0,
    added: 0,
    ambiguous: 0,
  };
  const changes = new Map<string, BaselineChange>();
  const notInThisRun: BaselineScenario[] = [];
  const baseScenarios = baseline.scenarios.map(normalizeBaselineRow);
  const baseGroups = groupBy(baseScenarios, (row) =>
    groupKey(row.feature, row.name),
  );
  const currentGroups = groupBy(current, (row) =>
    groupKey(row.feature, row.name),
  );
  const keys = new Set([...baseGroups.keys(), ...currentGroups.keys()]);

  for (const key of keys) {
    const baseRows = baseGroups.get(key) ?? [];
    const currentRows = currentGroups.get(key) ?? [];
    if (baseRows.length === 0) {
      for (const row of currentRows) classifyUnmatched(row, counts, changes);
      continue;
    }
    if (currentRows.length === 0) {
      for (const row of baseRows) notInThisRun.push(row);
      counts.notInThisRun += baseRows.length;
      continue;
    }
    if (baseRows.length === 1 && currentRows.length === 1) {
      const base = baseRows[0];
      const currentRow = currentRows[0];
      if (base && currentRow) classifyPair(base, currentRow, counts, changes);
      continue;
    }
    const pairs = pairRepeated(baseRows, currentRows);
    if (!pairs) {
      counts.ambiguous += 1;
      continue;
    }
    for (const pair of pairs) {
      classifyPair(pair.base, pair.current, counts, changes);
    }
  }

  notInThisRun.sort(compareBaselineRows);
  return {
    block: {
      status: baseline.status,
      counts,
      notInThisRun: notInThisRun.slice(0, NOT_IN_THIS_RUN_LIMIT),
    },
    changes,
  };
}
