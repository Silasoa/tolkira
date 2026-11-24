// Shared setup for the baseline-comparison Red suite. The baseline API does not
// exist yet, so this module declares the projection and option shapes the spec
// and design pin, without importing a missing module.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect } from 'vitest';
import { runCli } from '../src/cli.js';
import {
  summarizeReport,
  type ReportSummary,
  type SummaryScenario,
  type SummaryStatus,
} from '../src/index.js';

/** The validated, read-only projection `readBaseline` returns (design). */
export interface BaselineScenario {
  feature: string;
  name: string;
  uri: string;
  status: SummaryStatus;
  executed: boolean;
  example?: string;
}

export interface BaselineSummary {
  schemaVersion: 2;
  status: SummaryStatus;
  scenarios: BaselineScenario[];
}

export interface BaselineCounts {
  newFailures: number;
  fixed: number;
  stillFailing: number;
  other: number;
  notInThisRun: number;
  added: number;
  ambiguous: number;
}

export interface BaselineBlock {
  status: SummaryStatus;
  counts: BaselineCounts;
  notInThisRun: BaselineScenario[];
}

export type SummaryWithBaseline = ReportSummary & { baseline?: BaselineBlock };

/** `GenerateReportOptions`/`RenderReportOptions` plus the pending baseline. */
export interface BaselineRenderOptions {
  title?: string;
  metadata?: Record<string, string>;
  logo?: string;
  accent?: string;
  locale?: string;
  static?: boolean;
  baseline?: BaselineSummary;
}

export interface BaselineSummarizeOptions {
  baseline?: BaselineSummary;
}

/**
 * The future `summarizeReport(inputs, options?)` signature. The current
 * implementation ignores the second argument, which is exactly the Red state.
 */
export const summarizeWithBaseline = summarizeReport as unknown as (
  inputs: string | string[],
  options?: BaselineSummarizeOptions,
) => Promise<ReportSummary>;

export const SUMMARY_SCHEMA = 2;
export const BASELINE_MAX_BYTES = 10_485_760;

const dirs: string[] = [];

