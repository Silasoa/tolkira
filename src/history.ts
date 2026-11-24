import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, type FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { writeAtomic } from './output.js';
import type { ReportSummary, StatusCounts, SummaryStatus } from './summary.js';
import { oneLine } from './text.js';

/** The default write version; schema 2 only marks a wider window. */
export const HISTORY_SCHEMA_VERSION = 1;
/** The highest schema version the reader accepts. */
export const HISTORY_SCHEMA_VERSION_MAX = 2;
export const HISTORY_LIMIT = 30;
export const HISTORY_LIMIT_MAX = 365;
export const HISTORY_MAX_BYTES = 1024 * 1024;
/** Stored titles are capped at 200 code points, the last one being an ellipsis. */
export const HISTORY_MAX_TITLE = 200;
/** Ids are SHA-256 hex (64 characters); writes accept up to 128 UTF-16 code units. */
export const HISTORY_MAX_ID = 128;

/** One aggregate run in the history sidecar; no scenario names or steps. */
export interface HistoryRun {
  id: string;
  recordedAt: string;
  title: string;
  status: SummaryStatus;
  counts: {
    features: number;
    scenarios: StatusCounts;
    steps: StatusCounts;
  };
  durationMs: number;
  attachments: {
    total: number;
    bytes: number;
  };
  /** Executed non-skipped tagged or passed-after-retry scenarios. */
  flaky?: number;
}

const STATUSES = new Set<SummaryStatus>([
  'passed',
  'failed',
  'skipped',
  'pending',
  'undefined',
  'ambiguous',
  'unknown',
]);

/** A rejected sidecar; the message already names the file and the action. */
class HistoryValidationError extends Error {}

function fail(file: string, reason: string): never {
  throw new HistoryValidationError(
    `Invalid history file ${oneLine(file)}: ${reason}`,
  );
}

function cannotWrite(file: string, reason: string): never {
  throw new HistoryValidationError(
    `Cannot write history file ${oneLine(path.basename(file))}: ${reason}`,
  );
}

/** The window size; an omitted limit is exactly 30 and an invalid one throws. */
export function historyWindow(limit: number | undefined): number {
  const window = limit === undefined ? HISTORY_LIMIT : limit;
  if (!Number.isInteger(window) || window < 1 || window > HISTORY_LIMIT_MAX) {
    throw new Error(
      `Invalid history limit ${excerpt(limit)}. Use an integer from 1 to ${HISTORY_LIMIT_MAX}.`,
    );
  }
  return window;
}

/** A short, control-free rendering of an unexpected value for an error message. */
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

function capTitle(title: string): string {
  const characters = Array.from(title);
  return characters.length <= HISTORY_MAX_TITLE
    ? title
    : `${characters.slice(0, HISTORY_MAX_TITLE - 1).join('')}…`;
}

/** How a validator reports a rejected entry: `Invalid` on read, `Cannot write` on write. */
type Reject = (reason: string) => never;

function whole(value: unknown, reject: Reject, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    reject(`${field} must be a non-negative whole number`);
  }
  return value;
}

function amount(value: unknown, reject: Reject, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    reject(`${field} must be a non-negative number`);
  }
  return value;
}

function statusCounts(
  value: unknown,
  reject: Reject,
  field: string,
): StatusCounts {
  if (typeof value !== 'object' || value === null) {
    reject(`${field} must be an object`);
  }
  const counts = value as Record<string, unknown>;
  const parsed: StatusCounts = {
    total: whole(counts.total, reject, `${field}.total`),
    passed: whole(counts.passed, reject, `${field}.passed`),
    failed: whole(counts.failed, reject, `${field}.failed`),
    skipped: whole(counts.skipped, reject, `${field}.skipped`),
    pending: whole(counts.pending, reject, `${field}.pending`),
    undefined: whole(counts.undefined, reject, `${field}.undefined`),
    ambiguous: whole(counts.ambiguous, reject, `${field}.ambiguous`),
    unknown: whole(counts.unknown, reject, `${field}.unknown`),
  };
  const buckets =
    parsed.passed +
    parsed.failed +
    parsed.skipped +
    parsed.pending +
    parsed.undefined +
    parsed.ambiguous +
    parsed.unknown;
  if (buckets !== parsed.total) {
    reject(`${field} buckets must add up to total`);
  }
  return parsed;
}

function isIsoTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

