import {
  getWorstTestStepResult,
  TestStepResultStatus,
} from '@cucumber/messages';
import type {
  Attachment,
  Background,
  Envelope,
  Examples,
  Feature,
  FeatureChild,
  Hook,
  Pickle,
  Rule,
  RuleChild,
  Scenario,
  Step,
  TestCase,
  TestCaseStarted,
  TestRunHookFinished,
  TestRunHookStarted,
  TestStepFinished,
} from '@cucumber/messages';

import { isSyntheticBackground } from '../input/background.js';
import { stepResultMessage } from '../result-message.js';

export type ReportStatus =
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'pending'
  | 'undefined'
  | 'ambiguous'
  | 'unknown';

export interface ReportAttachment {
  fileName: string;
  mediaType: string;
  kind: 'image' | 'video' | 'audio' | 'text' | 'binary';
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

export interface ReportScenario {
  id: string;
  name: string;
  keyword: string;
  description: string;
  uri: string;
  featureName: string;
  ruleName?: string;
  rule?: ReportRule;
  status: ReportStatus;
  /** True when the selected test case reported at least one raw result. */
  executed: boolean;
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

export interface ReportEnvironment {
  producer?: string;
  runtime?: string;
  os?: string;
  cpu?: string;
  protocol?: string;
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

const STATUS_ORDER: TestStepResultStatus[] = [
  TestStepResultStatus.UNKNOWN,
  TestStepResultStatus.PASSED,
  TestStepResultStatus.SKIPPED,
  TestStepResultStatus.PENDING,
  TestStepResultStatus.UNDEFINED,
  TestStepResultStatus.AMBIGUOUS,
  TestStepResultStatus.FAILED,
];

/** Raw Cucumber ordinal; the report comparator forces passed last. */
export function statusSeverity(status: ReportStatus): number {
  return STATUS_ORDER.indexOf(status.toUpperCase() as TestStepResultStatus);
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

function timestampIso(
  timestamp: { seconds: number; nanos: number } | undefined,
): string | undefined {
  if (!timestamp) return undefined;
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

const ANSI_PATTERN = new RegExp(
  `${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`,
  'g',
);

function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
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

function extensionFor(mediaType: string): string {
  const map: Record<string, string> = {
    'application/json': 'json',
    'application/octet-stream': 'bin',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'text/html': 'html',
    'text/plain': 'txt',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };
  return map[mediaType.toLowerCase()] ?? mediaType.split('/')[1]?.split(';')[0] ?? 'bin';
}

function attachmentKind(mediaType: string): ReportAttachment['kind'] {
  if (mediaType.startsWith('image/')) return 'image';
  if (mediaType.startsWith('video/')) return 'video';
  if (mediaType.startsWith('audio/')) return 'audio';
  if (
    mediaType.startsWith('text/') ||
    mediaType === 'application/json' ||
    mediaType.includes('json')
  ) {
    return 'text';
  }
  return 'binary';
}

function toAttachment(
  attachment: Attachment,
  index: number,
): ReportAttachment {
  const body = attachment.body ?? '';
  const mediaType = attachment.mediaType || 'application/octet-stream';
  const kind = attachmentKind(mediaType);
  const fileName =
    attachment.fileName || `attachment-${index + 1}.${extensionFor(mediaType)}`;
  const isBase64 = attachment.contentEncoding === 'BASE64';
  const bytes = isBase64
    ? Math.max(0, Math.floor((body.length * 3) / 4) - (body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0))
    : Buffer.byteLength(body, 'utf8');

  if (kind === 'image' || kind === 'video' || kind === 'audio') {
    return {
      fileName,
      mediaType,
      kind,
      bytes,
      ...(body
        ? {
            dataUri: isBase64
              ? `data:${mediaType};base64,${body}`
              : `data:${mediaType};charset=utf-8,${encodeURIComponent(body)}`,
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
      bytes,
      text: kind === 'text' ? decoded : undefined,
      dataUri: kind === 'binary' ? `data:${mediaType};base64,${body}` : undefined,
    };
  }

  return {
    fileName,
    mediaType,
    kind,
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

interface OutlineExample {
  uri: string;
  scenario: Scenario;
  examples: Examples;
  examplesIndex: number;
  exampleIndex: number;
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

function featureTree(document: Feature | undefined): Map<string, {
  scenario: Scenario;
  rule?: ReportRule;
}> {
  const map = new Map<string, { scenario: Scenario; rule?: ReportRule }>();
  if (!document) return map;
  const visit = (
    children: readonly (FeatureChild | RuleChild)[],
    rule?: ReportRule,
  ): void => {
    for (const child of children) {
      if (child.scenario) {
        map.set(child.scenario.id, { scenario: child.scenario, ...(rule ? { rule } : {}) });
      }
      if ('rule' in child && child.rule) {
        visit(child.rule.children ?? [], ruleMetadata(child.rule));
      }
    }
  };
  visit(document.children ?? []);
  return map;
}

function exampleRowTree(
  document: Feature | undefined,
  uri: string,
): Map<string, OutlineExample> {
  const map = new Map<string, OutlineExample>();
  if (!document) return map;
  const visit = (children: readonly (FeatureChild | RuleChild)[]): void => {
    for (const child of children) {
      if (child.scenario) {
        const scenario = child.scenario;
        (scenario.examples ?? []).forEach((examples, examplesIndex) => {
          (examples.tableBody ?? []).forEach((row, exampleIndex) => {
            map.set(row.id, {
              uri,
              scenario,
              examples,
              examplesIndex,
              exampleIndex,
            });
          });
        });
      }
      if ('rule' in child && child.rule) visit(child.rule.children ?? []);
    }
  };
  visit(document.children ?? []);
  return map;
}

export function buildReportModel(
  envelopes: Envelope[],
  provenance?: Map<string, string>,
): ReportModel {
  const features = new Map<string, Feature>();
  const featureUris = new Map<Feature, string>();
  const featureSeen = new Set<Feature>();
  const featureOrder: Feature[] = [];
  const scenarioTree = new Map<string, { scenario: Scenario; rule?: ReportRule }>();
  const outlineRows = new Map<string, OutlineExample>();
  const featureByScenarioId = new Map<string, Feature>();
  const stepById = new Map<string, Step>();
  const pickles = new Map<string, Pickle>();
  const testCases = new Map<string, TestCase>();
  const started = new Map<string, TestCaseStarted>();
  const hooks = new Map<string, Hook>();
  const runHookStarts = new Map<string, TestRunHookStarted>();
  const runHookFinishes = new Map<string, TestRunHookFinished>();
  const results = new Map<string, TestStepFinished[]>();
  const attachments = new Map<string, Attachment[]>();
  const runHookAttachments = new Map<string, Attachment[]>();
  const suggestions = new Map<string, Array<{ language?: string; code: string }>>();
  const stepDefinitions = new Map<string, { pattern: string; source?: string }>();
  const attachmentCache = new Map<Attachment, ReportAttachment>();
  let attachmentIndex = 0;
  let startedAt: string | undefined;
  let finishedAt: string | undefined;
  let source = 'Cucumber';
  let environment: ReportEnvironment | undefined;

  const mapAttachments = (list: Attachment[]): ReportAttachment[] =>
    list.map((attachment) => {
      const cached = attachmentCache.get(attachment);
      if (cached) return cached;
      const mapped = toAttachment(attachment, attachmentIndex++);
      attachmentCache.set(attachment, mapped);
      return mapped;
    });

  for (const envelope of envelopes) {
    if (envelope.meta) {
      const { implementation, runtime, os, cpu, protocolVersion } = envelope.meta;
      source = productLabel(implementation) ?? 'Cucumber';
      const next: ReportEnvironment = {
        ...(implementation && productLabel(implementation)
          ? { producer: productLabel(implementation) }
          : {}),
        ...(runtime && productLabel(runtime) ? { runtime: productLabel(runtime) } : {}),
        ...(os && productLabel(os) ? { os: productLabel(os) } : {}),
        ...(cpu && productLabel(cpu) ? { cpu: productLabel(cpu) } : {}),
        ...(protocolVersion ? { protocol: protocolVersion } : {}),
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
    if (envelope.gherkinDocument?.feature) {
      const feature = envelope.gherkinDocument.feature;
      const uri = envelope.gherkinDocument.uri;
      const key = uri ?? feature.name;
      if (!features.has(key)) features.set(key, feature);
      if (!featureSeen.has(feature)) {
        featureSeen.add(feature);
        if (uri) featureUris.set(feature, uri);
        featureOrder.push(feature);
      }
      for (const [id, value] of featureTree(feature)) {
        scenarioTree.set(id, value);
        featureByScenarioId.set(id, feature);
      }
      for (const [id, value] of exampleRowTree(feature, uri ?? '')) {
        outlineRows.set(id, value);
      }
      const collectSteps = (children: readonly (FeatureChild | RuleChild)[]): void => {
        for (const child of children) {
          if (child.background) {
            for (const step of child.background.steps ?? []) stepById.set(step.id, step);
          }
          if (child.scenario) {
            for (const step of child.scenario.steps ?? []) stepById.set(step.id, step);
          }
          if ('rule' in child && child.rule) collectSteps(child.rule.children ?? []);
        }
      };
      collectSteps(feature.children ?? []);
    }
    if (envelope.pickle) pickles.set(envelope.pickle.id, envelope.pickle);
    if (envelope.testCase) testCases.set(envelope.testCase.id, envelope.testCase);
    if (envelope.testCaseStarted) started.set(envelope.testCaseStarted.id, envelope.testCaseStarted);
    if (envelope.hook) hooks.set(envelope.hook.id, envelope.hook);
    if (envelope.testRunHookStarted) {
      runHookStarts.set(envelope.testRunHookStarted.id, envelope.testRunHookStarted);
    }
    if (envelope.testRunHookFinished) {
      runHookFinishes.set(
        envelope.testRunHookFinished.testRunHookStartedId,
        envelope.testRunHookFinished,
      );
    }
    if (envelope.testStepFinished) {
      const list = results.get(envelope.testStepFinished.testCaseStartedId) ?? [];
      list.push(envelope.testStepFinished);
      results.set(envelope.testStepFinished.testCaseStartedId, list);
    }
    if (envelope.attachment) {
      const key = envelope.attachment.testRunHookStartedId;
      const target = key ? runHookAttachments : attachments;
      const id = key ?? envelope.attachment.testCaseStartedId ?? '';
      const list = target.get(id) ?? [];
      list.push(envelope.attachment);
      target.set(id, list);
    }
    if (envelope.suggestion) {
      const snippets = Array.isArray(envelope.suggestion.snippets)
        ? envelope.suggestion.snippets
        : [];
      const list = snippets
        .filter((snippet) => typeof snippet?.code === 'string')
        .map((snippet) => ({
          ...(typeof snippet.language === 'string' && snippet.language
            ? { language: snippet.language }
            : {}),
          code: snippet.code,
        }));
      if (list.length > 0) suggestions.set(envelope.suggestion.pickleStepId, list);
    }
    if (envelope.stepDefinition) {
      const pattern = envelope.stepDefinition.pattern;
      if (typeof pattern?.source === 'string') {
        const reference = envelope.stepDefinition.sourceReference;
        const uri = typeof reference?.uri === 'string' ? reference.uri : '';
        const line =
          typeof reference?.location?.line === 'number'
            ? reference.location.line
            : undefined;
        const source = uri ? (line ? `${uri}:${line}` : uri) : undefined;
        stepDefinitions.set(envelope.stepDefinition.id, {
          pattern: pattern.source,
          ...(source ? { source } : {}),
        });
      }
    }
  }

  const testCasesByPickle = new Map<string, TestCase[]>();
  for (const testCase of testCases.values()) {
    const list = testCasesByPickle.get(testCase.pickleId) ?? [];
    list.push(testCase);
    testCasesByPickle.set(testCase.pickleId, list);
  }

  const startedByTestCase = new Map<string, TestCaseStarted[]>();
  for (const item of started.values()) {
    const list = startedByTestCase.get(item.testCaseId) ?? [];
    list.push(item);
    startedByTestCase.set(item.testCaseId, list);
  }

  const scenarioRows: ReportScenario[] = [];
  const scenarioCounts = emptyStatusCounts();
  const stepCounts = emptyStatusCounts();
  const hookCounts = emptyStatusCounts();
  const featureScenarios = new Map<Feature, ReportScenario[]>();

  for (const pickle of pickles.values()) {
    const testCasesForPickle = testCasesByPickle.get(pickle.id) ?? [];
    const candidates = testCasesForPickle.flatMap(
      (testCase) => startedByTestCase.get(testCase.id) ?? [],
    );
    // The latest started attempt wins, even when it reported nothing: an
    // earlier retried attempt must not mask a later unexecuted one.
    const latest = candidates.reduce<TestCaseStarted | undefined>((current, candidate) => {
      if (!current) return candidate;
      if (candidate.attempt > current.attempt) return candidate;
      if (candidate.attempt < current.attempt) return current;
      const cSeconds = candidate.timestamp?.seconds ?? 0;
      const currentSeconds = current.timestamp?.seconds ?? 0;
      if (cSeconds !== currentSeconds) return cSeconds > currentSeconds ? candidate : current;
      const cNanos = candidate.timestamp?.nanos ?? 0;
      const currentNanos = current.timestamp?.nanos ?? 0;
      return cNanos > currentNanos ? candidate : current;
    }, undefined);
    if (!latest) continue;

    const testCase = testCases.get(latest.testCaseId);
    if (!testCase) continue;
    const pickleSteps = new Map(pickle.steps.map((step) => [step.id, step]));
    const startedAttachments = attachments.get(latest.id) ?? [];
    const resultsByStep = new Map(
      (results.get(latest.id) ?? []).map((entry) => [entry.testStepId, entry.testStepResult]),
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
        const data = stepData(ast ? stepById.get(ast) : undefined);
        const stepAttachments = mapAttachments(
          startedAttachments.filter((attachment) => attachment.testStepId === testStep.id),
        );
        const message = stepResultMessage(result);
        const stepSuggestions = suggestions.get(testStep.pickleStepId) ?? [];
        const definitionIds = Array.isArray(testStep.stepDefinitionIds)
          ? testStep.stepDefinitionIds
          : [];
        const stepMatches = definitionIds
          .map((id) => stepDefinitions.get(id))
          .filter(
            (definition): definition is { pattern: string; source?: string } =>
              Boolean(definition),
          );
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
          attachments: stepAttachments,
        });
      } else if (testStep.hookId) {
        const hook = hooks.get(testStep.hookId);
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

    const rawResults = (results.get(latest.id) ?? []).map((entry) => entry.testStepResult);
    const executed = rawResults.length > 0;
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
    const candidate = astIds.length ? outlineRows.get(astIds.at(-1) ?? '') : undefined;
    const outlineExample =
      candidate &&
      astIds.includes(candidate.scenario.id) &&
      (!candidate.uri || !pickle.uri || candidate.uri === pickle.uri)
        ? candidate
        : undefined;
    const scenarioId = outlineExample?.scenario.id ?? astIds[0] ?? '';
    const tree = outlineExample ?? scenarioTree.get(scenarioId);
    const astEntry = outlineExample
      ? scenarioTree.get(outlineExample.scenario.id)
      : scenarioTree.get(scenarioId);
    const rule = astEntry?.rule;
    const feature =
      featureByScenarioId.get(scenarioId) ??
      features.get(pickle.uri);
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
    const row: ReportScenario = {
      id: pickle.id,
      name: pickle.name,
      keyword: tree?.scenario.keyword ?? 'Scenario',
      description: normalizeText(tree?.scenario.description),
      uri: pickle.uri,
      featureName: feature?.name ?? pickle.uri,
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
    const executedScenarios = scenarios.filter((scenario) => scenario.executed);
    const status: ReportStatus =
      executedScenarios.length === 0
        ? 'unknown'
        : executedScenarios.some((scenario) => scenario.status !== 'passed')
          ? executedScenarios.reduce<ReportStatus>((worst, scenario) => {
              if (scenario.status === 'passed') return worst;
              return statusSeverity(scenario.status) > statusSeverity(worst)
                ? scenario.status
                : worst;
            }, 'unknown')
          : 'passed';
    const featureUri = featureUris.get(feature) ?? scenarios[0]?.uri ?? '';
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
  const orderedRunHooks = [...runHookStarts.values()]
    .map((start, index) => ({ start, index }))
    .sort((a, b) => {
      const seconds = (a.start.timestamp?.seconds ?? 0) - (b.start.timestamp?.seconds ?? 0);
      if (seconds !== 0) return seconds;
      const nanos = (a.start.timestamp?.nanos ?? 0) - (b.start.timestamp?.nanos ?? 0);
      return nanos !== 0 ? nanos : a.index - b.index;
    });
  for (const { start } of orderedRunHooks) {
    const finish = runHookFinishes.get(start.id);
    const hook = hooks.get(start.hookId);
    const result = finish?.result;
    const message = result ? stepResultMessage(result) : '';
    runHooks.push({
      id: start.id,
      type: hookLabel(hook?.type),
      ...(hook?.name ? { name: hook.name } : {}),
      status: result ? statusOf(result.status) : 'unknown',
      durationMs: durationMs(result?.duration),
      ...(message ? { message: stripAnsi(message) } : {}),
      attachments: mapAttachments(runHookAttachments.get(start.id) ?? []),
    });
  }
  for (const hook of runHooks) count(hookCounts, hook.status);

  const attachmentRows = scenarioRows.flatMap((scenario) => scenario.attachments);
  const runAttachments = mapAttachments(attachments.get('') ?? []);
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
