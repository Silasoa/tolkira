import { getWorstTestStepResult } from '@cucumber/messages';
import type {
  Attachment,
  Duration,
  Envelope,
  Feature,
  TestStepResult,
} from '@cucumber/messages';
import { loadEnvelopes } from './input/load.js';
import { sanitizeEnvelopes } from './input/sanitize.js';
import { stripAnsi } from './text.js';
import { stepResultMessage } from './result-message.js';
import {
  indexRun,
  type RunIndex,
  type RunStepDefinition,
} from './report/index-run.js';
import { type ReportStatus, statusSeverity, worstExecutedStatus } from './report/status.js';

export const SUMMARY_SCHEMA_VERSION = 2;

export type SummaryStatus = ReportStatus;

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
  name?: string;
  status: SummaryStatus;
  durationMs: number;
  message?: string;
  suggestions?: Array<{ language?: string; code: string }>;
  definitions?: Array<{ pattern: string; source?: string }>;
}

export interface SummaryScenario {
  name: string;
  uri: string;
  feature: string;
  status: SummaryStatus;
  /** True when the selected test case reported at least one raw result. */
  executed: boolean;
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

export function displayUri(uri: string): string {
  const normalized = uri.replace(/\\/g, '/').replace(/^file:\/\/+/i, '');
  if (!/^[a-z]:\//i.test(normalized) && !normalized.startsWith('/')) {
    return normalized;
  }
  const marker = normalized.lastIndexOf('/features/');
  if (marker >= 0) return normalized.slice(marker + 1);
  const parts = normalized
    .replace(/^[a-z]:/i, '')
    .split('/')
    .filter(Boolean);
  // Drop a home directory so a user name never reaches the report.
  if (
    parts.length > 1 &&
    /^(Users|home|Documents and Settings)$/i.test(parts[0] ?? '')
  ) {
    parts.splice(0, 2);
  }
  return parts.slice(-3).join('/') || uri;
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
  return summarizeIndex(indexRun(sanitizeEnvelopes(input)));
}

/** Builds the summary from an index already reduced from sanitized envelopes. */
export function summarizeIndex(index: RunIndex): ReportSummary {
  const scenarioCounts = emptyCounts();
  const stepCounts = emptyCounts();
  const scenarios: SummaryScenario[] = [];
  const countedAttachments = new Set<Attachment>();
  const featureSet = new Set<Feature>();
  let totalDuration = 0;

  for (const pickle of index.pickles.values()) {
    const testCases = index.testCasesByPickle.get(pickle.id) ?? [];
    const testSteps = testCases.flatMap((testCase) => testCase.testSteps);
    const started = index.attempts.get(pickle.id);
    // Never-started pickles stay pruned from entries and counts.
    if (!started) continue;
    const finished = index.results.get(started.id) ?? [];
    const resultByStep = new Map(
      finished.map((entry) => [entry.testStepId, entry.testStepResult]),
    );
    const feature =
      index.featureByScenarioId.get(pickle.astNodeIds[0] ?? '') ??
      index.featuresByUri.get(pickle.uri);
    if (feature) featureSet.add(feature);
    const featureName = feature?.name ?? '';
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
        const status = toStatus(result.status);
        const stepSuggestions =
          status === 'undefined'
            ? (index.suggestions.get(testStep.pickleStepId) ?? [])
            : [];
        const definitionIds =
          status === 'ambiguous' && Array.isArray(testStep.stepDefinitionIds)
            ? testStep.stepDefinitionIds
            : [];
        const stepMatches = definitionIds
          .map((id) => index.definitions.get(id))
          .filter(
            (definition): definition is RunStepDefinition =>
              Boolean(definition),
          )
          .map(({ pattern, uri, line }) => {
            const display = displayUri(uri);
            return {
              pattern,
              ...(display
                ? line
                  ? { source: `${display}:${line}` }
                  : { source: display }
                : {}),
            };
          });
        steps.push({
          keyword: astNodeId
            ? (index.steps.get(astNodeId)?.keyword ?? '').trim()
            : '',
          text: pickleStep?.text ?? '',
          status,
          durationMs: durationMs(result.duration),
          ...(message ? { message: stripAnsi(message) } : {}),
          ...(stepSuggestions.length > 0
            ? { suggestions: stepSuggestions }
            : {}),
          ...(stepMatches.length > 0 ? { definitions: stepMatches } : {}),
        });
      } else if (testStep.hookId) {
        const hook = index.hooks.get(testStep.hookId);
        steps.push({
          keyword: 'Hook',
          text: hook?.type ?? 'hook',
          ...(hook?.name ? { name: hook.name } : {}),
          status: toStatus(result.status),
          durationMs: durationMs(result.duration),
          ...(message ? { message: stripAnsi(message) } : {}),
        });
      }
    }

    const status = scenarioStatus(finished.map((entry) => entry.testStepResult));
    const executed = finished.length > 0;
    const scenarioDuration = steps.reduce((sum, step) => sum + step.durationMs, 0);
    const scenarioAttachments = executed
      ? (index.attachmentsByStarted.get(started.id) ?? [])
      : [];
    for (const attachment of scenarioAttachments) countedAttachments.add(attachment);

    if (executed) {
      countStatus(scenarioCounts, status);
      for (const step of steps) countStatus(stepCounts, step.status);
    }
    totalDuration += scenarioDuration;

    scenarios.push({
      name: pickle.name ?? '',
      uri: displayUri(pickle.uri ?? ''),
      feature: featureName,
      status,
      executed,
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

  const runHookResults: TestStepResult[] = [];
  for (const start of index.runHookStarts.values()) {
    const result = index.runHookFinishes.get(start.id)?.result;
    if (result) runHookResults.push(result);
  }
  const runHookStatus = scenarioStatus(runHookResults);
  totalDuration += runHookResults.reduce(
    (sum, result) => sum + durationMs(result.duration),
    0,
  );

  const executedScenarios = scenarios.filter((scenario) => scenario.executed);
  const scenarioOverall = worstExecutedStatus(executedScenarios);
  const overall =
    executedScenarios.length === 0
      ? runHookStatus === 'failed'
        ? 'failed'
        : 'unknown'
      : statusSeverity(runHookStatus) > statusSeverity(scenarioOverall)
        ? runHookStatus
        : scenarioOverall;

  const orphanAttachments = index.attachments.filter(
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
