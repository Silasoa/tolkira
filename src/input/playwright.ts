import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  AttachmentContentEncoding,
  TestStepResultStatus,
} from '@cucumber/messages';
import type {
  Attachment,
  Duration,
  Envelope,
  Feature,
  FeatureChild,
  Location,
  Meta,
  Pickle,
  PickleStep,
  Rule,
  RuleChild,
  Scenario,
  Step,
  TestCase,
  TestCaseStarted,
  TestStep,
  TestStepResult,
  Timestamp,
} from '@cucumber/messages';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_RETRY_EVIDENCE_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  attachmentBytes,
  retryEvidenceFits,
  safeMediaType,
} from '../attachment.js';
import { stripAnsi, stripBidiControls } from '../text.js';
import {
  markRetryEvidence,
  recordSkippedAttachments,
  type AttachmentSkipReason,
  type SkippedAttachment,
} from '../attempt-diagnostics.js';

const FAILED_STATUSES = new Set(['failed', 'timedOut', 'interrupted']);
const KNOWN_ANNOTATIONS = new Set(['skip', 'fixme', 'fail', 'slow']);

type JsonObject = Record<string, unknown>;

interface PlaywrightError {
  message?: string;
  value?: string;
  stack?: string;
  snippet?: string;
  location?: { file?: string; line?: number; column?: number };
}

interface PlaywrightStep {
  title: string;
  subtitle?: string;
  duration: number;
  error?: PlaywrightError;
  steps: PlaywrightStep[];
}

interface PlaywrightAttachment {
  name: string;
  contentType: string;
  body?: string;
  path?: string;
}

interface PlaywrightOutput {
  text?: string;
  buffer?: string;
}

interface PlaywrightAnnotation {
  type: string;
  description?: string;
}

interface PlaywrightResult {
  status: string;
  duration: number;
  retry: number;
  startTime?: string;
  error?: PlaywrightError;
  errors: PlaywrightError[];
  steps: PlaywrightStep[];
  attachments: PlaywrightAttachment[];
  stdout: PlaywrightOutput[];
  stderr: PlaywrightOutput[];
}

interface PlaywrightTest {
  projectName?: string;
  projectId?: string;
  status?: string;
  expectedStatus?: string;
  annotations: PlaywrightAnnotation[];
  results: PlaywrightResult[];
}

interface PlaywrightSpec {
  title: string;
  file?: string;
  line?: number;
  column?: number;
  tags: string[];
  tests: PlaywrightTest[];
}

interface PlaywrightSuite {
  title?: string;
  file?: string;
  line?: number;
  column?: number;
  specs: PlaywrightSpec[];
  suites: PlaywrightSuite[];
}

export interface PlaywrightJsonOptions {
  idPrefix?: string;
  /** One earlier image per report; the loader only allows a single input file. */
  allowRetryImages?: boolean;
}

export interface PlaywrightParseResult {
  envelopes: Envelope[];
  skippedAttachments: number;
}

interface CanonicalStep {
  text: string;
  durationMs: number;
  status: TestStepResultStatus;
  message?: string;
}

interface PlannedAttachment {
  fileName: string;
  mediaType: string;
  body: string;
  contentEncoding: AttachmentContentEncoding.BASE64;
}

interface PlannedAttempt {
  attempt: number;
  timestamp: Timestamp;
  steps: CanonicalStep[];
  attachments: PlannedAttachment[];
  skippedAttachments: number;
  skippedEntries: SkippedAttachment[];
  willBeRetried: boolean;
  /** Images of an earlier attempt; the one retry-evidence probe reads at most one. */
  retryImages?: PlaywrightAttachment[];
  /** The planned attachment is the marked earlier-attempt image. */
  retryEvidence?: boolean;
}

interface ScenarioPlan {
  scenario: Scenario;
  pickle: Pickle;
  testCase: TestCase;
  attempts: PlannedAttempt[];
}

interface RulePlan {
  id: string;
  name: string;
  scenarios: ScenarioPlan[];
}

interface FeaturePlan {
  name: string;
  uri: string;
  rules: Map<string, RulePlan>;
  order: RulePlan[];
}

interface PlanContext {
  source: string;
  idPrefix: string;
  inputDir: string;
  roots: string[];
  nextId: (kind: string) => string;
  totalAttachmentBytes: number;
  allowRetryImages: boolean;
  retryEvidenceBytes: number;
  retryEvidenceImageUsed: boolean;
  features: Map<string, FeaturePlan>;
  featureOrder: FeaturePlan[];
  runId: string;
  runTimestamp: Timestamp;
  skippedAttachments: number;
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalid(source: string, detail: string): Error {
  return new Error(`Invalid Playwright JSON in ${source}: ${detail}`);
}

function optionalString(
  value: JsonObject,
  field: string,
  source: string,
  where: string,
): string | undefined {
  const fieldValue = value[field];
  if (fieldValue === undefined) return undefined;
  if (typeof fieldValue !== 'string') {
    throw invalid(source, `${where}.${field} must be a string.`);
  }
  return fieldValue;
}

function optionalNumber(
  value: JsonObject,
  field: string,
  source: string,
  where: string,
): number | undefined {
  const fieldValue = value[field];
  if (fieldValue === undefined) return undefined;
  if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue)) {
    throw invalid(source, `${where}.${field} must be a number.`);
  }
  return fieldValue;
}

function arrayOf(
  value: JsonObject,
  field: string,
  source: string,
  where: string,
): unknown[] {
  const fieldValue = value[field];
  if (!Array.isArray(fieldValue)) {
    throw invalid(source, `${where}.${field} must be an array.`);
  }
  return fieldValue;
}

function validateError(
  value: unknown,
  source: string,
  where: string,
): PlaywrightError {
  if (!isObject(value)) {
    throw invalid(source, `${where} must be an object.`);
  }
  const error: PlaywrightError = {};
  for (const field of ['message', 'value', 'stack', 'snippet'] as const) {
    const text = optionalString(value, field, source, where);
    if (text !== undefined) error[field] = text;
  }
  if (value.location !== undefined) {
    if (!isObject(value.location)) {
      throw invalid(source, `${where}.location must be an object.`);
    }
    const file = optionalString(value.location, 'file', source, `${where}.location`);
    const line = optionalNumber(value.location, 'line', source, `${where}.location`);
    const column = optionalNumber(
      value.location,
      'column',
      source,
      `${where}.location`,
    );
    error.location = {
      ...(file === undefined ? {} : { file }),
      ...(line === undefined ? {} : { line }),
      ...(column === undefined ? {} : { column }),
    };
  }
  return error;
}

