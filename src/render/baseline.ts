import type { BaselineChange, BaselineComparison } from '../baseline.js';
import type { ReportModel } from '../report/model.js';
import { escapeHtml } from './escape.js';
import { statusClass, statusLabel } from './format.js';
import type { Translator } from './i18n.js';

const PANEL_LIMIT = 10;

/** Joins the precomputed change map to report rows by the model's pickle id. */
export function applyBaselineChanges(
  model: ReportModel,
  changes: Map<string, BaselineChange>,
): void {
  for (const scenario of model.scenarios) {
    const change = changes.get(scenario.id);
    if (change) scenario.change = change;
  }
}

function countItem(value: number, label: string, t: Translator): string {
  return `<li><b>${escapeHtml(t.number(value))}</b> ${escapeHtml(label)}</li>`;
}

export function renderBaselinePanel(
  comparison: BaselineComparison,
  t: Translator,
): string {
  const { block } = comparison;
  const counts = block.counts;
  const rows = block.notInThisRun.slice(0, PANEL_LIMIT);
  const remaining = counts.notInThisRun - rows.length;
  const ambiguous =
    counts.ambiguous > 0
      ? countItem(counts.ambiguous, t.t('baseline.ambiguous'), t)
      : '';
  const list = rows
    .map((row) => {
      const example = row.example
        ? ` <span class="baselineExample">${escapeHtml(row.example)}</span>`
        : '';
      return `<li><span class="baselineFeature">${escapeHtml(row.feature)}</span> <span class="baselineName">${escapeHtml(row.name)}</span>${example} <span class="statusText ${statusClass(row.status)}">${statusLabel(row.status, t)}</span></li>`;
    })
    .join('');
  const more =
    remaining > 0
      ? `<p class="baselineMore">${escapeHtml(t.t('baseline.more', { count: remaining }))}</p>`
      : '';
  return `<section class="baselinePanel" aria-labelledby="baseline-heading"><h2 id="baseline-heading">${escapeHtml(t.t('baseline.heading'))}</h2><p class="baselineStatusLine">${escapeHtml(t.t('baseline.status', { status: statusLabel(block.status, t) }))}</p><ul class="baselineCounts">${countItem(counts.newFailures, t.t('baseline.newFailures'), t)}${countItem(counts.fixed, t.t('baseline.fixed'), t)}${countItem(counts.stillFailing, t.t('baseline.stillFailing'), t)}${countItem(counts.notInThisRun, t.t('baseline.notInThisRun'), t)}${ambiguous}</ul><h3>${escapeHtml(t.t('baseline.notInThisRun'))}</h3><ul class="baselineList">${list}</ul>${more}</section>`;
}
