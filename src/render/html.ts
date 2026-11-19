import { createHash } from 'node:crypto';
import type { Envelope } from '@cucumber/messages';
import { sanitizeEnvelopes } from '../input/sanitize.js';
import { indexRun } from '../report/index-run.js';
import { buildReportModel } from '../report/model.js';
import { summarizeIndex } from '../summary.js';
import { isLogoDataUri, isValidAccent } from '../validation.js';
import { attachmentWarning } from '../warnings.js';
import { CLIENT_SCRIPT } from './client-bundle.js';
import { DOM_IDS } from './dom-contract.js';
import { renderAnalysisView } from './details.js';
import { escapeHtml } from './escape.js';
import { renderReportView } from './report.js';
import { REPORT_CSS } from './styles.js';
import { renderTrendsView } from './trends.js';
import type { RenderOptions } from './types.js';

export type { RenderOptions } from './types.js';

function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const content = match[1] ?? '';
    hashes.add(
      `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`,
    );
  }
  return [...hashes];
}

function csp(hashes: string[]): string {
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; script-src ${hashes.join(' ') || "'none'"}; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
}

function tabBar(historyLength: number): string {
  return `<div class="views" role="tablist" aria-label="Report views"><button class="view" id="view-report" type="button" role="tab" data-view="report" aria-selected="true" aria-controls="${DOM_IDS.reportView}">Report</button><button class="view" id="view-analysis" type="button" role="tab" data-view="analysis" aria-selected="false" aria-controls="${DOM_IDS.analysisView}">Details</button>${historyLength >= 2 ? `<button class="view" id="view-trends" type="button" role="tab" data-view="trends" aria-selected="false" aria-controls="${DOM_IDS.trendsView}">Trends</button>` : ''}</div>`;
}

export async function renderHtml(
  envelopes: Envelope[],
  options: RenderOptions,
): Promise<string> {
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
  const clientScript = `<script>${CLIENT_SCRIPT.replace(/<\/script/gi, '<\\/script')}</script>`;
  const skipped = options.skippedAttachments ?? 0;
  const notice =
    skipped > 0
      ? `<div class="noticeShell"><div class="attachmentWarning" role="note">${escapeHtml(attachmentWarning(skipped))}</div></div>`
      : '';
  const trends = history.length >= 2 ? renderTrendsView(history) : '';
  const body = `<header class="topbar"><div class="topbarInner"><div class="brand">${logo}tol<span>kira</span></div>${tabBar(history.length)}</div></header><p class="sr" id="${DOM_IDS.copyLive}" aria-live="polite"></p>${notice}${renderReportView(model, options)}${renderAnalysisView(model, options, summary)}${trends}<dialog class="lightbox" id="${DOM_IDS.lightbox}" aria-label="Full-size attachment"><button class="lightboxClose" type="button" data-lightbox-close>Close</button><img alt=""></dialog>${clientScript}`;
  const hashes = inlineScriptHashes(body);
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(options.title)}</title>\n${csp(hashes)}\n<style>${REPORT_CSS}${accent}</style>\n</head>\n<body>${body}</body>\n</html>`;
}
