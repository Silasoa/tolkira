import type { ReportModel } from '../report/model.js';
import { compareText } from '../text.js';
import { escapeHtml } from './escape.js';
import type { Translator } from './i18n.js';

export interface TagOverviewRow {
  tag: string;
  scenarios: number;
  failed: number;
  skipped: number;
}

/** Orders failing tags first so the cap only hides them past 50 failing tags. */
function compareRows(a: TagOverviewRow, b: TagOverviewRow): number {
  return (
    b.failed - a.failed ||
    b.scenarios - a.scenarios ||
    compareText(a.tag, b.tag)
  );
}

export function tagOverviewRows(model: ReportModel): TagOverviewRow[] {
  const rows = new Map<string, TagOverviewRow>();
  for (const scenario of model.scenarios) {
    for (const tag of new Set(scenario.tags)) {
      let row = rows.get(tag);
      if (!row) {
        row = { tag, scenarios: 0, failed: 0, skipped: 0 };
        rows.set(tag, row);
      }
      if (!scenario.executed) continue;
      row.scenarios += 1;
      if (scenario.status === 'failed') row.failed += 1;
      else if (scenario.status === 'skipped') row.skipped += 1;
    }
  }
  return [...rows.values()].sort(compareRows);
}

const TAG_ROW_LIMIT = 50;

// Only injected into a tagged report, so REPORT_CSS and untagged bytes stay
// unchanged. The print header/row rules sit here instead of the shared sheet.
// 19rem fits the three numeric columns in a 390px panel after the shell and
// panel padding plus the scrollbar gutter; 320px still scrolls.
export const TAG_TABLE_CSS =
  '.tagTable{width:auto;min-width:19rem;border-collapse:collapse;font-size:.8125rem}' +
  '.tagTable thead{display:table-header-group}' +
  '.tagTable tr{break-inside:avoid}' +
  '.tagTable thead th{text-align:left;color:var(--muted);font-size:.6875rem;font-weight:500;padding:.5rem .5rem .5rem 0;border-bottom:1px solid var(--line-strong)}' +
  '.tagTable thead th:not(:first-child){text-align:right}' +
  '.tagTable tbody th{text-align:left;color:var(--ink);font-size:.8125rem;font-weight:400;padding:.5rem .5rem .5rem 0;border-bottom:1px solid var(--line)}' +
  '.tagTable td{padding:.5rem .5rem .5rem 0;border-bottom:1px solid var(--line)}' +
  '.tagTable td:last-child,.tagTable thead th:last-child{text-align:right}' +
  '.tagTable tbody tr:last-child th,.tagTable tbody tr:last-child td{border-bottom:0}' +
  '.tagTable .num{text-align:right;font-family:var(--font-mono);font-size:.75rem;font-variant-numeric:tabular-nums}';

export function renderTagOverview(model: ReportModel, t: Translator): string {
  const rows = tagOverviewRows(model);
  if (rows.length === 0) return '';
  const head = `<tr><th scope="col">${t.t('report.tag')}</th><th scope="col">${t.t('details.tagScenarios')}</th><th scope="col">${t.t('details.tagFailed')}</th><th scope="col">${t.t('details.tagSkipped')}</th></tr>`;
  const body = rows
    .slice(0, TAG_ROW_LIMIT)
    .map(
      (row) =>
        `<tr><th scope="row"><span class="tag">${escapeHtml(row.tag)}</span></th><td class="num">${t.number(row.scenarios)}</td><td class="num">${t.number(row.failed)}</td><td class="num">${t.number(row.skipped)}</td></tr>`,
    )
    .join('');
  const remaining =
    rows.length > TAG_ROW_LIMIT
      ? `<p>${t.t('details.tagsRemaining', { shown: TAG_ROW_LIMIT, total: rows.length })}</p>`
      : '';
  return `<section class="panel" style="margin-top:16px"><h2>${t.t('details.tags')}</h2><p id="tag-overview-note">${t.t('details.tagsNote')}</p>${remaining}<div class="tableWrap" tabindex="0" role="region" aria-label="${t.t('details.tagsLabel')}" aria-describedby="tag-overview-note"><table class="tagTable"><thead>${head}</thead><tbody>${body}</tbody></table></div></section>`;
}
