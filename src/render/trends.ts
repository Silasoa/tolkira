import type { HistoryRun } from '../history.js';
import type { StatusCounts } from '../summary.js';
import { DOM_IDS } from './dom-contract.js';
import { escapeHtml } from './escape.js';
import { dateLabel, durationLabel, passRate } from './format.js';

const SPARK_WIDTH = 320;
const SPARK_HEIGHT = 64;
const SPARK_PAD = 6;

const STATUS_LABELS: Record<string, string> = {
  passed: 'Passed',
  failed: 'Failed',
  skipped: 'Skipped',
  pending: 'Pending',
  undefined: 'Undefined',
  ambiguous: 'Ambiguous',
  unknown: 'Unknown',
};

const STATUS_CLASSES: Record<string, string> = {
  passed: 'pass',
  failed: 'fail',
  skipped: 'skipped',
  pending: 'pending',
  undefined: 'undefined',
  ambiguous: 'ambiguous',
  unknown: 'unknown',
};

function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : 0;
}

function safeCounts(value: unknown): StatusCounts {
  const counts =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {};
  return {
    total: whole(counts.total),
    passed: whole(counts.passed),
    failed: whole(counts.failed),
    skipped: whole(counts.skipped),
    pending: whole(counts.pending),
    undefined: whole(counts.undefined),
    ambiguous: whole(counts.ambiguous),
    unknown: whole(counts.unknown),
  };
}

function scenarioCounts(run: HistoryRun): StatusCounts {
  return safeCounts(run?.counts?.scenarios);
}

function byTime(a: HistoryRun, b: HistoryRun): number {
  return time(a) - time(b);
}

function time(run: HistoryRun): number {
  const parsed =
    typeof run?.recordedAt === 'string' ? Date.parse(run.recordedAt) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusOf(run: HistoryRun): { label: string; className: string } {
  const status =
    typeof run?.status === 'string' && Object.hasOwn(STATUS_LABELS, run.status)
      ? run.status
      : 'unknown';
  return {
    label: STATUS_LABELS[status] ?? 'Unknown',
    className: STATUS_CLASSES[status] ?? 'unknown',
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function rateLabel(run: HistoryRun): string {
  const { percent } = passRate(scenarioCounts(run));
  return percent === null ? '—' : `${percent}%`;
}

function sparkPoints(runs: HistoryRun[]): Array<{ x: number; y: number } | null> {
  const ascending = [...runs].sort(byTime);
  const span = Math.max(ascending.length - 1, 1);
  const step = (SPARK_WIDTH - SPARK_PAD * 2) / span;
  const height = SPARK_HEIGHT - SPARK_PAD * 2;
  return ascending.map((run, index) => {
    const { percent } = passRate(scenarioCounts(run));
    if (percent === null) return null;
    return {
      x: round(SPARK_PAD + index * step),
      y: round(SPARK_PAD + (1 - percent / 100) * height),
    };
  });
}

function sparkline(runs: HistoryRun[]): string {
  const points = sparkPoints(runs);
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let segment: Array<{ x: number; y: number }> = [];
  for (const point of points) {
    if (point) {
      segment.push(point);
      continue;
    }
    if (segment.length > 0) segments.push(segment);
    segment = [];
  }
  if (segment.length > 0) segments.push(segment);

  const lines = segments
    .filter((entry) => entry.length > 1)
    .map(
      (entry) =>
        `<polyline class="sparkLine" points="${entry
          .map((point) => `${point.x},${point.y}`)
          .join(' ')}" fill="none" vector-effect="non-scaling-stroke"></polyline>`,
    )
    .join('');
  const circles = points
    .filter((point): point is { x: number; y: number } => point !== null)
    .map(
      (point) =>
        `<circle class="sparkPoint" cx="${point.x}" cy="${point.y}" r="2.5"></circle>`,
    )
    .join('');
  return `<svg class="spark" viewBox="0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}" aria-hidden="true" focusable="false">${lines}${circles}</svg>`;
}

function rowMarkup(run: HistoryRun, current: boolean): string {
  const counts = scenarioCounts(run);
  const status = statusOf(run);
  const title = typeof run?.title === 'string' ? run.title : '';
  const recordedAt =
    typeof run?.recordedAt === 'string' ? run.recordedAt : undefined;
  return `<tr><td>${escapeHtml(dateLabel(recordedAt))}${current ? '<span class="currentTag">Current</span>' : ''}</td><td>${escapeHtml(title)}</td><td><span class="statusText ${status.className}">${status.label}</span></td><td class="num">${counts.passed}</td><td class="num">${counts.failed}</td><td class="num">${counts.skipped}</td><td class="num">${counts.total}</td><td class="num">${rateLabel(run)}</td><td class="num">${durationLabel(typeof run?.durationMs === 'number' ? run.durationMs : 0)}</td></tr>`;
}

function rowsMarkup(runs: HistoryRun[]): string {
  return [...runs]
    .sort((a, b) => byTime(b, a))
    .map((run, index) => rowMarkup(run, index === 0))
    .join('');
}

/**
 * The third view: the latest runs newest first, with the pass-rate trend as a
 * decorative sparkline (oldest to newest). The table carries the data.
 */
export function renderTrendsView(history: HistoryRun[]): string {
  return `<div class="tabPanel" id="${DOM_IDS.trendsView}" role="tabpanel" aria-labelledby="view-trends" tabindex="0" hidden><main class="shell analysis"><header class="runHead"><div><p class="path">History / trends</p><h1>Trends</h1><p class="meta"><span>${history.length} runs</span><span>Newest first</span><span>Pass rate counts attempted (non-skipped) scenarios</span></p></div></header><section class="panel trendsPanel"><h2>Recorded runs</h2><p class="matrixHint">Scroll for status, counts, pass rate and duration.</p><div class="tableWrap" tabindex="0" role="region" aria-label="Recorded runs"><table class="trendsTable"><thead><tr><th scope="col">Recorded</th><th scope="col">Title</th><th scope="col">Status</th><th scope="col" class="num">Passed</th><th scope="col" class="num">Failed</th><th scope="col" class="num">Skipped</th><th scope="col" class="num">Total</th><th scope="col" class="num">Pass rate</th><th scope="col" class="num">Duration</th></tr></thead><tbody>${rowsMarkup(history)}</tbody></table></div><p class="sparkLead">Pass rate, oldest to newest. The table is newest first; runs without attempted scenarios are skipped.</p>${sparkline(history)}</section></main></div>`;
}
