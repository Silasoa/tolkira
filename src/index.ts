import { loadInputs, provenanceFor } from './input/load.js';
import { renderOptions, type RenderReportOptions } from './options.js';
import { renderHtml } from './render/html.js';
import { summarizeEnvelopes } from './summary.js';
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
  const envelopes = groups.flatMap((group) => group.envelopes);
  const summary = summarizeEnvelopes(envelopes);
  return {
    html: await renderHtml(envelopes, {
      ...renderOptions(options),
      summary,
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