export async function makeTempDir(prefix = 'tolkira-baseline-'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

export async function cleanupTempDirs(): Promise<void> {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
}

export async function writeText(
  dir: string,
  name: string,
  content: string,
): Promise<string> {
  const file = path.join(dir, name);
  await writeFile(file, content, 'utf8');
  return file;
}

export async function writeJson(
  dir: string,
  name: string,
  value: unknown,
): Promise<string> {
  return writeText(dir, name, JSON.stringify(value, null, 2));
}

export interface SyntheticScenario {
  name: string;
  /** A legacy status, or `unexecuted` for a started scenario without results. */
  status: string;
  message?: string;
}

export interface SyntheticFeature {
  name: string;
  uri: string;
  scenarios: SyntheticScenario[];
}

/** One legacy JSON document; the current-run side of every comparison. */
export function legacyJson(features: SyntheticFeature[]): string {
  return JSON.stringify(
    features.map((feature) => ({
      uri: feature.uri,
      name: feature.name,
      keyword: 'Feature',
      elements: feature.scenarios.map((scenario, index) => ({
        keyword: 'Scenario',
        type: 'scenario',
        name: scenario.name,
        line: index + 3,
        steps:
          scenario.status === 'unexecuted'
            ? []
            : [
                {
                  keyword: 'Given ',
                  name: 'a step',
                  result: {
                    status: scenario.status,
                    duration: 1,
                    ...(scenario.message
                      ? { error_message: scenario.message }
                      : {}),
                  },
                },
              ],
      })),
    })),
  );
}

export async function writeLegacyRun(
  dir: string,
  name: string,
  features: SyntheticFeature[],
): Promise<string> {
  return writeText(dir, name, legacyJson(features));
}

/** Projects a summary into the baseline the reader would return. */
export function projectSummary(summary: ReportSummary): BaselineSummary {
  const rows = summary.scenarios as Array<SummaryScenario & { example?: string }>;
  return {
    schemaVersion: summary.schemaVersion,
    status: summary.status,
    scenarios: rows.map((row) => ({
      feature: row.feature,
      name: row.name,
      uri: row.uri,
      status: row.status,
      executed: row.executed,
      ...(row.example === undefined ? {} : { example: row.example }),
    })),
  };
}

/** A valid baseline for a file; callers mutate one field per hostile case. */
export function validBaseline(): BaselineSummary {
  return {
    schemaVersion: SUMMARY_SCHEMA,
    status: 'passed',
    scenarios: [
      {
        feature: 'Checkout',
        name: 'pays by card',
        uri: 'features/checkout.feature',
        status: 'passed',
        executed: true,
      },
    ],
  };
}

export function summaryWithBaseline(
  summary: ReportSummary,
  counts: Partial<BaselineCounts>,
  notInThisRun: BaselineScenario[] = [],
): SummaryWithBaseline {
  return {
    ...summary,
    baseline: {
      status: 'failed',
      counts: {
        newFailures: 0,
        fixed: 0,
        stillFailing: 0,
        other: 0,
        notInThisRun: 0,
        added: 0,
        ambiguous: 0,
        ...counts,
      },
      notInThisRun,
    },
  };
}

export function baselineBlock(summary: ReportSummary): BaselineBlock {
  const block = (summary as SummaryWithBaseline).baseline;
  expect(block, 'baseline block').toBeDefined();
  return block as BaselineBlock;
}

export function scenarioOf(
  summary: ReportSummary,
  name: string,
  uri?: string,
): SummaryScenario | undefined {
  return summary.scenarios.find(
    (scenario) =>
      scenario.name === name && (uri === undefined || scenario.uri === uri),
  );
}

export function changeOf(
  summary: ReportSummary,
  name: string,
  uri?: string,
): string | undefined {
  return (
    scenarioOf(summary, name, uri) as
      | (SummaryScenario & { change?: string })
      | undefined
  )?.change;
}

export function exampleOf(
  summary: ReportSummary,
  name: string,
  uri?: string,
): string | undefined {
  return (
    scenarioOf(summary, name, uri) as
      | (SummaryScenario & { example?: string })
      | undefined
  )?.example;
}

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function cli(argv: string[]): Promise<CliResult> {
  let stdout = '';
  let stderr = '';
  const code = await runCli(argv, {
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { code, stdout, stderr };
}

export function parsedSummary(stdout: string): SummaryWithBaseline {
  return JSON.parse(stdout) as SummaryWithBaseline;
}

/** The panel markup: from its heading up to the needs-attention index. */
export function panelSlice(html: string): string {
  const start = html.indexOf('Compared with baseline');
  if (start < 0) return '';
  const triage = html.indexOf('data-triage', start);
  const featureList = html.indexOf('id="feature-list"', start);
  const candidates = [triage, featureList].filter((index) => index > start);
  const end = candidates.length ? Math.min(...candidates) : html.length;
  return html.slice(start, end);
}

/**
 * The panel's slot between the live region and the needs-attention index,
 * independent of the localized heading. Used by the German tests.
 */
export function panelRegion(html: string): string {
  const live = html.indexOf('id="tolkira-live"');
  if (live < 0) return '';
  const start = html.indexOf('>', live) + 1;
  const triage = html.indexOf('data-triage', start);
  const featureList = html.indexOf('id="feature-list"', start);
  const candidates = [triage, featureList].filter((index) => index > start);
  const end = candidates.length ? Math.min(...candidates) : html.length;
  return html.slice(start, end);
}

/** The `<summary>` of the scenario row matching a display URI and name. */
export function scenarioSummaryFor(
  html: string,
  uri: string,
  name: string,
): string {
  for (const row of html.split('<details class="scenario"').slice(1)) {
    const tag = row.slice(0, row.indexOf('>'));
    if (
      tag.includes(`data-uri="${uri}"`) &&
      tag.includes(`data-scenario-name="${name}"`)
    ) {
      return row.slice(0, row.indexOf('</summary>'));
    }
  }
  return '';
}

export function styleBlock(html: string): string {
  return /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
}

/** A JSON document padded to an exact byte length (ASCII padding). */
export function baselineOfSize(bytes: number): string {
  const base = {
    schemaVersion: SUMMARY_SCHEMA,
    status: 'passed',
    scenarios: [],
    padding: '',
  };
  const skeleton = JSON.stringify(base);
  const padding = 'x'.repeat(bytes - Buffer.byteLength(skeleton, 'utf8'));
  return JSON.stringify({ ...base, padding });
}

/**
 * The mixed run used by the panel, JSON and CI tests: two matched new
 * failures, one fixed, three still failing, two no-claim rows, one added and
 * one baseline row that is not in the current run.
 */
export function mixedFeatures(): SyntheticFeature[] {
  return [
    {
      name: 'Checkout',
      uri: 'features/checkout.feature',
      scenarios: [
        { name: 'new one', status: 'failed' },
        { name: 'new two', status: 'failed' },
        { name: 'fixed one', status: 'passed' },
        { name: 'still one', status: 'failed' },
        { name: 'still two', status: 'ambiguous' },
        { name: 'still three', status: 'undefined' },
        { name: 'other one', status: 'skipped' },
        { name: 'added one', status: 'passed' },
        { name: 'unchanged one', status: 'passed' },
      ],
    },
  ];
}

export function mixedBaseline(): BaselineSummary {
  return {
    schemaVersion: SUMMARY_SCHEMA,
    status: 'failed',
    scenarios: [
      {
        feature: 'Checkout',
        name: 'new one',
        uri: 'features/checkout.feature',
        status: 'passed',
        executed: true,
      },
      {
        feature: 'Checkout',
        name: 'new two',
        uri: 'features/checkout.feature',
        status: 'unknown',
        executed: false,
      },
      {
        feature: 'Checkout',
        name: 'fixed one',
        uri: 'features/checkout.feature',
        status: 'failed',
        executed: true,
      },
      {
        feature: 'Checkout',
        name: 'still one',
        uri: 'features/checkout.feature',
        status: 'failed',
        executed: true,
      },
      {
        feature: 'Checkout',
        name: 'still two',
        uri: 'features/checkout.feature',
        status: 'undefined',
        executed: true,
      },
      {
        feature: 'Checkout',
        name: 'still three',
        uri: 'features/checkout.feature',
        status: 'failed',
        executed: true,
      },
      {
        feature: 'Checkout',
        name: 'other one',
        uri: 'features/checkout.feature',
        status: 'failed',
        executed: true,
      },
      {
        feature: 'Checkout',
        name: 'unchanged one',
        uri: 'features/checkout.feature',
        status: 'passed',
        executed: true,
      },
      {
        feature: 'Checkout',
        name: 'gone one',
        uri: 'features/checkout.feature',
        status: 'failed',
        executed: true,
      },
    ],
  };
}
