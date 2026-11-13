import { loadInputs, provenanceFor } from './input/load.js';
import { sanitizeEnvelopes } from './input/sanitize.js';
import { renderOptions, type RenderReportOptions } from './options.js';
import { indexRun } from './report/index-run.js';
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
export type { RenderReportOptions } from './options.js';
export { CucumberHtmlStream } from './stream.js';

export interface GeneratedReport {
  html: string;
  summary: ReportSummary;
}

export async function generateReport(
  inputs: string | string[],
  options: RenderReportOptions = {},
): Promise<GeneratedReport> {
  const groups = await loadInputs(inputs);
  const envelopes = sanitizeEnvelopes(
    groups.flatMap((group) => group.envelopes),
  );
  const index = indexRun(envelopes);
  const summary = summarizeIndex(index);
  return {
    html: await renderHtml(envelopes, {
      ...renderOptions(options),
      summary,
      index,
      provenance: groups.length > 1 ? provenanceFor(groups) : undefined,
    }),
    summary,
  };
}

export async function renderReport(
  inputs: string | string[],
  options: RenderReportOptions = {},
): Promise<string> {
  return (await generateReport(inputs, options)).html;
}