function validateStep(
  value: unknown,
  source: string,
  where: string,
): PlaywrightStep {
  if (!isObject(value)) {
    throw invalid(source, `${where} must be an object.`);
  }
  if (typeof value.title !== 'string') {
    throw invalid(source, `${where}.title must be a string.`);
  }
  if (typeof value.duration !== 'number' || !Number.isFinite(value.duration)) {
    throw invalid(source, `${where}.duration must be a number.`);
  }
  const step: PlaywrightStep = {
    title: value.title,
    duration: value.duration,
    steps: [],
  };
  const subtitle = optionalString(value, 'subtitle', source, where);
  if (subtitle !== undefined) step.subtitle = subtitle;
  if (value.error !== undefined) {
    step.error = validateError(value.error, source, `${where}.error`);
  }
  if (value.steps !== undefined) {
    step.steps = arrayOf(value, 'steps', source, where).map((child, index) =>
      validateStep(child, source, `${where}.steps[${index}]`),
    );
  }
  return step;
}

function validateAttachment(
  value: unknown,
  source: string,
  where: string,
): PlaywrightAttachment {
  if (!isObject(value)) {
    throw invalid(source, `${where} must be an object.`);
  }
  if (typeof value.contentType !== 'string') {
    throw invalid(source, `${where}.contentType must be a string.`);
  }
  const attachment: PlaywrightAttachment = {
    name: 'attachment',
    contentType: value.contentType,
  };
  const name = optionalString(value, 'name', source, where);
  if (name !== undefined) attachment.name = name;
  const body = optionalString(value, 'body', source, where);
  if (body !== undefined) attachment.body = body;
  const file = optionalString(value, 'path', source, where);
  if (file !== undefined) attachment.path = file;
  return attachment;
}

function validateOutput(
  value: unknown,
  source: string,
  where: string,
): PlaywrightOutput {
  if (!isObject(value)) {
    throw invalid(source, `${where} must be an object.`);
  }
  const output: PlaywrightOutput = {};
  const text = optionalString(value, 'text', source, where);
  if (text !== undefined) output.text = text;
  const buffer = optionalString(value, 'buffer', source, where);
  if (buffer !== undefined) output.buffer = buffer;
  if (output.text === undefined && output.buffer === undefined) {
    throw invalid(source, `${where} must have a text or buffer string.`);
  }
  return output;
}

function validateResult(
  value: unknown,
  source: string,
  where: string,
): PlaywrightResult {
  if (!isObject(value)) {
    throw invalid(source, `${where} must be an object.`);
  }
  if (typeof value.status !== 'string') {
    throw invalid(source, `${where}.status must be a string.`);
  }
  if (typeof value.duration !== 'number' || !Number.isFinite(value.duration)) {
    throw invalid(source, `${where}.duration must be a number.`);
  }
  const result: PlaywrightResult = {
    status: value.status,
    duration: value.duration,
    retry: optionalNumber(value, 'retry', source, where) ?? 0,
    errors: [],
    steps: [],
    attachments: [],
    stdout: [],
    stderr: [],
  };
  const startTime = optionalString(value, 'startTime', source, where);
  if (startTime !== undefined) result.startTime = startTime;
  if (value.error !== undefined) {
    result.error = validateError(value.error, source, `${where}.error`);
  }
  if (value.errors !== undefined) {
    result.errors = arrayOf(value, 'errors', source, where).map((entry, index) =>
      validateError(entry, source, `${where}.errors[${index}]`),
    );
  }
  if (value.steps !== undefined) {
    result.steps = arrayOf(value, 'steps', source, where).map((entry, index) =>
      validateStep(entry, source, `${where}.steps[${index}]`),
    );
  }
  if (value.attachments !== undefined) {
    result.attachments = arrayOf(value, 'attachments', source, where).map(
      (entry, index) =>
        validateAttachment(entry, source, `${where}.attachments[${index}]`),
    );
  }
  for (const field of ['stdout', 'stderr'] as const) {
    if (value[field] !== undefined) {
      result[field] = arrayOf(value, field, source, where).map((entry, index) =>
        validateOutput(entry, source, `${where}.${field}[${index}]`),
      );
    }
  }
  return result;
}

function validateAnnotation(
  value: unknown,
  source: string,
  where: string,
): PlaywrightAnnotation {
  if (!isObject(value)) {
    throw invalid(source, `${where} must be an object.`);
  }
  if (typeof value.type !== 'string') {
    throw invalid(source, `${where}.type must be a string.`);
  }
  const description = optionalString(value, 'description', source, where);
  return { type: value.type, ...(description ? { description } : {}) };
}

function validateTest(
  value: unknown,
  source: string,
  where: string,
): PlaywrightTest {
  if (!isObject(value)) {
    throw invalid(source, `${where} must be an object.`);
  }
  const test: PlaywrightTest = {
    annotations: [],
    results: arrayOf(value, 'results', source, where).map((entry, index) =>
      validateResult(entry, source, `${where}.results[${index}]`),
    ),
  };
  const projectName = optionalString(value, 'projectName', source, where);
  if (projectName !== undefined) test.projectName = projectName;
  const projectId = optionalString(value, 'projectId', source, where);
  if (projectId !== undefined) test.projectId = projectId;
  const status = optionalString(value, 'status', source, where);
  if (status !== undefined) test.status = status;
  const expectedStatus = optionalString(value, 'expectedStatus', source, where);
  if (expectedStatus !== undefined) test.expectedStatus = expectedStatus;
  if (value.annotations !== undefined) {
    test.annotations = arrayOf(value, 'annotations', source, where).map(
      (entry, index) =>
        validateAnnotation(entry, source, `${where}.annotations[${index}]`),
    );
  }
  return test;
}

function validateSpec(
  value: unknown,
  source: string,
  where: string,
): PlaywrightSpec {
  if (!isObject(value)) {
    throw invalid(source, `${where} must be an object.`);
  }
  if (typeof value.title !== 'string') {
    throw invalid(source, `${where}.title must be a string.`);
  }
  const spec: PlaywrightSpec = {
    title: value.title,
    tags: [],
    tests: arrayOf(value, 'tests', source, where).map((entry, index) =>
      validateTest(entry, source, `${where}.tests[${index}]`),
    ),
  };
  const file = optionalString(value, 'file', source, where);
  if (file !== undefined) spec.file = file;
  const line = optionalNumber(value, 'line', source, where);
  if (line !== undefined) spec.line = line;
  const column = optionalNumber(value, 'column', source, where);
  if (column !== undefined) spec.column = column;
  if (value.tags !== undefined) {
    spec.tags = arrayOf(value, 'tags', source, where).map((tag, index) => {
      if (typeof tag !== 'string') {
        throw invalid(source, `${where}.tags[${index}] must be a string.`);
      }
      return tag;
    });
  }
  return spec;
}

