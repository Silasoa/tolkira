import type { HistoryRun } from '../history.js';
import type { ReportStatus } from '../report/status.js';
import type { StatusCounts } from '../summary.js';
import { DOM_IDS } from './dom-contract.js';
import { escapeHtml } from './escape.js';
import {
  dateLabel,
  durationLabel,
  passRate,
  statusLabel,
} from './format.js';
import type { Translator } from './i18n.js';

const SPARK_WIDTH = 320;
const SPARK_HEIGHT = 64;
const SPARK_PAD = 6;
/** Above this many plotted runs the per-run markers merge into a dense chain. */
const SPARK_MARKER_LIMIT = 60;

// The Trends shell fixes only matter when the third tab/table exists. Keeping
// them out of the always-on stylesheet leaves the no-history default HTML
// byte-identical, as the spec requires.
export const TRENDS_SHELL_CSS =
  '@media screen{' +
  '.views{flex-wrap:wrap;overflow-x:visible}' +
  '#trends-view .tableWrap{max-height:70vh;overflow-y:auto}' +
  '#trends-view .trendsTable thead th{position:sticky;top:0;background:var(--surface-2);z-index:1}' +
  '}' +
  '@media screen and (max-width:560px){html{scroll-padding-top:9rem}}' +
  '#trends-view .trendsTable th:first-child,#trends-view .trendsTable td:first-child{width:18%;white-space:nowrap}' +
  '#trends-view .trendsTable th:nth-child(2),#trends-view .trendsTable td:nth-child(2){width:16%}' +
  '#trends-view .spark{height:auto;aspect-ratio:320/64}' +
  '@media print{' +
  '#trends-view .tableWrap{max-height:none;overflow:visible}' +
  '#trends-view .trendsTable thead th{position:static}' +
  '#trends-view .trendsTable th{overflow-wrap:normal;word-break:normal;hyphens:none}' +
  '#trends-view .trendsTable th:first-child,#trends-view .trendsTable td:first-child{width:15%}' +
  '#trends-view .trendsTable th:nth-child(n+4),#trends-view .trendsTable td:nth-child(n+4){width:6.375%}' +
  '#trends-view .trendsTable .currentTag{font-size:6pt}' +
  '}';

