import type { Envelope } from '@cucumber/messages';
import { appendHistory, buildHistoryRun, type HistoryRun } from './history.js';
import { loadInputs, provenanceFor } from './input/load.js';
import { sanitizeEnvelopes } from './input/sanitize.js';
import { renderOptions, type RenderReportOptions } from './options.js';
import { indexRun, type RunIndex } from './report/index-run.js';
import { renderHtml } from './render/html.js';
import { summarizeIndex } from './summary.js';
import type { ReportSummary } from './summary.js';

export const version = '0.3.0';
export const phase = 'development';

export type {
  ReportSummary,
  StatusCounts,
  SummaryScenario,
  SummaryStatus,
  SummaryStep,
} from './summary.js';
export { summarizeReport, SUMMARY_SCHEMA_VERSION } from './summary.js';
export type { HistoryRun } from './history.js';
export {
  HISTORY_LIMIT,
  HISTORY_MAX_BYTES,
  HISTORY_MAX_TITLE,
  HISTORY_SCHEMA_VERSION,
  appendHistory,
  buildHistoryRun,
  readHistory,
  writeHistory,
} from './history.js';
export type { RenderReportOptions } from './options.js';
export type { EmailOptions } from './email.js';
export { renderEmail } from './email.js';
export type { PdfOptions } from './pdf.js';
export { renderPdf } from './pdf.js';
export { CucumberHtmlStream } from './stream.js';

export interface GeneratedReport {
  html: string;
  summary: ReportSummary;
  skippedAttachments: number;
  /** The history the report was rendered with, current run appended. */
  history?: HistoryRun[];
}

interface LoadedRun {
  envelopes: Envelope[];
  index: RunIndex;
  summary: ReportSummary;
  skippedAttachments: number;
  provenance?: Map<string, string>;
}

async function loadRun(inputs: string | string[]): Promise<LoadedRun> {
  const groups = await loadInputs(inputs);
  const envelopes = sanitizeEnvelopes(
    groups.flatMap((group) => group.envelopes),
  );
  const index = indexRun(envelopes);
  return {
    envelopes,
    index,
    summary: summarizeIndex(index),
    skippedAttachments: groups.reduce(
      (sum, group) => sum + group.skippedAttachments,
      0,
    ),
    provenance: groups.length > 1 ? provenanceFor(groups) : undefined,
  };
}

function render(
  run: LoadedRun,
  options: RenderReportOptions,
  history: HistoryRun[] | undefined,
): Promise<string> {
  return renderHtml(run.envelopes, {
    ...renderOptions(options),
    ...(history === undefined ? {} : { history }),
    summary: run.summary,
    index: run.index,
    provenance: run.provenance,
    skippedAttachments: run.skippedAttachments,
  });
}

export async function generateReport(
  inputs: string | string[],
  options: RenderReportOptions = {},
): Promise<GeneratedReport> {
  const run = await loadRun(inputs);
  const history =
    options.history === undefined
      ? undefined
      : appendHistory(
          options.history,
          buildHistoryRun(run.summary, renderOptions(options).title),
        );
  return {
    html: await render(run, options, history),
    summary: run.summary,
    skippedAttachments: run.skippedAttachments,
    ...(history === undefined ? {} : { history }),
  };
}

/** Renders the HTML with the given history; records nothing. */
export async function renderReport(
  inputs: string | string[],
  options: RenderReportOptions = {},
): Promise<string> {
  return render(await loadRun(inputs), options, options.history);
}
