import type { HistoryRun } from './history.js';

export interface RenderReportOptions {
  title?: string;
  metadata?: Record<string, string>;
  logo?: string;
  accent?: string;
  /** Prior aggregate runs; renderReport only renders them, generateReport appends. */
  history?: HistoryRun[];
}

export function renderOptions(options: RenderReportOptions) {
  return {
    title: options.title ?? 'Tolkira report',
    metadata: options.metadata,
    logo: options.logo,
    accent: options.accent,
  };
}
