import { resolveInputFiles } from './input/load.js';
import type { BaselineRenderOptions } from './options.js';
import {
  generateReportFromResolved,
  renderReportFromResolved,
  summarizeReportFromResolved,
  type GeneratedReport,
  type GenerateReportOptions,
} from './run.js';
import type { ReportSummary } from './summary.js';

export const version = '0.6.0';
export const phase = 'development';

export type {
  ReportSummary,
  StatusCounts,
  SummaryScenario,
  SummaryStatus,
  SummaryStep,
} from './summary.js';
export { SUMMARY_SCHEMA_VERSION } from './summary.js';
export type { BaselineSummary } from './baseline.js';
export type { HistoryRun } from './history.js';
export {
  HISTORY_LIMIT,
  HISTORY_LIMIT_MAX,
  HISTORY_MAX_BYTES,
  HISTORY_MAX_ID,
  HISTORY_MAX_TITLE,
  HISTORY_SCHEMA_VERSION,
  HISTORY_SCHEMA_VERSION_MAX,
  appendHistory,
  buildHistoryRun,
  readHistory,
  writeHistory,
} from './history.js';
export type {
  BaselineRenderOptions,
  RenderReportOptions,
} from './options.js';
export type { EmailOptions } from './email.js';
export { renderEmail } from './email.js';
export type { PdfOptions } from './pdf.js';
export { renderPdf } from './pdf.js';
export { CucumberHtmlStream } from './stream.js';
export type { GeneratedReport, GenerateReportOptions } from './run.js';

export async function generateReport(
  inputs: string | string[],
  options: GenerateReportOptions = {},
): Promise<GeneratedReport> {
  return generateReportFromResolved(await resolveInputFiles(inputs), options);
}

/** Renders the HTML with the given history; records nothing. */
export async function renderReport(
  inputs: string | string[],
  options: BaselineRenderOptions = {},
): Promise<string> {
  return renderReportFromResolved(await resolveInputFiles(inputs), options);
}

/** Builds the stable JSON summary, optionally with a baseline comparison. */
export async function summarizeReport(
  inputs: string | string[],
  options: BaselineRenderOptions = {},
): Promise<ReportSummary> {
  return summarizeReportFromResolved(
    await resolveInputFiles(inputs),
    options.baseline,
  );
}
