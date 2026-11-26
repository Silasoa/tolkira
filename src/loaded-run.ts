import type { Envelope } from '@cucumber/messages';
import {
  compareBaseline,
  type BaselineComparison,
  type BaselineSummary,
} from './baseline.js';
import { sanitizeEnvelopes } from './input/sanitize.js';
import { indexRun, type RunIndex } from './report/index-run.js';
import {
  scenarioIdentities,
  summarizeIndex,
  type ReportSummary,
} from './summary.js';

declare const loadedRunBrand: unique symbol;

/** Facts the pipeline knows beyond the envelopes; all are optional. */
export interface LoadedRunFacts {
  /** Earlier summary; when given, the run carries the comparison. */
  baseline?: BaselineSummary;
  /** Feature URI to input file name; multi-file runs only. */
  provenance?: Map<string, string>;
  /** Path attachments skipped outside every allowed root. */
  skippedAttachments?: number;
  /** Unique processed input files; absent omits the Details row. */
  inputFiles?: number;
  /** Total input bytes; absent omits the Details row. */
  inputBytes?: number;
}

/**
 * A sanitised, indexed and summarised run. Only `buildLoadedRun` may produce
 * one; the brand is compile-time only and adds no runtime field.
 */
export interface LoadedRun {
  /**
   * The caller's array, sanitised in place once. Do not mutate it after the
   * build: `renderRun` never sanitises again.
   */
  readonly envelopes: Envelope[];
  readonly index: RunIndex;
  readonly summary: ReportSummary;
  readonly comparison?: BaselineComparison;
  readonly provenance?: Map<string, string>;
  readonly skippedAttachments: number;
  readonly inputFiles?: number;
  readonly inputBytes?: number;
  readonly [loadedRunBrand]: true;
}

class LoadedRunValue implements LoadedRun {
  declare readonly [loadedRunBrand]: true;
  readonly envelopes: Envelope[];
  readonly index: RunIndex;
  readonly summary: ReportSummary;
  readonly comparison?: BaselineComparison;
  readonly provenance?: Map<string, string>;
  readonly skippedAttachments: number;
  readonly inputFiles?: number;
  readonly inputBytes?: number;

  constructor(shape: Omit<LoadedRun, typeof loadedRunBrand>) {
    this.envelopes = shape.envelopes;
    this.index = shape.index;
    this.summary = shape.summary;
    this.skippedAttachments = shape.skippedAttachments;
    if (shape.comparison !== undefined) this.comparison = shape.comparison;
    if (shape.provenance !== undefined) this.provenance = shape.provenance;
    if (shape.inputFiles !== undefined) this.inputFiles = shape.inputFiles;
    if (shape.inputBytes !== undefined) this.inputBytes = shape.inputBytes;
  }
}

/** The one producer: sanitise, index, compare and summarise exactly once. */
export function buildLoadedRun(
  envelopes: Envelope[],
  facts: LoadedRunFacts = {},
): LoadedRun {
  const safeEnvelopes = sanitizeEnvelopes(envelopes);
  const index = indexRun(safeEnvelopes);
  const comparison =
    facts.baseline === undefined
      ? undefined
      : compareBaseline(facts.baseline, scenarioIdentities(index));
  return new LoadedRunValue({
    envelopes: safeEnvelopes,
    index,
    summary: summarizeIndex(index, comparison),
    ...(comparison === undefined ? {} : { comparison }),
    ...(facts.provenance === undefined ? {} : { provenance: facts.provenance }),
    skippedAttachments: facts.skippedAttachments ?? 0,
    ...(facts.inputFiles === undefined ? {} : { inputFiles: facts.inputFiles }),
    ...(facts.inputBytes === undefined ? {} : { inputBytes: facts.inputBytes }),
  });
}
