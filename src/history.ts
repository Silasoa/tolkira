import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, type FileHandle } from 'node:fs/promises';
import { writeAtomic } from './output.js';
import type { ReportSummary, StatusCounts, SummaryStatus } from './summary.js';

export const HISTORY_SCHEMA_VERSION = 1;
export const HISTORY_LIMIT = 30;
export const HISTORY_MAX_BYTES = 1024 * 1024;
/** Stored titles are capped at 200 characters, the last one being an ellipsis. */
export const HISTORY_MAX_TITLE = 200;

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

function fail(file: string, reason: string): never {
  throw new Error(`Invalid history file ${file}: ${reason}`);
}

/** A short, control-free rendering of an unexpected value for an error message. */
function excerpt(value: unknown): string {
  let text: string;
  try {
    text =
      typeof value === 'string'
        ? value
        : (JSON.stringify(value) ?? String(value));
  } catch {
    text = String(value);
  }
  // oxlint-disable-next-line no-control-regex
  const flat = text.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
  return JSON.stringify(flat.length > 40 ? `${flat.slice(0, 40)}…` : flat);
}

function capTitle(title: string): string {
  const characters = Array.from(title);
  return characters.length <= HISTORY_MAX_TITLE
    ? title
    : `${characters.slice(0, HISTORY_MAX_TITLE - 1).join('')}…`;
}

function whole(value: unknown, file: string, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    fail(file, `${field} must be a non-negative whole number`);
  }
  return value;
}

function amount(value: unknown, file: string, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(file, `${field} must be a non-negative number`);
  }
  return value;
}

function statusCounts(
  value: unknown,
  file: string,
  field: string,
): StatusCounts {
  if (typeof value !== 'object' || value === null) {
    fail(file, `${field} must be an object`);
  }
  const counts = value as Record<string, unknown>;
  const parsed: StatusCounts = {
    total: whole(counts.total, file, `${field}.total`),
    passed: whole(counts.passed, file, `${field}.passed`),
    failed: whole(counts.failed, file, `${field}.failed`),
    skipped: whole(counts.skipped, file, `${field}.skipped`),
    pending: whole(counts.pending, file, `${field}.pending`),
    undefined: whole(counts.undefined, file, `${field}.undefined`),
    ambiguous: whole(counts.ambiguous, file, `${field}.ambiguous`),
    unknown: whole(counts.unknown, file, `${field}.unknown`),
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
    fail(file, `${field} buckets must add up to total`);
  }
  return parsed;
}

function isIsoTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function parseRun(value: unknown, file: string, index: number): HistoryRun {
  const at = `runs[${index}]`;
  if (typeof value !== 'object' || value === null) {
    fail(file, `${at} must be an object`);
  }
  const run = value as Record<string, unknown>;
  if (typeof run.id !== 'string' || !run.id) fail(file, `${at}.id must be a string`);
  if (!isIsoTime(run.recordedAt)) {
    fail(file, `${at}.recordedAt must be an ISO timestamp`);
  }
  if (typeof run.title !== 'string') fail(file, `${at}.title must be a string`);
  if (Array.from(run.title).length > HISTORY_MAX_TITLE) {
    fail(file, `${at}.title is longer than ${HISTORY_MAX_TITLE} characters`);
  }
  if (typeof run.status !== 'string' || !STATUSES.has(run.status as SummaryStatus)) {
    fail(file, `${at}.status is not a known status`);
  }
  if (typeof run.counts !== 'object' || run.counts === null) {
    fail(file, `${at}.counts must be an object`);
  }
  const counts = run.counts as Record<string, unknown>;
  if (typeof run.attachments !== 'object' || run.attachments === null) {
    fail(file, `${at}.attachments must be an object`);
  }
  const attachments = run.attachments as Record<string, unknown>;
  const scenarios = statusCounts(
    counts.scenarios,
    file,
    `${at}.counts.scenarios`,
  );
  const parsed: HistoryRun = {
    id: run.id,
    recordedAt: run.recordedAt,
    title: run.title,
    status: run.status as SummaryStatus,
    counts: {
      features: whole(counts.features, file, `${at}.counts.features`),
      scenarios,
      steps: statusCounts(counts.steps, file, `${at}.counts.steps`),
    },
    durationMs: amount(run.durationMs, file, `${at}.durationMs`),
    attachments: {
      total: whole(attachments.total, file, `${at}.attachments.total`),
      bytes: whole(attachments.bytes, file, `${at}.attachments.bytes`),
    },
  };
  // Old entries stay field-less; only a present value is validated.
  if (Object.hasOwn(run, 'flaky')) {
    const flaky = whole(run.flaky, file, `${at}.flaky`);
    if (flaky > scenarios.total - scenarios.skipped) {
      fail(file, `${at}.flaky must not exceed attempted scenarios`);
    }
    parsed.flaky = flaky;
  }
  return parsed;
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

/** Appends a run unless the last entry is the same aggregate; keeps the last 30. */
export function appendHistory(
  runs: readonly HistoryRun[],
  run: HistoryRun,
): HistoryRun[] {
  if (runs.at(-1)?.id === run.id) return [...runs].slice(-HISTORY_LIMIT);
  return [...runs, run].slice(-HISTORY_LIMIT);
}

function readError(file: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`Cannot read history file ${file}: ${detail}`);
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
 * Reads the sidecar. A missing file is an empty history; a corrupt, oversized,
 * non-regular or unsupported file throws without touching it. The descriptor
 * is opened non-blocking and capped before any content is read.
 */
export async function readHistory(file: string): Promise<HistoryRun[]> {
  let handle: FileHandle;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw readError(file, error);
  }

  let text: string;
  try {
    const info = await handle.stat();
    if (!info.isFile()) fail(file, 'not a regular file');
    if (info.size > HISTORY_MAX_BYTES) {
      fail(file, `file is larger than ${HISTORY_MAX_BYTES} bytes`);
    }
    text = await readBounded(handle, info.size);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid history file')) {
      throw error;
    }
    throw readError(file, error);
  } finally {
    await handle.close().catch(() => undefined);
  }

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
  if (data.schemaVersion !== HISTORY_SCHEMA_VERSION) {
    fail(file, `unsupported schema version ${excerpt(data.schemaVersion)}`);
  }
  if (!Array.isArray(data.runs)) fail(file, 'runs must be an array');

  const runs = data.runs.map((run, index) => parseRun(run, file, index));
  return runs.slice(-HISTORY_LIMIT);
}

/**
 * Writes schema version 1 JSON atomically, with a trailing newline. The list is
 * bounded to the newest 30 runs and every stored title to the documented cap.
 */
export async function writeHistory(
  file: string,
  runs: readonly HistoryRun[],
): Promise<void> {
  const bounded = runs
    .slice(-HISTORY_LIMIT)
    .map((run) => ({ ...run, title: capTitle(run.title) }));
  const text = `${JSON.stringify(
    { schemaVersion: HISTORY_SCHEMA_VERSION, runs: bounded },
    null,
    2,
  )}\n`;
  try {
    await writeAtomic(file, text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot write history file ${file}: ${detail}`);
  }
}