/** The reader's field rules, shared by read and write. */
function parseRun(value: unknown, reject: Reject, index: number): HistoryRun {
  const at = `runs[${index}]`;
  if (typeof value !== 'object' || value === null) {
    reject(`${at} must be an object`);
  }
  const run = value as Record<string, unknown>;
  if (typeof run.id !== 'string' || !run.id) reject(`${at}.id must be a string`);
  if (!isIsoTime(run.recordedAt)) {
    reject(`${at}.recordedAt must be an ISO timestamp`);
  }
  if (typeof run.title !== 'string') reject(`${at}.title must be a string`);
  if (Array.from(run.title).length > HISTORY_MAX_TITLE) {
    reject(`${at}.title is longer than ${HISTORY_MAX_TITLE} characters`);
  }
  if (typeof run.status !== 'string' || !STATUSES.has(run.status as SummaryStatus)) {
    reject(`${at}.status is not a known status`);
  }
  if (typeof run.counts !== 'object' || run.counts === null) {
    reject(`${at}.counts must be an object`);
  }
  const counts = run.counts as Record<string, unknown>;
  if (typeof run.attachments !== 'object' || run.attachments === null) {
    reject(`${at}.attachments must be an object`);
  }
  const attachments = run.attachments as Record<string, unknown>;
  const scenarios = statusCounts(
    counts.scenarios,
    reject,
    `${at}.counts.scenarios`,
  );
  const parsed: HistoryRun = {
    id: run.id,
    recordedAt: run.recordedAt,
    title: run.title,
    status: run.status as SummaryStatus,
    counts: {
      features: whole(counts.features, reject, `${at}.counts.features`),
      scenarios,
      steps: statusCounts(counts.steps, reject, `${at}.counts.steps`),
    },
    durationMs: amount(run.durationMs, reject, `${at}.durationMs`),
    attachments: {
      total: whole(attachments.total, reject, `${at}.attachments.total`),
      bytes: whole(attachments.bytes, reject, `${at}.attachments.bytes`),
    },
  };
  // Old entries stay field-less; only a present value is validated.
  if (Object.hasOwn(run, 'flaky')) {
    const flaky = whole(run.flaky, reject, `${at}.flaky`);
    if (flaky > scenarios.total - scenarios.skipped) {
      reject(`${at}.flaky must not exceed attempted scenarios`);
    }
    parsed.flaky = flaky;
  }
  return parsed;
}

/** Validates one run for writing: caps the title and applies the id cap. */
function writeRun(value: unknown, reject: Reject, index: number): HistoryRun {
  const record =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : undefined;
  const capped =
    record && typeof record.title === 'string'
      ? { ...record, title: capTitle(record.title) }
      : value;
  const run = parseRun(capped, reject, index);
  if (run.id.length > HISTORY_MAX_ID) {
    reject(`runs[${index}].id is longer than ${HISTORY_MAX_ID} characters`);
  }
  return run;
}

/** Tagged, executed non-skipped scenarios plus passed-after-retry ones. */
function flakyCount(summary: ReportSummary): number {
  return summary.scenarios.filter(
    (scenario) =>
      scenario.executed &&
      scenario.status !== 'skipped' &&
      (scenario.tags.includes('@flaky') ||
        (scenario.attempt > 0 && scenario.status === 'passed')),
  ).length;
}

/**
 * Builds one aggregate history entry. The id hashes everything except the
 * recorded time, so regenerating an identical run dedupes instead of growing.
 */
export function buildHistoryRun(
  summary: ReportSummary,
  title: string,
  now = new Date(),
): HistoryRun {
  const aggregate = {
    title: capTitle(title),
    status: summary.status,
    counts: {
      features: summary.counts.features,
      scenarios: summary.counts.scenarios,
      steps: summary.counts.steps,
    },
    durationMs: summary.durationMs,
    attachments: summary.attachments,
    flaky: flakyCount(summary),
  };
  return {
    id: createHash('sha256')
      .update(JSON.stringify(aggregate), 'utf8')
      .digest('hex'),
    recordedAt: now.toISOString(),
    ...aggregate,
  };
}

/** Appends a run unless the last entry is the same aggregate; keeps the newest `limit`. */
export function appendHistory(
  runs: readonly HistoryRun[],
  run: HistoryRun,
  limit: number = HISTORY_LIMIT,
): HistoryRun[] {
  const window = historyWindow(limit);
  if (runs.at(-1)?.id === run.id) return [...runs].slice(-window);
  return [...runs, run].slice(-window);
}

function readError(file: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`Cannot read history file ${oneLine(file)}: ${detail}`);
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

/**
 * Opens and reads a sidecar with the shared non-blocking, regular-file and size
 * checks. A missing file returns undefined; a rejected or unreadable file
 * throws. `reject` supplies the caller's `Invalid`/`Cannot write` prefix.
 */
