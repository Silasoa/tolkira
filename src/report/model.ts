import { getWorstTestStepResult } from '@cucumber/messages';
import type {
  Attachment,
  Background,
  Ci,
  Envelope,
  FeatureChild,
  Rule,
  RuleChild,
  Step,
  TestCaseStarted,
} from '@cucumber/messages';

import {
  MAX_RETRY_EVIDENCE_BYTES,
  attachmentMetadata,
  type AttachmentKind,
  type AttachmentTextFormat,
} from '../attachment.js';
import type { BaselineChange } from '../baseline.js';
import {
  isRetryEvidence,
  skippedAttachmentEntriesOf,
  skippedAttachmentsOf,
  type SkippedAttachment,
} from '../attempt-diagnostics.js';
import { isSyntheticBackground } from '../input/background.js';
import { stepResultMessage } from '../result-message.js';
import { displayUri } from '../summary.js';
import { stripAnsi, stripBidiControls } from '../text.js';
import {
  indexRun,
  renderedCaseAttachments,
  type RunIndex,
  type RunStepDefinition,
} from './index-run.js';
import { type ReportStatus, worstExecutedStatus } from './status.js';

export type { ReportStatus } from './status.js';

export interface ReportAttachment {
  fileName: string;
  mediaType: string;
  kind: AttachmentKind;
  /** Internal text presentation; never written to HTML or the summary. */
  textFormat: AttachmentTextFormat;
  dataUri?: string;
  text?: string;
  bytes: number;
}

export interface ReportStep {
  id: string;
  order: number;
  keyword: string;
  text: string;
  status: ReportStatus;
  durationMs: number;
  message?: string;
  docString?: string;
  dataTable?: string[][];
  suggestions?: Array<{ language?: string; code: string }>;
  definitions?: Array<{ pattern: string; source?: string }>;
  parameters?: Array<{ start: number; value: string; type: string }>;
  attachments: ReportAttachment[];
}

export interface ReportHook {
  id: string;
  order: number;
  type: string;
  name?: string;
  status: ReportStatus;
  durationMs: number;
  message?: string;
  attachments: ReportAttachment[];
}

export interface ReportRunHook {
  id: string;
  type: string;
  name?: string;
  status: ReportStatus;
  durationMs: number;
  message?: string;
  attachments: ReportAttachment[];
}

export interface ReportOutline {
  id: string;
  keyword: string;
  name: string;
  description: string;
  tags: string[];
  examplesId: string;
  examplesKeyword: string;
  examplesName: string;
  examplesDescription: string;
  examplesTags: string[];
  examplesIndex: number;
  exampleIndex: number;
}

export interface ReportBackground {
  id: string;
  keyword: string;
  name: string;
  description: string;
}

export interface ReportRule {
  id: string;
  keyword: string;
  name: string;
  description: string;
  tags: string[];
  backgrounds: ReportBackground[];
}

export interface ReportEarlierAttempt {
  /** Display number from the executed earlier starts, oldest first. */
  attempt: number;
  status: ReportStatus;
  durationMs: number;
  message?: string;
  attachments: ReportAttachment[];
}

export interface ReportScenario {
  id: string;
  name: string;
  keyword: string;
  description: string;
  uri: string;
  /** Pickle location line; render metadata only, never in the summary. */
  line?: number;
  featureName: string;
  ruleName?: string;
  rule?: ReportRule;
  status: ReportStatus;
  /** True when the selected test case reported at least one raw result. */
  executed: boolean;
  /** Baseline classification joined by pickle id; absent without a baseline. */
  change?: BaselineChange;
  durationMs: number;
  attempt: number;
  startedAt?: string;
  /** Scenario tags from the AST; examples-block tags for outline rows. */
  ownTags: string[];
  /** Inherited pickle tags, kept for filtering and search. */
  tags: string[];
  outline?: ReportOutline;
  steps: ReportStep[];
  hooks: ReportHook[];
  attachments: ReportAttachment[];
  extraAttachments: ReportAttachment[];
  /** Path attachments skipped on this scenario's final attempt. */
  skippedAttachments?: number;
  /** Up to three sanitized names and reasons for those skips. */
  skippedAttachmentEntries?: SkippedAttachment[];
  /** Up to three executed earlier attempts, oldest first; report-only. */
  earlierAttempts?: ReportEarlierAttempt[];
  /** Executed earlier attempts before the three-item display cap. */
  earlierAttemptTotal?: number;
}

