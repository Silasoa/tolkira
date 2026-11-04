import { loadEnvelopes } from './input/load.js';
import { renderHtml } from './render/html.js';
import { summarizeEnvelopes } from './summary.js';
import type { ReportSummary } from './summary.js';

export const version = '0.1.0';
export const phase = 'development';

export type {
  ReportSummary,
  StatusCounts,
  SummaryScenario,
  SummaryStatus,
  SummaryStep,
} from './summary.js';
export { summarizeReport, SUMMARY_SCHEMA_VERSION } from './summary.js';

export interface RenderReportOptions {
  title?: string;
  metadata?: Record<string, string>;
  logo?: string;
  accent?: string;
}

export interface GeneratedReport {
  html: string;
  summary: ReportSummary;
}

export async function generateReport(
  inputs: string | string[],
  options: RenderReportOptions = {},
): Promise<GeneratedReport> {
  const envelopes = await loadEnvelopes(inputs);
  const summary = summarizeEnvelopes(envelopes);
  return {
    html: await renderHtml(envelopes, {
      title: options.title ?? 'Tolkira report',
      metadata: options.metadata,
      logo: options.logo,
      accent: options.accent,
      summary,
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
