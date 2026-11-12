import { Transform, type TransformCallback } from 'node:stream';
import type { Envelope } from '@cucumber/messages';
import { loadInputs, provenanceFor } from './input/load.js';
import { renderHtml } from './render/html.js';
import { summarizeEnvelopes } from './summary.js';
import type { ReportSummary } from './summary.js';

export const version = '0.2.0';
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

function renderOptions(options: RenderReportOptions) {
  return {
    title: options.title ?? 'Tolkira report',
    metadata: options.metadata,
    logo: options.logo,
    accent: options.accent,
  };
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

/**
 * A `CucumberHtmlStream`-shaped adapter for Cucumber Messages. It collects
 * envelopes and renders one HTML document on flush with the same options and
 * renderer as `renderReport`.
 */
export class CucumberHtmlStream extends Transform {
  private readonly envelopes: Envelope[] = [];

  constructor(private readonly options: RenderReportOptions = {}) {
    super({ objectMode: true });
  }

  _transform(
    envelope: Envelope,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.envelopes.push(envelope);
    callback();
  }

  _flush(callback: TransformCallback): void {
    renderHtml(this.envelopes, renderOptions(this.options)).then(
      (html) => callback(null, html),
      (error: unknown) =>
        callback(error instanceof Error ? error : new Error(String(error))),
    );
  }
}

export async function renderReport(
  inputs: string | string[],
  options: RenderReportOptions = {},
): Promise<string> {
  return (await generateReport(inputs, options)).html;
}