async function readSidecar(
  file: string,
  reject: Reject,
): Promise<string | undefined> {
  let handle: FileHandle;
  try {
    // O_NONBLOCK is undefined on Windows; the fstat regular-file guard does the work.
    handle = await open(file, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  try {
    const info = await handle.stat();
    if (!info.isFile()) reject('not a regular file');
    if (info.size > HISTORY_MAX_BYTES) {
      reject(`file is larger than ${HISTORY_MAX_BYTES} bytes`);
    }
    const text = await readBounded(handle, info.size);
    // Exactly one leading UTF-8 BOM, as the baseline reader does.
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  } finally {
    await handle.close().catch(() => undefined);
  }
}

interface ParsedHistory {
  schemaVersion: number;
  runs: HistoryRun[];
}

/** The reader's full document and run rules, shared by read and write. */
function parseHistoryText(text: string, reject: Reject): ParsedHistory {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return reject('not valid JSON');
  }
  if (
    typeof document !== 'object' ||
    document === null ||
    Array.isArray(document)
  ) {
    return reject('expected a JSON object');
  }
  const data = document as Record<string, unknown>;
  if (
    data.schemaVersion !== HISTORY_SCHEMA_VERSION &&
    data.schemaVersion !== HISTORY_SCHEMA_VERSION_MAX
  ) {
    return reject(
      `unsupported schema version ${excerpt(data.schemaVersion)}`,
    );
  }
  if (!Array.isArray(data.runs)) return reject('runs must be an array');
  return {
    schemaVersion: data.schemaVersion,
    runs: data.runs.map((run, index) => parseRun(run, reject, index)),
  };
}

/**
 * Reads the sidecar. A missing file is an empty history; a corrupt, oversized,
 * non-regular or unsupported file throws without touching it. The descriptor
 * is opened non-blocking and capped before any content is read. The newest
 * `limit` runs are returned without rewriting the file.
 */
export async function readHistory(
  file: string,
  limit: number = HISTORY_LIMIT,
): Promise<HistoryRun[]> {
  const window = historyWindow(limit);
  const reject: Reject = (reason) => fail(file, reason);
  let text: string | undefined;
  try {
    text = await readSidecar(file, reject);
  } catch (error) {
    if (error instanceof HistoryValidationError) throw error;
    throw readError(file, error);
  }
  if (text === undefined) return [];

  return parseHistoryText(text, reject).runs.slice(-window);
}

/**
 * The schema of the file already on disk, or 1 when it is missing. The peek
 * uses the same cap and regular-file check as a read; any other failure throws
 * instead of downgrading a schema-2 file to 1.
 */
async function storedSchema(file: string): Promise<number> {
  let text: string | undefined;
  try {
    text = await readSidecar(file, (reason) => cannotWrite(file, reason));
  } catch (error) {
    if (error instanceof HistoryValidationError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    return cannotWrite(file, detail);
  }
  if (text === undefined) return HISTORY_SCHEMA_VERSION;

  return parseHistoryText(text, (reason) => cannotWrite(file, reason))
    .schemaVersion;
}

function serialize(schemaVersion: number, runs: readonly HistoryRun[]): string {
  return `${JSON.stringify({ schemaVersion, runs }, null, 2)}\n`;
}

/**
 * Writes the sidecar atomically, with a trailing newline. Schema 2 marks a file
 * that may hold more than 30 runs; it is chosen above the default window or
 * when the file already used it, which needs one bounded read of the target.
 * Every stored run is validated with the reader's rules, titles are capped and
 * ids above 128 UTF-16 code units are rejected. The oldest entries are then pruned
 * until the file fits the read cap, always keeping the newest one; a run that
 * alone exceeds the cap is rejected instead of written.
 */
export async function writeHistory(
  file: string,
  runs: readonly HistoryRun[],
  limit: number = HISTORY_LIMIT,
): Promise<void> {
  const window = historyWindow(limit);
  const stored = await storedSchema(file);
  const schemaVersion =
    window > HISTORY_LIMIT || stored === HISTORY_SCHEMA_VERSION_MAX
      ? HISTORY_SCHEMA_VERSION_MAX
      : HISTORY_SCHEMA_VERSION;
  const reject: Reject = (reason) => cannotWrite(file, reason);
  let bounded = runs.slice(-window).map((run, index) => writeRun(run, reject, index));
  let text = serialize(schemaVersion, bounded);
  while (
    Buffer.byteLength(text, 'utf8') > HISTORY_MAX_BYTES &&
    bounded.length > 1
  ) {
    bounded = bounded.slice(1);
    text = serialize(schemaVersion, bounded);
  }
  if (Buffer.byteLength(text, 'utf8') > HISTORY_MAX_BYTES) {
    cannotWrite(file, `the newest run alone exceeds ${HISTORY_MAX_BYTES} bytes`);
  }
  try {
    await writeAtomic(file, text);
  } catch (error) {
    // Name the target, never the atomic temporary file.
    const code = (error as NodeJS.ErrnoException).code;
    throw new Error(
      `Cannot write history file ${oneLine(path.basename(file))}${code ? ` (${code})` : ''}`,
    );
  }
}
