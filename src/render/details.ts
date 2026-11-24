import type { ReportAttachment, ReportModel } from '../report/model.js';
import type { ReportSummary } from '../summary.js';
import { renderAttachment } from './attachments.js';
import { ciDetailRows } from './ci.js';
import { DOM_IDS } from './dom-contract.js';
import { escapeHtml } from './escape.js';
import {
  countPills,
  dateLabel,
  displayStatuses,
  durationLabel,
  exactSizeLabel,
  healthMarkup,
  metadataValueHtml,
  sizeLabel,
  statusBar,
  statusClass,
  statusLabel,
} from './format.js';

import type { Translator } from './i18n.js';
import { renderFeatureMatrix } from './matrix.js';
import type { RenderOptions } from './types.js';

/** Empty element replaced with the exact report size after the document is built. */
export const REPORT_BYTES_MARKER = '<dd data-report-bytes></dd>';

/** Solves the fixed point once and replaces the marker with the exact size. */
export function applyReportSize(html: string, t: Translator): string {
  const markerBytes = Buffer.byteLength(REPORT_BYTES_MARKER, 'utf8');
  const baseBytes = Buffer.byteLength(html, 'utf8') - markerBytes;
  const replacement = (bytes: number): string =>
    `<dd>${escapeHtml(exactSizeLabel(bytes, t))}</dd>`;
  let displayed = 0;
  // The label length changes only at digit and MB boundaries, so five rounds
  // is a guard; the loop breaks on equality.
  for (let i = 0; i < 5; i += 1) {
    const next = baseBytes + Buffer.byteLength(replacement(displayed), 'utf8');
    if (next === displayed) break;
    displayed = next;
  }
  return html.replace(REPORT_BYTES_MARKER, () => replacement(displayed));
}

function detailsHeader(model: ReportModel, t: Translator): string {
  const date = dateLabel(model.startedAt, t);
  return `<header class="runHead"><div><p class="path">${escapeHtml(model.source)} / ${t.t('details.path')}</p><h1>${t.t('details.title')}</h1><p class="meta">${date ? `<span>${date}</span>` : ''}<span>${escapeHtml(model.source)}</span></p></div><div class="health">${healthMarkup(model, t)}${statusBar(model)}${countPills(model, t)}</div></header>`;
}

function largestAttachments(model: ReportModel): ReportAttachment[] {
  return model.scenarios
    .flatMap((scenario) => scenario.attachments)
    .concat(
      model.runHooks.flatMap((hook) => hook.attachments),
      model.runAttachments,
    )
    .map((attachment, index) => ({ attachment, index }))
    .sort(
      (a, b) =>
        b.attachment.bytes - a.attachment.bytes || a.index - b.index,
    )
    .slice(0, 3)
    .map(({ attachment }) => attachment);
}

function runPanel(
  model: ReportModel,
  total: number,
  options: RenderOptions,
  t: Translator,
): string {
  const { inputFiles, inputBytes } = options;
  const inputRow =
    typeof inputFiles === 'number' &&
    Number.isFinite(inputFiles) &&
    inputFiles >= 0 &&
    typeof inputBytes === 'number' &&
    Number.isFinite(inputBytes) &&
    inputBytes >= 0
      ? `<dt>${t.t('details.inputData')}</dt><dd>${t.t('details.inputFiles', { count: inputFiles })} · ${sizeLabel(inputBytes, t)}</dd>`
      : '';
  const largest = largestAttachments(model);
  const largestRow = largest.length
    ? `<dt>${t.t('details.largestAttachments')}</dt><dd><ul class="sizeList">${largest.map((attachment) => `<li><span class="sizeName">${escapeHtml(attachment.fileName)}</span><span class="sizeValue">${sizeLabel(attachment.bytes, t)}</span></li>`).join('')}</ul></dd>`
    : '';
  return `<h2 class="subhead">${t.t('details.run')}</h2><dl class="metaList sizeMeta"><dt>${t.t('details.testTime')}</dt><dd>${durationLabel(model.durationMs, t)}</dd><dt>${t.t('details.features')}</dt><dd>${t.number(model.counts.features)}</dd><dt>${t.t('details.scenarios')}</dt><dd>${t.number(total)}</dd><dt>${t.t('details.steps')}</dt><dd>${t.number(model.counts.steps.total)}</dd><dt>${t.t('details.hooks')}</dt><dd>${t.number(model.counts.hooks.total)}</dd><dt>${t.t('details.attachments')}</dt><dd>${t.number(model.counts.attachments)}</dd><dt>${t.t('details.attachmentSize')}</dt><dd>${sizeLabel(model.counts.attachmentBytes, t)}</dd>${inputRow}<dt>${t.t('details.reportHtml')}</dt>${REPORT_BYTES_MARKER}${largestRow}<dt>${t.t('details.source')}</dt><dd>${escapeHtml(model.source)}</dd></dl><p class="durationNote">${t.t('details.durationNote')}</p><p class="durationNote">${t.t('details.sizeNote')}</p>`;
}

