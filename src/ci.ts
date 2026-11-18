import type {
  ReportSummary,
  StatusCounts,
  SummaryScenario,
  SummaryStatus,
} from './summary.js';

export type CiFormat = 'github' | 'markdown';

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

const GITHUB_MESSAGE_LIMIT = 4000;
const GITHUB_ERROR_LIMIT = 50;
const GITHUB_NOTICE_LIMIT = 20;
const MARKDOWN_MESSAGE_LIMIT = 500;
const MARKDOWN_FAILED_LIMIT = 50;
const MARKDOWN_SKIPPED_LIMIT = 20;

function escapeGitHubProperty(value: string): string {
  return value
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');
}

function escapeGitHubMessage(value: string): string {
  return value
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}[truncated]` : text;
}

function scenarioIdentity(scenario: SummaryScenario): string {
  return scenario.feature
    ? `${scenario.feature}: ${scenario.name}`
    : scenario.name;
}

function failureMessage(scenario: SummaryScenario): string {
  const step = scenario.steps.find(
    (entry) => entry.status !== 'passed' && entry.message,
  );
  return step?.message ?? 'Scenario failed';
}

function unexecutedCount(summary: ReportSummary): number {
  return summary.scenarios.filter((scenario) => !scenario.executed).length;
}

function isEmptyRun(summary: ReportSummary): boolean {
  return (
    summary.counts.scenarios.total === 0 && summary.scenarios.length === 0
  );
}

function nonZeroBuckets(counts: StatusCounts): string[] {
  const buckets: string[] = [];
  for (const [status, label] of STATUS_LABELS) {
    if (counts[status] > 0) buckets.push(`${counts[status]} ${label}`);
  }
  return buckets;
}

function finalGitHubNotice(summary: ReportSummary): string {
  const parts = nonZeroBuckets(summary.counts.scenarios);
  parts.push(`${unexecutedCount(summary)} unexecuted`);
  return (
    `::notice title=Tolkira::${summary.counts.scenarios.total} scenarios: ` +
    parts.join(', ')
  );
}

/** Formats the summary as GitHub Actions workflow commands. */
export function formatGitHubAnnotations(
  summary: ReportSummary,
  _options?: CiFormatOptions,
): string {
  if (isEmptyRun(summary)) {
    return '::notice title=Tolkira::No scenarios\n';
  }

  const errors: string[] = [];
  const notices: string[] = [];
  for (const scenario of summary.scenarios) {
    if (!scenario.executed) continue;
    if (ERROR_STATUSES.has(scenario.status)) {
      const title = escapeGitHubProperty(scenarioIdentity(scenario));
      const message = escapeGitHubMessage(
        truncate(failureMessage(scenario), GITHUB_MESSAGE_LIMIT),
      );
      errors.push(`::error title=${title}::${message}`);
    } else if (NOTICE_STATUSES.has(scenario.status)) {
      const message = escapeGitHubMessage(
        `${scenarioIdentity(scenario)} was ${scenario.status}`,
      );
      const title =
        scenario.status.charAt(0).toUpperCase() + scenario.status.slice(1);
      notices.push(`::notice title=${title}::${message}`);
    }
  }

  const lines = [
    ...errors.slice(0, GITHUB_ERROR_LIMIT),
    ...notices.slice(0, GITHUB_NOTICE_LIMIT),
  ];
  const omitted =
    Math.max(0, errors.length - GITHUB_ERROR_LIMIT) +
    Math.max(0, notices.length - GITHUB_NOTICE_LIMIT);
  if (omitted > 0) {
    lines.push(`::notice title=Tolkira::${omitted} more annotations omitted`);
  }
  lines.push(finalGitHubNotice(summary));
  return `${lines.join('\n')}\n`;
}

function longestBacktickRun(text: string): number {
  let longest = 0;
  for (const match of text.matchAll(/`+/g)) {
    longest = Math.max(longest, match[0].length);
  }
  return longest;
}

function codeSpan(text: string): string {
  const fence = '`'.repeat(longestBacktickRun(text) + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
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

function markdownFailedSection(
  summary: ReportSummary,
  lines: string[],
): void {
  const failed = summary.scenarios.filter(
    (scenario) => scenario.executed && scenario.status === 'failed',
  );
  if (failed.length === 0) return;

  lines.push('### Failed scenarios', '');
  for (const scenario of failed.slice(0, MARKDOWN_FAILED_LIMIT)) {
    lines.push(
      `#### ${codeSpan(scenario.feature || 'Unknown feature')} - ` +
        codeSpan(scenario.name),
      '',
      `URI: ${codeSpan(scenario.uri)}`,
      '',
      ...fencedBlock(
        truncate(failureMessage(scenario), MARKDOWN_MESSAGE_LIMIT),
      ),
      '',
    );
  }
  if (failed.length > MARKDOWN_FAILED_LIMIT) {
    lines.push(
      `${failed.length - MARKDOWN_FAILED_LIMIT} more failed scenarios ` +
        'are not listed.',
      '',
    );
  }
}

function markdownSkippedSection(
  summary: ReportSummary,
  lines: string[],
): void {
  const skipped = summary.scenarios.filter(
    (scenario) => scenario.executed && scenario.status === 'skipped',
  );
  const skippedCount = summary.counts.scenarios.skipped;
  if (skippedCount === 0) return;

  lines.push('### Skipped scenarios', '', `${skippedCount} skipped scenarios.`);
  const shown = skipped.slice(0, MARKDOWN_SKIPPED_LIMIT);
  if (shown.length > 0) {
    lines.push('');
    for (const scenario of shown) {
      lines.push(`- ${codeSpan(scenarioIdentity(scenario))}`);
    }
  }
  const omitted = skippedCount - shown.length;
  if (omitted > 0) {
    lines.push('', `${omitted} more skipped scenarios are not listed.`);
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
    `## ${options.title ?? 'Tolkira report'}`,
    '',
    '| Metric | Value |',
    '| --- | --- |',
    ...markdownCountRows(summary, unexecuted).map(
      ([label, value]) => `| ${label} | ${value} |`,
    ),
    '',
  ];

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

/** Dispatches between the two CI formats. */
export function formatCiOutput(
  summary: ReportSummary,
  format: CiFormat,
  options: CiFormatOptions = {},
): string {
  return format === 'github'
    ? formatGitHubAnnotations(summary, options)
    : formatMarkdownSummary(summary, options);
}
