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
  TestStep,
  TestStepFinished,
  TestStepResult,
} from '@cucumber/messages';
import { loadEnvelopes } from './input/load.js';
import { sanitizeEnvelopes } from './input/sanitize.js';

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

function toStatus(status: TestStepResultStatus): SummaryStatus {
  return status.toLowerCase() as SummaryStatus;
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
  counts[status] += 1;
}

function durationMs(duration: Duration | undefined): number {
  if (!duration) return 0;
  return Math.round((duration.seconds * 1000 + duration.nanos / 1_000_000) * 1000) / 1000;
}

function attachmentBytes(attachment: Attachment): number {
  if (attachment.contentEncoding === 'BASE64') {
    return Buffer.from(attachment.body ?? '', 'base64').byteLength;
  }
  return Buffer.byteLength(attachment.body ?? '', 'utf8');
}

function scenarioStatus(results: TestStepResult[]): SummaryStatus {
  if (results.length === 0) return 'unknown';
  return toStatus(getWorstTestStepResult(results).status);
}

function statusOrdinal(status: SummaryStatus): number {
  return STATUS_ORDER.indexOf(status.toUpperCase() as TestStepResultStatus);
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
        for (const step of child.background.steps) {
          stepKeywords.set(step.id, step.keyword ?? '');
        }
      }
      if (child.scenario) {
        for (const step of child.scenario.steps) {
          stepKeywords.set(step.id, step.keyword ?? '');
        }
      }
      if ('rule' in child && child.rule) visit(child.rule.children);
    }
  };

  visit(document.children);
  return { featureName: document.name, stepKeywords };
}

/**
 * Builds a stable, renderer-independent summary from Cucumber Messages.
 * This is the machine-readable contract for agents and CI tools.
 */
export function summarizeEnvelopes(input: Envelope[]): ReportSummary {
  const envelopes = sanitizeEnvelopes(input);
  const features = new Map<string, Feature>();
  const pickles = new Map<string, Pickle>();
  const testCases = new Map<string, TestCase>();
  const testCaseStarteds = new Map<string, TestCaseStarted>();
  const testSteps = new Map<string, TestStep>();
  const hooks = new Map<string, Hook>();
  const results = new Map<string, TestStepFinished[]>();
  const attachments = new Map<string, Attachment[]>();
  const attachmentList: Attachment[] = [];

  for (const envelope of envelopes) {
    if (envelope.gherkinDocument?.feature) {
      features.set(envelope.gherkinDocument.uri ?? '', envelope.gherkinDocument.feature);
    }
    if (envelope.pickle) pickles.set(envelope.pickle.id, envelope.pickle);
    if (envelope.testCase) {
      testCases.set(envelope.testCase.id, envelope.testCase);
      for (const step of envelope.testCase.testSteps) testSteps.set(step.id, step);
    }
    if (envelope.testCaseStarted) {
      testCaseStarteds.set(envelope.testCaseStarted.id, envelope.testCaseStarted);
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

  const latestByPickle = new Map<string, TestCaseStarted>();
  for (const testCase of testCases.values()) {
    for (const started of testCaseStarteds.values()) {
      if (started.testCaseId !== testCase.id) continue;
      const current = latestByPickle.get(testCase.pickleId);
      if (
        !current ||
        started.attempt > current.attempt ||
        (started.attempt === current.attempt &&
          (started.timestamp?.seconds ?? 0) > (current.timestamp?.seconds ?? 0))
      ) {
        latestByPickle.set(testCase.pickleId, started);
      }
    }
  }

  const scenarioCounts = emptyCounts();
  const stepCounts = emptyCounts();
  const scenarios: SummaryScenario[] = [];
  let totalDuration = 0;

  for (const pickle of pickles.values()) {
    const testCase = [...testCases.values()].find(
      (candidate) => candidate.pickleId === pickle.id,
    );
    const started = latestByPickle.get(pickle.id);
    const finished = started ? (results.get(started.id) ?? []) : [];
    const resultByStep = new Map(
      finished.map((entry) => [entry.testStepId, entry.testStepResult]),
    );
    const tree = featureTree(features.get(pickle.uri));
    const pickleSteps = new Map(pickle.steps.map((step) => [step.id, step]));

    const steps: SummaryStep[] = [];
    for (const testStep of testCase?.testSteps ?? []) {
      const result = resultByStep.get(testStep.id);
      if (!result) continue;

      if (testStep.pickleStepId) {
        const pickleStep = pickleSteps.get(testStep.pickleStepId);
        const astNodeId = pickleStep?.astNodeIds[0];
        steps.push({
          keyword: astNodeId ? (tree.stepKeywords.get(astNodeId) ?? '') : '',
          text: pickleStep?.text ?? '',
          status: toStatus(result.status),
          durationMs: durationMs(result.duration),
          ...(result.message ? { message: result.message } : {}),
        });
      } else if (testStep.hookId) {
        const hook = hooks.get(testStep.hookId);
        steps.push({
          keyword: 'Hook',
          text: hook?.type ?? 'hook',
          status: toStatus(result.status),
          durationMs: durationMs(result.duration),
          ...(result.message ? { message: result.message } : {}),
        });
      }
    }

    const rawResults = finished.map((entry) => entry.testStepResult);
    const status = scenarioStatus(rawResults);
    const scenarioDuration = steps.reduce((sum, step) => sum + step.durationMs, 0);
    const scenarioAttachments = started ? (attachments.get(started.id) ?? []) : [];

    countStatus(scenarioCounts, status);
    for (const step of steps) countStatus(stepCounts, step.status);
    totalDuration += scenarioDuration;

    scenarios.push({
      name: pickle.name,
      uri: pickle.uri,
      feature: tree.featureName,
      status,
      durationMs: Math.round(scenarioDuration * 1000) / 1000,
      attempt: started?.attempt ?? 0,
      tags: pickle.tags.map((tag) => tag.name),
      attachments: scenarioAttachments.length,
      steps,
    });
  }

  scenarios.sort((a, b) => a.uri.localeCompare(b.uri) || a.name.localeCompare(b.name));

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

  return {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    status: overall,
    durationMs: Math.round(totalDuration * 1000) / 1000,
    counts: {
      scenarios: scenarioCounts,
      steps: stepCounts,
    },
    attachments: {
      total: attachmentList.length,
      bytes: attachmentList.reduce(
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
