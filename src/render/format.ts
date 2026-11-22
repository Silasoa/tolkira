import type {
  ReportFeature,
  ReportHook,
  ReportModel,
  ReportRunHook,
  ReportScenario,
} from '../report/model.js';
import { positiveLine } from '../report/model.js';
import { statusSeverity, type ReportStatus } from '../report/status.js';
import { displayUri, type StatusCounts } from '../summary.js';
import { stripBidiControls } from '../text.js';
import { escapeHtml } from './escape.js';
import type { MessageKey, Translator } from './i18n.js';
import type { DisplayStatus, OrderedFeature } from './types.js';

const STATUS_KEYS: Record<ReportStatus, MessageKey> = {
  passed: 'status.passed',
  failed: 'status.failed',
  skipped: 'status.skipped',
  pending: 'status.pending',
  undefined: 'status.undefined',
  ambiguous: 'status.ambiguous',
  unknown: 'status.unknown',
};

export function statusLabel(status: ReportStatus, t: Translator): string {
  return t.t(STATUS_KEYS[status]);
}

export function statusClass(status: ReportStatus): string {
  return status === 'passed' ? 'pass' : status === 'failed' ? 'fail' : status;
}

export const STEP_GLYPHS: Record<ReportStatus, string> = {
  passed: '✓',
  failed: '×',
  pending: '?',
  undefined: '!',
  ambiguous: '?',
  skipped: '–',
  unknown: '·',
};

export function durationLabel(
  milliseconds: number,
  t: Translator,
): string {
  return t.duration(milliseconds);
}

export function dateLabel(iso: string | undefined, t: Translator): string {
  return t.date(iso);
}

export const ALL_STATUSES: DisplayStatus[] = [
  'passed',
  'failed',
  'pending',
  'undefined',
  'ambiguous',
  'skipped',
  'unknown',
];

export function displayStatuses(model: ReportModel): DisplayStatus[] {
  return ALL_STATUSES.filter(
    (status) => model.counts.scenarios[status] > 0,
  );
}

export function compareStatus(a: ReportStatus, b: ReportStatus): number {
  const passed = Number(a === 'passed') - Number(b === 'passed');
  return passed !== 0 ? passed : statusSeverity(b) - statusSeverity(a);
}

function bySeverity<T extends { status: ReportStatus }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const status = compareStatus(a.item.status, b.item.status);
      return status !== 0 ? status : a.index - b.index;
    })
    .map(({ item }) => item);
}

export function orderFeatures(features: ReportFeature[]): OrderedFeature[] {
  return bySeverity(features).map((feature) => ({
    feature,
    scenarios: bySeverity(feature.scenarios),
  }));
}

export function countStatuses(
  scenarios: Array<{ status: ReportStatus }>,
): Partial<Record<ReportStatus, number>> {
  const counts: Partial<Record<ReportStatus, number>> = {};
  for (const scenario of scenarios) {
    counts[scenario.status] = (counts[scenario.status] ?? 0) + 1;
  }
  return counts;
}

// shortcut: lowercasing is not locale-aware (for example Turkish dotted i),
// upgrade when a locale with different casing rules ships.
function lowerLabel(label: string): string {
  return label.toLowerCase();
}

