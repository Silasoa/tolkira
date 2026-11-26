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
export const TAG_TABLE_CSS =
  '.tagTable{width:100%;min-width:34rem;border-collapse:collapse;font-size:.8125rem}' +
  '.tagTable thead{display:table-header-group}' +
  '.tagTable tr{break-inside:avoid}' +
  '.tagTable th{text-align:left;color:var(--muted);font-size:.6875rem;font-weight:500;padding:.5rem .5rem .5rem 0;border-bottom:1px solid var(--line-strong)}' +
  '.tagTable th:not(:first-child){text-align:right}' +
  '.tagTable th[scope="row"]{color:var(--ink);font-size:.8125rem;font-weight:400}' +
  '.tagTable td{padding:.5rem .5rem .5rem 0;border-bottom:1px solid var(--line)}' +
  '.tagTable td:last-child,.tagTable th:last-child{text-align:right}' +
  '.tagTable tr:last-child td{border-bottom:0}' +
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
  return `<section class="panel" style="margin-top:16px" role="region" aria-label="${t.t('details.tagsLabel')}"><h2>${t.t('details.tags')}</h2><p>${t.t('details.tagsNote')}</p><div class="tableWrap" tabindex="0"><table class="tagTable"><thead>${head}</thead><tbody>${body}</tbody></table></div>${remaining}</section>`;
}
