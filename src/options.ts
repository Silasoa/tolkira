import type { BaselineSummary } from './baseline.js';
import type { HistoryRun } from './history.js';
import type { LoadedRun } from './loaded-run.js';
import type { RenderOptions } from './render/types.js';

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

/** The view options for a loaded run; a missing run fact stays absent. */
export function runRenderOptions(
  run: LoadedRun,
  options: RenderReportOptions,
): RenderOptions {
  return {
    ...renderOptions(options),
    ...(options.history === undefined ? {} : { history: options.history }),
    ...(run.comparison === undefined ? {} : { comparison: run.comparison }),
    ...(run.inputFiles === undefined ? {} : { inputFiles: run.inputFiles }),
    ...(run.inputBytes === undefined ? {} : { inputBytes: run.inputBytes }),
  };
}
