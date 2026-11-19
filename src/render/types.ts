import type { RunIndex } from '../report/index-run.js';
import type { ReportFeature, ReportScenario } from '../report/model.js';
import type { ReportStatus } from '../report/status.js';
import type { ReportSummary } from '../summary.js';

export interface RenderOptions {
  title: string;
  metadata?: Record<string, string>;
  logo?: string;
  accent?: string;
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
