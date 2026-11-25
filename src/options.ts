import type { BaselineSummary } from './baseline.js';
import type { HistoryRun } from './history.js';

export interface RenderReportOptions {
  title?: string;
  metadata?: Record<string, string>;
  logo?: string;
  accent?: string;
  /** Report UI language tag; defaults to English. */
  locale?: string;
  /** Prior aggregate runs; renderReport only renders them, generateReport appends. */
  history?: HistoryRun[];
  /** Opt-in script-free report with every view stacked and every detail open. */
  static?: boolean;
}

/** Report options plus the validated earlier summary; not for the stream. */
export interface BaselineRenderOptions extends RenderReportOptions {
  /** Validated earlier summary; the API accepts the projection, never a path. */
  baseline?: BaselineSummary;
}

export function renderOptions(options: RenderReportOptions) {
  return {
    title: options.title ?? 'Tolkira report',
    ...(options.metadata === undefined ? {} : { metadata: options.metadata }),
    ...(options.logo === undefined ? {} : { logo: options.logo }),
    ...(options.accent === undefined ? {} : { accent: options.accent }),
    ...(options.locale === undefined ? {} : { locale: options.locale }),
    ...(options.static === undefined ? {} : { static: options.static }),
  };
}