function environmentPanel(
  model: ReportModel,
  customRows: string,
  t: Translator,
): string {
  const environmentRows = [
    model.environment?.producer
      ? `<dt>${t.t('details.producer')}</dt><dd>${escapeHtml(model.environment.producer)}</dd>`
      : '',
    model.environment?.runtime
      ? `<dt>${t.t('details.runtime')}</dt><dd>${escapeHtml(model.environment.runtime)}</dd>`
      : '',
    model.environment?.os
      ? `<dt>${t.t('details.os')}</dt><dd>${escapeHtml(model.environment.os)}</dd>`
      : '',
    model.environment?.cpu
      ? `<dt>${t.t('details.cpu')}</dt><dd>${escapeHtml(model.environment.cpu)}</dd>`
      : '',
    model.environment?.protocol
      ? `<dt>${t.t('details.protocol')}</dt><dd>${escapeHtml(model.environment.protocol)}</dd>`
      : '',
    ciDetailRows(model.environment?.ci, t),
  ].join('');
  return `${environmentRows ? `<h2 class="subhead">${t.t('details.runEnvironment')}</h2><dl class="metaList">${environmentRows}</dl>` : ''}${customRows ? `<h2 class="subhead">${t.t('details.customMetadata')}</h2><dl class="metaList">${customRows}</dl>` : ''}`;
}

export function renderAnalysisView(
  model: ReportModel,
  options: RenderOptions,
  summary: ReportSummary,
  t: Translator,
  staticMode = false,
): string {
  const counts = model.counts.scenarios;
  const preview = {
    schemaVersion: summary.schemaVersion,
    status: summary.status,
    counts: summary.counts,
    attachments: summary.attachments,
  };
  const customRows = Object.entries(options.metadata ?? {})
    .filter(([key, value]) => key.length > 0 && String(value ?? '').length > 0)
    .map(
      ([key, value]) =>
        `<dt>${escapeHtml(key)}</dt><dd>${metadataValueHtml(value)}</dd>`,
    )
    .join('');
  const view = `${detailsHeader(model, t)}<div class="analysisGrid"><section class="panel"><h2>${t.t('details.features')}</h2><p>${t.t('details.featureSpend')}</p><p class="matrixHint">${t.t('details.matrixHint')}</p><div class="tableWrap" tabindex="0" role="region" aria-label="${t.t('details.matrixLabel')}">${renderFeatureMatrix(model, t)}</div></section><section class="panel"><h2>${t.t('details.statusDistribution')}</h2><p>${t.t('details.passRateNote')}</p><div class="legend">${displayStatuses(model)
    .map(
      (status) =>
        `<div class="legendRow ${statusClass(status)}"><span class="marker ${statusClass(status)}"></span><span>${statusLabel(status, t)}</span><b>${t.number(counts[status])}</b></div>`,
    )
    .join('')}</div>${runPanel(model, counts.total, options, t)}${environmentPanel(model, customRows, t)}</section></div>${model.runAttachments.length ? `<section class="panel" style="margin-top:16px"><h2>${t.t('details.runAttachments')}</h2>${model.runAttachments.map((attachment) => renderAttachment(attachment, t.t('details.runAttachments'), t, staticMode)).join('')}</section>` : ''}<section class="panel" style="margin-top:16px"><h2>${t.t('details.agentSummary')}</h2><p>${t.t('details.agentSummaryNote')}</p><pre class="json" tabindex="0" aria-label="${t.t('details.agentSummaryJson')}">${escapeHtml(JSON.stringify(preview))}</pre></section><p class="foot">${t.t('details.fullSummary')} <code>tolkira ... --json</code></p>`;
  return staticMode
    ? `<div class="tabPanel" id="${DOM_IDS.analysisView}"><div class="shell analysis">${view}</div></div>`
    : `<div class="tabPanel" id="${DOM_IDS.analysisView}" role="tabpanel" aria-labelledby="view-analysis" tabindex="0" hidden><div class="shell analysis">${view}</div></div>`;
}