function validateSuite(
  value: unknown,
  source: string,
  where: string,
): PlaywrightSuite {
  if (!isObject(value)) {
    throw invalid(source, `${where} must be an object.`);
  }
  const suite: PlaywrightSuite = {
    specs: arrayOf(value, 'specs', source, where).map((entry, index) =>
      validateSpec(entry, source, `${where}.specs[${index}]`),
    ),
    suites: [],
  };
  const title = optionalString(value, 'title', source, where);
  if (title !== undefined) suite.title = title;
  const file = optionalString(value, 'file', source, where);
  if (file !== undefined) suite.file = file;
  const line = optionalNumber(value, 'line', source, where);
  if (line !== undefined) suite.line = line;
  const column = optionalNumber(value, 'column', source, where);
  if (column !== undefined) suite.column = column;
  if (value.suites !== undefined) {
    suite.suites = arrayOf(value, 'suites', source, where).map((entry, index) =>
      validateSuite(entry, source, `${where}.suites[${index}]`),
    );
  }
  return suite;
}

function timestamp(milliseconds: number): Timestamp {
  const safe = Number.isFinite(milliseconds) ? milliseconds : 0;
  const seconds = Math.floor(safe / 1000);
  const nanos = Math.round((safe - seconds * 1000) * 1_000_000);
  return nanos >= 1_000_000_000
    ? { seconds: seconds + 1, nanos: nanos - 1_000_000_000 }
    : { seconds, nanos };
}

function timestampOf(value: string | undefined, fallback: Timestamp): Timestamp {
  if (!value) return fallback;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? timestamp(milliseconds) : fallback;
}

function addDuration(base: Timestamp, milliseconds: number): Timestamp {
  return timestamp(base.seconds * 1000 + base.nanos / 1_000_000 + milliseconds);
}

// Playwright durations are milliseconds; Messages uses nanoseconds. The legacy
// adapter's time helpers do not fit, so the conversion stays local until a third
// adapter justifies a shared module.
function durationOf(milliseconds: number): Duration {
  const nanos = Math.max(0, Math.round(milliseconds * 1_000_000));
  return {
    seconds: Math.floor(nanos / 1_000_000_000),
    nanos: nanos % 1_000_000_000,
  };
}

function location(line?: number, column?: number): Location {
  const safeLine = line !== undefined && line > 0 ? line : 1;
  return column !== undefined && column > 0
    ? { line: safeLine, column }
    : { line: safeLine };
}

// The report shows a positive Pickle line; a missing or zero spec.line must stay
// unknown (0), while AST nodes keep the line-1 placeholder.
function pickleLocation(line?: number, column?: number): Location {
  const safeLine =
    typeof line === 'number' && Number.isInteger(line) && line > 0 ? line : 0;
  return safeLine > 0 && column !== undefined && Number.isInteger(column) && column > 0
    ? { line: safeLine, column }
    : { line: safeLine };
}

// Right-to-left token scan; a regex here backtracked quadratically on long
// titles with many trailing @tags.
function stripTrailingTags(value: string): string {
  let end = value.length;
  while (end > 0) {
    let tokenEnd = end;
    while (tokenEnd > 0 && /\s/.test(value[tokenEnd - 1] as string)) tokenEnd -= 1;
    let tokenStart = tokenEnd;
    while (tokenStart > 0 && !/\s/.test(value[tokenStart - 1] as string)) {
      tokenStart -= 1;
    }
    const token = value.slice(tokenStart, tokenEnd);
    if (
      tokenStart === 0 ||
      token.length < 2 ||
      token[0] !== '@' ||
      token.includes('@', 1)
    ) {
      break;
    }
    end = tokenStart;
  }
  return value.slice(0, end).trim();
}

function fileUri(value: string | undefined, inputDir: string): string {
  return relativeFile(value ?? 'playwright.spec.ts', inputDir);
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (!path.isAbsolute(relative) &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`))
  );
}

function relativeFile(file: string, inputDir: string): string {
  if (!path.isAbsolute(file)) {
    const normalized = file.replaceAll('\\', '/').replace(/^\.\//, '');
    return normalized || path.basename(file);
  }
  const resolved = path.resolve(file);
  for (const root of [inputDir, process.cwd()]) {
    const relative = path.relative(root, resolved);
    if (
      relative &&
      !path.isAbsolute(relative) &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`)
    ) {
      return relative.replaceAll('\\', '/');
    }
  }
  return path.basename(file);
}

function locationText(
  value: PlaywrightError['location'],
  inputDir: string,
): string | undefined {
  if (!value?.file) return undefined;
  const file = relativeFile(value.file, inputDir);
  const line = value.line !== undefined ? `:${value.line}` : '';
  const column = value.column !== undefined ? `:${value.column}` : '';
  return `${file}${line}${column}`;
}

