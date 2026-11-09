import { createHash } from 'node:crypto';
import type { Envelope } from '@cucumber/messages';
import { sanitizeEnvelopes } from '../input/sanitize.js';
import {
  buildReportModel,
  statusSeverity,
  type ReportAttachment,
  type ReportFeature,
  type ReportModel,
  type ReportScenario,
  type ReportStatus,
  type ReportStep,
} from '../report/model.js';
import type { ReportSummary } from '../summary.js';
import { summarizeEnvelopes, displayUri } from '../summary.js';
import { isLogoDataUri, isValidAccent } from '../validation.js';
import { escapeHtml } from './escape.js';
import { REPORT_CSS } from './styles.js';

export interface RenderOptions {
  title: string;
  metadata?: Record<string, string>;
  logo?: string;
  accent?: string;
  summary?: ReportSummary;
  provenance?: Map<string, string>;
}

function statusLabel(status: ReportStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClass(status: ReportStatus): string {
  return status === 'passed' ? 'pass' : status === 'failed' ? 'fail' : status;
}

const STEP_GLYPHS: Record<ReportStatus, string> = {
  passed: '✓',
  failed: '×',
  pending: '?',
  undefined: '!',
  ambiguous: '?',
  skipped: '–',
  unknown: '·',
};

function durationLabel(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '0 ms';
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
    (status) => model.counts.scenarios[status] > 0,
  );
}

interface OrderedFeature {
  feature: ReportFeature;
  scenarios: ReportScenario[];
}

const TRIAGE_FEATURE_LIMIT = 20;
const TRIAGE_SCENARIO_LIMIT = 3;
const SOURCE_LIMIT = 6;

function compareStatus(a: ReportStatus, b: ReportStatus): number {
  const passed = Number(a === 'passed') - Number(b === 'passed');
  return passed !== 0 ? passed : statusSeverity(b) - statusSeverity(a);
}

function bySeverity<T extends { status: ReportStatus }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const status = compareStatus(a.item.status, b.item.status);
      return status !== 0 ? status : a.index - b.index;
    })
    .map(({ item }) => item);
}

function orderFeatures(features: ReportFeature[]): OrderedFeature[] {
  return bySeverity(features).map((feature) => ({
    feature,
    scenarios: bySeverity(feature.scenarios),
  }));
}

function countStatuses(
  scenarios: Array<{ status: ReportStatus }>,
): Partial<Record<ReportStatus, number>> {
  const counts: Partial<Record<ReportStatus, number>> = {};
  for (const scenario of scenarios) {
    counts[scenario.status] = (counts[scenario.status] ?? 0) + 1;
  }
  return counts;
}

function barWidth(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
}

