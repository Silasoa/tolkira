import type { BaselineSummary } from './baseline.js';
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
import { buildLoadedRun, type LoadedRun } from './loaded-run.js';
import {
  renderOptions,
  type BaselineRenderOptions,
  type RenderReportOptions,
} from './options.js';
import { renderRun } from './render/html.js';
import type { ReportSummary } from './summary.js';

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
export interface GenerateReportOptions extends BaselineRenderOptions {
  /** Runs kept in the history; defaults to 30, range 1 to 365. */
  historyLimit?: number;
}

async function loadRun(
  resolved: ResolvedInputs,
  baseline?: BaselineSummary,
): Promise<LoadedRun> {
  const groups = await loadResolvedInputs(resolved);
  const provenance = groups.length > 1 ? provenanceFor(groups) : undefined;
  return buildLoadedRun(
    groups.flatMap((group) => group.envelopes),
    {
      ...(baseline === undefined ? {} : { baseline }),
      ...(provenance === undefined ? {} : { provenance }),
      skippedAttachments: groups.reduce(
        (sum, group) => sum + group.skippedAttachments,
        0,
      ),
      inputFiles: groups.length,
      inputBytes: groups.reduce((sum, group) => sum + group.bytes, 0),
    },
  );
}

function render(
  run: LoadedRun,
  options: RenderReportOptions,
  history: HistoryRun[] | undefined,
): Promise<string> {
  return renderRun(run, {
    ...options,
    ...(history === undefined ? {} : { history }),
  });
}

/** Internal: generates a report from a list the caller already resolved. */
export async function generateReportFromResolved(
  resolved: ResolvedInputs,
  options: GenerateReportOptions = {},
): Promise<GeneratedReport> {
  const historyLimit = historyWindow(options.historyLimit);
  const run = await loadRun(resolved, options.baseline);
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
    inputFiles: run.inputFiles ?? 0,
    inputBytes: run.inputBytes ?? 0,
    ...(history === undefined ? {} : { history }),
  };
}

/** Internal: renders the HTML for a list the caller already resolved. */
export async function renderReportFromResolved(
  resolved: ResolvedInputs,
  options: BaselineRenderOptions = {},
): Promise<string> {
  return render(
    await loadRun(resolved, options.baseline),
    options,
    options.history,
  );
}

interface SummarizedRun {
  summary: ReportSummary;
  skippedAttachments: number;
}

/** Internal: the summary and skipped-attachment count from one load. */
export async function summarizeRunFromResolved(
  resolved: ResolvedInputs,
  baseline?: BaselineSummary,
): Promise<SummarizedRun> {
  const run = await loadRun(resolved, baseline);
  return { summary: run.summary, skippedAttachments: run.skippedAttachments };
}

/** Internal: builds the summary, including a baseline comparison, without HTML. */
export async function summarizeReportFromResolved(
  resolved: ResolvedInputs,
  baseline?: BaselineSummary,
): Promise<ReportSummary> {
  return (await summarizeRunFromResolved(resolved, baseline)).summary;
}
