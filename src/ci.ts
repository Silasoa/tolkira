import type {
  ReportSummary,
  StatusCounts,
  SummaryScenario,
  SummaryStatus,
} from './summary.js';
import { stripAnsi } from './text.js';

export type CiFormat = 'github' | 'azure' | 'markdown';

export interface CiFormatOptions {
  /** Markdown heading; defaults to "Tolkira report". */
  title?: string;
}

const ERROR_STATUSES = new Set<SummaryStatus>([
  'failed',
  'undefined',
  'ambiguous',
]);
const NOTICE_STATUSES = new Set<SummaryStatus>([
  'skipped',
  'pending',
  'unknown',
]);
const STATUS_LABELS: Array<[SummaryStatus, string]> = [
  ['passed', 'passed'],
  ['failed', 'failed'],
  ['skipped', 'skipped'],
  ['pending', 'pending'],
  ['undefined', 'undefined'],
  ['ambiguous', 'ambiguous'],
  ['unknown', 'unknown'],
];

const CI_IDENTITY_LIMIT = 200;
const GITHUB_MESSAGE_LIMIT = 4000;
const GITHUB_ERROR_LIMIT = 50;
const GITHUB_NOTICE_LIMIT = 20;
const AZURE_MESSAGE_LIMIT = 4000;
const AZURE_ERROR_LIMIT = 50;
const AZURE_WARNING_LIMIT = 20;
const MARKDOWN_MESSAGE_LIMIT = 500;
const MARKDOWN_FAILED_LIMIT = 50;
const MARKDOWN_SKIPPED_LIMIT = 20;
const RUN_FAILED_MESSAGE =
  'Run failed: The report summary is failed ' +
  'but no scenario-level error was emitted.';
const RUN_FAILED_ANNOTATION = `::error title=Tolkira::${RUN_FAILED_MESSAGE}`;

function escapeGitHubProperty(value: string): string {
  return value
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A')
    .replaceAll(':', '%3A')
    .replaceAll(',', '%2C');
}

