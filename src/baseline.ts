import { constants } from 'node:fs';
import { open, type FileHandle } from 'node:fs/promises';
import { displayUri, type SummaryScenarioIdentity, type SummaryStatus } from './summary.js';

/** A baseline summary is one JSON document; the input cap does not apply. */
export const BASELINE_MAX_BYTES = 10_485_760;
const MAX_DEPTH = 64;
const NOT_IN_THIS_RUN_LIMIT = 50;

const STATUSES = new Set<SummaryStatus>([
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

export type BaselineChange = 'new-failure' | 'fixed' | 'still-failing' | 'added';

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

function oneLine(value: string): string {
  // oxlint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ');
}

function fail(file: string, reason: string): never {
  throw new BaselineValidationError(
    `Invalid baseline ${oneLine(file)}: ${reason}`,
  );
}

function readError(file: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`Cannot read baseline ${oneLine(file)}: ${detail}`);
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

async function readBounded(handle: FileHandle, size: number): Promise<string> {
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
  return buffer.toString('utf8', 0, offset);
}

async function readText(file: string): Promise<string> {
  let handle: FileHandle;
  try {
    // O_NONBLOCK is undefined on Windows; the fstat regular-file guard does the work.
    handle = await open(file, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch (error) {
    throw readError(file, error);
  }
  try {
    const info = await handle.stat();
    if (!info.isFile()) fail(file, 'not a regular file');
    if (info.size > BASELINE_MAX_BYTES) {
      fail(
        file,
        `file is larger than ${BASELINE_MAX_BYTES} bytes (10 MiB)`,
      );
    }
    return await readBounded(handle, info.size);
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function assertDepth(value: unknown, file: string): void {
  const stack: Array<[unknown, number]> = [[value, 0]];
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) break;
    const [current, depth] = entry;
    if (depth > MAX_DEPTH) {
      fail(file, `value is nested deeper than ${MAX_DEPTH} levels`);
    }
    if (Array.isArray(current)) {
      for (const item of current) stack.push([item, depth + 1]);
    } else if (typeof current === 'object' && current !== null) {
      for (const item of Object.values(current)) stack.push([item, depth + 1]);
    }
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
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    fail(file, `scenarios[${index}] must be an object`);
  }
  const row = entry as Record<string, unknown>;
  for (const key of PROTO_KEYS) {
    if (Object.hasOwn(row, key)) {
      fail(file, `scenarios[${index}] has the unsupported key ${key}`);
    }
  }
  const feature = stringField(row, 'feature', index, file);
  const name = stringField(row, 'name', index, file);
  const uri = stringField(row, 'uri', index, file);
  if (typeof row.status !== 'string' || !STATUSES.has(row.status as SummaryStatus)) {
    fail(file, `scenarios[${index}].status is not a documented scenario status`);
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
    status: row.status as SummaryStatus,
    executed: row.executed,
    ...(row.example === undefined ? {} : { example: row.example }),
  };
}

/**
 * Reads and validates a schema-2 summary. The file is opened read-only, checked
 * on the descriptor, capped before any content is read and never rewritten.
 */
export async function readBaseline(file: string): Promise<BaselineSummary> {
  let text = await readText(file);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    fail(file, 'not valid JSON');
  }
  if (
    typeof document !== 'object' ||
    document === null ||
    Array.isArray(document)
  ) {
    fail(file, 'expected a JSON object');
  }
  const data = document as Record<string, unknown>;
  for (const key of PROTO_KEYS) {
    if (Object.hasOwn(data, key)) {
      fail(file, `unsupported key ${key}`);
    }
  }
  if (data.schemaVersion !== 2) {
    fail(
      file,
      `unsupported schema version ${excerpt(data.schemaVersion)}; expected 2`,
    );
  }
  if (
    typeof data.status !== 'string' ||
    !STATUSES.has(data.status as SummaryStatus)
  ) {
    fail(file, 'status is not a documented scenario status');
  }
  if (!Array.isArray(data.scenarios)) {
    fail(file, 'scenarios must be an array');
  }
  assertDepth(document, file);

  const scenarios = data.scenarios.map((entry, index) =>
    parseScenario(entry, index, file),
  );
  return {
    schemaVersion: 2,
    status: data.status as SummaryStatus,
    scenarios,
  };
}

interface Pair {
  base: BaselineScenario;
  current: SummaryScenarioIdentity;
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

function copyBaselineRow(row: BaselineScenario): BaselineScenario {
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
    a.feature.localeCompare(b.feature) ||
    a.name.localeCompare(b.name) ||
    compareExamples(a.example, b.example) ||
    a.uri.localeCompare(b.uri)
  );
}

function pairUnique(
  baseRows: BaselineScenario[],
  currentRows: SummaryScenarioIdentity[],
  key: (row: { uri: string; example?: string }) => string | undefined,
): Pair[] | undefined {
  const used = new Set<number>();
  const pairs: Pair[] = [];
  for (const base of baseRows) {
    const wanted = key(base);
    let match = -1;
    for (let index = 0; index < currentRows.length; index += 1) {
      const candidate = currentRows[index];
      if (!candidate || used.has(index) || key(candidate) !== wanted) continue;
      if (match >= 0) return undefined;
      match = index;
    }
    const current = currentRows[match];
    if (!current) return undefined;
    used.add(match);
    pairs.push({ base, current });
  }
  return used.size === currentRows.length ? pairs : undefined;
}

function pairRepeated(
  baseRows: BaselineScenario[],
  currentRows: SummaryScenarioIdentity[],
): Pair[] | undefined {
  if (
    baseRows.every((row) => row.example !== undefined) &&
    currentRows.every((row) => row.example !== undefined)
  ) {
    return pairUnique(baseRows, currentRows, (row) => row.example);
  }
  return pairUnique(baseRows, currentRows, (row) => displayUri(row.uri));
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
  const baseGroups = groupBy(baseline.scenarios, (row) =>
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
      for (const row of baseRows) notInThisRun.push(copyBaselineRow(row));
      counts.notInThisRun += baseRows.length;
      continue;
    }
    if (baseRows.length === 1 && currentRows.length === 1) {
      const base = baseRows[0];
      const current = currentRows[0];
      if (base && current) classifyPair(base, current, counts, changes);
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