const STATUS_CLASSES: Record<string, string> = {  passed: 'pass',
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

function statusOf(
  run: HistoryRun,
  t: Translator,
): { label: string; className: string } {
  const status: ReportStatus =
    typeof run?.status === 'string' && Object.hasOwn(STATUS_CLASSES, run.status)
      ? (run.status as ReportStatus)
      : 'unknown';
  return {
    label: statusLabel(status, t),
    className: STATUS_CLASSES[status] ?? 'unknown',
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function rateLabel(run: HistoryRun, t: Translator): string {
  const { percent } = passRate(scenarioCounts(run));
  return percent === null ? '—' : t.percent(percent);
}

/** Absent means an older run; only a finite number is a recorded count. */
function flakyValue(run: HistoryRun): number | null {
  const value = run?.flaky;
  return typeof value === 'number' && Number.isFinite(value)
    ? whole(value)
    : null;
}

/** Clamped for API input; an absent count is an old entry, not a zero. */
function flakyLabel(run: HistoryRun, attempted: number, t: Translator): string {
  const flaky = flakyValue(run);
  return flaky === null ? '—' : t.number(Math.min(flaky, attempted));
}

/** Flagged share of attempted scenarios, clamped for hostile API input. */
function flakyShareLabel(run: HistoryRun, t: Translator): string {
  const { attempted } = passRate(scenarioCounts(run));
  const flaky = flakyValue(run);
  if (flaky === null || attempted === 0) return '—';
  const clamped = Math.min(flaky, attempted);
  const share = Math.round((clamped / attempted) * 1000) / 10;
  // Compare the raw boundary: 1/1001 is below 0.1%, 1/1000 is exactly 0.1%.
  return clamped > 0 && clamped * 1000 < attempted
    ? t.t('trends.flakyShareBelow', { percent: t.percent(0.1) })
    : t.percent(share);
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
  const circles =
    points.filter((point): point is { x: number; y: number } => point !== null)
      .length > SPARK_MARKER_LIMIT
      ? ''
      : points
          .filter((point): point is { x: number; y: number } => point !== null)
          .map(
            (point) =>
              `<circle class="sparkPoint" cx="${point.x}" cy="${point.y}" r="2.5"></circle>`,
          )
          .join('');
  return `<svg class="spark" viewBox="0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}" aria-hidden="true" focusable="false">${lines}${circles}</svg>`;
}

function rowMarkup(
  run: HistoryRun,
  current: boolean,
  t: Translator,
): string {
  const counts = scenarioCounts(run);
  const { attempted } = passRate(counts);
  const status = statusOf(run, t);
  const title = typeof run?.title === 'string' ? run.title : '';
  const recordedAt =
    typeof run?.recordedAt === 'string' ? run.recordedAt : undefined;
  return `<tr><td>${escapeHtml(dateLabel(recordedAt, t))}${current ? `<span class="currentTag">${t.t('trends.current')}</span>` : ''}</td><td>${escapeHtml(title)}</td><td><span class="statusText ${status.className}">${status.label}</span></td><td class="num">${t.number(counts.passed)}</td><td class="num">${t.number(counts.failed)}</td><td class="num">${t.number(counts.skipped)}</td><td class="num">${t.number(counts.total)}</td><td class="num">${rateLabel(run, t)}</td><td class="num">${flakyLabel(run, attempted, t)}</td><td class="num">${flakyShareLabel(run, t)}</td><td class="num">${durationLabel(typeof run?.durationMs === 'number' ? run.durationMs : 0, t)}</td></tr>`;
}

function rowsMarkup(runs: HistoryRun[], t: Translator): string {
  return [...runs]
    .sort((a, b) => byTime(b, a))
    .map((run, index) => rowMarkup(run, index === 0, t))
    .join('');
}

/**
 * The third view: the latest runs newest first, with the pass-rate trend as a
 * decorative sparkline (oldest to newest). The table carries the data.
 */
export function renderTrendsView(
  history: HistoryRun[],
  t: Translator,
  staticMode = false,
): string {
  const view = `<header class="runHead"><div><p class="path">${t.t('trends.path')}</p><h1>${t.t('trends.title')}</h1><p class="meta"><span>${t.t('trends.runs', { count: history.length })}</span><span>${t.t('trends.newestFirst')}</span><span>${t.t('trends.passRateNote')}</span></p></div></header><section class="panel trendsPanel"><h2>${t.t('trends.recordedRuns')}</h2><p class="matrixHint">${t.t('trends.tableHint')}</p><div class="tableWrap" tabindex="0" role="region" aria-label="${t.t('trends.tableLabel')}"><table class="trendsTable"><thead><tr><th scope="col">${t.t('trends.recorded')}</th><th scope="col">${t.t('trends.titleColumn')}</th><th scope="col">${t.t('trends.status')}</th><th scope="col" class="num">${statusLabel('passed', t)}</th><th scope="col" class="num">${statusLabel('failed', t)}</th><th scope="col" class="num">${statusLabel('skipped', t)}</th><th scope="col" class="num">${t.t('trends.total')}</th><th scope="col" class="num">${t.t('trends.passRate')}</th><th scope="col" class="num">${t.t('trends.flaky')}</th><th scope="col" class="num">${t.t('trends.flakyShare')}</th><th scope="col" class="num">${t.t('trends.duration')}</th></tr></thead><tbody>${rowsMarkup(history, t)}</tbody></table></div><p class="flakyNote">${t.t('trends.flakyNote')}</p><p class="sparkLead">${t.t('trends.sparkLead')}</p>${sparkline(history)}</section>`;
  return staticMode
    ? `<div class="tabPanel" id="${DOM_IDS.trendsView}"><div class="shell analysis">${view}</div></div>`
    : `<div class="tabPanel" id="${DOM_IDS.trendsView}" role="tabpanel" aria-labelledby="view-trends" tabindex="0" hidden><main class="shell analysis">${view}</main></div>`;
}
