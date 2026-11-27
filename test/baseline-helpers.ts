import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect } from 'vitest';
import { runCli } from '../src/cli.js';
import type {
  BaselineBlock,
  BaselineCounts,
  BaselineScenario,
} from '../src/baseline.js';
import {
  SUMMARY_SCHEMA_VERSION,
  summarizeReport,
  type BaselineRenderOptions,
  type BaselineSummary,
  type ReportSummary,
  type SummaryScenario,
} from '../src/index.js';

export type {
  BaselineBlock,
  BaselineCounts,
  BaselineRenderOptions,
  BaselineScenario,
  BaselineSummary,
};

export type SummaryWithBaseline = ReportSummary & { baseline?: BaselineBlock };

export const summarizeWithBaseline = summarizeReport;

export const BASELINE_MAX_BYTES = 10_485_760;

const dirs: string[] = [];

export async function makeTempDir(
  prefix = 'tolkira-baseline-',
): Promise<string> {
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

interface SyntheticScenario {
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
function legacyJson(features: SyntheticFeature[]): string {
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
  return {
    schemaVersion: summary.schemaVersion,
    status: summary.status,
    scenarios: summary.scenarios.map((row) => ({
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
    schemaVersion: SUMMARY_SCHEMA_VERSION,
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
  expect(summary.baseline, 'baseline block').toBeDefined();
  return summary.baseline as BaselineBlock;
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
  return scenarioOf(summary, name, uri)?.change;
}

export function exampleOf(
  summary: ReportSummary,
  name: string,
  uri?: string,
): string | undefined {
  return scenarioOf(summary, name, uri)?.example;
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

/** The row header of the scenario matching a display URI and name. */
export function scenarioSummaryFor(
  html: string,
  uri: string,
  name: string,
): string {
  const rows = html.split(
    /<details class="scenario"|<div class="scenario" id=/,
  );
  for (const row of rows.slice(1)) {
    const tag = row.slice(0, row.indexOf('>'));
    if (
      tag.includes(`data-uri="${uri}"`) &&
      tag.includes(`data-scenario-name="${name}"`)
    ) {
      const ends = [row.indexOf('</summary>'), row.indexOf('</div>')].filter(
        (position) => position >= 0,
      );
      return row.slice(0, Math.min(...ends));
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
    schemaVersion: SUMMARY_SCHEMA_VERSION,
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
    schemaVersion: SUMMARY_SCHEMA_VERSION,
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
