import type {
  ReportFeature,
  ReportHook,
  ReportModel,
  ReportRunHook,
  ReportScenario,
} from '../report/model.js';
import { statusSeverity, type ReportStatus } from '../report/status.js';
import { displayUri } from '../summary.js';
import { stripBidiControls } from '../text.js';
import { escapeHtml } from './escape.js';
import type { DisplayStatus, OrderedFeature } from './types.js';

export function statusLabel(status: ReportStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
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

export function durationLabel(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '0 ms';
  if (milliseconds < 1000) return `${Math.round(milliseconds * 100) / 100} ms`;
  return `${(milliseconds / 1000).toFixed(2)} s`;
}

export function dateLabel(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
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

export function attentionCounts(scenarios: ReportScenario[]): string {
  const counts = new Map<ReportStatus, number>();
  for (const scenario of scenarios) {
    if (!scenario.executed || scenario.status === 'passed') continue;
    counts.set(scenario.status, (counts.get(scenario.status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => statusSeverity(b[0]) - statusSeverity(a[0]))
    .map(([status, count]) => `${count} ${status}`)
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

export function featureSourceLabel(feature: ReportFeature): string {
  const uris = new Set(
    feature.scenarios.map((scenario) => displayUri(scenario.uri)).filter(Boolean),
  );
  if (uris.size === 0) return '';
  return uris.size === 1 ? [...uris][0] ?? '' : `${uris.size} spec files`;
}

export function healthMarkup(model: ReportModel): string {
  const { total, passed, skipped } = model.counts.scenarios;
  if (total === 0) {
    return '<div class="healthTop"><strong>0%</strong><span aria-hidden="true">0 / 0</span><span class="sr">0 / 0 passed</span></div>';
  }
  const attempted = total - skipped;
  if (attempted === 0) {
    return '<div class="healthTop"><span>No scenarios attempted</span><span class="sr">Skipped scenarios are results, not pass attempts.</span></div>';
  }
  const percent = Math.round((passed / attempted) * 1000) / 10;
  return `<div class="healthTop"><strong>${percent}%</strong><span aria-hidden="true">${passed} / ${attempted} attempted</span><span class="sr">${passed} of ${attempted} attempted scenarios passed</span></div>`;
}

export function tagsMarkup(tags: string[], extraClass = ''): string {
  const className = extraClass ? `tags ${extraClass}` : 'tags';
  return tags.length
    ? `<span class="${className}">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</span>`
    : '';
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

export function countPills(model: ReportModel): string {
  const counts = model.counts.scenarios;
  return `<div class="counts">${displayStatuses(model)
    .map(
      (status) =>
        `<span class="${statusClass(status)}"><b>${counts[status]}</b> ${status}</span>`,
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

export function hookLabel(
  hook: ReportHook | ReportRunHook,
  bareName = false,
): string {
  if (hook.name) return bareName ? hook.name : `${hook.type}: ${hook.name}`;
  return hook.type;
}
