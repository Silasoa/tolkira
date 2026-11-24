import { getWorstTestStepResult } from '@cucumber/messages';
import type {
  Attachment,
  Duration,
  Envelope,
  Feature,
  Pickle,
  TestStepResult,
} from '@cucumber/messages';
import type {
  BaselineBlock,
  BaselineChange,
  BaselineComparison,
} from './baseline.js';
import { attachmentBytes } from './attachment.js';
import { sanitizeEnvelopes } from './input/sanitize.js';
import { stripAnsi } from './text.js';
import { stepResultMessage } from './result-message.js';
import {
  indexRun,
  renderedCaseAttachments,
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
  /** Baseline classification; present only with a baseline and a claim. */
  change?: BaselineChange;
  durationMs: number;
  attempt: number;
  /** Messages outline coordinate, `#<examples>.<example>`, 1-based. */
  example?: string;
  tags: string[];
  attachments: number;
  steps: SummaryStep[];
}

/** The identity fields the baseline matcher needs from a current row. */
export interface SummaryScenarioIdentity {
  id: string;
  feature: string;
  name: string;
  uri: string;
  status: SummaryStatus;
  executed: boolean;
  example?: string;
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
  /** Present only when a baseline was supplied. */
  baseline?: BaselineBlock;
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

function featureFor(index: RunIndex, pickle: Pickle): Feature | undefined {
  return (
    index.featureByScenarioId.get(pickle.astNodeIds[0] ?? '') ??
    index.featuresByUri.get(pickle.uri)
  );
}

/** The same coordinate the report model labels a grouped outline row with. */
function exampleCoordinate(
  index: RunIndex,
  pickle: Pickle,
): string | undefined {
  const astIds = pickle.astNodeIds ?? [];
  const candidate = astIds.length
    ? index.outlineRows.get(astIds.at(-1) ?? '')
    : undefined;
  const row =
    candidate &&
    astIds.includes(candidate.scenario.id) &&
    (!candidate.uri || !pickle.uri || candidate.uri === pickle.uri)
      ? candidate
      : undefined;
  return row ? `#${row.examplesIndex + 1}.${row.exampleIndex + 1}` : undefined;
}

/**
 * Builds a stable, renderer-independent summary from Cucumber Messages.
 * This is the machine-readable contract for agents and CI tools.
 */
export function summarizeEnvelopes(
  input: Envelope[],
  comparison?: BaselineComparison,
): ReportSummary {
  return summarizeIndex(indexRun(sanitizeEnvelopes(input)), comparison);
}

/** Builds the summary from an index already reduced from sanitized envelopes. */
export function summarizeIndex(
  index: RunIndex,
  comparison?: BaselineComparison,
): ReportSummary {
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
    const feature = featureFor(index, pickle);
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
    const example = exampleCoordinate(index, pickle);
    const change = comparison?.changes.get(pickle.id);
    const scenarioDuration = steps.reduce((sum, step) => sum + step.durationMs, 0);
    const selectedCase = index.testCases.get(started.testCaseId);
    const scenarioAttachments =
      executed && selectedCase
        ? renderedCaseAttachments(index, selectedCase, started.id)
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
      ...(change ? { change } : {}),
      durationMs: finiteDuration(scenarioDuration),
      attempt: started?.attempt ?? 0,
      ...(example ? { example } : {}),
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

  // The run total is the union of rendered scenario attachments, attachments
  // on run-hook starts present in the stream, and run-level attachments.
  for (const start of index.runHookStarts.keys()) {
    for (const attachment of index.runHookAttachments.get(start) ?? []) {
      countedAttachments.add(attachment);
    }
  }
  for (const attachment of index.runAttachments) {
    countedAttachments.add(attachment);
  }
  const renderedAttachments = [...countedAttachments];

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
      total: renderedAttachments.length,
      bytes: renderedAttachments.reduce(
        (sum, attachment) => sum + attachmentBytes(attachment),
        0,
      ),
    },
    ...(comparison ? { baseline: comparison.block } : {}),
    scenarios,
  };
}

/**
 * The current-run identity rows the baseline matcher compares against. The
 * fields and the example coordinate come from the same helpers as the summary,
 * so the report, summary and matcher cannot drift.
 */
export function scenarioIdentities(index: RunIndex): SummaryScenarioIdentity[] {
  const rows: SummaryScenarioIdentity[] = [];
  for (const pickle of index.pickles.values()) {
    const started = index.attempts.get(pickle.id);
    if (!started) continue;
    const finished = index.results.get(started.id) ?? [];
    const feature = featureFor(index, pickle);
    const example = exampleCoordinate(index, pickle);
    rows.push({
      id: pickle.id,
      feature: feature?.name ?? '',
      name: pickle.name ?? '',
      uri: displayUri(pickle.uri ?? ''),
      status: scenarioStatus(finished.map((entry) => entry.testStepResult)),
      executed: finished.length > 0,
      ...(example ? { example } : {}),
    });
  }
  return rows;
}