export interface ReportFeature {
  id: string;
  name: string;
  keyword: string;
  uri: string;
  description: string;
  tags: string[];
  backgrounds: ReportBackground[];
  status: ReportStatus;
  durationMs: number;
  scenarios: ReportScenario[];
  attachments: number;
  sourceFile?: string;
}

export interface ReportCounts {
  features: number;
  scenarios: Record<ReportStatus, number> & { total: number };
  steps: Record<ReportStatus, number> & { total: number };
  hooks: Record<ReportStatus, number> & { total: number };
  attachments: number;
  attachmentBytes: number;
}

export interface ReportCi {
  name?: string;
  url?: string;
  remote?: string;
  revision?: string;
  branch?: string;
  tag?: string;
}

export interface ReportEnvironment {
  producer?: string;
  runtime?: string;
  os?: string;
  cpu?: string;
  protocol?: string;
  ci?: ReportCi;
}

export interface ReportModel {
  features: ReportFeature[];
  counts: ReportCounts;
  durationMs: number;
  startedAt?: string;
  finishedAt?: string;
  source: string;
  environment?: ReportEnvironment;
  scenarios: ReportScenario[];
  runHooks: ReportRunHook[];
  runAttachments: ReportAttachment[];
}

const VALID_STATUS = new Set<ReportStatus>([
  'passed',
  'failed',
  'skipped',
  'pending',
  'undefined',
  'ambiguous',
  'unknown',
]);

function statusOf(status: unknown): ReportStatus {
  const value = typeof status === 'string' ? status.toLowerCase() : '';
  return VALID_STATUS.has(value as ReportStatus)
    ? (value as ReportStatus)
    : 'unknown';
}

function durationMs(duration: { seconds: number; nanos: number } | undefined): number {
  if (!duration) return 0;
  const seconds = Number.isFinite(duration.seconds) ? duration.seconds : 0;
  const nanos = Number.isFinite(duration.nanos) ? duration.nanos : 0;
  const milliseconds = seconds * 1000 + nanos / 1_000_000;
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return 0;
  const rounded = Math.round(milliseconds * 1000) / 1000;
  return Number.isFinite(rounded) ? rounded : 0;
}

function finiteDuration(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isFinite(rounded) ? rounded : 0;
}

export function positiveLine(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

// Only a trusted, serialisable count may reach the report; malformed Messages
// must never fabricate a notice.
function safePositiveInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : 0;
}

function timestampIso(
  timestamp: { seconds: number; nanos: number } | undefined,
): string | undefined {
  if (!timestamp) return undefined;
  // A zero-seconds timestamp is the adapter's unknown fallback, not 1970.
  if (timestamp.seconds === 0) return undefined;
  const milliseconds = timestamp.seconds * 1000 + timestamp.nanos / 1_000_000;
  if (!Number.isFinite(milliseconds)) return undefined;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').replace(/\r\n/g, '\n');
}

function productLabel(
  product: { name?: string; version?: string } | undefined,
): string | undefined {
  if (!product) return undefined;
  const label = [product.name, product.version].filter(Boolean).join(' ');
  return label || undefined;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = stripBidiControls(value ?? '').trim();
  return trimmed ? trimmed : undefined;
}