function attentionCounts(scenarios: ReportScenario[]): string {
  const counts = new Map<ReportStatus, number>();
  for (const scenario of scenarios) {
    if (scenario.status === 'passed') continue;
    counts.set(scenario.status, (counts.get(scenario.status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => statusSeverity(b[0]) - statusSeverity(a[0]))
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');
}

function featureBar(scenarios: ReportScenario[]): string {
  const total = scenarios.length;
  if (total === 0) return '';
  const counts = countStatuses(scenarios);
  const segments = ALL_STATUSES.filter((status) => counts[status])
    .map(
      (status) =>
        `<i class="${statusClass(status)}" style="width:${barWidth(counts[status] ?? 0, total)}%"></i>`,
    )
    .join('');
  return `<span class="bar" aria-hidden="true">${segments}</span>`;
}

function featureShape(
  feature: ReportFeature,
  scenarios: ReportScenario[],
): string {
  const passed = scenarios.filter(
    (scenario) => scenario.status === 'passed',
  ).length;
  const attention = attentionCounts(scenarios);
  const counts = `${passed} of ${scenarios.length} passed${attention ? ` · ${attention}` : ''}`;
  const source = feature.sourceFile
    ? `<span class="featureSource">from ${escapeHtml(feature.sourceFile)}</span>`
    : '';
  return `<span class="featureShape"><span class="featureCounts">${counts}</span>${featureBar(scenarios)}${source}<span class="featureUri">${escapeHtml(displayUri(feature.uri))}</span></span>`;
}

interface TriageEntry extends OrderedFeature {
  index: number;
}

function renderTriageRow({
  feature,
  scenarios,
  index,
}: TriageEntry): string {
  const failing = scenarios.filter(
    (scenario) => scenario.status !== 'passed',
  );
  const links = failing
    .slice(0, TRIAGE_SCENARIO_LIMIT)
    .map((scenario) => {
      const scenarioIndex = scenarios.indexOf(scenario) + 1;
      return `<li><a class="triageScenario" href="#scenario-${index + 1}-${scenarioIndex}"><span class="triageStatus ${statusClass(scenario.status)}">${statusLabel(scenario.status)}</span><span>${escapeHtml(scenario.name)}</span></a></li>`;
    })
    .join('');
  const more =
    failing.length > TRIAGE_SCENARIO_LIMIT
      ? `<li class="triageMore">+${failing.length - TRIAGE_SCENARIO_LIMIT} more in the report</li>`
      : '';
  const failed = scenarios.find((scenario) => scenario.status === 'failed');
  const failedStep = failed?.steps.find(
    (step) => step.status === 'failed' && step.message,
  );
  const reason = failedStep?.message
    ? `${failedStep.keyword ? `${failedStep.keyword} ` : ''}${failedStep.text} — ${failedStep.message.split(/\r?\n/)[0].trim().slice(0, 120)}${failedStep.message.split(/\r?\n/)[0].trim().length > 120 ? '…' : ''}`
    : '';
  return `<li class="triageItem"><a class="triageFeature" href="#feature-${index + 1}" title="${escapeHtml(displayUri(feature.uri))}"><span class="triageStatus ${statusClass(feature.status)}">${statusLabel(feature.status)}</span><span>${escapeHtml(feature.name)}</span></a><p class="triageCounts">${attentionCounts(scenarios)}</p><ul class="triageScenarios">${links}${more}</ul>${reason ? `<p class="triageReason"><span class="triageReasonLabel">First failure:</span> ${escapeHtml(reason)}</p>` : ''}</li>`;
}

function renderTriage(features: OrderedFeature[]): string {
  const attention = features
    .map((entry, index) => ({ ...entry, index }))
    .filter(({ scenarios }) =>
      scenarios.some((scenario) => scenario.status !== 'passed'),
    );
  if (attention.length === 0) return '';

  const shown = attention.slice(0, 5);
  const rest = attention.slice(5, TRIAGE_FEATURE_LIMIT);
  const total = features.reduce(
    (sum, entry) => sum + entry.scenarios.length,
    0,
  );
  const need = attention.reduce(
    (sum, entry) =>
      sum +
      entry.scenarios.filter((scenario) => scenario.status !== 'passed').length,
    0,
  );
  const rows = shown.map(renderTriageRow).join('');
  const restBlock = rest.length
    ? `<details class="triageRest"><summary>Show ${rest.length} more feature${rest.length === 1 ? '' : 's'}</summary><ol class="triageList">${rest.map(renderTriageRow).join('')}</ol></details>`
    : '';
  const remainder =
    attention.length > TRIAGE_FEATURE_LIMIT
      ? `<p class="triageMore">${attention.length - TRIAGE_FEATURE_LIMIT} more feature${attention.length - TRIAGE_FEATURE_LIMIT === 1 ? '' : 's'} below.</p>`
      : '';
  const lead = `${need} of ${total} scenario${total === 1 ? '' : 's'} ${need === 1 ? 'needs' : 'need'} attention.`;
  return `<details class="triageBox" data-triage open><summary class="triageSummary"><span class="triageTitle">Needs attention</span><span class="triageSummaryLead">${lead}</span><span class="chev" aria-hidden="true"></span></summary><nav class="triage" aria-label="Needs attention"><h2 id="triage-heading">Needs attention</h2><p class="triageLead">${lead}</p><ol class="triageList">${rows}</ol>${restBlock}${remainder}</nav></details>`;
}

function renderSourceStrip(model: ReportModel): string {
  if (model.features.some((feature) => !feature.sourceFile)) return '';
  const groups = new Map<string, { features: ReportFeature[]; order: number }>();
  model.features.forEach((feature, index) => {
    const file = feature.sourceFile;
    if (!file) return;
    const group = groups.get(file) ?? { features: [], order: index };
    group.features.push(feature);
    groups.set(file, group);
  });
  if (groups.size < 2) return '';

  const entries = [...groups.entries()].map(([file, group]) => ({
    file,
    features: group.features.length,
    scenarios: group.features.flatMap((feature) => feature.scenarios),
    status: bySeverity(group.features)[0]?.status ?? 'unknown',
    order: group.order,
  }));
  entries.sort((a, b) => {
    const status = compareStatus(a.status, b.status);
    return status !== 0 ? status : a.order - b.order;
  });

  const shown = entries.slice(0, SOURCE_LIMIT);
  const remainder = entries.length - shown.length;
  const items = shown
    .map((entry) => {
      const attention = attentionCounts(entry.scenarios);
      const counts = `${entry.features} feature${entry.features === 1 ? '' : 's'} · ${entry.scenarios.length} scenario${entry.scenarios.length === 1 ? '' : 's'}${attention ? ` · ${attention}` : ''}`;
      return `<li class="sourceItem"><div class="sourceHead"><span class="triageStatus ${statusClass(entry.status)}">${statusLabel(entry.status)}</span><span class="sourceName">${escapeHtml(entry.file)}</span></div><p class="sourceCounts">${counts}</p>${featureBar(entry.scenarios)}</li>`;
    })
    .join('');
  const more =
    remainder > 0
      ? `<p class="triageMore">${remainder} more input${remainder === 1 ? '' : 's'}</p>`
      : '';
  return `<section class="sources" aria-labelledby="sources-heading" data-sources><h2 id="sources-heading">Sources</h2><ul class="sourceList">${items}</ul>${more}</section>`;
}

function statusBar(model: ReportModel): string {
  const total = model.counts.scenarios.total;
  if (total === 0) return '';
  return `<div class="bar" aria-hidden="true">${displayStatuses(model)
    .map(
      (status) =>
        `<i class="${statusClass(status)}" style="width:${barWidth(model.counts.scenarios[status], total)}%"></i>`,
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
  context?: string,
): string {
  const name = escapeHtml(attachment.fileName);
  const media = escapeHtml(attachment.mediaType);
  const label = context
    ? `Screenshot for ${escapeHtml(context)}: ${name}`
    : `Attachment ${name}`;
  if (attachment.kind === 'image' && attachment.dataUri) {
    return `<figure class="attachment"><button class="shotButton" type="button" aria-label="View full size: ${label}"><img class="shot" src="${escapeHtml(attachment.dataUri)}" alt="${label} (${media})"></button><figcaption>${name} (${media})</figcaption></figure>`;
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

function scenarioTags(model: ReportModel): string[] {
  return [...new Set(model.scenarios.flatMap((scenario) => scenario.tags))].sort(
    (a, b) => a.localeCompare(b),
  );
}

function renderStep(step: ReportStep, scenarioName: string): string {
  const docString = step.docString
    ? `<pre class="docString">${escapeHtml(step.docString)}</pre>`
    : '';
  const table = step.dataTable
    ? `<div class="tableWrap" tabindex="0" role="region" aria-label="Data table for: ${escapeHtml(step.text)}"><table class="dataTable"><tbody>${step.dataTable
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
  const context = `${scenarioName}: ${step.keyword.trim()} ${step.text}`;
  const attachments = step.attachments
    .map((attachment) => renderAttachment(attachment, context))
    .join('');
  return `<li class="step"${step.status === 'failed' ? ' data-status="failed"' : ''}><span class="stepMarker ${statusClass(step.status)}"><span aria-hidden="true">${STEP_GLYPHS[step.status]}</span><span class="sr">${statusLabel(step.status)}</span></span><div><span class="kw">${escapeHtml(step.keyword)}</span> ${escapeHtml(step.text)}${error}${docString}${table}${attachments}</div><span class="dur">${durationLabel(step.durationMs)}</span></li>`;
}

function scenarioText(scenario: ReportScenario): string {
  return [
    scenario.name,
    scenario.featureName,
    displayUri(scenario.uri),
    scenario.keyword,
    scenario.description,
    scenario.tags.join(' '),
    scenario.steps.map((step) => `${step.keyword} ${step.text} ${step.message ?? ''}`).join(' '),
  ].join(' ');
}

function renderScenario(
  scenario: ReportScenario,
  featureIndex: number,
  scenarioIndex: number,
): string {
  const image = scenario.attachments.find(
    (attachment) => attachment.kind === 'image' && attachment.dataUri,
  );
  const open = scenario.status === 'failed' || Boolean(image);
  const steps = scenario.steps
    .map((step) => renderStep(step, scenario.name))
    .join('');
  const description = scenario.description
    ? `<p class="description">${escapeHtml(scenario.description)}</p>`
    : '';
  const extraAttachments = scenario.extraAttachments.length
    ? `<h4>Attachments</h4>${scenario.extraAttachments.map((attachment) => renderAttachment(attachment, scenario.name)).join('')}`
    : '';
  const copyFailure =
    scenario.status === 'failed'
      ? '<button class="copyFailure" type="button" data-copy-failure>Copy failure</button>'
      : '';
  return `<details class="scenario" id="scenario-${featureIndex + 1}-${scenarioIndex + 1}" data-scenario data-status="${scenario.status}" data-uri="${escapeHtml(displayUri(scenario.uri))}" data-tags="${escapeHtml(scenario.tags.join(' '))}" data-search="${escapeHtml(scenarioText(scenario))}" ${open ? 'open' : ''}><summary class="scenarioButton"><span class="statusCell"><span class="statusText ${statusClass(scenario.status)}">${statusLabel(scenario.status)}</span></span><span class="thumbCell">${image ? `<img class="thumb" src="${escapeHtml(image.dataUri ?? '')}" alt="" loading="lazy">` : ''}</span><span class="scenarioMain"><h3 class="scenarioName">${escapeHtml(scenario.name)}</h3><span class="scenarioSub">${scenario.steps.length} step${scenario.steps.length === 1 ? '' : 's'}${scenario.tags.length ? ` <span class="tags">${scenario.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</span>` : ''}</span></span><span class="rowRight">${durationLabel(scenario.durationMs)}${scenario.attachments.length ? `<br>${scenario.attachments.length} attachment${scenario.attachments.length === 1 ? '' : 's'}` : ''}</span><span class="chev" aria-hidden="true"></span></summary><div class="detailInline">${description}<div class="stepsHead"><h4>Steps</h4>${copyFailure}</div><ol class="steps">${steps}</ol>${extraAttachments}<div class="detailMeta"><span>Feature: ${escapeHtml(scenario.featureName)}</span><span>Attempt: ${scenario.attempt + 1}</span>${scenario.startedAt ? `<span>Started: ${dateLabel(scenario.startedAt)}</span>` : ''}${scenario.ruleName ? `<span>Rule: ${escapeHtml(scenario.ruleName)}</span>` : ''}</div></div></details>`;
}

function renderFeature(
  { feature, scenarios }: OrderedFeature,
  featureIndex: number,
): string {
  const open =
    feature.status === 'failed' ||
    scenarios.some((scenario) =>
      scenario.attachments.some((attachment) => attachment.kind === 'image'),
    );
  const description = feature.description
    ? `<p class="description">${escapeHtml(feature.description)}</p>`
    : '';
  return `<details class="feature ${feature.status === 'failed' ? 'has-fail' : 'has-pass'}" id="feature-${featureIndex + 1}" data-feature ${open ? 'open' : ''}><summary><span class="statusCell"><span class="statusText ${statusClass(feature.status)}">${statusLabel(feature.status)}</span></span><h2>${escapeHtml(feature.name)}</h2><span class="chev" aria-hidden="true"></span>${featureShape(feature, scenarios)}</summary>${description}<div class="rows">${scenarios
    .map((scenario, scenarioIndex) =>
      renderScenario(scenario, featureIndex, scenarioIndex),
    )
    .join('')}</div></details>`;
}

function matrixStatuses(model: ReportModel): ReportStatus[] {
  return ALL_STATUSES.filter((status) => model.counts.scenarios[status] > 0).sort(
    compareStatus,
  );
}

function renderFeatureMatrix(model: ReportModel): string {
  const statuses = matrixStatuses(model);
  const head = `<tr><th>Feature</th><th>Total</th>${statuses
    .map((status) => `<th>${statusLabel(status)}</th>`)
    .join('')}<th>Duration</th></tr>`;
  const rows = model.features
    .map((feature) => {
      const counts = countStatuses(feature.scenarios);
      const cells = statuses
        .map((status) => {
          const count = counts[status] ?? 0;
          return `<td class="num${count === 0 ? ' zero' : ''}">${count}</td>`;
        })
        .join('');
      return `<tr><th scope="row"><span class="matrixName">${escapeHtml(feature.name)}</span><span class="matrixUri">${escapeHtml(displayUri(feature.uri))}</span></th><td class="num">${feature.scenarios.length}</td>${cells}<td class="num">${durationLabel(feature.durationMs)}</td></tr>`;
    })
    .join('');
  return `<table class="featureTable"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
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
  const ordered = orderFeatures(model.features);
  const features = ordered
    .map((feature, index) => renderFeature(feature, index))
    .join('');
  const triage = renderTriage(ordered);
  const sources = renderSourceStrip(model);
  const tags = scenarioTags(model);
  const tagFilter = tags.length
    ? `<label class="tagFilter"><span>Tag</span><select data-tag-filter><option value="">All tags</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('')}</select></label>`
    : '';
  return `<div class="tabPanel" id="report-view" role="tabpanel" aria-labelledby="view-report" tabindex="0"><main class="shell"><header class="runHead"><div><p class="path">${escapeHtml(model.source)} / ${escapeHtml(options.title)}</p><h1>${escapeHtml(options.title)}</h1><p class="meta">${date ? `<span>${date}</span>` : ''}<span>${model.counts.features} feature${model.counts.features === 1 ? '' : 's'}</span><span>${model.counts.scenarios.total} scenarios</span><span>${durationLabel(model.durationMs)}</span><span>${escapeHtml(model.source)}</span>${meta}</p></div><div class="health"><div class="healthTop"><strong>${percent}%</strong><span>${passed} of ${total} passed</span></div>${statusBar(model)}${countPills(model)}</div></header><div class="toolbar"><label class="search"><span aria-hidden="true">⌕</span><input data-search type="search" placeholder="Search scenario, feature or tag" aria-label="Search scenarios"></label>${tagFilter}<div class="filters">${displayStatuses(model)
    .map(
      (status) =>
        `<button class="filter" type="button" data-status="${status}" aria-pressed="true">${statusLabel(status)} <b>${model.counts.scenarios[status]}</b></button>`,
    )
    .join('')}</div><div class="expand"><button type="button" data-expand="all">Expand all</button><button type="button" data-expand="none">Collapse all</button></div></div><p class="live sr" id="tolkira-live" role="status" aria-live="polite" data-total="${total}"></p><p class="sr" id="tolkira-copy-live" aria-live="polite"></p>${triage}${sources}<div id="feature-list">${features || `<div class="empty">No scenarios in this report.</div>`}</div><div class="empty" id="empty-results" hidden>No scenarios match the current search or filters.</div><p class="foot">Generated by Tolkira. Single file. No network requests. Screenshots are embedded.</p></main></div>`;
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
  const customRows = Object.entries(options.metadata ?? {})
    .filter(([key, value]) => key.length > 0 && value.length > 0)
    .map(
      ([key, value]) =>
        `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`,
    )
    .join('');
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
  ].join('');
  const runRows = `<dt>Duration</dt><dd>${durationLabel(model.durationMs)}</dd><dt>Features</dt><dd>${model.counts.features}</dd><dt>Scenarios</dt><dd>${counts.total}</dd><dt>Steps</dt><dd>${model.counts.steps.total}</dd><dt>Attachments</dt><dd>${model.counts.attachments}</dd><dt>Attachment size</dt><dd>${model.counts.attachmentBytes} bytes</dd><dt>Source</dt><dd>${escapeHtml(model.source)}</dd>`;
  return `<div class="tabPanel" id="analysis-view" role="tabpanel" aria-labelledby="view-analysis" tabindex="0" hidden><main class="shell analysis"><header class="runHead"><div><p class="path">${escapeHtml(model.source)} / details</p><h1>Run details</h1><p class="meta">${dateLabel(model.startedAt) ? `<span>${dateLabel(model.startedAt)}</span>` : ''}<span>${escapeHtml(model.source)}</span></p></div><div class="health"><div class="healthTop"><strong>${counts.total === 0 ? 0 : Math.round((counts.passed / counts.total) * 1000) / 10}%</strong><span>${counts.passed} of ${counts.total} passed</span></div>${statusBar(model)}${countPills(model)}</div></header><div class="analysisGrid"><section class="panel"><h2>Features</h2><p>Where the run spent its scenarios and steps.</p><p class="matrixHint">Scroll for all status columns.</p><div class="tableWrap" tabindex="0" role="region" aria-label="Feature status matrix">${renderFeatureMatrix(model)}</div></section><section class="panel"><h2>Status distribution</h2><p>All scenarios in the run.</p><div class="legend">${displayStatuses(model)
    .map(
      (status) =>
        `<div class="legendRow ${statusClass(status)}"><span class="marker ${statusClass(status)}"></span><span>${statusLabel(status)}</span><b>${counts[status]}</b></div>`,
    )
    .join('')}</div><h2 class="subhead">Run</h2><dl class="metaList">${runRows}</dl>${environmentRows ? `<h2 class="subhead">Cucumber environment</h2><dl class="metaList">${environmentRows}</dl>` : ''}${customRows ? `<h2 class="subhead">Custom metadata</h2><dl class="metaList">${customRows}</dl>` : ''}</section></div>${model.runAttachments.length ? `<section class="panel" style="margin-top:16px"><h2>Run attachments</h2>${model.runAttachments.map((attachment) => renderAttachment(attachment, 'Run attachments')).join('')}</section>` : ''}<section class="panel" style="margin-top:16px"><h2>Agent summary</h2><p>The same run as stable JSON for CI tools and agents.</p><pre class="json" tabindex="0" aria-label="Agent summary JSON">${escapeHtml(JSON.stringify(preview))}</pre></section><p class="foot">Full summary: <code>tolkira ... --json</code></p></main></div>`;
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
    window.scrollTo(0, 0);
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
  var state = { query: '', hidden: new Set(), tag: '' };
  var scenarios = Array.prototype.slice.call(document.querySelectorAll('[data-scenario]'));
  var features = Array.prototype.slice.call(document.querySelectorAll('[data-feature]'));
  var live = document.getElementById('tolkira-live');
  var triage = document.querySelector('[data-triage]');
  var sources = document.querySelector('[data-sources]');
  function apply() {
    var query = state.query.toLowerCase();
    var tag = state.tag;
    var visible = 0;
    scenarios.forEach(function (scenario) {
      var status = scenario.getAttribute('data-status');
      var text = (scenario.getAttribute('data-search') || '').toLowerCase();
      var tags = ' ' + (scenario.getAttribute('data-tags') || '') + ' ';
      var tagMatch = !tag || tags.indexOf(' ' + tag + ' ') !== -1;
      var match = !state.hidden.has(status) && tagMatch && (!query || text.indexOf(query) !== -1);
      scenario.hidden = !match;
      if (match) visible += 1;
    });
    features.forEach(function (feature) {
      var children = feature.querySelectorAll('[data-scenario]');
      var any = Array.prototype.some.call(children, function (child) { return !child.hidden; });
      feature.hidden = !any;
      if (any && (query || state.hidden.size || tag)) feature.open = true;
    });
    if (query) {
      scenarios.forEach(function (scenario) {
        if (!scenario.hidden) scenario.open = true;
      });
    }
    if (live) live.textContent = visible + ' of ' + scenarios.length + ' scenarios visible';
    var empty = document.getElementById('empty-results');
    if (empty) empty.hidden = visible !== 0;
    if (triage) triage.hidden = Boolean(query || tag || state.hidden.size);
    if (sources) sources.hidden = Boolean(query || tag || state.hidden.size);
    highlightSearch();
  }
  function clearHighlights() {
    if (typeof CSS === 'undefined' || !CSS.highlights) return;
    CSS.highlights.delete('tolkira-search');
  }
  function escapeRegex(value) {
    var out = '';
    for (var i = 0; i < value.length; i++) {
      var code = value.charCodeAt(i);
      var ch = value.charAt(i);
      var special = code === 92 || code === 94 || code === 36 || code === 46 || code === 42 || code === 43 || code === 63 || code === 40 || code === 41 || code === 91 || code === 93 || code === 123 || code === 125 || code === 124;
      out += special ? String.fromCharCode(92) + ch : ch;
    }
    return out;
  }
  function highlightSearch() {
    if (typeof CSS === 'undefined' || !CSS.highlights || typeof Highlight === 'undefined') return;
    var needle = state.query.trim();
    if (needle.length < 2) { clearHighlights(); return; }
    try {
      var pattern = new RegExp(escapeRegex(needle), 'gi');
      var ranges = [];
      scenarios.forEach(function (scenario) {
        if (scenario.hidden || !scenario.open || ranges.length >= 200) return;
        var walker = document.createTreeWalker(scenario, NodeFilter.SHOW_TEXT, null);
        var node;
        while (ranges.length < 200 && (node = walker.nextNode())) {
          var value = node.nodeValue;
          if (!value) continue;
          var parent = node.parentElement;
          if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) continue;
          pattern.lastIndex = 0;
          var match;
          while (ranges.length < 200 && (match = pattern.exec(value)) !== null) {
            var range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            ranges.push(range);
            if (match[0].length === 0) pattern.lastIndex += 1;
          }
        }
      });
      clearHighlights();
      if (ranges.length) CSS.highlights.set('tolkira-search', new Highlight(...ranges));
    } catch (error) {
      clearHighlights();
    }
  }
  var search = document.querySelector('[data-search]');
  if (search) search.addEventListener('input', function () {
    state.query = search.value;
    apply();
  });
  var tagFilter = document.querySelector('[data-tag-filter]');
  if (tagFilter) tagFilter.addEventListener('change', function () {
    state.tag = tagFilter.value;
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
  var copyLive = document.getElementById('tolkira-copy-live');
  function legacyCopy(text) {
    var active = document.activeElement;
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '-1000px';
    document.body.appendChild(field);
    var ok = false;
    try {
      field.select();
      ok = document.execCommand('copy');
    } catch (error) {
      ok = false;
    } finally {
      field.remove();
      if (active && typeof active.focus === 'function') active.focus();
    }
    return ok;
  }
  function writeClipboard(text, done) {
    var settled = false;
    function finish(ok) {
      if (settled) return;
      settled = true;
      done(ok);
    }
    function fallback() {
      finish(legacyCopy(text));
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        navigator.clipboard.writeText(text).then(function () { finish(true); }, fallback);
      } catch (error) {
        fallback();
      }
    } else {
      fallback();
    }
  }
  function failureText(button) {
    var scenario = button.closest('[data-scenario]');
    if (!scenario) return '';
    var feature = scenario.closest('[data-feature]');
    var featureTitle = feature ? feature.querySelector('h2') : null;
    var scenarioTitle = scenario.querySelector('.scenarioName');
    var step = scenario.querySelector('.step[data-status="failed"]');
    var keyword = step && step.querySelector('.kw') ? step.querySelector('.kw').textContent.trim() : '';
    var body = step ? step.querySelector('div') : null;
    var text = '';
    if (body) {
      Array.prototype.forEach.call(body.childNodes, function (node) {
        if (node.nodeType === 3) text += node.nodeValue;
      });
    }
    var error = step ? step.querySelector('.error') : null;
    var stepLabel = keyword === 'Hook' ? text.trim() : (keyword + ' ' + text.trim()).trim();
    var lines = [
      'Feature: ' + (featureTitle ? featureTitle.textContent : ''),
      'Scenario: ' + (scenarioTitle ? scenarioTitle.textContent : ''),
      'URI: ' + (scenario.getAttribute('data-uri') || ''),
      'Step: ' + stepLabel
    ];
    if (error && error.textContent.trim()) {
      lines.push('Error:\\n' + error.textContent.trim());
    }
    return lines.join('\\n');
  }
  Array.prototype.slice.call(document.querySelectorAll('[data-copy-failure]')).forEach(function (button) {
    var labelTimer = null;
    button.addEventListener('click', function () {
      button.focus();
      writeClipboard(failureText(button), function (ok) {
        if (labelTimer) clearTimeout(labelTimer);
        button.textContent = ok ? 'Copied' : 'Copy failed';
        if (copyLive) {
          copyLive.textContent = ok
            ? 'Failure details copied to clipboard.'
            : 'Could not copy failure details.';
        }
        labelTimer = setTimeout(function () {
          button.textContent = 'Copy failure';
          if (copyLive) copyLive.textContent = '';
        }, 2000);
      });
    });
  });
  var lightbox = document.getElementById('tolkira-lightbox');
  if (lightbox) {
    var lightboxImage = lightbox.querySelector('img');
    var closeLightbox = lightbox.querySelector('[data-lightbox-close]');
    var lightboxTrigger = null;
    var previousOverflow = '';
    function closeDialog() {
      if (typeof lightbox.close === 'function') lightbox.close();
      else { lightbox.removeAttribute('open'); restoreLightbox(); }
    }
    function restoreLightbox() {
      document.documentElement.style.overflow = previousOverflow;
      if (lightboxTrigger) { lightboxTrigger.focus(); lightboxTrigger = null; }
    }
    Array.prototype.slice.call(document.querySelectorAll('.shotButton')).forEach(function (button) {
      button.addEventListener('click', function () {
        var image = button.querySelector('img');
        if (!image || !lightboxImage) return;
        lightboxImage.src = image.src;
        lightboxImage.alt = image.alt;
        lightboxTrigger = button;
        previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        if (typeof lightbox.showModal === 'function') lightbox.showModal();
        else lightbox.setAttribute('open', '');
      });
    });
    if (closeLightbox) closeLightbox.addEventListener('click', closeDialog);
    lightbox.addEventListener('click', function (event) { if (event.target === lightbox) closeDialog(); });
    lightbox.addEventListener('close', restoreLightbox);
  }
  function revealHash() {
    if (!location.hash) return;
    var id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (error) { return; }
    var target = document.getElementById(id);
    if (!target) return;
    var node = target;
    while (node) {
      if (node.tagName === 'DETAILS') node.open = true;
      node = node.parentElement;
    }
    var focusTarget = target.tagName === 'DETAILS' ? target.querySelector('summary') : target;
    if (focusTarget) {
      if (!focusTarget.hasAttribute('tabindex')) focusTarget.setAttribute('tabindex', '-1');
      try { focusTarget.focus({ preventScroll: true }); } catch (error) { focusTarget.focus(); }
    }
    target.scrollIntoView();
  }
  var compact = window.matchMedia('(max-width: 560px)');
  function syncCompact() {
    if (triage) triage.open = !compact.matches;
  }
  if (compact.addEventListener) compact.addEventListener('change', syncCompact);
  syncCompact();
  window.addEventListener('hashchange', revealHash);
  showView('report');
  revealHash();
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
  const model = buildReportModel(safeEnvelopes, options.provenance);
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