// Common local roots on POSIX plus Windows drive paths. The lookbehinds keep
// URL text such as https://example.com/tmp/report intact.
const ABSOLUTE_LOCAL_PATH =
  /(?:(?<![A-Za-z0-9_])[A-Za-z]:[\\/]|(?<![A-Za-z0-9_/])\/(?:Users|home|tmp|var|opt|etc|usr|private|mnt|srv|root|workspace|builds|app|data|github)\/)[^\s"'<>|]+/g;

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rootPattern(root: string): RegExp | undefined {
  const trimmed = root.replace(/[\\/]+$/, '');
  if (!trimmed) return undefined;
  const body = trimmed
    .split(/[\\/]/)
    .map((part) => escapeRegExp(part))
    .join('[\\\\/]');
  return new RegExp(`${body}(?:[\\\\/]|(?=$|[^\\w.-]))`, 'gi');
}

// Error text is untrusted and must not carry the machine's absolute paths into
// a shared report. Roots become relative; other local paths keep the basename.
function scrubPaths(text: string, inputDir: string): string {
  let scrubbed = text;
  for (const root of [inputDir, process.cwd()]) {
    const pattern = rootPattern(root);
    if (pattern) scrubbed = scrubbed.replace(pattern, '');
  }
  return scrubbed.replaceAll(ABSOLUTE_LOCAL_PATH, (match) =>
    path.basename(match.replaceAll('\\', '/')),
  );
}

function locationAlreadyPresent(part: string, at: string): boolean {
  const normalized = part.replaceAll('\\', '/');
  const needle = at.replaceAll('\\', '/');
  const escaped = escapeRegExp(needle);
  // A location without a column also matches the same file and line with one.
  const column = /:\d+:\d+$/.test(needle) ? '' : '(?::\\d+)?';
  return new RegExp(`(?:^|[^\\w:./-])${escaped}${column}(?![\\w:])`).test(normalized);
}

function errorText(
  error: PlaywrightError | undefined,
  inputDir: string,
): string | undefined {
  if (!error) return undefined;
  const message = [error.message, error.value, error.stack]
    .find((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
  const parts: string[] = [];
  if (message) parts.push(scrubPaths(stripAnsi(message), inputDir).trim());
  if (error.snippet) parts.push(scrubPaths(stripAnsi(error.snippet), inputDir).trim());
  const at = locationText(error.location, inputDir);
  if (at && !parts.some((part) => locationAlreadyPresent(part, at))) {
    parts.push(`at ${at}`);
  }
  return parts.filter(Boolean).join('\n\n') || undefined;
}

function resultErrorText(
  result: PlaywrightResult | undefined,
  inputDir: string,
): string | undefined {
  // Playwright reports the same failure in `error` and `errors[0]`, so prefer
  // the array when it has entries and fall back to the single error otherwise.
  const errors =
    result?.errors && result.errors.length > 0 ? result.errors : [result?.error];
  const texts: string[] = [];
  for (const error of errors) {
    const text = errorText(error, inputDir);
    if (text && !texts.includes(text)) texts.push(text);
  }
  return texts.length > 0 ? texts.join('\n\n') : undefined;
}

function stepText(step: PlaywrightStep, depth: number): string {
  const subtitle = step.subtitle ? ` — ${step.subtitle}` : '';
  return `${'› '.repeat(depth)}${step.title}${subtitle}`;
}

function flattenSteps(
  steps: PlaywrightStep[],
  depth = 0,
): Array<{ text: string; durationMs: number; error?: PlaywrightError }> {
  const rows: Array<{ text: string; durationMs: number; error?: PlaywrightError }> = [];
  for (const step of steps) {
    // Playwright step durations are inclusive; subtract children so parent and
    // child are not counted twice by the report model.
    const childMs = step.steps.reduce((sum, child) => sum + child.duration, 0);
    rows.push({
      text: stepText(step, depth),
      durationMs: Math.max(0, step.duration - childMs),
      ...(step.error ? { error: step.error } : {}),
    });
    rows.push(...flattenSteps(step.steps, depth + 1));
  }
  return rows;
}

function statusOf(value: string): TestStepResultStatus {
  switch (value) {
    case 'passed':
      return TestStepResultStatus.PASSED;
    case 'skipped':
      return TestStepResultStatus.SKIPPED;
    case 'failed':
    case 'timedOut':
    case 'interrupted':
      return TestStepResultStatus.FAILED;
    default:
      return TestStepResultStatus.UNKNOWN;
  }
}

const PASSED = TestStepResultStatus.PASSED;
const FAILED = TestStepResultStatus.FAILED;
const SKIPPED = TestStepResultStatus.SKIPPED;

function canonicalSteps(
  result: PlaywrightResult | undefined,
  mode: 'expected-failure' | 'unexpected-pass' | 'skipped' | 'normal',
  inputDir: string,
  unexpectedPassMessage = 'Unexpected pass: expected to fail, but passed.',
): CanonicalStep[] {
  const flat = flattenSteps(result?.steps ?? []);
  let steps: CanonicalStep[];

  if (mode === 'unexpected-pass') {
    steps = flat.map((step) => ({
      text: step.text,
      durationMs: step.durationMs,
      status: PASSED,
    }));
    steps.push({
      text: 'Unexpected pass',
      durationMs: steps.length > 0 ? 0 : (result?.duration ?? 0),
      status: FAILED,
      message: unexpectedPassMessage,
    });
  } else if (mode === 'expected-failure' || mode === 'skipped') {
    const status = mode === 'skipped' ? SKIPPED : PASSED;
    steps = flat.map((step) => ({
      text: step.text,
      durationMs: step.durationMs,
      status,
    }));
    if (steps.length === 0) {
      steps.push({
        text: mode === 'skipped' ? 'Skipped' : 'Expected failure',
        durationMs: result?.duration ?? 0,
        status,
      });
    }
  } else {
    if (!result) return [];

    const failed = FAILED_STATUSES.has(result.status);
    steps = flat.map((step) => {
      const message = errorText(step.error, inputDir);
      return {
        text: step.text,
        durationMs: step.durationMs,
        status: step.error ? FAILED : PASSED,
        ...(message ? { message } : {}),
      };
    });

    if (failed && !flat.some((step) => step.error)) {
      steps.push({
        text: 'Error',
        durationMs: steps.length > 0 ? 0 : result.duration,
        status: FAILED,
        message:
          resultErrorText(result, inputDir) ??
          `Playwright reported a ${result.status} result.`,
      });
    }

    if (steps.length === 0) {
      steps.push({
        text: 'Test',
        durationMs: result.duration,
        status: statusOf(result.status),
      });
    }
  }

  if (!result) return steps;
  const visibleMs = steps.reduce((sum, step) => sum + step.durationMs, 0);
  const residual = result.duration - visibleMs;
  if (residual > 0) {
    steps.push({
      text: 'Playwright overhead',
      durationMs: residual,
      status: mode === 'skipped' ? SKIPPED : PASSED,
    });
  }
  return steps;
}

function attemptSteps(result: PlaywrightResult, inputDir: string): CanonicalStep[] {
  return canonicalSteps(
    result,
    result.status === 'skipped' ? 'skipped' : 'normal',
    inputDir,
  );
}

function imageAttachmentsOf(result: PlaywrightResult): PlaywrightAttachment[] {
  return result.attachments.filter(
    (attachment) =>
      safeMediaType(attachment.contentType).startsWith('image/') &&
      (attachment.body
        ? attachment.body !== ''
        : attachment.path !== undefined),
  );
}

const NON_LOCAL_PATH = /^[a-z][a-z0-9+.-]+:/i;
const MAX_SKIP_ENTRIES = 3;
const MAX_SKIP_NAME_LENGTH = 120;
const MAX_EARLIER_ATTEMPTS = 3;

// Only the sanitized name is persisted, so a report or CLI warning cannot leak
// a directory. Escape stripping runs before the split: an OSC-8 payload may
// carry its own visible path after the terminator.
function displayAttachmentName(name: string): string {
  const stripped = stripBidiControls(stripAnsi(name));
  const base = stripped.replaceAll('\\', '/').split('/').at(-1) ?? '';
  const collapsed = base.replaceAll(/\s+/g, ' ').trim();
  let displayed = '';
  let length = 0;
  for (const character of collapsed) {
    if (length >= MAX_SKIP_NAME_LENGTH) break;
    displayed += character;
    length += 1;
  }
  return displayed || 'attachment';
}

// A 2+ character scheme keeps Windows drive letters (`C:\`) local. Reject URL
// schemes and UNC/device paths before any lstat, so a crafted JSON report cannot
// make the adapter touch an SMB or device path.
function isNonLocalPath(file: string): boolean {
  return (
    NON_LOCAL_PATH.test(file) ||
    file.startsWith('\\\\') ||
    file.startsWith('//')
  );
}

async function readAttachment(
  candidate: string,
  context: PlanContext,
  maxBytes?: number,
): Promise<PlannedAttachment | undefined> {
  const info = await lstat(candidate).catch(() => undefined);
  if (!info || info.isSymbolicLink() || !info.isFile()) return undefined;

  const target = await realpath(candidate).catch(() => undefined);
  if (!target || !context.roots.some((root) => isInside(root, target))) {
    return undefined;
  }

  // Stat and read through the opened handle; the path could change after
  // realpath. Size caps are enforced on the descriptor, not the earlier lstat.
  const handle = await open(target, 'r').catch(() => undefined);
  if (!handle) return undefined;
  try {
    const stats = await handle.stat().catch(() => undefined);
    if (!stats || !stats.isFile()) return undefined;
    // An earlier-attempt probe has its own cap and must not spend the final
    // attachment budget on a read it will discard.
    if (maxBytes !== undefined && stats.size > maxBytes) return undefined;
    if (stats.size > MAX_ATTACHMENT_BYTES) {
      throw new Error('Attachment is larger than 50 MB. Use a smaller asset.');
    }
    if (context.totalAttachmentBytes + stats.size > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new Error(
        'Attachments exceed 100 MB in total. Split the report or use smaller assets.',
      );
    }
    const data = await handle.readFile().catch(() => undefined);
    if (!data) return undefined;
    context.totalAttachmentBytes += stats.size;
    return {
      fileName: path.basename(candidate),
      mediaType: 'application/octet-stream',
      body: data.toString('base64'),
      contentEncoding: AttachmentContentEncoding.BASE64,
    };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function resolveAttachmentPath(
  file: string,
  context: PlanContext,
  onSkip?: (reason: AttachmentSkipReason) => void,
  maxBytes?: number,
): Promise<PlannedAttachment | undefined> {
  if (isNonLocalPath(file)) {
    if (onSkip) {
      context.skippedAttachments += 1;
      onSkip('non-local');
    }
    return undefined;
  }
  // Relative paths use the input directory first, then cwd for CI layouts where
  // reports/results.json and test-results/ are siblings.
  const candidates = path.isAbsolute(file)
    ? [file]
    : [path.resolve(context.inputDir, file), path.resolve(process.cwd(), file)];
  // Classify before reading: only a file that exists and resolves outside every
  // root is an outside skip. readAttachment repeats the type and root checks on
  // its own realpath before opening; a swap after that point is a TOCTOU the
  // adapter does not claim to close.
  let outside = 0;
  let unreadable = 0;
  let notRegular = 0;
  let missing = 0;
  for (const candidate of candidates) {
    const info = await lstat(candidate).catch(() => undefined);
    if (!info) {
      missing += 1;
      continue;
    }
    if (info.isSymbolicLink() || !info.isFile()) {
      notRegular += 1;
      continue;
    }
    const target = await realpath(candidate).catch(() => undefined);
    if (!target) {
      unreadable += 1;
      continue;
    }
    if (!context.roots.some((root) => isInside(root, target))) {
      outside += 1;
      continue;
    }
    const attachment = await readAttachment(candidate, context, maxBytes);
    if (attachment) return attachment;
    unreadable += 1;
  }
  // One attachment is skipped at most once; the first reason that explains a
  // lost read wins over a candidate that is merely absent. A probe without a
  // callback stays out of the run-level skip diagnostics.
  let reason: AttachmentSkipReason | undefined;
  if (unreadable > 0) reason = 'unreadable';
  else if (outside > 0) reason = 'outside';
  else if (notRegular > 0) reason = 'not-regular';
  else if (missing > 0) reason = 'missing';
  if (reason && onSkip) {
    context.skippedAttachments += 1;
    onSkip(reason);
  }
  return undefined;
}

// Only folds Playwright's documented markdown case here; the shared
// `src/attachment` module normalises and allow-lists media types.
function playwrightMediaType(mediaType: string): string {
  return mediaType.split(';', 1)[0]?.trim().toLowerCase() === 'text/markdown'
    ? 'text/plain'
    : mediaType;
}

// Inline final bodies spend the total attachment budget exactly like path reads,
// so the retry-evidence reserve sees the real remaining room.
function addInlineAttachmentBytes(context: PlanContext, body: string): void {
  context.totalAttachmentBytes += attachmentBytes({
    body,
    contentEncoding: AttachmentContentEncoding.BASE64,
  });
}

async function attachmentsForResult(
  result: PlaywrightResult,
  context: PlanContext,
): Promise<{
  attachments: PlannedAttachment[];
  skipped: number;
  skippedEntries: SkippedAttachment[];
}> {
  const planned: PlannedAttachment[] = [];
  const skippedEntries: SkippedAttachment[] = [];
  let skipped = 0;

  for (const attachment of result.attachments) {
    if (
      attachment.name.toLowerCase() === 'trace' &&
      attachment.contentType.toLowerCase().startsWith('application/zip')
    ) {
      // Trace zips are not readable in a report; keep them out of the budget.
      continue;
    }
    if (attachment.body !== undefined && attachment.body !== '') {
      addInlineAttachmentBytes(context, attachment.body);
      planned.push({
        fileName: attachment.name,
        mediaType: playwrightMediaType(attachment.contentType),
        body: attachment.body,
        contentEncoding: AttachmentContentEncoding.BASE64,
      });
      continue;
    }
    if (attachment.path === undefined) continue;
    const file = await resolveAttachmentPath(
      attachment.path,
      context,
      (reason) => {
        skipped += 1;
        if (skippedEntries.length < MAX_SKIP_ENTRIES) {
          skippedEntries.push({
            name: displayAttachmentName(attachment.name),
            reason,
          });
        }
      },
    );
    if (!file) continue;
    planned.push({
      ...file,
      fileName: attachment.name || file.fileName,
      mediaType: playwrightMediaType(attachment.contentType),
    });
  }

  for (const field of ['stdout', 'stderr'] as const) {
    for (const [index, output] of result[field].entries()) {
      if (output.text !== undefined) {
        const body = Buffer.from(output.text, 'utf8').toString('base64');
        addInlineAttachmentBytes(context, body);
        planned.push({
          fileName: `${field} ${index + 1}`,
          mediaType: 'text/plain',
          body,
          contentEncoding: AttachmentContentEncoding.BASE64,
        });
      } else if (output.buffer !== undefined) {
        addInlineAttachmentBytes(context, output.buffer);
        planned.push({
          fileName: `${field} ${index + 1} buffer`,
          mediaType: 'application/octet-stream',
          body: output.buffer,
          contentEncoding: AttachmentContentEncoding.BASE64,
        });
      }
    }
  }

  return { attachments: planned, skipped, skippedEntries };
}

// A read that races past a cap omits only the optional evidence; the final
// attachments and the run stay valid.
async function readRetryEvidence(
  attachment: PlaywrightAttachment,
  context: PlanContext,
): Promise<PlannedAttachment | undefined> {
  const remaining = MAX_RETRY_EVIDENCE_BYTES - context.retryEvidenceBytes;
  try {
    if (attachment.body !== undefined && attachment.body !== '') {
      const bytes = attachmentBytes({
        body: attachment.body,
        contentEncoding: AttachmentContentEncoding.BASE64,
      });
      if (
        !retryEvidenceFits(
          context.totalAttachmentBytes,
          context.retryEvidenceBytes,
          bytes,
        )
      ) {
        return undefined;
      }
      context.totalAttachmentBytes += bytes;
      context.retryEvidenceBytes += bytes;
      context.retryEvidenceImageUsed = true;
      return {
        fileName: attachment.name || 'retry-evidence',
        mediaType: playwrightMediaType(attachment.contentType),
        body: attachment.body,
        contentEncoding: AttachmentContentEncoding.BASE64,
      };
    }
    if (attachment.path === undefined) return undefined;
    const file = await resolveAttachmentPath(
      attachment.path,
      context,
      undefined,
      remaining,
    );
    if (!file) return undefined;
    const bytes = attachmentBytes(file);
    if (context.retryEvidenceBytes + bytes > MAX_RETRY_EVIDENCE_BYTES) {
      return undefined;
    }
    context.retryEvidenceBytes += bytes;
    context.retryEvidenceImageUsed = true;
    // The path reader intentionally returns the generic type; the declared one
    // is trusted only after the shared allow-list runs in the model.
    return {
      ...file,
      fileName: attachment.name || file.fileName,
      mediaType: playwrightMediaType(attachment.contentType),
    };
  } catch {
    return undefined;
  }
}

// Runs after every final attachment is planned, so final attachments always win
// the 100 MB budget. Only a single-input report reaches here; one image is read
// for the whole run, from the first failed displayed earlier attempt.
async function planRetryEvidence(context: PlanContext): Promise<void> {
  if (!context.allowRetryImages || context.retryEvidenceImageUsed) return;
  if (
    !retryEvidenceFits(
      context.totalAttachmentBytes,
      0,
      MAX_RETRY_EVIDENCE_BYTES,
    )
  ) {
    return;
  }

  for (const feature of context.featureOrder) {
    for (const rule of feature.order) {
      for (const plan of rule.scenarios) {
        const earlier = plan.attempts.slice(
          0,
          Math.max(0, plan.attempts.length - 1),
        );
        for (const attempt of earlier.slice(0, MAX_EARLIER_ATTEMPTS)) {
          if (!attempt.steps.some((step) => step.status === FAILED)) continue;
          for (const image of attempt.retryImages ?? []) {
            const planned = await readRetryEvidence(image, context);
            if (!planned) continue;
            attempt.attachments.push(planned);
            attempt.retryEvidence = true;
            return;
          }
          // The first failed displayed attempt has no usable image; later
          // attempts do not supply one.
          return;
        }
      }
    }
  }
}

function featureFor(
  context: PlanContext,
  project: string | undefined,
  file: string,
): FeaturePlan {
  const hasProject = Boolean(project);
  const name = project || file;
  const key = hasProject ? `project:${name}` : `file:${file}`;
  const existing = context.features.get(key);
  if (existing) return existing;
  const feature: FeaturePlan = {
    name,
    uri: hasProject
      ? `playwright://${context.idPrefix}/${encodeURIComponent(name)}`
      : `playwright://${context.idPrefix}/file/${encodeURIComponent(file)}`,
    rules: new Map(),
    order: [],
  };
  context.features.set(key, feature);
  context.featureOrder.push(feature);
  return feature;
}

function ruleFor(
  context: PlanContext,
  feature: FeaturePlan,
  name: string,
): RulePlan {
  const existing = feature.rules.get(name);
  if (existing) return existing;
  const rule: RulePlan = {
    id: context.nextId('rule'),
    name,
    scenarios: [],
  };
  feature.rules.set(name, rule);
  feature.order.push(rule);
  return rule;
}

async function scenarioPlan(
  context: PlanContext,
  feature: FeaturePlan,
  spec: PlaywrightSpec,
  test: PlaywrightTest,
  describes: string[],
  inheritedFile: string | undefined,
): Promise<ScenarioPlan> {
  const file = fileUri(inheritedFile, context.inputDir);
  const ruleName = [stripTrailingTags(file), ...describes]
    .filter(Boolean)
    .join(' › ');
  const rule = ruleFor(context, feature, ruleName || file);
  const name = stripTrailingTags(spec.title) || `Test ${rule.scenarios.length + 1}`;
  const results = test.results;
  const finalIndex =
    results.length > 0
      ? results.reduce(
          (best, candidate, index) =>
            candidate.retry >= (results[best] as PlaywrightResult).retry
              ? index
              : best,
          0,
        )
      : -1;
  const final = finalIndex >= 0 ? results[finalIndex] : undefined;
  const finalStatus = final?.status;
  // A skip marker never overrides a final failed or passed result.
  const skipped =
    finalStatus === 'skipped' ||
    (finalStatus === undefined &&
      (test.status === 'skipped' || test.expectedStatus === 'skipped'));
  const failedFinal =
    finalStatus !== undefined && FAILED_STATUSES.has(finalStatus);
  const passedFinal = finalStatus === 'passed';
  const expectsFailure = test.expectedStatus === 'failed';
  const expectedFailure =
    failedFinal &&
    test.expectedStatus !== 'skipped' &&
    (test.status === 'expected' || expectsFailure);
  const unexpectedPass =
    passedFinal &&
    (test.status === 'unexpected' ||
      expectsFailure ||
      test.expectedStatus === 'skipped');
  const flakyPass = passedFinal && test.status === 'flaky';
  const unexpectedPassMessage =
    test.expectedStatus === 'skipped'
      ? 'Unexpected pass: expected to be skipped, but passed.'
      : 'Unexpected pass: expected to fail, but passed.';

  const mode = expectedFailure
    ? 'expected-failure'
    : unexpectedPass
      ? 'unexpected-pass'
      : skipped
        ? 'skipped'
        : 'normal';
  const canonical = canonicalSteps(
    final,
    mode,
    context.inputDir,
    unexpectedPassMessage,
  );

  const tagNames: string[] = [];
  const addTag = (value: string): void => {
    const tagName = value.startsWith('@') ? value : `@${value}`;
    if (tagName.length > 1 && !tagNames.includes(tagName)) tagNames.push(tagName);
  };
  for (const tag of spec.tags) addTag(tag);
  for (const annotation of test.annotations) {
    if (KNOWN_ANNOTATIONS.has(annotation.type.toLowerCase())) {
      addTag(annotation.type);
    }
  }
  if (expectedFailure) addTag('expected-failure');
  if (unexpectedPass) addTag('unexpected-pass');
  if (flakyPass) addTag('flaky');

  const descriptionParts = test.annotations.map((annotation) =>
    annotation.description
      ? `Annotation: ${annotation.type} - ${annotation.description}`
      : `Annotation: ${annotation.type}`,
  );
  if (expectedFailure) {
    const text = resultErrorText(final, context.inputDir);
    if (text) descriptionParts.push(text);
  }
  if (unexpectedPass) {
    descriptionParts.push(unexpectedPassMessage);
  }

  const scenarioId = context.nextId('scenario');
  const stepNodes: Step[] = canonical.map((step) => ({
    id: context.nextId('step'),
    location: location(spec.line),
    keyword: '',
    text: step.text,
  }));
  const scenario: Scenario = {
    id: scenarioId,
    location: location(spec.line, spec.column),
    tags: tagNames.map((tag) => ({
      id: context.nextId('tag'),
      name: tag,
      location: location(spec.line),
    })),
    keyword: 'Scenario',
    name,
    description: descriptionParts.join('\n\n'),
    steps: stepNodes,
    examples: [],
  };

  const pickleSteps: PickleStep[] = stepNodes.map((step) => ({
    id: context.nextId('pickle-step'),
    text: step.text,
    astNodeIds: [step.id],
  }));
  const pickle: Pickle = {
    id: context.nextId('pickle'),
    uri: file,
    location: pickleLocation(spec.line, spec.column),
    name,
    language: 'en',
    steps: pickleSteps,
    tags: scenario.tags.map((tag) => ({
      name: tag.name,
      astNodeId: tag.id,
    })),
    astNodeIds: [scenarioId],
  };
  const testSteps: TestStep[] = pickleSteps.map((step) => ({
    id: context.nextId('test-step'),
    pickleStepId: step.id,
  }));
  const testCase: TestCase = {
    id: context.nextId('test-case'),
    pickleId: pickle.id,
    testSteps,
    testRunStartedId: context.runId,
  };

  // Register before the attachment reads: scenario collection starts every
  // async plan up front, so a later push could otherwise reorder the report.
  const plan: ScenarioPlan = { scenario, pickle, testCase, attempts: [] };
  rule.scenarios.push(plan);
  if (results.length === 0) {
    plan.attempts.push({
      attempt: 0,
      timestamp: context.runTimestamp,
      steps: skipped ? canonical : [],
      attachments: [],
      skippedAttachments: 0,
      skippedEntries: [],
      willBeRetried: false,
    });
  } else {
    for (const [index, result] of results.entries()) {
      const isFinal = index === finalIndex;
      // Final attachments are planned first across every scenario. An earlier
      // attempt keeps only its image references; the retry probe reads at most
      // one after all final reads have spent the budget.
      const finalAttachments = isFinal
        ? await attachmentsForResult(result, context)
        : undefined;
      plan.attempts.push({
        attempt: result.retry,
        timestamp: timestampOf(result.startTime, context.runTimestamp),
        steps: isFinal ? canonical : attemptSteps(result, context.inputDir),
        attachments: finalAttachments?.attachments ?? [],
        skippedAttachments: finalAttachments?.skipped ?? 0,
        skippedEntries: finalAttachments?.skippedEntries ?? [],
        willBeRetried: index < results.length - 1,
        ...(isFinal ? {} : { retryImages: imageAttachmentsOf(result) }),
      });
    }
  }

  return plan;
}

function collectScenarios(
  context: PlanContext,
  suite: PlaywrightSuite,
  describes: string[],
  file: string,
  inheritedFile: string | undefined,
): Array<() => Promise<void>> {
  const suiteFile = stripTrailingTags(suite.file ?? file);
  // The actual file named by the suite chain, if any; the fallback stays only
  // for a report where neither the spec nor a suite names a file.
  const suiteUriFile = suite.file ? stripTrailingTags(suite.file) : inheritedFile;
  const jobs: Array<() => Promise<void>> = [];

  for (const spec of suite.specs) {
    const specFile = stripTrailingTags(spec.file ?? suiteFile);
    const specUriFile = spec.file ? stripTrailingTags(spec.file) : suiteUriFile;
    for (const test of spec.tests) {
      const project = test.projectName || test.projectId;
      jobs.push(() =>
        scenarioPlan(
          context,
          featureFor(context, project, specFile),
          spec,
          test,
          describes,
          specUriFile,
        ).then(() => undefined),
      );
    }
  }

  for (const child of suite.suites) {
    const title = stripTrailingTags(child.title ?? '');
    const childFile = stripTrailingTags(child.file ?? suiteFile);
    const nextDescribes =
      title && title !== suiteFile && title !== childFile
        ? [...describes, title]
        : describes;
    jobs.push(
      ...collectScenarios(
        context,
        child,
        nextDescribes,
        childFile,
        suiteUriFile,
      ),
    );
  }

  return jobs;
}

function addErrorFeature(
  context: PlanContext,
  errors: unknown[],
): void {
  if (errors.length === 0) return;
  const feature: FeaturePlan = {
    name: 'Playwright',
    uri: `playwright://${context.idPrefix}/errors`,
    rules: new Map(),
    order: [],
  };
  for (const [index, value] of errors.entries()) {
    if (!isObject(value)) {
      throw invalid(context.source, `errors[${index}] must be an object.`);
    }
    const error = validateError(value, context.source, `errors[${index}]`);
    const name = `Run error ${index + 1}`;
    const message =
      errorText(error, context.inputDir) ?? 'Playwright reported a run error.';
    const scenarioId = context.nextId('scenario');
    const stepId = context.nextId('step');
    const scenario: Scenario = {
      id: scenarioId,
      location: location(1),
      tags: [],
      keyword: 'Scenario',
      name,
      description: '',
      steps: [{ id: stepId, location: location(1), keyword: '', text: 'Playwright error' }],
      examples: [],
    };
    const pickleStep: PickleStep = {
      id: context.nextId('pickle-step'),
      text: 'Playwright error',
      astNodeIds: [stepId],
    };
    const pickle: Pickle = {
      id: context.nextId('pickle'),
      uri: `playwright://${context.idPrefix}/errors`,
      // The pseudo-file has no source line; the AST placeholder stays at 1.
      location: pickleLocation(),
      name,
      language: 'en',
      steps: [pickleStep],
      tags: [],
      astNodeIds: [scenarioId],
    };
    const testStep: TestStep = {
      id: context.nextId('test-step'),
      pickleStepId: pickleStep.id,
    };
    const testCase: TestCase = {
      id: context.nextId('test-case'),
      pickleId: pickle.id,
      testSteps: [testStep],
      testRunStartedId: context.runId,
    };
    const plan: ScenarioPlan = {
      scenario,
      pickle,
      testCase,
      attempts: [
        {
          attempt: 0,
          timestamp: context.runTimestamp,
          steps: [{ text: 'Playwright error', durationMs: 0, status: FAILED, message }],
          attachments: [],
          skippedAttachments: 0,
          skippedEntries: [],
          willBeRetried: false,
        },
      ],
    };
    const rule = ruleFor(context, feature, 'Playwright');
    rule.scenarios.push(plan);
  }
  context.features.set('errors', feature);
  context.featureOrder.push(feature);
}

function featureDocument(feature: FeaturePlan): Feature {
  const children: FeatureChild[] = feature.order.map((plan) => {
    const rule: Rule = {
      id: plan.id,
      location: location(1),
      tags: [],
      keyword: 'Rule',
      name: plan.name,
      description: '',
      children: plan.scenarios.map((scenario): RuleChild => ({
        scenario: scenario.scenario,
      })),
    };
    return { rule };
  });
  return {
    location: location(1),
    tags: [],
    language: 'en',
    keyword: 'Feature',
    name: feature.name,
    description: '',
    children,
  };
}

/**
 * Normalises a Playwright JSON reporter file into Cucumber Messages. It builds
 * the envelopes directly so retries stay separate attempts; the latest attempt
 * is the rendered result.
 */
export async function parsePlaywrightJson(
  parsed: unknown,
  source: string,
  options: PlaywrightJsonOptions = {},
): Promise<PlaywrightParseResult> {
  if (!isObject(parsed)) {
    throw invalid(source, 'expected a Playwright report object.');
  }
  if (!isObject(parsed.config)) {
    throw invalid(source, 'config must be an object.');
  }
  if (!isObject(parsed.stats)) {
    throw invalid(source, 'stats must be an object.');
  }
  if (parsed.suites !== undefined && !Array.isArray(parsed.suites)) {
    throw invalid(source, 'suites must be an array.');
  }
  if (parsed.errors !== undefined && !Array.isArray(parsed.errors)) {
    throw invalid(source, 'errors must be an array.');
  }

  const idPrefix = options.idPrefix ?? 'playwright';
  let counter = 0;
  const nextId = (kind: string): string => `${idPrefix}-${kind}-${counter++}`;
  const runId = nextId('run');

  const startTime = optionalString(parsed.stats, 'startTime', source, 'stats');
  const startMs = startTime ? Date.parse(startTime) : Number.NaN;
  const runTimestamp = timestamp(Number.isFinite(startMs) ? startMs : 0);
  const sourcePath = path.resolve(source);
  const inputDir = await realpath(sourcePath)
    .then((resolved) => path.dirname(resolved))
    .catch(() => path.dirname(sourcePath));
  const roots: string[] = [];
  for (const root of [inputDir, process.cwd()]) {
    try {
      roots.push(await realpath(root));
    } catch {
      roots.push(path.resolve(root));
    }
  }

  const context: PlanContext = {
    source,
    idPrefix,
    inputDir,
    roots,
    nextId,
    totalAttachmentBytes: 0,
    allowRetryImages: options.allowRetryImages ?? true,
    retryEvidenceBytes: 0,
    retryEvidenceImageUsed: false,
    features: new Map(),
    featureOrder: [],
    runId,
    runTimestamp,
    skippedAttachments: 0,
  };

  const suites = (parsed.suites ?? []) as unknown[];
  const rootsSuites = suites.map((suite, index) =>
    validateSuite(suite, source, `suites[${index}]`),
  );

  for (const suite of rootsSuites) {
    const file = stripTrailingTags(suite.file ?? suite.title ?? 'playwright.spec.ts');
    const inheritedFile = suite.file ? stripTrailingTags(suite.file) : undefined;
    // Await in collection order so I/O timing cannot reorder scenarios.
    for (const job of collectScenarios(context, suite, [], file, inheritedFile)) {
      await job();
    }
  }

  await planRetryEvidence(context);

  addErrorFeature(context, Array.isArray(parsed.errors) ? parsed.errors : []);

  const featureEnvelopes: Envelope[][] = [];

  for (const feature of context.featureOrder) {
    const envelopes: Envelope[] = [
      {
        gherkinDocument: {
          uri: feature.uri,
          feature: featureDocument(feature),
          comments: [],
        },
      },
    ];
    for (const rule of feature.order) {
      for (const plan of rule.scenarios) {
        envelopes.push({ pickle: plan.pickle });
        envelopes.push({ testCase: plan.testCase });
        for (const attempt of plan.attempts) {
          const startedId = nextId('test-case-started');
          const started: TestCaseStarted = {
            id: startedId,
            testCaseId: plan.testCase.id,
            attempt: attempt.attempt,
            timestamp: attempt.timestamp,
          };
          if (
            attempt.skippedAttachments > 0 ||
            attempt.skippedEntries.length > 0
          ) {
            recordSkippedAttachments(
              started,
              attempt.skippedAttachments,
              attempt.skippedEntries,
            );
          }
          envelopes.push({
            testCaseStarted: started,
          });
          let clock = attempt.timestamp;
          const count = Math.min(attempt.steps.length, plan.testCase.testSteps.length);
          for (let index = 0; index < count; index += 1) {
            const testStep = plan.testCase.testSteps[index] as TestStep;
            const step = attempt.steps[index] as CanonicalStep;
            envelopes.push({
              testStepStarted: {
                testCaseStartedId: startedId,
                testStepId: testStep.id,
                timestamp: clock,
              },
            });
            const duration = durationOf(step.durationMs);
            const result: TestStepResult = {
              status: step.status,
              duration,
            };
            if (step.message) result.message = step.message;
            clock = addDuration(clock, step.durationMs);
            envelopes.push({
              testStepFinished: {
                testCaseStartedId: startedId,
                testStepId: testStep.id,
                testStepResult: result,
                timestamp: clock,
              },
            });
          }
          for (const attachment of attempt.attachments) {
            const envelope: Attachment = {
              ...attachment,
              testCaseStartedId: startedId,
              timestamp: clock,
            };
            if (attempt.retryEvidence) markRetryEvidence(envelope);
            envelopes.push({ attachment: envelope });
          }
          envelopes.push({
            testCaseFinished: {
              testCaseStartedId: startedId,
              timestamp: clock,
              willBeRetried: attempt.willBeRetried,
            },
          });
        }
      }
    }
    featureEnvelopes.push(envelopes);
  }

  const meta: Meta = {
    protocolVersion: '',
    implementation: {
      name: 'Playwright',
      ...(typeof parsed.config.version === 'string'
        ? { version: parsed.config.version }
        : {}),
    },
    runtime: { name: '' },
    os: { name: '' },
    cpu: { name: '' },
  };
  const envelopes: Envelope[] = [
    { meta },
    { testRunStarted: { id: runId, timestamp: runTimestamp } },
  ];
  for (const feature of featureEnvelopes) {
    for (const envelope of feature) envelopes.push(envelope);
  }

  const duration = optionalNumber(parsed.stats, 'duration', source, 'stats') ?? 0;
  const success = !envelopes.some(
    (envelope) => envelope.testStepFinished?.testStepResult.status === FAILED,
  );
  envelopes.push({
    testRunFinished: {
      testRunStartedId: runId,
      success,
      timestamp: addDuration(runTimestamp, duration),
    },
  });

  return { envelopes, skippedAttachments: context.skippedAttachments };
}
