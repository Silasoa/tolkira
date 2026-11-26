import type { BaselineComparison } from '../baseline.js';
import type { HistoryRun } from '../history.js';
import type { ReportFeature, ReportScenario } from '../report/model.js';
import type { ReportStatus } from '../report/status.js';

export interface RenderOptions {
  title: string;
  metadata?: Record<string, string>;
  logo?: string;
  accent?: string;
  /** Report UI language tag; defaults to English. */
  locale?: string;
  /** Prior aggregate runs; two or more render the Trends view. */
  history?: HistoryRun[];
  /** Script-free report: stacked views, open details, no dead controls. */
  static?: boolean;
  /** Filled by `renderRun` from the loaded run; absent when it has none. */
  comparison?: BaselineComparison;
  /** Filled by `renderRun` from the loaded run; absent omits the input row. */
  inputFiles?: number;
  /** Filled by `renderRun` from the loaded run; absent omits the input row. */
  inputBytes?: number;
}

export type DisplayStatus = ReportStatus;

export interface OrderedFeature {
  feature: ReportFeature;
  scenarios: ReportScenario[];
}