export function attentionCounts(
  scenarios: ReportScenario[],
  t: Translator,
): string {
  const counts = new Map<ReportStatus, number>();
  for (const scenario of scenarios) {
    if (!scenario.executed || scenario.status === 'passed') continue;
    counts.set(scenario.status, (counts.get(scenario.status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => statusSeverity(b[0]) - statusSeverity(a[0]))
    .map(
      ([status, count]) =>
        `${t.number(count)} ${lowerLabel(statusLabel(status, t))}`,
    )
    .join(', ');
}

export function executedOnly(scenarios: ReportScenario[]): ReportScenario[] {
  return scenarios.filter((scenario) => scenario.executed);
}

function barWidth(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
}

export function featureBar(scenarios: ReportScenario[]): string {
  const executed = executedOnly(scenarios);
  const total = executed.length;
  if (total === 0) return '';
  const counts = countStatuses(executed);
  const segments = ALL_STATUSES.filter((status) => counts[status])
    .map(
      (status) =>
        `<i class="${statusClass(status)}" style="width:${barWidth(counts[status] ?? 0, total)}%"></i>`,
    )
    .join('');
  return `<span class="bar" aria-hidden="true">${segments}</span>`;
}

export function scenarioSourceLabel(scenario: ReportScenario): string {
  const uri = displayUri(scenario.uri);
  if (!uri) return '';
  const line = positiveLine(scenario.line);
  return line === undefined ? uri : `${uri}:${line}`;
}

export function featureSourceLabel(
  feature: ReportFeature,
  t: Translator,
): string {
  const sources = feature.scenarios
    .map((scenario) => ({
      uri: displayUri(scenario.uri),
      line: positiveLine(scenario.line),
    }))
    .filter((source) => source.uri);
  const uris = new Set(sources.map((source) => source.uri));
  if (uris.size === 0) return '';
  if (uris.size > 1) return t.t('format.specFiles', { count: uris.size });
  const uri = sources[0]?.uri ?? '';
  const lines = new Set(sources.map((source) => source.line));
  const line = [...lines][0];
  // A line needs every scenario in the one file to agree on it; mixed or
  // absent lines keep the file alone rather than invent a location.
  return lines.size === 1 && line !== undefined ? `${uri}:${line}` : uri;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : 0;
}

export function passRate(counts: StatusCounts): {
  attempted: number;
  percent: number | null;
} {
  const total = count(counts.total);
  const attempted = Math.max(total - count(counts.skipped), 0);
  const passed = Math.min(count(counts.passed), attempted);
  return {
    attempted,
    percent:
      attempted === 0 ? null : Math.round((passed / attempted) * 1000) / 10,
  };
}

export function healthMarkup(model: ReportModel, t: Translator): string {
  const { total } = model.counts.scenarios;
  if (total === 0) {
    return `<div class="healthTop"><strong>${t.percent(0)}</strong><span aria-hidden="true">0 / 0</span><span class="sr">${t.t('format.emptyRatio')}</span></div>`;
  }
  const { attempted, percent } = passRate(model.counts.scenarios);
  if (attempted === 0) {
    return `<div class="healthTop"><span>${t.t('format.noAttempts')}</span><span class="sr">${t.t('format.skippedNotAttempts')}</span></div>`;
  }
  const passed = model.counts.scenarios.passed;
  return `<div class="healthTop"><strong>${t.percent(percent ?? 0)}</strong><span aria-hidden="true">${t.t('format.attemptedRatio', { passed, attempted })}</span><span class="sr">${t.t('format.passedOfAttempted', { passed, attempted })}</span></div>`;
}

export function tagsMarkup(tags: string[], extraClass = ''): string {
  const className = extraClass ? `tags ${extraClass}` : 'tags';
  return tags.length
    ? `<span class="${className}">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</span>`
    : '';
}

export function isFlakyScenario(scenario: ReportScenario): boolean {
  return scenario.tags.includes('@flaky');
}

export function flakyScenarioCount(model: ReportModel): number {
  return model.features.reduce(
    (total, feature) =>
      total + feature.scenarios.filter(isFlakyScenario).length,
    0,
  );
}

export function statusBar(model: ReportModel): string {
  const total = model.counts.scenarios.total;
  if (total === 0) return '';
  return `<div class="bar" aria-hidden="true">${displayStatuses(model)
    .map(
      (status) =>
        `<i class="${statusClass(status)}" style="width:${barWidth(model.counts.scenarios[status], total)}%"></i>`,
    )
    .join('')}</div>`;
}

export function countPills(model: ReportModel, t: Translator): string {
  const counts = model.counts.scenarios;
  return `<div class="counts">${displayStatuses(model)
    .map(
      (status) =>
        `<span class="${statusClass(status)}"><b>${t.number(counts[status])}</b> ${lowerLabel(statusLabel(status, t))}</span>`,
    )
    .join('')}</div>`;
}

export function safeHttpUrl(value: string | undefined): string | undefined {
  const trimmed = stripBidiControls(value ?? '').trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function metadataValueHtml(value: string): string {
  const text = String(value ?? '');
  const trimmed = stripBidiControls(text).trim();
  // The URL parser deletes tabs and newlines, so a link could disagree with
  // the visible label.
  if (/[\t\n\r]/.test(trimmed)) return escapeHtml(text);
  const url = safeHttpUrl(trimmed);
  if (!url) return escapeHtml(text);
  return `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(trimmed)}</a>`;
}

export function hookLabel(
  hook: ReportHook | ReportRunHook,
  bareName = false,
): string {
  if (hook.name) return bareName ? hook.name : `${hook.type}: ${hook.name}`;
  return hook.type;
}
