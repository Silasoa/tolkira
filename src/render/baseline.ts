import type {
  BaselineBlock,
  BaselineChange,
  BaselineComparison,
} from '../baseline.js';
import type { ReportModel } from '../report/model.js';
import { stripAnsi, stripBidiControls } from '../text.js';
import { escapeHtml } from './escape.js';
import { statusClass, statusLabel } from './format.js';
import type { MessageKey, Translator } from './i18n.js';

const PANEL_LIMIT = 10;
const JSON_LIMIT = 50;

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

/** The row badge; still-failing and added rows carry none. */
export function baselineBadge(
  change: BaselineChange | undefined,
  t: Translator,
): string {
  if (change === 'new-failure') {
    return `<span class="changeBadge changeBadgeNewFailure">${escapeHtml(t.t('baseline.badgeNewFailure'))}</span> `;
  }
  if (change === 'fixed') {
    return `<span class="changeBadge changeBadgeFixed">${escapeHtml(t.t('baseline.badgeFixed'))}</span> `;
  }
  return '';
}

// Baseline text is untrusted: strip terminal controls and bidi marks, collapse
// whitespace, then escape. Scoped to the panel so default report bytes stay put.
function panelText(value: string): string {
  return stripBidiControls(stripAnsi(value)).replace(/\s+/g, ' ').trim();
}

function countItem(value: number, key: MessageKey, t: Translator): string {
  return `<li><b>${t.number(value)}</b> ${escapeHtml(t.t(key, { count: value }))}</li>`;
}

export function renderBaselinePanel(
  comparison: BaselineComparison,
  t: Translator,
): string {
  const block: BaselineBlock = comparison.block;
  const counts = block.counts;
  const rows = block.notInThisRun.slice(0, PANEL_LIMIT);
  const ambiguous =
    counts.ambiguous > 0
      ? countItem(counts.ambiguous, 'baseline.ambiguous', t)
      : '';
  const list =
    rows.length > 0
      ? `<h3>${escapeHtml(t.t('baseline.notInThisRun'))}</h3><ul class="baselineList">${rows
          .map((row) => {
            const example = row.example
              ? ` <span class="baselineExample">${escapeHtml(panelText(row.example))}</span>`
              : '';
            return `<li><span class="baselineFeature">${escapeHtml(panelText(row.feature))}</span> · <span class="baselineName">${escapeHtml(panelText(row.name))}</span>${example} <span class="statusText ${statusClass(row.status)}">${statusLabel(row.status, t)}</span></li>`;
          })
          .join('')}</ul>`
      : '';
  const remaining = counts.notInThisRun - rows.length;
  let more = '';
  if (remaining > 0) {
    if (counts.notInThisRun <= JSON_LIMIT) {
      more = `<p class="baselineMore">${escapeHtml(t.t('baseline.more', { count: remaining }))}</p>`;
    } else {
      const jsonRows = JSON_LIMIT - rows.length;
      const missing = counts.notInThisRun - JSON_LIMIT;
      more = `<p class="baselineMore">${escapeHtml(t.t('baseline.moreCapped', { count: jsonRows, total: counts.notInThisRun, cap: JSON_LIMIT, missing }))}</p>`;
    }
  }
  return `<section class="baselinePanel" aria-labelledby="baseline-heading"><h2 id="baseline-heading">${escapeHtml(t.t('baseline.heading'))}</h2><p class="baselineStatusLine">${escapeHtml(t.t('baseline.status', { status: statusLabel(block.status, t) }))}</p><ul class="baselineCounts">${countItem(counts.newFailures, 'baseline.newFailures', t)}${countItem(counts.fixed, 'baseline.fixed', t)}${countItem(counts.stillFailing, 'baseline.stillFailing', t)}${countItem(counts.notInThisRun, 'baseline.notInThisRun', t)}${ambiguous}</ul>${list}${more}</section>`;
}
