import { createHash } from 'node:crypto';
import type { Envelope } from '@cucumber/messages';
import { sanitizeEnvelopes } from '../input/sanitize.js';
import { indexRun } from '../report/index-run.js';
import { buildReportModel } from '../report/model.js';
import { summarizeIndex } from '../summary.js';
import { isLogoDataUri, isValidAccent } from '../validation.js';
import { CLIENT_SCRIPT } from './client-bundle.js';
import { DOM_IDS } from './dom-contract.js';
import { renderAnalysisView } from './details.js';
import { escapeHtml } from './escape.js';
import { createTranslator, type Translator } from './i18n.js';
import { renderReportView } from './report.js';
import { REPORT_CSS } from './styles.js';
import { renderTrendsView } from './trends.js';
import type { RenderOptions } from './types.js';

export type { RenderOptions } from './types.js';

function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const type = /\btype\s*=\s*["']([^"']*)["']/i.exec(match[1] ?? '')?.[1];
    if (type && !/^(?:module|text\/javascript|application\/javascript)$/i.test(type)) {
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

function tabBar(historyLength: number, t: Translator): string {
  return `<div class="views" role="tablist" aria-label="${t.t('report.views')}"><button class="view" id="view-report" type="button" role="tab" data-view="report" aria-selected="true" aria-controls="${DOM_IDS.reportView}">${t.t('report.tab')}</button><button class="view" id="view-analysis" type="button" role="tab" data-view="analysis" aria-selected="false" aria-controls="${DOM_IDS.analysisView}">${t.t('details.tab')}</button>${historyLength >= 2 ? `<button class="view" id="view-trends" type="button" role="tab" data-view="trends" aria-selected="false" aria-controls="${DOM_IDS.trendsView}">${t.t('trends.tab')}</button>` : ''}</div>`;
}

export async function renderHtml(
  envelopes: Envelope[],
  options: RenderOptions,
): Promise<string> {
  const t = createTranslator(options.locale);
  const safeEnvelopes = sanitizeEnvelopes(envelopes);
  const index = options.index ?? indexRun(safeEnvelopes);
  const model = buildReportModel(safeEnvelopes, options.provenance, index);
  const summary = options.summary ?? summarizeIndex(index);
  const history = Array.isArray(options.history) ? options.history : [];
  const logo = isLogoDataUri(options.logo)
    ? `<img class="logo" src="${escapeHtml(options.logo)}" alt="">`
    : '';
  const accent = isValidAccent(options.accent)
    ? `<style>:root{--accent:${options.accent}}</style>`
    : '';
  // German labels are longer than their English counterparts; the scoped
  // rules keep the shell inside 320px without touching the English layout.
  const localeCss =
    (t.lang.split('-')[0] ?? '').toLowerCase() === 'en'
      ? ''
      : ':lang(de) .statusText{overflow-wrap:anywhere;text-align:center}' +
        ':lang(de) .feature > summary .statusText{white-space:nowrap}' +
        ':lang(de) .featureTable th:first-child,:lang(de) .featureTable td:first-child{min-width:9.5rem}' +
        ':lang(de) .featureTable .matrixName{overflow-wrap:break-word}' +
        ':lang(de) .panel h2{overflow-wrap:anywhere;hyphens:auto}' +
        ':lang(de) .metaList{grid-template-columns:minmax(0,40%) minmax(0,60%)}' +
        ':lang(de) .metaList dt{min-width:0;overflow-wrap:anywhere}' +
        '@media (max-width:900px){:lang(de) .feature > summary{grid-template-columns:minmax(6.25rem,max-content) minmax(0,1fr) 1.25rem}}' +
        '@media (max-width:560px){.expand{flex-wrap:wrap}}';
  const clientScript = `<script>${CLIENT_SCRIPT.replace(/<\/script/gi, '<\\/script')}</script>`;
  const skipped = options.skippedAttachments ?? 0;
  const notice =
    skipped > 0
      ? `<div class="noticeShell"><div class="attachmentWarning" role="note">${escapeHtml(t.t('report.attachmentNotice', { count: skipped }))}</div></div>`
      : '';
  const trends = history.length >= 2 ? renderTrendsView(history, t) : '';
  const messages = `<script type="application/json" id="${DOM_IDS.i18nMessages}">${t.clientMessages()}</script>`;
  const body = `<header class="topbar"><div class="topbarInner"><div class="brand">${logo}tol<span>kira</span></div>${tabBar(history.length, t)}</div></header><p class="sr" id="${DOM_IDS.copyLive}" aria-live="polite"></p>${notice}${renderReportView(model, options, t)}${renderAnalysisView(model, options, summary, t)}${trends}<dialog class="lightbox" id="${DOM_IDS.lightbox}" aria-label="${t.t('lightbox.label')}"><button class="lightboxClose" type="button" data-lightbox-close>${t.t('lightbox.close')}</button><img alt=""></dialog>${messages}${clientScript}`;
  const hashes = inlineScriptHashes(body);
  return `<!doctype html>\n<html lang="${escapeHtml(t.lang)}" dir="${t.dir}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(options.title)}</title>\n${csp(hashes)}\n<style>${REPORT_CSS}${accent}${localeCss}</style>\n</head>\n<body>${body}</body>\n</html>`;
}
