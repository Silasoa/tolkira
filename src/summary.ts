import {
  getWorstTestStepResult,
  TestStepResultStatus,
} from '@cucumber/messages';
import type {
  Attachment,
  Duration,
  Envelope,
  Feature,
  FeatureChild,
  Hook,
  Pickle,
  RuleChild,
  TestCase,
  TestCaseStarted,
  TestStepFinished,
  TestStepResult,
} from '@cucumber/messages';
import { loadEnvelopes } from './input/load.js';
import { sanitizeEnvelopes } from './input/sanitize.js';
import { stepResultMessage } from './result-message.js';

export const SUMMARY_SCHEMA_VERSION = 1;

export type SummaryStatus =
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'pending'
  | 'undefined'
  | 'ambiguous'
  | 'unknown';

export interface StatusCounts {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  undefined: number;
  ambiguous: number;
  unknown: number;
}

export interface SummaryStep {
  keyword: string;
  text: string;
  status: SummaryStatus;
  durationMs: number;
  message?: string;
}

export interface SummaryScenario {
  name: string;
  uri: string;
  feature: string;
  status: SummaryStatus;
  durationMs: number;
  attempt: number;
  tags: string[];
  attachments: number;
  steps: SummaryStep[];
}

export interface ReportSummary {
  schemaVersion: typeof SUMMARY_SCHEMA_VERSION;
  status: SummaryStatus;
  durationMs: number;
  counts: {
    features: number;
    scenarios: StatusCounts;
    steps: StatusCounts;
  };
  attachments: {
    total: number;
    bytes: number;
  };
  scenarios: SummaryScenario[];
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

const VALID_STATUSES = new Set<SummaryStatus>([
  'passed',
  'failed',
  'skipped',
  'pending',
  'undefined',
  'ambiguous',
  'unknown',
]);

function toStatus(status: unknown): SummaryStatus {
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  return VALID_STATUSES.has(normalized as SummaryStatus)
    ? (normalized as SummaryStatus)
    : 'unknown';
}

function emptyCounts(): StatusCounts {
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

function countStatus(counts: StatusCounts, status: SummaryStatus): void {
  counts.total += 1;
  switch (status) {
    case 'passed':
      counts.passed += 1;
      break;
    case 'failed':
      counts.failed += 1;
      break;
    case 'skipped':
      counts.skipped += 1;
      break;
    case 'pending':
      counts.pending += 1;
      break;
    case 'undefined':
      counts.undefined += 1;
      break;
    case 'ambiguous':
      counts.ambiguous += 1;
      break;
    default:
      counts.unknown += 1;
      break;
  }
}

function durationMs(duration: Duration | undefined): number {
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

function scenarioStatus(results: TestStepResult[]): SummaryStatus {
  if (results.length === 0) return 'unknown';
  return toStatus(getWorstTestStepResult(results).status);
}

function statusOrdinal(status: SummaryStatus): number {
  return STATUS_ORDER.indexOf(status.toUpperCase() as TestStepResultStatus);
}

export function displayUri(uri: string): string {
  const normalized = uri.replace(/\\/g, '/').replace(/^file:\/\/+/i, '');
  if (!/^[a-z]:\//i.test(normalized) && !normalized.startsWith('/')) {
    return normalized;
  }
  const marker = normalized.lastIndexOf('/features/');
  if (marker >= 0) return normalized.slice(marker + 1);
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? uri;
}

function featureTree(document: Feature | undefined): {
  featureName: string;
  stepKeywords: Map<string, string>;
} {
  const stepKeywords = new Map<string, string>();
  if (!document) return { featureName: '', stepKeywords };

  const visit = (children: readonly (FeatureChild | RuleChild)[]): void => {
    for (const child of children) {
      if (child.background) {
        for (const step of child.background.steps ?? []) {
          stepKeywords.set(step.id, step.keyword ?? '');
        }
      }
      if (child.scenario) {
        for (const step of child.scenario.steps ?? []) {
          stepKeywords.set(step.id, step.keyword ?? '');
        }
      }
      if ('rule' in child && child.rule) visit(child.rule.children ?? []);
    }
  };

  visit(document.children ?? []);
  return { featureName: document.name ?? '', stepKeywords };
}

function attachmentBytes(attachment: Attachment): number {
  const body = attachment.body ?? '';
  if (attachment.contentEncoding === 'BASE64') {
    const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
  }
  return Buffer.byteLength(body, 'utf8');
}

/**
 * Builds a stable, renderer-independent summary from Cucumber Messages.
 * This is the machine-readable contract for agents and CI tools.
 */
export function summarizeEnvelopes(input: Envelope[]): ReportSummary {
  const envelopes = sanitizeEnvelopes(input);
  const features = new Map<string, Feature>();
  const pickles = new Map<string, Pickle>();
  const testCasesByPickle = new Map<string, TestCase[]>();
  const startedByTestCase = new Map<string, TestCaseStarted[]>();
  const hooks = new Map<string, Hook>();
  const results = new Map<string, TestStepFinished[]>();
  const attachments = new Map<string, Attachment[]>();
  const attachmentList: Attachment[] = [];
  const finishedIds = new Set<string>();
  const scenarioFeatures = new Map<string, Feature>();

  const indexFeature = (feature: Feature): void => {
    const visit = (children: readonly (FeatureChild | RuleChild)[]): void => {
      for (const child of children) {
        if (child.scenario) scenarioFeatures.set(child.scenario.id, feature);
        if ('rule' in child && child.rule) visit(child.rule.children ?? []);
      }
    };
    visit(feature.children ?? []);
  };

  for (const envelope of envelopes) {
    if (envelope.gherkinDocument?.feature) {
      features.set(
        envelope.gherkinDocument.uri ?? '',
        envelope.gherkinDocument.feature,
      );
      indexFeature(envelope.gherkinDocument.feature);
    }
    if (envelope.pickle) pickles.set(envelope.pickle.id, envelope.pickle);
    if (envelope.testCase) {
      const list = testCasesByPickle.get(envelope.testCase.pickleId) ?? [];
      list.push(envelope.testCase);
      testCasesByPickle.set(envelope.testCase.pickleId, list);
    }
    if (envelope.testCaseStarted) {
      const list =
        startedByTestCase.get(envelope.testCaseStarted.testCaseId) ?? [];
      list.push(envelope.testCaseStarted);
      startedByTestCase.set(envelope.testCaseStarted.testCaseId, list);
    }
    if (envelope.testCaseFinished) {
      finishedIds.add(envelope.testCaseFinished.testCaseStartedId);
    }
    if (envelope.hook) hooks.set(envelope.hook.id, envelope.hook);
    if (envelope.testStepFinished) {
      const list = results.get(envelope.testStepFinished.testCaseStartedId) ?? [];
      list.push(envelope.testStepFinished);
      results.set(envelope.testStepFinished.testCaseStartedId, list);
    }
    if (envelope.attachment) {
      attachmentList.push(envelope.attachment);
      const startedId = envelope.attachment.testCaseStartedId;
      if (startedId) {
        const list = attachments.get(startedId) ?? [];
        list.push(envelope.attachment);
        attachments.set(startedId, list);
      }
    }
  }

  const treeCache = new Map<
    Feature,
    { featureName: string; stepKeywords: Map<string, string> }
  >();
  const treeOf = (
    feature: Feature | undefined,
  ): { featureName: string; stepKeywords: Map<string, string> } => {
    if (!feature) return { featureName: '', stepKeywords: new Map() };
    const cached = treeCache.get(feature);
    if (cached) return cached;
    const tree = featureTree(feature);
    treeCache.set(feature, tree);
    return tree;
  };

  const latestByPickle = new Map<string, TestCaseStarted>();
  for (const [pickleId, testCases] of testCasesByPickle) {
    const candidates = testCases.flatMap(
      (testCase) => startedByTestCase.get(testCase.id) ?? [],
    );
    const finishedCandidates = candidates.filter((candidate) =>
      finishedIds.has(candidate.id),
    );
    const pool = finishedCandidates.length
      ? finishedCandidates
      : candidates.filter((candidate) => (results.get(candidate.id)?.length ?? 0) > 0);
    let latest: TestCaseStarted | undefined;
    for (const candidate of pool) {
      if (!latest) {
        latest = candidate;
        continue;
      }
      const newer =
        candidate.attempt > latest.attempt ||
        (candidate.attempt === latest.attempt &&
          (candidate.timestamp?.seconds ?? 0) >
            (latest.timestamp?.seconds ?? 0)) ||
        (candidate.attempt === latest.attempt &&
          (candidate.timestamp?.seconds ?? 0) ===
            (latest.timestamp?.seconds ?? 0) &&
          (candidate.timestamp?.nanos ?? 0) > (latest.timestamp?.nanos ?? 0));
      if (newer) latest = candidate;
    }
    if (latest) latestByPickle.set(pickleId, latest);
  }

  const scenarioCounts = emptyCounts();
  const stepCounts = emptyCounts();
  const scenarios: SummaryScenario[] = [];
  const countedAttachments = new Set<Attachment>();
  const featureSet = new Set<Feature>();
  let totalDuration = 0;

  for (const pickle of pickles.values()) {
    const testCases = testCasesByPickle.get(pickle.id) ?? [];
    const testSteps = testCases.flatMap((testCase) => testCase.testSteps);
    const started = latestByPickle.get(pickle.id);
    const finished = started ? (results.get(started.id) ?? []) : [];
    const resultByStep = new Map(
      finished.map((entry) => [entry.testStepId, entry.testStepResult]),
    );
    const feature =
      scenarioFeatures.get(pickle.astNodeIds[0] ?? '') ??
      features.get(pickle.uri);
    if (feature) featureSet.add(feature);
    const tree = treeOf(feature);
    const pickleSteps = new Map(
      (pickle.steps ?? []).map((step) => [step.id, step]),
    );

    const steps: SummaryStep[] = [];
    for (const testStep of testSteps) {
      const result = resultByStep.get(testStep.id);
      if (!result) continue;
      const message = stepResultMessage(result);

      if (testStep.pickleStepId) {
        const pickleStep = pickleSteps.get(testStep.pickleStepId);
        const astNodeId = pickleStep?.astNodeIds[0];
        steps.push({
          keyword: astNodeId
            ? (tree.stepKeywords.get(astNodeId) ?? '').trim()
            : '',
          text: pickleStep?.text ?? '',
          status: toStatus(result.status),
          durationMs: durationMs(result.duration),
          ...(message ? { message } : {}),
        });
      } else if (testStep.hookId) {
        const hook = hooks.get(testStep.hookId);
        steps.push({
          keyword: 'Hook',
          text: hook?.type ?? 'hook',
          status: toStatus(result.status),
          durationMs: durationMs(result.duration),
          ...(message ? { message } : {}),
        });
      }
    }

    const status = scenarioStatus(finished.map((entry) => entry.testStepResult));
    const scenarioDuration = steps.reduce((sum, step) => sum + step.durationMs, 0);
    const scenarioAttachments = started ? (attachments.get(started.id) ?? []) : [];
    for (const attachment of scenarioAttachments) countedAttachments.add(attachment);

    countStatus(scenarioCounts, status);
    for (const step of steps) countStatus(stepCounts, step.status);
    totalDuration += scenarioDuration;

    scenarios.push({
      name: pickle.name ?? '',
      uri: displayUri(pickle.uri ?? ''),
      feature: tree.featureName,
      status,
      durationMs: finiteDuration(scenarioDuration),
      attempt: started?.attempt ?? 0,
      tags: (pickle.tags ?? []).map((tag) => tag.name),
      attachments: scenarioAttachments.length,
      steps,
    });
  }

  scenarios.sort(
    (a, b) => a.uri.localeCompare(b.uri) || a.name.localeCompare(b.name),
  );

  const overall =
    scenarios.length === 0
      ? 'unknown'
      : scenarios.reduce(
          (worst, scenario) =>
            statusOrdinal(scenario.status) > statusOrdinal(worst)
              ? scenario.status
              : worst,
          'unknown' as SummaryStatus,
        );

  const orphanAttachments = attachmentList.filter(
    (attachment) =>
      !attachment.testCaseStartedId || countedAttachments.has(attachment),
  );

  return {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    status: overall,
    durationMs: finiteDuration(totalDuration),
    counts: {
      features: featureSet.size,
      scenarios: scenarioCounts,
      steps: stepCounts,
    },
    attachments: {
      total: orphanAttachments.length,
      bytes: orphanAttachments.reduce(
        (sum, attachment) => sum + attachmentBytes(attachment),
        0,
      ),
    },
    scenarios,
  };
}

export async function summarizeReport(
  inputs: string | string[],
): Promise<ReportSummary> {
  return summarizeEnvelopes(await loadEnvelopes(inputs));
}
