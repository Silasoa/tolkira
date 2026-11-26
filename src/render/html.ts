import { createHash } from 'node:crypto';
import type { Envelope } from '@cucumber/messages';
import { buildLoadedRun, type LoadedRun } from '../loaded-run.js';
import { runRenderOptions, type RenderReportOptions } from '../options.js';
import { buildReportModel } from '../report/model.js';
import { isLogoDataUri, isValidAccent } from '../validation.js';
import { CLIENT_SCRIPT } from './client-bundle.js';
import { DOM_IDS } from './dom-contract.js';
import { renderAnalysisView, applyReportSize } from './details.js';
import { escapeHtml } from './escape.js';
import { createTranslator, localeShellCss, type Translator } from './i18n.js';
import { PRINT_SCRIPT } from './print-script.js';
import { renderReportView } from './report.js';
import { BASELINE_CSS, REPORT_CSS } from './styles.js';
import { TAG_TABLE_CSS } from './tags.js';
import { renderTrendsView, TRENDS_SHELL_CSS } from './trends.js';

function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const match of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    const type = /\btype\s*=\s*["']([^"']*)["']/i.exec(match[1] ?? '')?.[1];
    if (
      type &&
      !/^(?:module|text\/javascript|application\/javascript)$/i.test(type)
    ) {
      continue;
    }
    const content = match[2] ?? '';
    hashes.add(
      `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`,
    );
  }
  return [...hashes];
}

function csp(hashes: string[]): string {
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; script-src ${hashes.join(' ') || "'none'"}; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
}

function inlineScript(code: string): string {
  return `<script>${code.replaceAll(/<\/script/gi, '<\\/script')}</script>`;
}

function tabBar(historyLength: number, t: Translator): string {
  return `<div class="views" role="tablist" aria-label="${t.t('report.views')}"><button class="view" id="view-report" type="button" role="tab" data-view="report" aria-selected="true" aria-controls="${DOM_IDS.reportView}">${t.t('report.tab')}</button><button class="view" id="view-analysis" type="button" role="tab" data-view="analysis" aria-selected="false" aria-controls="${DOM_IDS.analysisView}">${t.t('details.tab')}</button>${historyLength >= 2 ? `<button class="view" id="view-trends" type="button" role="tab" data-view="trends" aria-selected="false" aria-controls="${DOM_IDS.trendsView}">${t.t('trends.tab')}</button>` : ''}</div>`;
}

export async function renderRun(
  run: LoadedRun,
  options: RenderReportOptions = {},
): Promise<string> {
  const viewOptions = runRenderOptions(run, options);
  const t = createTranslator(viewOptions.locale);
  const model = buildReportModel(run.envelopes, run.provenance, run.index);
  const history = Array.isArray(viewOptions.history) ? viewOptions.history : [];
  const staticMode = viewOptions.static === true;
  const logo = isLogoDataUri(viewOptions.logo)
    ? `<img class="logo" src="${escapeHtml(viewOptions.logo)}" alt="">`
    : '';
  const accent = isValidAccent(viewOptions.accent)
    ? `:root{--accent:${viewOptions.accent}}`
    : '';
  // German labels are longer; scoped rules keep the shell inside 320px.
  const localeCss = localeShellCss(t);
  const clientScript = staticMode ? '' : inlineScript(CLIENT_SCRIPT);
  const printScript = staticMode ? '' : inlineScript(PRINT_SCRIPT);
  const skipped = run.skippedAttachments;
  const notice =
    skipped > 0
      ? `<div class="noticeShell"><div class="attachmentWarning" role="note">${escapeHtml(t.t('report.attachmentSkipNotice', { count: skipped }))} ${escapeHtml(t.t(staticMode ? 'report.attachmentSkipWhereStatic' : 'report.attachmentSkipWhere'))}</div></div>`
      : '';
  const trends =
    history.length >= 2 ? renderTrendsView(history, t, staticMode) : '';
  const tagTableCss = model.scenarios.some(
    (scenario) => scenario.tags.length > 0,
  )
    ? TAG_TABLE_CSS
    : '';
  const messages = staticMode
    ? ''
    : `<script type="application/json" id="${DOM_IDS.i18nMessages}">${t.clientMessages()}</script>`;
  const lightbox = staticMode
    ? ''
    : `<dialog class="lightbox" id="${DOM_IDS.lightbox}" aria-label="${t.t('lightbox.label')}"><button class="lightboxClose" type="button" data-lightbox-close>${t.t('lightbox.close')}</button><img alt=""></dialog>`;
  const body = `<header class="topbar"><div class="topbarInner"><div class="brand">${logo}tol<span>kira</span></div>${staticMode ? '' : tabBar(history.length, t)}</div></header><p class="sr" id="${DOM_IDS.copyLive}" aria-live="polite"></p>${notice}<main>${renderReportView(model, viewOptions, t, staticMode)}${renderAnalysisView(model, viewOptions, run.summary, t, staticMode)}${trends}</main>${lightbox}${messages}${clientScript}${printScript}`;
  const html = `<!doctype html>\n<html lang="${escapeHtml(t.lang)}" dir="${t.dir}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(viewOptions.title)}</title>\n${csp(inlineScriptHashes(body))}\n<style>${REPORT_CSS}${accent}${localeCss}${trends ? TRENDS_SHELL_CSS : ''}${viewOptions.comparison ? BASELINE_CSS : ''}${tagTableCss}</style>\n</head>\n<body>${body}</body>\n</html>`;
  return applyReportSize(html, t);
}

export async function renderHtml(
  envelopes: Envelope[],
  options: RenderReportOptions = {},
): Promise<string> {
  return renderRun(buildLoadedRun(envelopes), options);
}
