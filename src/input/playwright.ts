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
  TestStep,
  TestStepResult,
  Timestamp,
} from '@cucumber/messages';
import { stripAnsi } from '../text.js';

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 100 * 1024 * 1024;
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
  willBeRetried: boolean;
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
  features: Map<string, FeaturePlan>;
  featureOrder: FeaturePlan[];
  runId: string;
  runTimestamp: Timestamp;
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
    error.location = {
      file: optionalString(value.location, 'file', source, `${where}.location`),
      line: optionalNumber(value.location, 'line', source, `${where}.location`),
      column: optionalNumber(value.location, 'column', source, `${where}.location`),
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
    const normalized = file.replace(/\\/g, '/').replace(/^\.\//, '');
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
      return relative.replace(/\\/g, '/');
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

const ABSOLUTE_LOCAL_PATH = /(?:[A-Za-z]:[\\/]|\/Users\/|\/home\/)[^\s"'<>|]+/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  return scrubbed.replace(ABSOLUTE_LOCAL_PATH, (match) =>
    path.basename(match.replace(/\\/g, '/')),
  );
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
  if (at) parts.push(`at ${at}`);
  return parts.filter(Boolean).join('\n\n') || undefined;
}

function resultErrorText(
  result: PlaywrightResult | undefined,
  inputDir: string,
): string | undefined {
  const texts: string[] = [];
  for (const error of [result?.error, ...(result?.errors ?? [])]) {
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
      message: 'Unexpected pass: expected to fail, but passed.',
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

const NON_LOCAL_PATH = /^(?:https?|file):/i;

// Reject URL schemes and UNC/device paths before any lstat, so a crafted JSON
// report cannot make the adapter touch an SMB or device path.
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
): Promise<PlannedAttachment | undefined> {
  if (isNonLocalPath(file)) return undefined;
  // Relative paths use the input directory first, then cwd for CI layouts where
  // reports/results.json and test-results/ are siblings.
  const candidates = path.isAbsolute(file)
    ? [file]
    : [path.resolve(context.inputDir, file), path.resolve(process.cwd(), file)];
  for (const candidate of candidates) {
    const attachment = await readAttachment(candidate, context);
    if (attachment) return attachment;
  }
  return undefined;
}

// Only folds Playwright's documented markdown case here; the report layer
// normalises and allow-lists media types in report/attachment.ts.
function playwrightMediaType(mediaType: string): string {
  return mediaType.split(';', 1)[0]?.trim().toLowerCase() === 'text/markdown'
    ? 'text/plain'
    : mediaType;
}

async function attachmentsForResult(
  result: PlaywrightResult,
  context: PlanContext,
): Promise<PlannedAttachment[]> {
  const planned: PlannedAttachment[] = [];

  for (const attachment of result.attachments) {
    if (
      attachment.name.toLowerCase() === 'trace' &&
      attachment.contentType.toLowerCase().startsWith('application/zip')
    ) {
      // Trace zips are not readable in a report; keep them out of the budget.
      continue;
    }
    if (attachment.body !== undefined && attachment.body !== '') {
      planned.push({
        fileName: attachment.name,
        mediaType: playwrightMediaType(attachment.contentType),
        body: attachment.body,
        contentEncoding: AttachmentContentEncoding.BASE64,
      });
      continue;
    }
    if (attachment.path === undefined) continue;
    const file = await resolveAttachmentPath(attachment.path, context);
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
        planned.push({
          fileName: `${field} ${index + 1}`,
          mediaType: 'text/plain',
          body: Buffer.from(output.text, 'utf8').toString('base64'),
          contentEncoding: AttachmentContentEncoding.BASE64,
        });
      } else if (output.buffer !== undefined) {
        planned.push({
          fileName: `${field} ${index + 1} buffer`,
          mediaType: 'application/octet-stream',
          body: output.buffer,
          contentEncoding: AttachmentContentEncoding.BASE64,
        });
      }
    }
  }

  return planned;
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
): Promise<ScenarioPlan> {
  const file = fileUri(spec.file, context.inputDir);
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
            candidate.retry > (results[best] as PlaywrightResult).retry ? index : best,
          0,
        )
      : -1;
  const final = finalIndex >= 0 ? results[finalIndex] : undefined;
  const finalStatus = final?.status;
  const skipped =
    test.status === 'skipped' ||
    test.expectedStatus === 'skipped' ||
    finalStatus === 'skipped';
  const failedFinal =
    finalStatus !== undefined && FAILED_STATUSES.has(finalStatus);
  const passedFinal = finalStatus === 'passed';
  const expectsFailure = test.expectedStatus === 'failed';
  const expectedFailure =
    failedFinal && (test.status === 'expected' || expectsFailure);
  const unexpectedPass =
    passedFinal && (test.status === 'unexpected' || expectsFailure);
  const flakyPass = passedFinal && test.status === 'flaky';

  const mode = expectedFailure
    ? 'expected-failure'
    : unexpectedPass
      ? 'unexpected-pass'
      : skipped
        ? 'skipped'
        : 'normal';
  const canonical = canonicalSteps(final, mode, context.inputDir);

  const tagNames: string[] = [];
  const addTag = (value: string): void => {
    const name = value.startsWith('@') ? value : `@${value}`;
    if (name.length > 1 && !tagNames.includes(name)) tagNames.push(name);
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
    descriptionParts.push('Unexpected pass: expected to fail, but passed.');
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
    location: location(spec.line, spec.column),
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
      willBeRetried: false,
    });
  } else {
    for (const [index, result] of results.entries()) {
      const isFinal = index === finalIndex;
      plan.attempts.push({
        attempt: result.retry,
        timestamp: timestampOf(result.startTime, context.runTimestamp),
        steps: isFinal ? canonical : attemptSteps(result, context.inputDir),
        // Earlier attempts are never rendered; reading their attachments would
        // spend the total byte budget twice per retry.
        attachments: isFinal ? await attachmentsForResult(result, context) : [],
        willBeRetried: index < results.length - 1,
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
): Array<() => Promise<void>> {
  const suiteFile = stripTrailingTags(suite.file ?? file);
  const jobs: Array<() => Promise<void>> = [];

  for (const spec of suite.specs) {
    const specFile = stripTrailingTags(spec.file ?? suiteFile);
    for (const test of spec.tests) {
      const project = test.projectName || test.projectId;
      jobs.push(() =>
        scenarioPlan(
          context,
          featureFor(context, project, specFile),
          spec,
          test,
          describes,
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
    jobs.push(...collectScenarios(context, child, nextDescribes, childFile));
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
      location: location(1),
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
): Promise<Envelope[]> {
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
    features: new Map(),
    featureOrder: [],
    runId,
    runTimestamp,
  };

  const suites = (parsed.suites ?? []) as unknown[];
  const rootsSuites = suites.map((suite, index) =>
    validateSuite(suite, source, `suites[${index}]`),
  );

  for (const suite of rootsSuites) {
    const file = stripTrailingTags(suite.file ?? suite.title ?? 'playwright.spec.ts');
    // Await in collection order so I/O timing cannot reorder scenarios.
    for (const job of collectScenarios(context, suite, [], file)) await job();
  }

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
          envelopes.push({
            testCaseStarted: {
              id: startedId,
              testCaseId: plan.testCase.id,
              attempt: attempt.attempt,
              timestamp: attempt.timestamp,
            },
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

  return envelopes;
}
