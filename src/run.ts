import type { Envelope } from '@cucumber/messages';
import {
  appendHistory,
  buildHistoryRun,
  historyWindow,
  type HistoryRun,
} from './history.js';
import {
  loadResolvedInputs,
  provenanceFor,
  type ResolvedInputs,
} from './input/load.js';
import { sanitizeEnvelopes } from './input/sanitize.js';
import { renderOptions, type RenderReportOptions } from './options.js';
import { indexRun, type RunIndex } from './report/index-run.js';
import { renderHtml } from './render/html.js';
import { summarizeIndex, type ReportSummary } from './summary.js';

export interface GeneratedReport {
  html: string;
  summary: ReportSummary;
  skippedAttachments: number;
  /** Unique input files that formed loader groups, including files with no envelopes. */
  inputFiles: number;
  /** Total size on disk of those input files. */
  inputBytes: number;
  /** The history the report was rendered with, current run appended. */
  history?: HistoryRun[];
}

/** Generate-only options: the history window never reaches the renderer. */
export interface GenerateReportOptions extends RenderReportOptions {
  /** Runs kept in the history; defaults to 30, range 1 to 365. */
  historyLimit?: number;
}

interface LoadedRun {
  envelopes: Envelope[];
  index: RunIndex;
  summary: ReportSummary;
  skippedAttachments: number;
  inputFiles: number;
  inputBytes: number;
  provenance?: Map<string, string>;
}

async function loadRun(resolved: ResolvedInputs): Promise<LoadedRun> {
  const groups = await loadResolvedInputs(resolved);
  const envelopes = sanitizeEnvelopes(
    groups.flatMap((group) => group.envelopes),
  );
  const index = indexRun(envelopes);
  return {
    envelopes,
    index,
    summary: summarizeIndex(index),
    skippedAttachments: groups.reduce(
      (sum, group) => sum + group.skippedAttachments,
      0,
    ),
    inputFiles: groups.length,
    inputBytes: groups.reduce((sum, group) => sum + group.bytes, 0),
    provenance: groups.length > 1 ? provenanceFor(groups) : undefined,
  };
}

function render(
  run: LoadedRun,
  options: RenderReportOptions,
  history: HistoryRun[] | undefined,
): Promise<string> {
  return renderHtml(run.envelopes, {
    ...renderOptions(options),
    ...(history === undefined ? {} : { history }),
    summary: run.summary,
    index: run.index,
    provenance: run.provenance,
    skippedAttachments: run.skippedAttachments,
    inputFiles: run.inputFiles,
    inputBytes: run.inputBytes,
  });
}

/** Internal: generates a report from a list the caller already resolved. */
export async function generateReportFromResolved(
  resolved: ResolvedInputs,
  options: GenerateReportOptions = {},
): Promise<GeneratedReport> {
  const historyLimit = historyWindow(options.historyLimit);
  const run = await loadRun(resolved);
  const history =
    options.history === undefined
      ? undefined
      : appendHistory(
          options.history,
          buildHistoryRun(run.summary, renderOptions(options).title),
          historyLimit,
        );
  return {
    html: await render(run, options, history),
    summary: run.summary,
    skippedAttachments: run.skippedAttachments,
    inputFiles: run.inputFiles,
    inputBytes: run.inputBytes,
    ...(history === undefined ? {} : { history }),
  };
}

/** Internal: renders the HTML for a list the caller already resolved. */
export async function renderReportFromResolved(
  resolved: ResolvedInputs,
  options: RenderReportOptions = {},
): Promise<string> {
  return render(await loadRun(resolved), options, options.history);
}