function ciFromMeta(ci: Ci | undefined): ReportCi | undefined {
  if (!ci) return undefined;
  const git = ci.git;
  const name = nonEmpty(ci.name);
  const url = nonEmpty(ci.url);
  const remote = nonEmpty(git?.remote);
  const revision = nonEmpty(git?.revision);
  const branch = nonEmpty(git?.branch);
  const tag = nonEmpty(git?.tag);
  const result: ReportCi = {
    ...(name ? { name } : {}),
    ...(url ? { url } : {}),
    ...(remote ? { remote } : {}),
    ...(revision ? { revision } : {}),
    ...(branch ? { branch } : {}),
    ...(tag ? { tag } : {}),
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

function hookLabel(type: string | undefined): string {
  switch (type) {
    case 'BEFORE_TEST_CASE':
      return 'Before';
    case 'AFTER_TEST_CASE':
      return 'After';
    case 'BEFORE_TEST_STEP':
      return 'BeforeStep';
    case 'AFTER_TEST_STEP':
      return 'AfterStep';
    case 'BEFORE_TEST_RUN':
      return 'BeforeAll';
    case 'AFTER_TEST_RUN':
      return 'AfterAll';
    default:
      return 'Hook';
  }
}

function mediaDataUri(mediaType: string, body: string): string {
  try {
    return `data:${mediaType};charset=utf-8,${encodeURIComponent(body)}`;
  } catch {
    // A lone UTF-16 surrogate cannot be percent-encoded; keep the media inline.
    return `data:${mediaType};base64,${Buffer.from(body, 'utf8').toString('base64')}`;
  }
}

function toAttachment(attachment: Attachment): ReportAttachment {
  const body = attachment.body ?? '';
  const { fileName, mediaType, kind, bytes, textFormat } =
    attachmentMetadata(attachment);
  const isBase64 = attachment.contentEncoding === 'BASE64';

  if (kind === 'image' || kind === 'video' || kind === 'audio') {
    return {
      fileName,
      mediaType,
      kind,
      textFormat,
      bytes,
      ...(body
        ? {
            dataUri: isBase64
              ? `data:${mediaType};base64,${body}`
              : mediaDataUri(mediaType, body),
          }
        : {}),
    };
  }

  if (isBase64) {
    const decoded = Buffer.from(body, 'base64').toString('utf8');
    return {
      fileName,
      mediaType,
      kind,
      textFormat,
      bytes,
      text: kind === 'text' ? decoded : undefined,
      dataUri: kind === 'binary' ? `data:${mediaType};base64,${body}` : undefined,
    };
  }

  return {
    fileName,
    mediaType,
    kind,
    textFormat,
    bytes,
    text: body,
  };
}

function stepData(step: Step | undefined): {
  keyword: string;
  docString?: string;
  dataTable?: string[][];
} {
  if (!step) return { keyword: '' };
  return {
    keyword: (step.keyword ?? '').trim(),
    ...(step.docString?.content !== undefined
      ? { docString: normalizeText(step.docString.content) }
      : {}),
    ...(step.dataTable
      ? {
          dataTable: step.dataTable.rows.map((row) =>
            row.cells.map((cell) => cell.value),
          ),
        }
      : {}),
  };
}

function emptyStatusCounts(): Record<ReportStatus, number> & { total: number } {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
    undefined: 0,
    ambiguous: 0,
    unknown: 0,
  };
}

function count(counts: Record<ReportStatus, number> & { total: number }, status: ReportStatus): void {
  counts.total += 1;
  counts[status] += 1;
}

function backgroundRow(background: Background): ReportBackground | undefined {
  if (isSyntheticBackground(background)) return undefined;
  return {
    id: background.id,
    keyword: background.keyword || 'Background',
    name: background.name ?? '',
    description: normalizeText(background.description),
  };
}

function backgroundsOf(
  children: readonly (FeatureChild | RuleChild)[] | undefined,
): ReportBackground[] {
  const rows: ReportBackground[] = [];
  for (const child of children ?? []) {
    if (!child.background) continue;
    const row = backgroundRow(child.background);
    if (row) rows.push(row);
  }
  return rows;
}

function ruleMetadata(rule: Rule): ReportRule {
  return {
    id: rule.id,
    keyword: rule.keyword || 'Rule',
    name: rule.name ?? '',
    description: normalizeText(rule.description),
    tags: (rule.tags ?? []).map((tag) => tag.name),
    backgrounds: backgroundsOf(rule.children ?? []),
  };
}

export function buildReportModel(
  envelopes: Envelope[],
  provenance?: Map<string, string>,
  index: RunIndex = indexRun(envelopes),
): ReportModel {
  const attachmentCache = new Map<Attachment, ReportAttachment>();
  const ruleCache = new Map<Rule, ReportRule>();
  let startedAt: string | undefined;
  let finishedAt: string | undefined;
  let source = 'Cucumber';
  let environment: ReportEnvironment | undefined;

  for (const envelope of envelopes) {
    if (envelope.meta) {
      const { implementation, runtime, os, cpu, protocolVersion } = envelope.meta;
      source = productLabel(implementation) ?? 'Cucumber';
      // The first non-empty CI block wins; later or legacy-synthesized meta
      // must not erase it.
      const ci = environment?.ci ?? ciFromMeta(envelope.meta.ci);
      const next: ReportEnvironment = {
        ...(implementation && productLabel(implementation)
          ? { producer: productLabel(implementation) }
          : {}),
        ...(runtime && productLabel(runtime) ? { runtime: productLabel(runtime) } : {}),
        ...(os && productLabel(os) ? { os: productLabel(os) } : {}),
        ...(cpu && productLabel(cpu) ? { cpu: productLabel(cpu) } : {}),
        ...(protocolVersion ? { protocol: protocolVersion } : {}),
        ...(ci ? { ci } : {}),
      };
      if (Object.keys(next).length > 0) environment = next;
    }
    if (envelope.testRunStarted?.timestamp) {
      const iso = timestampIso(envelope.testRunStarted.timestamp);
      if (iso && (!startedAt || iso < startedAt)) startedAt = iso;
    }
    if (envelope.testRunFinished?.timestamp) {
      const iso = timestampIso(envelope.testRunFinished.timestamp);
      if (iso && (!finishedAt || iso > finishedAt)) finishedAt = iso;
    }
  }

  const mapAttachments = (list: Attachment[]): ReportAttachment[] =>
    list.map((attachment) => {
      const cached = attachmentCache.get(attachment);
      if (cached) return cached;
      const mapped = toAttachment(attachment);
      attachmentCache.set(attachment, mapped);
      return mapped;
    });

  const MAX_EARLIER_ATTEMPTS = 3;
  let earlierImageUsed = false;
  let earlierImageBytes = 0;

  // Earlier starts stay report-only: the final attempt remains the scenario,
  // summary and history result. Display numbers come from executed envelope
  // order, not the raw attempt value.
  const earlierAttemptsFor = (
    pickleId: string,
    latest: TestCaseStarted,
  ): { rows: ReportEarlierAttempt[]; total: number } => {
    let total = 0;
    const rows: ReportEarlierAttempt[] = [];
    for (const start of index.allAttempts.get(pickleId) ?? []) {
      if (start.id === latest.id) continue;
      const results = index.results.get(start.id) ?? [];
      if (results.length === 0) continue;
      total += 1;
      if (rows.length >= MAX_EARLIER_ATTEMPTS) continue;
      const stepResults = results.map((entry) => entry.testStepResult);
      const status = statusOf(getWorstTestStepResult(stepResults).status);
      const rawMessage = results
        .map((entry) => entry.testStepResult)
        .filter((result) => statusOf(result.status) === 'failed')
        .map((result) => stepResultMessage(result))
        .find((text): text is string => Boolean(text?.trim()));
      const attachments: ReportAttachment[] = [];
      if (!earlierImageUsed && status === 'failed') {
        const image = mapAttachments(
          (index.caseAttachments.get(start.id) ?? []).filter(isRetryEvidence),
        ).find((candidate) => candidate.kind === 'image');
        if (
          image &&
          earlierImageBytes + image.bytes <= MAX_RETRY_EVIDENCE_BYTES
        ) {
          earlierImageUsed = true;
          earlierImageBytes += image.bytes;
          attachments.push(image);
        }
      }
      rows.push({
        attempt: rows.length + 1,
        status,
        durationMs: finiteDuration(
          results.reduce(
            (sum, entry) => sum + durationMs(entry.testStepResult.duration),
            0,
          ),
        ),
        ...(rawMessage
          ? { message: stripBidiControls(stripAnsi(rawMessage)).trim() }
          : {}),
        attachments,
      });
    }
    return { rows, total };
  };

  const ruleOf = (rule: Rule | undefined): ReportRule | undefined => {
    if (!rule) return undefined;
    const cached = ruleCache.get(rule);
    if (cached) return cached;
    const metadata = ruleMetadata(rule);
    ruleCache.set(rule, metadata);
    return metadata;
  };

  const featureOrder = index.featureDocuments.map((document) => document.feature);
  const featureUris = new Map(
    index.featureDocuments.map((document) => [document.feature, document.uri]),
  );
  const scenarioRows: ReportScenario[] = [];
  const scenarioCounts = emptyStatusCounts();
  const stepCounts = emptyStatusCounts();
  const hookCounts = emptyStatusCounts();
  const featureScenarios = new Map<
    (typeof featureOrder)[number],
    ReportScenario[]
  >();

  for (const pickle of index.pickles.values()) {
    // The latest started attempt wins, even when it reported nothing: an
    // earlier retried attempt must not mask a later unexecuted one.
    const latest = index.attempts.get(pickle.id);
    if (!latest) continue;

    const testCase = index.testCases.get(latest.testCaseId);
    if (!testCase) continue;
    const pickleSteps = new Map(pickle.steps.map((step) => [step.id, step]));
    const rawResults = (index.results.get(latest.id) ?? []).map(
      (entry) => entry.testStepResult,
    );
    const executed = rawResults.length > 0;
    // An unexecuted attempt contributes no attachment, even when the runner
    // emitted an attachment envelope for it.
    const startedAttachments = executed
      ? renderedCaseAttachments(index, testCase, latest.id)
      : [];
    const resultsByStep = new Map(
      (index.results.get(latest.id) ?? []).map((entry) => [
        entry.testStepId,
        entry.testStepResult,
      ]),
    );
    const stepRows: ReportStep[] = [];
    const hookRows: ReportHook[] = [];
    let testStepOrder = 0;

    for (const testStep of testCase.testSteps) {
      const result = resultsByStep.get(testStep.id);
      if (!result) continue;

      if (testStep.pickleStepId) {
        const pickleStep = pickleSteps.get(testStep.pickleStepId);
        const ast = pickleStep?.astNodeIds[0];
        const data = stepData(ast ? index.steps.get(ast) : undefined);
        const stepAttachments = mapAttachments(
          startedAttachments.filter((attachment) => attachment.testStepId === testStep.id),
        );
        const message = stepResultMessage(result);
        const stepSuggestions =
          index.suggestions.get(testStep.pickleStepId) ?? [];
        const definitionIds = Array.isArray(testStep.stepDefinitionIds)
          ? testStep.stepDefinitionIds
          : [];
        const stepMatches = definitionIds
          .map((id) => index.definitions.get(id))
          .filter(
            (definition): definition is RunStepDefinition =>
              Boolean(definition),
          )
          .map(({ pattern, uri, line }) => ({
            pattern,
            ...(uri ? (line ? { source: `${uri}:${line}` } : { source: uri }) : {}),
          }));
        const matchLists = testStep.stepMatchArgumentsLists ?? [];
        const parameters: Array<{ start: number; value: string; type: string }> =
          [];
        if (matchLists.length === 1) {
          for (const argument of matchLists[0]?.stepMatchArguments ?? []) {
            const start = argument.group?.start;
            const value = argument.group?.value;
            if (
              typeof start !== 'number' ||
              !Number.isFinite(start) ||
              typeof value !== 'string' ||
              value.length === 0
            ) {
              continue;
            }
            parameters.push({
              start,
              value,
              type: argument.parameterTypeName || 'anonymous',
            });
          }
        }
        stepRows.push({
          id: testStep.id,
          order: testStepOrder++,
          keyword: data.keyword,
          text: pickleStep?.text ?? '',
          status: statusOf(result.status),
          durationMs: durationMs(result.duration),
          ...(message ? { message: stripAnsi(message) } : {}),
          ...(data.docString ? { docString: data.docString } : {}),
          ...(data.dataTable ? { dataTable: data.dataTable } : {}),
          ...(stepSuggestions.length > 0
            ? { suggestions: stepSuggestions }
            : {}),
          ...(stepMatches.length > 0 ? { definitions: stepMatches } : {}),
          ...(parameters.length > 0 ? { parameters } : {}),
          attachments: stepAttachments,
        });
      } else if (testStep.hookId) {
        const hook = index.hooks.get(testStep.hookId);
        const hookAttachments = mapAttachments(
          startedAttachments.filter((attachment) => attachment.testStepId === testStep.id),
        );
        const message = stepResultMessage(result);
        hookRows.push({
          id: testStep.id,
          order: testStepOrder++,
          type: hookLabel(hook?.type),
          ...(hook?.name ? { name: hook.name } : {}),
          status: statusOf(result.status),
          durationMs: durationMs(result.duration),
          ...(message ? { message: stripAnsi(message) } : {}),
          attachments: hookAttachments,
        });
      }
    }

    const status = executed
      ? statusOf(getWorstTestStepResult(rawResults).status)
      : 'unknown';
    const duration = [...stepRows, ...hookRows].reduce(
      (sum, entry) => sum + entry.durationMs,
      0,
    );
    const astIds = pickle.astNodeIds ?? [];
    // The deepest AST id is the examples row. Verify the URI as well so a
    // merged input cannot attach the same row id to the wrong outline.
    const candidate = astIds.length
      ? index.outlineRows.get(astIds.at(-1) ?? '')
      : undefined;
    const outlineExample =
      candidate &&
      astIds.includes(candidate.scenario.id) &&
      (!candidate.uri || !pickle.uri || candidate.uri === pickle.uri)
        ? candidate
        : undefined;
    const scenarioId = outlineExample?.scenario.id ?? astIds[0] ?? '';
    const tree = outlineExample ?? index.scenarioTree.get(scenarioId);
    const astEntry = outlineExample
      ? index.scenarioTree.get(outlineExample.scenario.id)
      : index.scenarioTree.get(scenarioId);
    const rule = ruleOf(astEntry?.rule);
    const feature =
      index.featureByScenarioId.get(scenarioId) ??
      index.featuresByKey.get(pickle.uri);
    const stepAttachments = stepRows.flatMap((step) => step.attachments);
    const hookAttachments = hookRows.flatMap((hook) => hook.attachments);
    const extraAttachments = mapAttachments(
      startedAttachments.filter((attachment) => !attachment.testStepId),
    );
    const scenarioAttachments = [
      ...stepAttachments,
      ...hookAttachments,
      ...extraAttachments,
    ];
    const outline: ReportOutline | undefined = outlineExample
      ? {
          id: outlineExample.scenario.id,
          keyword: outlineExample.scenario.keyword,
          name: outlineExample.scenario.name,
          description: normalizeText(outlineExample.scenario.description),
          tags: (outlineExample.scenario.tags ?? []).map((tag) => tag.name),
          examplesId: outlineExample.examples.id,
          examplesKeyword: outlineExample.examples.keyword,
          examplesName: outlineExample.examples.name,
          examplesDescription: normalizeText(outlineExample.examples.description),
          examplesTags: (outlineExample.examples.tags ?? []).map((tag) => tag.name),
          examplesIndex: outlineExample.examplesIndex,
          exampleIndex: outlineExample.exampleIndex,
        }
      : undefined;
    const pickleLine = positiveLine(pickle.location?.line);
    const skippedAttachments = safePositiveInteger(
      skippedAttachmentsOf(latest),
    );
    const skippedAttachmentEntries = skippedAttachmentEntriesOf(latest);
    const earlier = earlierAttemptsFor(pickle.id, latest);
    const row: ReportScenario = {
      id: pickle.id,
      name: pickle.name,
      keyword: tree?.scenario.keyword ?? 'Scenario',
      description: normalizeText(tree?.scenario.description),
      uri: displayUri(pickle.uri ?? ''),
      ...(pickleLine ? { line: pickleLine } : {}),
      featureName: feature?.name ?? displayUri(pickle.uri ?? ''),
      ...(rule ? { rule } : {}),
      ...(rule?.name ? { ruleName: rule.name } : {}),
      status,
      executed,
      durationMs: finiteDuration(duration),
      attempt: Number.isFinite(latest.attempt) ? latest.attempt : 0,
      ...(timestampIso(latest.timestamp) ? { startedAt: timestampIso(latest.timestamp) } : {}),
      ownTags: outlineExample
        ? (outlineExample.examples.tags ?? []).map((tag) => tag.name)
        : tree
          ? (tree.scenario.tags ?? []).map((tag) => tag.name)
          : (pickle.tags ?? []).map((tag) => tag.name),
      tags: (pickle.tags ?? []).map((tag) => tag.name),
      ...(outline ? { outline } : {}),
      steps: stepRows,
      hooks: hookRows,
      attachments: scenarioAttachments,
      extraAttachments,
      ...(skippedAttachments > 0 ? { skippedAttachments } : {}),
      ...(skippedAttachmentEntries.length > 0
        ? { skippedAttachmentEntries }
        : {}),
      ...(earlier.rows.length > 0
        ? {
            earlierAttempts: earlier.rows,
            earlierAttemptTotal: earlier.total,
          }
        : {}),
    };
    scenarioRows.push(row);
    if (executed) {
      count(scenarioCounts, status);
      for (const step of stepRows) count(stepCounts, step.status);
      for (const hook of hookRows) count(hookCounts, hook.status);
    }
    if (feature) {
      const list = featureScenarios.get(feature) ?? [];
      list.push(row);
      featureScenarios.set(feature, list);
    }
  }

  const featureRows: ReportFeature[] = [];
  const inInputOrder = new Set(featureOrder);
  const orderedFeatures = [
    ...featureOrder,
    ...[...featureScenarios.keys()].filter(
      (feature) => !inInputOrder.has(feature),
    ),
  ];
  for (const feature of orderedFeatures) {
    const scenarios = featureScenarios.get(feature) ?? [];
    if (scenarios.length === 0) continue;
    const status = worstExecutedStatus(scenarios);
    const featureUri = featureUris.get(feature) || scenarios[0]?.uri || '';
    const sourceFiles = new Set<string | undefined>([
      ...scenarios.map((scenario) => provenance?.get(scenario.uri)),
      provenance?.get(featureUri),
    ]);
    const sourceFile =
      sourceFiles.size === 1 && !sourceFiles.has(undefined)
        ? [...sourceFiles][0]
        : undefined;
    featureRows.push({
      id: `feature-${featureRows.length + 1}`,
      name: feature.name,
      keyword: feature.keyword,
      uri: scenarios[0]?.uri ?? '',
      description: normalizeText(feature.description),
      tags: (feature.tags ?? []).map((tag) => tag.name),
      backgrounds: backgroundsOf(feature.children ?? []),
      status,
      durationMs: finiteDuration(
        scenarios.reduce((sum, scenario) => sum + scenario.durationMs, 0),
      ),
      scenarios,
      attachments: scenarios.reduce((sum, scenario) => sum + scenario.attachments.length, 0),
      ...(sourceFile ? { sourceFile } : {}),
    });
  }

  if (featureRows.some((feature) => !feature.sourceFile)) {
    for (const feature of featureRows) delete feature.sourceFile;
  }

  const runHooks: ReportRunHook[] = [];
  const orderedRunHooks = [...index.runHookStarts.values()]
    .map((start, position) => ({ start, position }))
    .sort((a, b) => {
      const seconds = (a.start.timestamp?.seconds ?? 0) - (b.start.timestamp?.seconds ?? 0);
      if (seconds !== 0) return seconds;
      const nanos = (a.start.timestamp?.nanos ?? 0) - (b.start.timestamp?.nanos ?? 0);
      return nanos !== 0 ? nanos : a.position - b.position;
    });
  for (const { start } of orderedRunHooks) {
    const finish = index.runHookFinishes.get(start.id);
    const hook = index.hooks.get(start.hookId);
    const result = finish?.result;
    const message = result ? stepResultMessage(result) : '';
    runHooks.push({
      id: start.id,
      type: hookLabel(hook?.type),
      ...(hook?.name ? { name: hook.name } : {}),
      status: result ? statusOf(result.status) : 'unknown',
      durationMs: durationMs(result?.duration),
      ...(message ? { message: stripAnsi(message) } : {}),
      attachments: mapAttachments(index.runHookAttachments.get(start.id) ?? []),
    });
  }
  for (const hook of runHooks) count(hookCounts, hook.status);

  const attachmentRows = scenarioRows.flatMap((scenario) => scenario.attachments);
  const runAttachments = mapAttachments(index.runAttachments);
  const allAttachments = [
    ...attachmentRows,
    ...runHooks.flatMap((hook) => hook.attachments),
    ...runAttachments,
  ];
  return {
    features: featureRows,
    scenarios: scenarioRows,
    runHooks,
    runAttachments,
    counts: {
      features: featureRows.length,
      scenarios: scenarioCounts,
      steps: stepCounts,
      hooks: hookCounts,
      attachments: allAttachments.length,
      attachmentBytes: allAttachments.reduce((sum, attachment) => sum + attachment.bytes, 0),
    },
    durationMs: finiteDuration(
      scenarioRows.reduce((sum, scenario) => sum + scenario.durationMs, 0) +
        runHooks.reduce((sum, hook) => sum + hook.durationMs, 0),
    ),
    ...(startedAt ? { startedAt } : {}),
    ...(finishedAt ? { finishedAt } : {}),
    source,
    ...(environment ? { environment } : {}),
  };
}
