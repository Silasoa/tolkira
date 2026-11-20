import type { HistoryRun } from '../history.js';
import type { RunIndex } from '../report/index-run.js';
import type { ReportFeature, ReportScenario } from '../report/model.js';
import type { ReportStatus } from '../report/status.js';
import type { ReportSummary } from '../summary.js';

export interface RenderOptions {
  title: string;
  metadata?: Record<string, string>;
  logo?: string;
  accent?: string;
  /** Report UI language tag; defaults to English. */
  locale?: string;
  /** Prior aggregate runs; two or more render the Trends view. */
  history?: HistoryRun[];
  summary?: ReportSummary;
  provenance?: Map<string, string>;
  /** Index already built from the sanitized envelopes; internal fast path. */
  index?: RunIndex;
  /** Path attachments skipped because they resolve outside every allowed root. */
  skippedAttachments?: number;
}

export type DisplayStatus = ReportStatus;

export interface OrderedFeature {
  feature: ReportFeature;
  scenarios: ReportScenario[];
}
