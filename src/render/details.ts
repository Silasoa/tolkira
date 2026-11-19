import type { ReportModel } from '../report/model.js';
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
  healthMarkup,
  statusBar,
  statusClass,
  statusLabel,
} from './format.js';
import { renderFeatureMatrix } from './matrix.js';
import type { RenderOptions } from './types.js';

function detailsHeader(model: ReportModel): string {
  return `<header class="runHead"><div><p class="path">${escapeHtml(model.source)} / details</p><h1>Run details</h1><p class="meta">${dateLabel(model.startedAt) ? `<span>${dateLabel(model.startedAt)}</span>` : ''}<span>${escapeHtml(model.source)}</span></p></div><div class="health">${healthMarkup(model)}${statusBar(model)}${countPills(model)}</div></header>`;
}

function runPanel(model: ReportModel, total: number): string {
  return `<h2 class="subhead">Run</h2><dl class="metaList"><dt>Test time</dt><dd>${durationLabel(model.durationMs)}</dd><dt>Features</dt><dd>${model.counts.features}</dd><dt>Scenarios</dt><dd>${total}</dd><dt>Steps (excl. hooks)</dt><dd>${model.counts.steps.total}</dd><dt>Hooks</dt><dd>${model.counts.hooks.total}</dd><dt>Attachments</dt><dd>${model.counts.attachments}</dd><dt>Attachment size</dt><dd>${model.counts.attachmentBytes} bytes</dd><dt>Source</dt><dd>${escapeHtml(model.source)}</dd></dl><p class="durationNote">Test time sums the final attempt per scenario and test-run hooks; Scenario time sums the final attempt per scenario. Neither is wall-clock time.</p>`;
}

function environmentPanel(model: ReportModel, customRows: string): string {
  const environmentRows = [
    model.environment?.producer
      ? `<dt>Producer</dt><dd>${escapeHtml(model.environment.producer)}</dd>`
      : '',
    model.environment?.runtime
      ? `<dt>Runtime</dt><dd>${escapeHtml(model.environment.runtime)}</dd>`
      : '',
    model.environment?.os
      ? `<dt>OS</dt><dd>${escapeHtml(model.environment.os)}</dd>`
      : '',
    model.environment?.cpu
      ? `<dt>CPU</dt><dd>${escapeHtml(model.environment.cpu)}</dd>`
      : '',
    model.environment?.protocol
      ? `<dt>Protocol</dt><dd>${escapeHtml(model.environment.protocol)}</dd>`
      : '',
    ciDetailRows(model.environment?.ci),
  ].join('');
  return `${environmentRows ? `<h2 class="subhead">Run environment</h2><dl class="metaList">${environmentRows}</dl>` : ''}${customRows ? `<h2 class="subhead">Custom metadata</h2><dl class="metaList">${customRows}</dl>` : ''}`;
}

export function renderAnalysisView(
  model: ReportModel,
  options: RenderOptions,
  summary: ReportSummary,
): string {
  const counts = model.counts.scenarios;
  const preview = {
    schemaVersion: summary.schemaVersion,
    status: summary.status,
    counts: summary.counts,
    attachments: summary.attachments,
  };
  const customRows = Object.entries(options.metadata ?? {})
    .filter(([key, value]) => key.length > 0 && value.length > 0)
    .map(
      ([key, value]) =>
        `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`,
    )
    .join('');
  return `<div class="tabPanel" id="${DOM_IDS.analysisView}" role="tabpanel" aria-labelledby="view-analysis" tabindex="0" hidden><main class="shell analysis">${detailsHeader(model)}<div class="analysisGrid"><section class="panel"><h2>Features</h2><p>Where the run spent its scenarios and steps.</p><p class="matrixHint">Executed scenarios only. Scroll for all status columns.</p><div class="tableWrap" tabindex="0" role="region" aria-label="Feature status matrix">${renderFeatureMatrix(model)}</div></section><section class="panel"><h2>Status distribution</h2><p>Pass rate counts attempted (non-skipped) scenarios; counts and bars include skipped.</p><div class="legend">${displayStatuses(model)
    .map(
      (status) =>
        `<div class="legendRow ${statusClass(status)}"><span class="marker ${statusClass(status)}"></span><span>${statusLabel(status)}</span><b>${counts[status]}</b></div>`,
    )
    .join('')}</div>${runPanel(model, counts.total)}${environmentPanel(model, customRows)}</section></div>${model.runAttachments.length ? `<section class="panel" style="margin-top:16px"><h2>Run attachments</h2>${model.runAttachments.map((attachment) => renderAttachment(attachment, 'Run attachments')).join('')}</section>` : ''}<section class="panel" style="margin-top:16px"><h2>Agent summary</h2><p>The same run as stable JSON for CI tools and agents. Its step counts include hook entries; the HTML counts above exclude them.</p><pre class="json" tabindex="0" aria-label="Agent summary JSON">${escapeHtml(JSON.stringify(preview))}</pre></section><p class="foot">Full summary: <code>tolkira ... --json</code></p></main></div>`;
}