function escapeGitHubMessage(value: string): string {
  return value
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

function truncateCodePoints(text: string, limit: number): string {
  if (text.length <= limit) return text;
  let end = 0;
  let codePoints = 0;
  // Truncate by code point so a surrogate pair is never split.
  while (end < text.length && codePoints < limit) {
    end += (text.codePointAt(end) ?? 0) > 0xffff ? 2 : 1;
    codePoints += 1;
  }
  return text.slice(0, end);
}

function truncate(text: string, limit: number): string {
  const raw = truncateCodePoints(text, limit);
  return raw === text ? text : `${raw}[truncated]`;
}

function scenarioIdentity(scenario: SummaryScenario): string {
  return scenario.feature
    ? `${scenario.feature}: ${scenario.name}`
    : scenario.name;
}

function failureMessage(scenario: SummaryScenario): string {
  const messages = scenario.steps.filter((entry) => entry.message);
  // A skipped step's message is never the failure.
  const step =
    messages.find((entry) => ERROR_STATUSES.has(entry.status)) ??
    messages.find(
      (entry) => entry.status !== 'passed' && entry.status !== 'skipped',
    );
  return step?.message ?? 'Scenario failed';
}

function unexecutedCount(summary: ReportSummary): number {
  return summary.scenarios.filter((scenario) => !scenario.executed).length;
}

function isEmptyRun(summary: ReportSummary): boolean {
  return summary.counts.scenarios.total === 0 && summary.scenarios.length === 0;
}

function nonZeroBuckets(counts: StatusCounts): string[] {
  const buckets: string[] = [];
  for (const [status, label] of STATUS_LABELS) {
    if (counts[status] > 0) buckets.push(`${counts[status]} ${label}`);
  }
  return buckets;
}

function finalGitHubNotice(summary: ReportSummary, runFailed: boolean): string {
  const unexecuted = unexecutedCount(summary);
  const suffix = runFailed ? '; run failed' : '';
  if (summary.counts.scenarios.total === 0) {
    return (
      '::notice title=Tolkira::0 executed scenarios: ' +
      `${unexecuted} unexecuted${suffix}`
    );
  }
  const parts = nonZeroBuckets(summary.counts.scenarios);
  parts.push(`${unexecuted} unexecuted`);
  return (
    `::notice title=Tolkira::${summary.counts.scenarios.total} scenarios: ` +
    `${parts.join(', ')}${suffix}`
  );
}

/** Formats the summary as GitHub Actions workflow commands. */
export function formatGitHubAnnotations(summary: ReportSummary): string {
  const emptyRunFailed = summary.status === 'failed';
  if (isEmptyRun(summary)) {
    const lines = emptyRunFailed
      ? [RUN_FAILED_ANNOTATION, '::notice title=Tolkira::No scenarios']
      : ['::notice title=Tolkira::No scenarios'];
    return `${lines.join('\n')}\n`;
  }

  const lines: string[] = [];
  let errorCount = 0;
  let noticeCount = 0;
  let omitted = 0;
  for (const scenario of summary.scenarios) {
    if (!scenario.executed) continue;
    if (ERROR_STATUSES.has(scenario.status)) {
      if (errorCount >= GITHUB_ERROR_LIMIT) {
        omitted += 1;
        continue;
      }
      errorCount += 1;
      const title = escapeGitHubProperty(
        truncate(scenarioIdentity(scenario), CI_IDENTITY_LIMIT),
      );
      const message = escapeGitHubMessage(
        truncate(failureMessage(scenario), GITHUB_MESSAGE_LIMIT),
      );
      lines.push(`::error title=${title}::${message}`);
    } else if (NOTICE_STATUSES.has(scenario.status)) {
      if (noticeCount >= GITHUB_NOTICE_LIMIT) {
        omitted += 1;
        continue;
      }
      noticeCount += 1;
      const message = escapeGitHubMessage(
        truncate(
          `${scenarioIdentity(scenario)} was ${scenario.status}`,
          GITHUB_MESSAGE_LIMIT,
        ),
      );
      const title =
        scenario.status.charAt(0).toUpperCase() + scenario.status.slice(1);
      lines.push(`::notice title=${title}::${message}`);
    }
  }

  // A failed run-level result (for example a global hook) has no scenario.
  const runFailed = summary.status === 'failed' && errorCount === 0;
  if (runFailed) {
    lines.push(RUN_FAILED_ANNOTATION);
  }
  if (omitted > 0) {
    lines.push(`::notice title=Tolkira::${omitted} more annotations omitted`);
  }
  lines.push(finalGitHubNotice(summary, runFailed));
  return `${lines.join('\n')}\n`;
}

function escapeAzureMessage(value: string): string {
  return value
    .replaceAll('%', '%AZP25')
    .replaceAll('\r', '%0D')
    .replaceAll(/[\n\u2028\u2029\u0085]/g, '%0A')
    .replaceAll(']', '%5D');
}

// The truncation marker is presentation, not input data, so it stays readable.
// shortcut: 4000 code points can expand to ~24 KB after % escaping; Azure line
// limits are provider-specific, so the limit counts code points, not bytes.
function azureMessage(value: string): string {
  const text = stripAnsi(value);
  const raw = truncateCodePoints(text, AZURE_MESSAGE_LIMIT);
  const marker = raw === text ? '' : '[truncated]';
  return `${escapeAzureMessage(raw)}${marker}`;
}

function finalAzureSection(summary: ReportSummary, runFailed: boolean): string {
  const unexecuted = unexecutedCount(summary);
  const suffix = runFailed ? '; run failed' : '';
  if (isEmptyRun(summary)) return `##[section]Tolkira: No scenarios${suffix}`;
  if (summary.counts.scenarios.total === 0) {
    return (
      '##[section]Tolkira: 0 executed scenarios; ' +
      `${unexecuted} unexecuted${suffix}`
    );
  }
  const parts = nonZeroBuckets(summary.counts.scenarios);
  return (
    `##[section]Tolkira: ${summary.counts.scenarios.total} scenarios: ` +
    `${parts.join(', ')}; ${unexecuted} unexecuted${suffix}`
  );
}

/** Formats the summary as Azure DevOps logging commands. */
export function formatAzureAnnotations(summary: ReportSummary): string {
  const errorLines: string[] = [];
  const warningLines: string[] = [];
  let errorCount = 0;
  let warningCount = 0;
  let omitted = 0;

  if (!isEmptyRun(summary)) {
    for (const scenario of summary.scenarios) {
      if (!scenario.executed || !ERROR_STATUSES.has(scenario.status)) continue;
      if (errorCount >= AZURE_ERROR_LIMIT) {
        omitted += 1;
        continue;
      }
      errorCount += 1;
      const message = `${scenarioIdentity(scenario)} — ${failureMessage(scenario)}`;
      errorLines.push(
        `##vso[task.logissue type=error]${azureMessage(message)}`,
      );
    }
    for (const scenario of summary.scenarios) {
      if (!scenario.executed || !NOTICE_STATUSES.has(scenario.status)) continue;
      if (warningCount >= AZURE_WARNING_LIMIT) {
        omitted += 1;
        continue;
      }
      warningCount += 1;
      const message = `${scenarioIdentity(scenario)} was ${scenario.status}`;
      warningLines.push(
        `##vso[task.logissue type=warning]${azureMessage(message)}`,
      );
    }
  }

  const lines = [...errorLines, ...warningLines];
  // A failed run-level result (for example a global hook) has no scenario.
  const runFailed = summary.status === 'failed' && errorCount === 0;
  if (runFailed) {
    lines.push(
      '##vso[task.logissue type=error]' +
        escapeAzureMessage(RUN_FAILED_MESSAGE),
    );
  }
  if (omitted > 0) {
    lines.push(
      `##vso[task.logissue type=warning]Tolkira: ${omitted} more annotations omitted`,
    );
  }
  lines.push(finalAzureSection(summary, runFailed));
  return `${lines.join('\n')}\n`;
}

function longestBacktickRun(text: string): number {
  let longest = 0;
  for (const match of text.matchAll(/`+/g)) {
    longest = Math.max(longest, match[0].length);
  }
  return longest;
}

// ANSI, controls and any line ending would end the code span and let the
// dynamic text become active Markdown.
function inlineText(value: string): string {
  return stripAnsi(value).replaceAll(/[\r\n\u2028\u2029]+/g, ' ');
}

const MARKDOWN_SPECIALS = /[\\`*_[\]<>|!#]/g;

function markdownText(value: string): string {
  return inlineText(value).replaceAll(MARKDOWN_SPECIALS, '\\$&');
}

function codeSpan(text: string): string {
  const safe = inlineText(text);
  const fence = '`'.repeat(longestBacktickRun(safe) + 1);
  const pad = safe.startsWith('`') || safe.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${safe}${pad}${fence}`;
}

/** Markdown identity: truncate before escaping, with a literal marker outside. */
function markdownIdentity(text: string): string {
  const raw = truncateCodePoints(text, CI_IDENTITY_LIMIT);
  const marker = raw === text ? '' : '[truncated]';
  return `${markdownText(raw)}${marker}`;
}

function fencedBlock(text: string): string[] {
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(text) + 1));
  return [fence, ...text.split('\n'), fence];
}

function markdownCountRows(
  summary: ReportSummary,
  unexecuted: number,
): Array<[string, string]> {
  const scenarioCounts = summary.counts.scenarios;
  return [
    ['Status', summary.status],
    ['Scenarios', String(scenarioCounts.total)],
    ['Passed', String(scenarioCounts.passed)],
    ['Failed', String(scenarioCounts.failed)],
    ['Skipped', String(scenarioCounts.skipped)],
    ['Pending', String(scenarioCounts.pending)],
    ['Undefined', String(scenarioCounts.undefined)],
    ['Ambiguous', String(scenarioCounts.ambiguous)],
    ['Unknown', String(scenarioCounts.unknown)],
    ['Unexecuted', String(unexecuted)],
    ['Steps failed', String(summary.counts.steps.failed)],
    ['Steps skipped', String(summary.counts.steps.skipped)],
    ['Duration', `${summary.durationMs} ms`],
    ['Attachments', String(summary.attachments.total)],
    ['Attachment bytes', String(summary.attachments.bytes)],
  ];
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function markdownFailedSection(summary: ReportSummary, lines: string[]): void {
  const failed = summary.scenarios.filter(
    (scenario) => scenario.executed && scenario.status === 'failed',
  );
  if (failed.length === 0) return;

  lines.push('### Failed scenarios', '');
  for (const scenario of failed.slice(0, MARKDOWN_FAILED_LIMIT)) {
    lines.push(
      `#### ${codeSpan(truncate(scenario.feature || 'Unknown feature', CI_IDENTITY_LIMIT))} - ` +
        codeSpan(truncate(scenario.name, CI_IDENTITY_LIMIT)),
      '',
      `URI: ${codeSpan(truncate(scenario.uri, CI_IDENTITY_LIMIT))}`,
      '',
      ...fencedBlock(
        truncate(failureMessage(scenario), MARKDOWN_MESSAGE_LIMIT),
      ),
      '',
    );
  }
  if (failed.length > MARKDOWN_FAILED_LIMIT) {
    const omitted = failed.length - MARKDOWN_FAILED_LIMIT;
    lines.push(
      `${plural(omitted, 'more failed scenario')} ` +
        `${omitted === 1 ? 'is' : 'are'} not listed.`,
      '',
    );
  }
}

function markdownSkippedSection(summary: ReportSummary, lines: string[]): void {
  const skipped = summary.scenarios.filter(
    (scenario) => scenario.executed && scenario.status === 'skipped',
  );
  const skippedCount = summary.counts.scenarios.skipped;
  if (skippedCount === 0) return;

  lines.push(
    '### Skipped scenarios',
    '',
    `${plural(skippedCount, 'skipped scenario')}.`,
  );
  const shown = skipped.slice(0, MARKDOWN_SKIPPED_LIMIT);
  if (shown.length > 0) {
    lines.push('');
    for (const scenario of shown) {
      lines.push(
        `- ${codeSpan(truncate(scenarioIdentity(scenario), CI_IDENTITY_LIMIT))}`,
      );
    }
  }
  const omitted = skippedCount - shown.length;
  if (omitted > 0) {
    lines.push(
      '',
      `${plural(omitted, 'more skipped scenario')} ` +
        `${omitted === 1 ? 'is' : 'are'} not listed.`,
    );
  }
  lines.push('');
}

/** Formats the summary as deterministic, inert Markdown. */
export function formatMarkdownSummary(
  summary: ReportSummary,
  options: CiFormatOptions = {},
): string {
  const unexecuted = unexecutedCount(summary);
  const lines = [
    `## ${markdownIdentity(options.title ?? 'Tolkira report')}`,
    '',
    '| Metric | Value |',
    '| --- | --- |',
    ...markdownCountRows(summary, unexecuted).map(
      ([label, value]) => `| ${label} | ${value} |`,
    ),
    '',
  ];

  const baseline = summary.baseline;
  if (baseline) {
    const parts = [
      plural(baseline.counts.newFailures, 'new failure'),
      `${baseline.counts.fixed} fixed`,
      `${baseline.counts.stillFailing} still failing`,
      `${baseline.counts.notInThisRun} not in this run`,
    ];
    if (baseline.counts.ambiguous > 0) {
      parts.push(plural(baseline.counts.ambiguous, 'ambiguous group'));
    }
    lines.push(`Baseline: ${parts.join(' · ')}`, '');
  }

  if (isEmptyRun(summary)) {
    lines.push('No scenarios in this report.');
    return `${lines.join('\n')}\n`;
  }

  if (summary.counts.scenarios.total === 0) {
    lines.push(`0 executed scenarios; ${unexecuted} unexecuted.`);
    return `${lines.join('\n')}\n`;
  }

  markdownFailedSection(summary, lines);
  markdownSkippedSection(summary, lines);
  return `${lines.join('\n')}\n`;
}

/** Dispatches between the CI formats. */
export function formatCiOutput(
  summary: ReportSummary,
  format: CiFormat,
  options: CiFormatOptions = {},
): string {
  if (format === 'github') return formatGitHubAnnotations(summary);
  if (format === 'azure') return formatAzureAnnotations(summary);
  return formatMarkdownSummary(summary, options);
}
