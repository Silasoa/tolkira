import { createHash } from 'node:crypto';
import type { Envelope } from '@cucumber/messages';
import { sanitizeEnvelopes } from '../input/sanitize.js';
import {
  buildReportModel,
  type ReportAttachment,
  type ReportFeature,
  type ReportModel,
  type ReportScenario,
  type ReportStatus,
  type ReportStep,
} from '../report/model.js';
import type { ReportSummary } from '../summary.js';
import { summarizeEnvelopes } from '../summary.js';
import { isLogoDataUri, isValidAccent } from '../validation.js';
import { escapeHtml } from './escape.js';
import { REPORT_CSS } from './styles.js';

export interface RenderOptions {
  title: string;
  metadata?: Record<string, string>;
  logo?: string;
  accent?: string;
  summary?: ReportSummary;
}

function statusLabel(status: ReportStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClass(status: ReportStatus): string {
  return status === 'passed' ? 'pass' : status === 'failed' ? 'fail' : status;
}

function durationLabel(milliseconds: number): string {
  if (milliseconds < 1000) return `${Math.round(milliseconds * 100) / 100} ms`;
  return `${(milliseconds / 1000).toFixed(2)} s`;
}

function dateLabel(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

type DisplayStatus = ReportStatus;

const ALL_STATUSES: DisplayStatus[] = [
  'passed',
  'failed',
  'pending',
  'undefined',
  'ambiguous',
  'skipped',
  'unknown',
];

function displayStatuses(model: ReportModel): DisplayStatus[] {
  return ALL_STATUSES.filter(
    (status) =>
      status === 'passed' ||
      status === 'failed' ||
      model.counts.scenarios[status] > 0,
  );
}

function statusBar(model: ReportModel): string {
  const total = model.counts.scenarios.total;
  if (total === 0) return '';
  return `<div class="bar" aria-hidden="true">${displayStatuses(model)
    .map(
      (status) =>
        `<i class="${statusClass(status)}" style="width:${(model.counts.scenarios[status] / total) * 100}%"></i>`,
    )
    .join('')}</div>`;
}

function countPills(model: ReportModel): string {
  const counts = model.counts.scenarios;
  return `<div class="counts">${displayStatuses(model)
    .map(
      (status) =>
        `<span class="${statusClass(status)}"><b>${counts[status]}</b> ${status}</span>`,
    )
    .join('')}</div>`;
}

function renderAttachment(
  attachment: ReportAttachment,
): string {
  const name = escapeHtml(attachment.fileName);
  const media = escapeHtml(attachment.mediaType);
  if (attachment.kind === 'image' && attachment.dataUri) {
    return `<figure class="attachment"><button class="shotButton" type="button" aria-label="View full size: ${name}"><img class="shot" src="${escapeHtml(attachment.dataUri)}" alt="Attachment ${name} (${media})"></button><figcaption>${name} (${media})</figcaption></figure>`;
  }
  if (attachment.kind === 'video' && attachment.dataUri) {
    return `<figure class="attachment"><video class="shot" controls src="${escapeHtml(attachment.dataUri)}"></video><figcaption>${name} (${media})</figcaption></figure>`;
  }
  if (attachment.kind === 'audio' && attachment.dataUri) {
    return `<figure class="attachment"><audio controls src="${escapeHtml(attachment.dataUri)}"></audio><figcaption>${name} (${media})</figcaption></figure>`;
  }
  if (attachment.kind === 'text' && attachment.text !== undefined) {
    return `<details class="attachmentText"><summary>${name} (${media})</summary><pre>${escapeHtml(attachment.text)}</pre></details>`;
  }
  if (attachment.dataUri) {
    return `<a class="fileLink" href="${escapeHtml(attachment.dataUri)}" download="${name}">${name} (${media}, ${attachment.bytes} bytes)</a>`;
  }
  return `<span class="fileLink">${name} (${media}, ${attachment.bytes} bytes)</span>`;
}

function renderStep(step: ReportStep): string {
  const docString = step.docString
    ? `<pre class="docString">${escapeHtml(step.docString)}</pre>`
    : '';
  const table = step.dataTable
    ? `<div class="tableWrap"><table class="dataTable"><tbody>${step.dataTable
        .map(
          (row, index) =>
            `<tr>${row
              .map(
                (cell) =>
                  `<${index === 0 ? 'th' : 'td'}>${escapeHtml(cell)}</${index === 0 ? 'th' : 'td'}>`,
              )
              .join('')}</tr>`,
        )
        .join('')}</tbody></table></div>`
    : '';
  const error = step.message
    ? `<pre class="error">${escapeHtml(step.message)}</pre>`
    : '';
  const attachments = step.attachments
    .map((attachment) => renderAttachment(attachment))
    .join('');
  return `<li class="step"><span class="marker ${statusClass(step.status)}"><span class="sr">${statusLabel(step.status)}</span></span><div><span class="kw">${escapeHtml(step.keyword)}</span> ${escapeHtml(step.text)}${error}${docString}${table}${attachments}</div><span class="dur">${durationLabel(step.durationMs)}</span></li>`;
}

function scenarioText(scenario: ReportScenario): string {
  return [
    scenario.name,
    scenario.featureName,
    scenario.uri,
    scenario.keyword,
    scenario.description,
    scenario.tags.join(' '),
    scenario.steps.map((step) => `${step.keyword} ${step.text} ${step.message ?? ''}`).join(' '),
  ].join(' ');
}

function renderScenario(scenario: ReportScenario): string {
  const image = scenario.attachments.find(
    (attachment) => attachment.kind === 'image' && attachment.dataUri,
  );
  const open = scenario.status === 'failed' || Boolean(image);
  const steps = scenario.steps.map((step) => renderStep(step)).join('');
  const description = scenario.description
    ? `<p class="description">${escapeHtml(scenario.description)}</p>`
    : '';
  const extraAttachments = scenario.extraAttachments.length
    ? `<h3>Attachments</h3>${scenario.extraAttachments.map((attachment) => renderAttachment(attachment)).join('')}`
    : '';
  return `<details class="scenario" data-scenario data-status="${scenario.status}" data-search="${escapeHtml(scenarioText(scenario))}" ${open ? 'open' : ''}><summary class="scenarioButton"><span class="statusCell"><span class="statusText ${statusClass(scenario.status)}">${statusLabel(scenario.status)}</span></span><span class="thumbCell">${image ? `<img class="thumb" src="${escapeHtml(image.dataUri ?? '')}" alt="" loading="lazy">` : ''}</span><span class="scenarioMain"><h3 class="scenarioName">${escapeHtml(scenario.name)}</h3><span class="scenarioSub">${scenario.steps.length} step${scenario.steps.length === 1 ? '' : 's'}${scenario.tags.length ? ` <span class="tags">${scenario.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</span>` : ''}</span></span><span class="rowRight">${durationLabel(scenario.durationMs)}${scenario.attachments.length ? `<br>${scenario.attachments.length} attachment${scenario.attachments.length === 1 ? '' : 's'}` : ''}</span><span class="chev" aria-hidden="true"></span></summary><div class="detailInline">${description}<h3>Steps</h3><ol class="steps">${steps}</ol>${extraAttachments}<div class="detailMeta"><span>Feature: ${escapeHtml(scenario.featureName)}</span><span>Attempt: ${scenario.attempt + 1}</span>${scenario.startedAt ? `<span>Started: ${dateLabel(scenario.startedAt)}</span>` : ''}${scenario.ruleName ? `<span>Rule: ${escapeHtml(scenario.ruleName)}</span>` : ''}</div></div></details>`;
}

function renderFeature(feature: ReportFeature): string {
  const passed = feature.scenarios.filter((scenario) => scenario.status === 'passed').length;
  const open =
    feature.status === 'failed' ||
    feature.scenarios.some((scenario) =>
      scenario.attachments.some((attachment) => attachment.kind === 'image'),
    );
  const description = feature.description
    ? `<p class="description">${escapeHtml(feature.description)}</p>`
    : '';
  return `<details class="feature ${feature.status === 'failed' ? 'has-fail' : 'has-pass'}" data-feature ${open ? 'open' : ''}><summary><span class="statusCell"><span class="statusText ${statusClass(feature.status)}">${statusLabel(feature.status)}</span></span><h2>${escapeHtml(feature.name)}</h2><span class="fmeta">${passed} of ${feature.scenarios.length} passed, ${escapeHtml(feature.uri)}</span><span class="chev" aria-hidden="true"></span></summary>${description}<div class="rows">${feature.scenarios.map(renderScenario).join('')}</div></details>`;
}

function metadataLine(metadata: Record<string, string> | undefined): string {
  return Object.entries(metadata ?? {})
    .filter(([key, value]) => key.length > 0 && value.length > 0)
    .map(
      ([key, value]) =>
        `<span><b>${escapeHtml(key)}</b> ${escapeHtml(value)}</span>`,
    )
    .join('');
}

function renderReportView(
  model: ReportModel,
  options: RenderOptions,
): string {
  const total = model.counts.scenarios.total;
  const passed = model.counts.scenarios.passed;
  const percent = total === 0 ? 0 : Math.round((passed / total) * 1000) / 10;
  const meta = metadataLine(options.metadata);
  const date = dateLabel(model.startedAt);
  const features = model.features
    .map((feature) => renderFeature(feature))
    .join('');
  return `<div class="tabPanel" id="report-view" role="tabpanel" aria-labelledby="view-report"><main class="shell"><header class="runHead"><div><p class="path">${escapeHtml(model.source)} / ${escapeHtml(options.title)}</p><h1>${escapeHtml(options.title)}</h1><p class="meta">${date ? `<span>${date}</span>` : ''}<span>${model.counts.features} feature${model.counts.features === 1 ? '' : 's'}</span><span>${model.counts.scenarios.total} scenarios</span><span>${escapeHtml(model.source)}</span>${meta}</p></div><div class="health"><div class="healthTop"><strong>${percent}%</strong><span>${passed} of ${total} passed</span></div>${statusBar(model)}${countPills(model)}</div></header><div class="toolbar"><label class="search"><span aria-hidden="true">⌕</span><input data-search type="search" placeholder="Search scenario, feature or tag" aria-label="Search scenarios"></label><div class="filters">${displayStatuses(model)
    .map(
      (status) =>
        `<button class="filter" type="button" data-status="${status}" aria-pressed="true">${statusLabel(status)} <b>${model.counts.scenarios[status]}</b></button>`,
    )
    .join('')}</div><div class="expand"><button type="button" data-expand="all">Expand all</button><button type="button" data-expand="none">Collapse all</button></div></div><p class="live sr" id="tolkira-live" role="status" aria-live="polite" data-total="${total}"></p><div id="feature-list">${features || `<div class="empty">No scenarios in this report.</div>`}</div><div class="empty" id="empty-results" hidden>No scenarios match the current search or filters.</div><p class="foot">Generated by Tolkira. Single file. No network requests. Screenshots are embedded.</p></main></div>`;
}

function renderAnalysisView(
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
  const metadata = Object.entries(options.metadata ?? {})
    .filter(([key, value]) => key.length > 0 && value.length > 0)
    .map(
      ([key, value]) =>
        `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`,
    )
    .join('');
  const environmentRows = [
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
  ].join('');
  return `<div class="tabPanel" id="analysis-view" role="tabpanel" aria-labelledby="view-analysis" hidden><main class="shell analysis"><header class="runHead"><div><p class="path">${escapeHtml(model.source)} / details</p><h1>Run details</h1><p class="meta">${dateLabel(model.startedAt) ? `<span>${dateLabel(model.startedAt)}</span>` : ''}<span>${escapeHtml(model.source)}</span></p></div><div class="health"><div class="healthTop"><strong>${counts.total === 0 ? 0 : Math.round((counts.passed / counts.total) * 1000) / 10}%</strong><span>${counts.passed} of ${counts.total} passed</span></div>${statusBar(model)}${countPills(model)}</div></header><div class="analysisGrid"><section class="panel"><h2>Features</h2><p>Where the run spent its scenarios and steps.</p><table class="featureTable"><thead><tr><th>Feature</th><th>Scenarios</th><th>Passed</th><th>Failed</th><th>Duration</th></tr></thead><tbody>${model.features
    .map(
      (feature) =>
        `<tr><td>${escapeHtml(feature.name)}</td><td class="num">${feature.scenarios.length}</td><td class="num">${feature.scenarios.filter((scenario) => scenario.status === 'passed').length}</td><td class="num">${feature.scenarios.filter((scenario) => scenario.status === 'failed').length}</td><td class="num">${durationLabel(feature.durationMs)}</td></tr>`,
    )
    .join('')}</tbody></table></section><section class="panel"><h2>Status distribution</h2><p>All scenarios in the run.</p><div class="legend">${displayStatuses(model)
    .map(
      (status) =>
        `<div class="legendRow ${statusClass(status)}"><span class="marker ${statusClass(status)}"></span><span>${statusLabel(status)}</span><b>${counts[status]}</b></div>`,
    )
    .join('')}</div><h2 style="margin-top:20px">Summary</h2><dl class="metaList"><dt>Duration</dt><dd>${durationLabel(model.durationMs)}</dd><dt>Features</dt><dd>${model.counts.features}</dd><dt>Scenarios</dt><dd>${counts.total}</dd><dt>Steps</dt><dd>${model.counts.steps.total}</dd><dt>Attachments</dt><dd>${model.counts.attachments}</dd><dt>Attachment size</dt><dd>${model.counts.attachmentBytes} bytes</dd><dt>Source</dt><dd>${escapeHtml(model.source)}</dd>${environmentRows}${metadata}</dl></section></div>${model.runAttachments.length ? `<section class="panel" style="margin-top:16px"><h2>Run attachments</h2>${model.runAttachments.map((attachment) => renderAttachment(attachment)).join('')}</section>` : ''}<section class="panel" style="margin-top:16px"><h2>Agent summary</h2><p>The same run as stable JSON for CI tools and agents.</p><pre class="json">${escapeHtml(JSON.stringify(preview))}</pre></section><p class="foot">Full summary: <code>tolkira ... --json</code></p></main></div>`;
}

const SCRIPT = `<script>
(function () {
  var views = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));
  var report = document.getElementById('report-view');
  var analysis = document.getElementById('analysis-view');
  function showView(name) {
    if (!report || !analysis) return;
    report.hidden = name !== 'report';
    analysis.hidden = name !== 'analysis';
    views.forEach(function (button) {
      var active = button.getAttribute('data-view') === name;
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }
  views.forEach(function (button) {
    button.addEventListener('click', function () { showView(button.getAttribute('data-view')); });
  });
  var tablist = document.querySelector('[role="tablist"]');
  if (tablist) tablist.addEventListener('keydown', function (event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    var index = views.indexOf(document.activeElement);
    if (index < 0) return;
    var next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length;
    views[next].focus();
    showView(views[next].getAttribute('data-view'));
  });
  var state = { query: '', hidden: new Set() };
  var scenarios = Array.prototype.slice.call(document.querySelectorAll('[data-scenario]'));
  var features = Array.prototype.slice.call(document.querySelectorAll('[data-feature]'));
  var live = document.getElementById('tolkira-live');
  function apply() {
    var query = state.query.toLowerCase();
    var visible = 0;
    scenarios.forEach(function (scenario) {
      var status = scenario.getAttribute('data-status');
      var text = (scenario.getAttribute('data-search') || '').toLowerCase();
      var match = !state.hidden.has(status) && (!query || text.indexOf(query) !== -1);
      scenario.hidden = !match;
      if (match) visible += 1;
    });
    features.forEach(function (feature) {
      var children = feature.querySelectorAll('[data-scenario]');
      var any = Array.prototype.some.call(children, function (child) { return !child.hidden; });
      feature.hidden = !any;
      if (any && (query || state.hidden.size)) feature.open = true;
    });
    if (live) live.textContent = visible + ' of ' + scenarios.length + ' scenarios visible';
    var empty = document.getElementById('empty-results');
    if (empty) empty.hidden = visible !== 0;
  }
  var search = document.querySelector('[data-search]');
  if (search) search.addEventListener('input', function () {
    state.query = search.value;
    apply();
  });
  Array.prototype.slice.call(document.querySelectorAll('button.filter[data-status]')).forEach(function (button) {
    button.addEventListener('click', function () {
      var status = button.getAttribute('data-status');
      var active = button.getAttribute('aria-pressed') !== 'false';
      if (active) { state.hidden.add(status); button.setAttribute('aria-pressed', 'false'); }
      else { state.hidden.delete(status); button.setAttribute('aria-pressed', 'true'); }
      apply();
    });
  });
  Array.prototype.slice.call(document.querySelectorAll('[data-expand]')).forEach(function (button) {
    button.addEventListener('click', function () {
      var open = button.getAttribute('data-expand') === 'all';
      features.forEach(function (feature) { feature.open = open; });
      scenarios.forEach(function (scenario) { scenario.open = open; });
    });
  });
  var lightbox = document.getElementById('tolkira-lightbox');
  if (lightbox) {
    var lightboxImage = lightbox.querySelector('img');
    var closeLightbox = lightbox.querySelector('[data-lightbox-close]');
    Array.prototype.slice.call(document.querySelectorAll('.shotButton')).forEach(function (button) {
      button.addEventListener('click', function () {
        var image = button.querySelector('img');
        if (!image || !lightboxImage) return;
        lightboxImage.src = image.src;
        lightboxImage.alt = image.alt;
        if (typeof lightbox.showModal === 'function') lightbox.showModal();
        else lightbox.setAttribute('open', '');
      });
    });
    if (closeLightbox) closeLightbox.addEventListener('click', function () { lightbox.close(); });
    lightbox.addEventListener('click', function (event) { if (event.target === lightbox) lightbox.close(); });
  }
  showView('report');
})();
</script>`;

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

export async function renderHtml(
  envelopes: Envelope[],
  options: RenderOptions,
): Promise<string> {
  const safeEnvelopes = sanitizeEnvelopes(envelopes);
  const model = buildReportModel(safeEnvelopes);
  const summary = options.summary ?? summarizeEnvelopes(safeEnvelopes);
  const logo = isLogoDataUri(options.logo)
    ? `<img class="logo" src="${escapeHtml(options.logo)}" alt="">`
    : '';
  const accent = isValidAccent(options.accent)
    ? `<style>:root{--accent:${options.accent}}</style>`
    : '';
  const body = `<header class="topbar"><div class="topbarInner"><div class="brand">${logo}tol<span>kira</span></div><div class="views" role="tablist" aria-label="Report view"><button class="view" id="view-report" type="button" role="tab" data-view="report" aria-selected="true" aria-controls="report-view">Report</button><button class="view" id="view-analysis" type="button" role="tab" data-view="analysis" aria-selected="false" aria-controls="analysis-view">Details</button></div></div></header>${renderReportView(model, options)}${renderAnalysisView(model, options, summary)}<dialog class="lightbox" id="tolkira-lightbox" aria-label="Full-size attachment"><button class="lightboxClose" type="button" data-lightbox-close>Close</button><img alt=""></dialog>${SCRIPT}`;
  const hashes = inlineScriptHashes(body);
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(options.title)}</title>\n${csp(hashes)}\n<style>${REPORT_CSS}${accent}</style>\n</head>\n<body>${body}</body>\n</html>`;
}
