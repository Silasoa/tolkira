import { createHash } from 'node:crypto';
import type { Envelope } from '@cucumber/messages';
import { sanitizeEnvelopes } from '../input/sanitize.js';
import {
  MAX_TEXT_ATTACHMENT_BYTES,
  normalizedMediaType,
} from '../report/attachment.js';
import {
  buildReportModel,
  type ReportAttachment,
  type ReportBackground,
  type ReportFeature,
  type ReportHook,
  type ReportModel,
  type ReportOutline,
  type ReportRule,
  type ReportRunHook,
  type ReportScenario,
  type ReportStep,
} from '../report/model.js';
import {
  type ReportStatus,
  statusSeverity,
  worstExecutedStatus,
} from '../report/status.js';
import type { ReportSummary } from '../summary.js';
import { summarizeEnvelopes, displayUri } from '../summary.js';
import { stripBidiControls } from '../text.js';
import { isLogoDataUri, isValidAccent } from '../validation.js';
import { renderAnsiLog } from './ansi.js';
import { escapeHtml } from './escape.js';
import { CLIENT_SCRIPT } from './client-bundle.js';
import { renderDescription } from './markdown.js';
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
const SEARCH_MESSAGE_LIMIT = 2000;
const UNDEFINED_LEAD = 'No step definition found.';
const AMBIGUOUS_LEAD = 'Multiple matching step definitions found:';

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

function executedOnly(scenarios: ReportScenario[]): ReportScenario[] {
  return scenarios.filter((scenario) => scenario.executed);
}

function barWidth(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
}

function attentionCounts(scenarios: ReportScenario[]): string {
  const counts = new Map<ReportStatus, number>();
  for (const scenario of scenarios) {
    if (!scenario.executed || scenario.status === 'passed') continue;
    counts.set(scenario.status, (counts.get(scenario.status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => statusSeverity(b[0]) - statusSeverity(a[0]))
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');
}

function featureBar(scenarios: ReportScenario[]): string {
  const executed = executedOnly(scenarios);
  const total = executed.length;
  if (total === 0) return '';
  const counts = countStatuses(executed);
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
  const executed = executedOnly(scenarios);
  const passed = executed.filter(
    (scenario) => scenario.status === 'passed',
  ).length;
  const attention = attentionCounts(executed);
  const counts = `${passed} of ${executed.length} passed${attention ? ` · ${attention}` : ''}`;
  const source = feature.sourceFile
    ? `<span class="featureSource">from ${escapeHtml(feature.sourceFile)}</span>`
    : '';
  return `<span class="featureShape"><span class="featureCounts">${counts}</span>${featureBar(scenarios)}${source}<span class="featureUri">${escapeHtml(displayUri(feature.uri))}</span>${tagsMarkup(feature.tags, 'featureTags')}</span>`;
}

interface TriageEntry extends OrderedFeature {
  index: number;
}

function renderTriageRow({
  feature,
  scenarios,
  index,
}: TriageEntry): string {
  const failing = executedOnly(scenarios).filter(
    (scenario) => scenario.status !== 'passed',
  );
  const links = failing
    .slice(0, TRIAGE_SCENARIO_LIMIT)
    .map((scenario) => {
      const scenarioIndex = scenarios.indexOf(scenario) + 1;
      return `<li><a class="triageScenario" href="#scenario-${index + 1}-${scenarioIndex}"><span class="triageStatus ${statusClass(scenario.status)}">${statusLabel(scenario.status)}</span><span>${escapeHtml(scenarioLabel(scenario))}</span></a></li>`;
    })
    .join('');
  const more =
    failing.length > TRIAGE_SCENARIO_LIMIT
      ? `<li class="triageMore">+${failing.length - TRIAGE_SCENARIO_LIMIT} more in the report</li>`
      : '';
  const failed = failing.find((scenario) => scenario.status === 'failed');
  const failedStep = failed?.steps.find(
    (step) => step.status === 'failed' && step.message,
  );
  const failedHook = failed?.hooks.find(
    (hook) => hook.status === 'failed' && hook.message,
  );
  const reasonSource = failedStep?.message
    ? `${failedStep.keyword ? `${failedStep.keyword} ` : ''}${failedStep.text}`
    : failedHook?.message
      ? hookLabel(failedHook)
      : '';
  const reasonMessage = failedStep?.message ?? failedHook?.message ?? '';
  const reason = reasonSource
    ? `${reasonSource} — ${reasonMessage.split(/\r?\n/)[0].trim().slice(0, 120)}${reasonMessage.split(/\r?\n/)[0].trim().length > 120 ? '…' : ''}`
    : '';
  return `<li class="triageItem"><a class="triageFeature" href="#feature-${index + 1}" title="${escapeHtml(displayUri(feature.uri))}"><span class="triageStatus ${statusClass(feature.status)}">${statusLabel(feature.status)}</span><span>${escapeHtml(feature.name)}</span></a><p class="triageCounts">${attentionCounts(scenarios)}</p><ul class="triageScenarios">${links}${more}</ul>${reason ? `<p class="triageReason"><span class="triageReasonLabel">First failure:</span> ${escapeHtml(reason)}</p>` : ''}</li>`;
}

function renderTriage(features: OrderedFeature[]): string {
  const attention = features
    .map((entry, index) => ({ ...entry, index }))
    .filter(({ scenarios }) =>
      scenarios.some(
        (scenario) => scenario.executed && scenario.status !== 'passed',
      ),
    );
  if (attention.length === 0) return '';

  const shown = attention.slice(0, 5);
  const rest = attention.slice(5, TRIAGE_FEATURE_LIMIT);
  const total = features.reduce(
    (sum, entry) => sum + executedOnly(entry.scenarios).length,
    0,
  );
  const need = attention.reduce(
    (sum, entry) =>
      sum +
      entry.scenarios.filter(
        (scenario) => scenario.executed && scenario.status !== 'passed',
      ).length,
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
  const lead = `${need} of ${total} scenario${total === 1 ? '' : 's'} ${total === 1 ? 'needs' : 'need'} attention.`;
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

  const entries = [...groups.entries()].map(([file, group]) => {
    const scenarios = executedOnly(
      group.features.flatMap((feature) => feature.scenarios),
    );
    return {
      file,
      features: group.features.length,
      scenarios,
      status: worstExecutedStatus(scenarios),
      order: group.order,
    };
  });
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

function safeHttpUrl(value: string | undefined): string | undefined {
  const trimmed = stripBidiControls(value ?? '').trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function githubRepoPath(url: URL): string | undefined {
  if (url.hostname.toLowerCase() !== 'github.com') return undefined;
  const path = url.pathname.replace(/\/+$/, '').replace(/\.git$/i, '');
  return /^\/[^/]+\/[^/]+$/.test(path) ? path : undefined;
}

// Accepts https, ssh:// and scp-like GitHub remotes; everything else is plain.
function githubBaseUrl(remote: string | undefined): string | undefined {
  const value = stripBidiControls(remote ?? '').trim();
  if (!value) return undefined;
  const direct = safeHttpUrl(value);
  if (direct) {
    const url = new URL(direct);
    const path = githubRepoPath(url);
    return path ? `${url.origin}${path}` : undefined;
  }
  const scp = /^(?:[^@\s/:]+@)?github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(
    value,
  );
  if (scp) return `https://github.com/${scp[1]}/${scp[2]}`;
  if (!/^(?:ssh|git\+ssh):\/\//i.test(value)) return undefined;
  try {
    const path = githubRepoPath(new URL(value));
    return path ? `https://github.com${path}` : undefined;
  } catch {
    return undefined;
  }
}

function shortRevision(revision: string): string {
  return stripBidiControls(revision).slice(0, 7);
}

function githubCommitUrl(
  ci: NonNullable<ReportModel['environment']>['ci'],
): string | undefined {
  if (!ci?.remote || !ci.revision) return undefined;
  const base = githubBaseUrl(ci.remote);
  if (!base) return undefined;
  return `${base}/commit/${encodeURIComponent(stripBidiControls(ci.revision))}`;
}

function revisionMarkup(
  ci: NonNullable<ReportModel['environment']>['ci'],
): string {
  if (!ci?.revision) return '';
  const short = escapeHtml(shortRevision(ci.revision));
  const commit = githubCommitUrl(ci);
  if (!commit) return short;
  return `<a href="${escapeHtml(commit)}" title="${escapeHtml(ci.revision)}" rel="noopener noreferrer">${short}</a>`;
}

function ciNameMarkup(
  ci: NonNullable<ReportModel['environment']>['ci'],
): string {
  const href = safeHttpUrl(ci?.url);
  const label = ci?.name || href;
  if (!label) return '';
  return href
    ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
    : escapeHtml(label);
}

function ciHeaderMarkup(
  ci: NonNullable<ReportModel['environment']>['ci'],
): string {
  if (!ci) return '';
  const name = ciNameMarkup(ci);
  const rows = [
    name ? `<span class="ci"><b>CI</b> ${name}</span>` : '',
    ci.revision
      ? `<span><b>Revision</b> ${revisionMarkup(ci)}</span>`
      : '',
    ci.branch
      ? `<span><b>Branch</b> <span>${escapeHtml(ci.branch)}</span></span>`
      : '',
    ci.tag ? `<span><b>Tag</b> <span>${escapeHtml(ci.tag)}</span></span>` : '',
  ].filter(Boolean);
  return rows.join('');
}

function ciDetailRows(
  ci: NonNullable<ReportModel['environment']>['ci'],
): string {
  if (!ci) return '';
  const name = ciNameMarkup(ci);
  return [
    name ? `<dt>CI</dt><dd>${name}</dd>` : '',
    ci.revision
      ? `<dt>Revision</dt><dd>${revisionMarkup(ci)}</dd>`
      : '',
    ci.branch ? `<dt>Branch</dt><dd>${escapeHtml(ci.branch)}</dd>` : '',
    ci.tag ? `<dt>Tag</dt><dd>${escapeHtml(ci.tag)}</dd>` : '',
  ].join('');
}

interface JsonFrame {
  opener: '{' | '[';
  hasItems: boolean;
}

// Formats valid JSON without re-serialising parsed values, so big numbers and
// duplicate keys survive unchanged.
function prettyJson(text: string): string | undefined {
  try {
    JSON.parse(text);
  } catch {
    return undefined;
  }
  const out: string[] = [];
  const stack: JsonFrame[] = [];
  let inString = false;
  let escaped = false;
  const openItem = (): void => {
    const top = stack[stack.length - 1];
    if (top && !top.hasItems) {
      out.push('\n', '  '.repeat(stack.length));
      top.hasItems = true;
    }
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] as string;
    if (inString) {
      out.push(character);
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      openItem();
      out.push(character);
      inString = true;
      continue;
    }
    if (character === '{' || character === '[') {
      openItem();
      out.push(character);
      stack.push({ opener: character, hasItems: false });
      continue;
    }
    if (character === '}' || character === ']') {
      const frame = stack.pop();
      if (!frame) return undefined;
      if (
        (frame.opener === '{' && character !== '}') ||
        (frame.opener === '[' && character !== ']')
      ) {
        return undefined;
      }
      if (frame.hasItems) out.push('\n', '  '.repeat(stack.length));
      out.push(character);
      continue;
    }
    if (character === ',') {
      out.push(',', '\n', '  '.repeat(stack.length));
      continue;
    }
    if (character === ':') {
      out.push(': ');
      continue;
    }
    if (
      character === ' ' ||
      character === '\n' ||
      character === '\r' ||
      character === '\t'
    ) {
      continue;
    }
    let end = index;
    while (end < text.length && !/[\s,\]}:]/.test(text[end] as string)) {
      end += 1;
    }
    openItem();
    out.push(text.slice(index, end));
    index = end - 1;
  }
  return stack.length === 0 && !inString ? out.join('') : undefined;
}

function jsonBody(text: string): string {
  return prettyJson(text) ?? text;
}

function uriListBody(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const label = line.trim();
      const href = safeHttpUrl(label);
      return href
        ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
        : escapeHtml(line);
    })
    .join('\n');
}

function textAttachmentBody(attachment: ReportAttachment): string {
  const text = attachment.text ?? '';
  const mediaType = normalizedMediaType(attachment.mediaType);
  if (mediaType.startsWith('application/json')) {
    const body =
      Buffer.byteLength(text, 'utf8') > MAX_TEXT_ATTACHMENT_BYTES
        ? text
        : jsonBody(text);
    return `<pre>${escapeHtml(body)}</pre>`;
  }
  if (mediaType === 'text/uri-list') {
    return `<pre>${uriListBody(text)}</pre>`;
  }
  if (mediaType === 'text/x.cucumber.log+plain') {
    return `<div class="logTools"><button class="copyLog" type="button" data-copy-log aria-label="Copy log ${escapeHtml(attachment.fileName)}" hidden>Copy log</button></div><pre class="ansiLog">${renderAnsiLog(text)}</pre>`;
  }
  return `<pre>${escapeHtml(text)}</pre>`;
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
    return `<details class="attachmentText"><summary>${name} (${media})</summary>${textAttachmentBody(attachment)}</details>`;
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

function renderDiagnostic(step: ReportStep): string {
  if (step.status === 'undefined') {
    const suggestions = step.suggestions ?? [];
    const lead = suggestions.length
      ? `${UNDEFINED_LEAD} Implement with the snippet(s) below:`
      : UNDEFINED_LEAD;
    const snippets = suggestions
      .map((suggestion) => {
        const language = suggestion.language
          ? `<span class="snippetLang">${escapeHtml(suggestion.language)}</span>`
          : '';
        return `<div class="snippet">${language}<pre><code>${escapeHtml(suggestion.code)}</code></pre></div>`;
      })
      .join('');
    return `<div class="diagnostic" data-diagnostic="undefined"><p class="diagnosticLead">${lead}</p>${snippets}</div>`;
  }
  if (step.status === 'ambiguous') {
    const definitions = step.definitions ?? [];
    const items = definitions
      .map(
        (definition) =>
          `<li><code class="definitionPattern">${escapeHtml(definition.pattern)}</code>${definition.source ? `<span class="definitionSource">${escapeHtml(displayUri(definition.source))}</span>` : ''}</li>`,
      )
      .join('');
    const list = items ? `<ul class="definitions">${items}</ul>` : '';
    return `<div class="diagnostic" data-diagnostic="ambiguous"><p class="diagnosticLead">${AMBIGUOUS_LEAD}</p>${list}</div>`;
  }
  return '';
}

function renderStep(step: ReportStep, scenarioName: string): string {
  const diagnostic = renderDiagnostic(step);
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
  return `<li class="step"${step.status === 'failed' ? ' data-status="failed"' : ''}><span class="stepMarker ${statusClass(step.status)}"><span aria-hidden="true">${STEP_GLYPHS[step.status]}</span><span class="sr">${statusLabel(step.status)}</span></span><div><span class="kw">${escapeHtml(step.keyword)}</span> ${escapeHtml(step.text)}${diagnostic}${error}${docString}${table}${attachments}</div><span class="dur">${durationLabel(step.durationMs)}</span></li>`;
}

function hookLabel(
  hook: ReportHook | ReportRunHook,
  bareName = false,
): string {
  if (hook.name) return bareName ? hook.name : `${hook.type}: ${hook.name}`;
  return hook.type;
}

function renderHook(
  hook: ReportHook | ReportRunHook,
  scenarioName: string,
  bareName = false,
): string {
  const error = hook.message
    ? `<pre class="error">${escapeHtml(hook.message)}</pre>`
    : '';
  const label = hookLabel(hook, bareName);
  const attachments = hook.attachments
    .map((attachment) => renderAttachment(attachment, `${scenarioName}: ${label}`))
    .join('');
  return `<li class="hook" data-status="${hook.status}"><span class="stepMarker ${statusClass(hook.status)}"><span aria-hidden="true">${STEP_GLYPHS[hook.status]}</span><span class="sr">${statusLabel(hook.status)}</span></span><div><span class="hookLabel">${escapeHtml(label)}</span>${error}${attachments}</div><span class="dur">${durationLabel(hook.durationMs)}</span></li>`;
}

function renderRunHooks(model: ReportModel): string {
  if (model.runHooks.length === 0) return '';
  return `<section class="runHooks" data-run-hooks aria-labelledby="run-hooks-heading"><h2 id="run-hooks-heading">Hooks</h2><ul class="hooks">${model.runHooks.map((hook) => renderHook(hook, 'Run', true)).join('')}</ul></section>`;
}

function scenarioLabel(scenario: ReportScenario): string {
  const outline = scenario.outline;
  if (!outline) return scenario.name;
  const number = `#${outline.examplesIndex + 1}.${outline.exampleIndex + 1}`;
  const examples = outline.examplesName ? `${outline.examplesName} ` : '';
  return `${examples}${number} · ${scenario.name}`.trim();
}

function tagsMarkup(tags: string[], extraClass = ''): string {
  const className = extraClass ? `tags ${extraClass}` : 'tags';
  return tags.length
    ? `<span class="${className}">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</span>`
    : '';
}

function backgroundText(background: ReportBackground): string {
  return [background.name, background.description].join(' ');
}

function backgroundMarkup(backgrounds: ReportBackground[]): string {
  return backgrounds
    .filter((background) => background.name || background.description)
    .map((background) => {
      const name = background.name
        ? ` ${escapeHtml(background.name)}`
        : '';
      const description = renderDescription(background.description);
      return `<section class="background" data-background><h3 class="backgroundTitle"><span class="kw">${escapeHtml(background.keyword)}:</span>${name}</h3>${description}</section>`;
    })
    .join('');
}

function ruleSearchText(rule: ReportRule): string {
  return [
    rule.name,
    rule.description,
    ...rule.tags,
    ...rule.backgrounds.map(backgroundText),
  ].join(' ');
}

function scenarioText(scenario: ReportScenario): string {
  const outline = scenario.outline;
  const example = outline
    ? `#${outline.examplesIndex + 1}.${outline.exampleIndex + 1}`
    : '';
  // Grouped rows share outline metadata; index only the per-row names and the
  // inherited tags so a large outline does not repeat its descriptions per row.
  return [
    scenario.name,
    scenario.featureName,
    displayUri(scenario.uri),
    outline ? outline.keyword : scenario.keyword,
    ...(outline
      ? [outline.name, outline.examplesKeyword, outline.examplesName, example]
      : [scenario.description]),
    scenario.tags.join(' '),
    scenario.hooks
      .map(
        (hook) =>
          `${hook.type} ${hook.name ?? ''} ${(hook.message ?? '').slice(0, SEARCH_MESSAGE_LIMIT)}`,
      )
      .join(' '),
    scenario.steps
      .map((step) => {
        const diagnostic =
          step.status === 'undefined' || step.status === 'ambiguous'
            ? [
                step.status === 'undefined' ? UNDEFINED_LEAD : AMBIGUOUS_LEAD,
                ...(step.suggestions ?? []).flatMap((suggestion) => [
                  suggestion.language ?? '',
                  suggestion.code.slice(0, SEARCH_MESSAGE_LIMIT),
                ]),
                ...(step.definitions ?? []).flatMap((definition) => [
                  definition.pattern.slice(0, SEARCH_MESSAGE_LIMIT),
                  displayUri(definition.source ?? '').slice(
                    0,
                    SEARCH_MESSAGE_LIMIT,
                  ),
                ]),
              ].join(' ')
            : '';
        return `${step.keyword} ${step.text} ${(step.message ?? '').slice(0, SEARCH_MESSAGE_LIMIT)} ${diagnostic}`;
      })
      .join(' '),
  ].join(' ');
}

function renderScenario(
  scenario: ReportScenario,
  featureIndex: number,
  scenarioIndex: number,
  grouped = false,
  inRule = false,
): string {
  const outline = scenario.outline;
  const example =
    grouped && outline
      ? `#${outline.examplesIndex + 1}.${outline.exampleIndex + 1}`
      : '';
  const heading = grouped ? 'h5' : inRule ? 'h4' : 'h3';
  const image = scenario.attachments.find(
    (attachment) => attachment.kind === 'image' && attachment.dataUri,
  );
  const open =
    scenario.executed &&
    (scenario.status !== 'passed' || (!grouped && Boolean(image)));
  const passedHooks = scenario.hooks.filter(
    (hook) => hook.status === 'passed',
  );
  const inlineItems = [
    ...scenario.steps.map((step) => ({
      order: step.order,
      html: renderStep(step, scenario.name),
    })),
    ...scenario.hooks
      .filter((hook) => hook.status !== 'passed')
      .map((hook) => ({ order: hook.order, html: renderHook(hook, scenario.name) })),
  ]
    .sort((a, b) => a.order - b.order)
    .map((item) => item.html)
    .join('');
  const passedHooksGroup = passedHooks.length
    ? `<details class="hookGroup"><summary>${passedHooks.length} hook${passedHooks.length === 1 ? '' : 's'}</summary><ul class="hooks" aria-label="Passed hooks">${passedHooks.map((hook) => renderHook(hook, scenario.name)).join('')}</ul></details>`
    : '';
  const description = grouped ? '' : renderDescription(scenario.description);
  const screenReaderLabel =
    grouped && outline
      ? `<span class="sr">${escapeHtml(`${scenario.name}, Scenario Outline ${outline.name}${outline.examplesName ? `, Examples ${outline.examplesName}` : ''}, example ${example}`)}</span>`
      : '';
  const visibleName = grouped
    ? `<span class="exampleNo" aria-hidden="true">${escapeHtml(example)}</span>${screenReaderLabel}`
    : escapeHtml(scenario.name);
  // Grouped rows keep their tags on the outline/examples sections; standalone
  // rows show only their own tags and never repeat inherited feature/rule tags.
  const rowTags = grouped ? '' : tagsMarkup(scenario.ownTags);
  const extraAttachments = scenario.extraAttachments.length
    ? `<div role="group" aria-label="Attachments"><p class="detailLabel">Attachments</p>${scenario.extraAttachments.map((attachment) => renderAttachment(attachment, scenario.name)).join('')}</div>`
    : '';
  const copyFailure =
    scenario.status === 'failed'
      ? '<button class="copyFailure" type="button" data-copy-failure>Copy failure</button>'
      : '';
  const exampleData = grouped
    ? ` data-example="${escapeHtml(example)}" data-examples-name="${escapeHtml(outline?.examplesName ?? '')}"`
    : '';
  const scenarioMeta =
    grouped && outline
      ? `<span>Scenario: ${escapeHtml(scenario.name)}</span>`
      : '';
  const statusCell = scenario.executed
    ? `<span class="statusCell"><span class="statusText ${statusClass(scenario.status)}">${statusLabel(scenario.status)}</span></span>`
    : '<span class="statusCell"><span class="sr">Not executed</span></span>';
  const statusData = scenario.executed
    ? ` data-status="${scenario.status}"`
    : '';
  return `<details class="scenario" id="scenario-${featureIndex + 1}-${scenarioIndex + 1}" data-scenario${statusData} data-uri="${escapeHtml(displayUri(scenario.uri))}" data-scenario-name="${escapeHtml(scenario.name)}"${exampleData} data-tags="${escapeHtml(scenario.tags.join(' '))}" data-search="${escapeHtml(scenarioText(scenario))}" ${open ? 'open' : ''}><summary class="scenarioButton">${statusCell}<span class="thumbCell">${image ? `<img class="thumb" src="${escapeHtml(image.dataUri ?? '')}" alt="" loading="lazy">` : ''}</span><span class="scenarioMain"><${heading} class="scenarioName">${visibleName}</${heading}><span class="scenarioSub">${scenario.steps.length} step${scenario.steps.length === 1 ? '' : 's'}${scenario.hooks.length ? ` · ${scenario.hooks.length} hook${scenario.hooks.length === 1 ? '' : 's'}` : ''}${rowTags ? ` ${rowTags}` : ''}</span></span><span class="rowRight">${durationLabel(scenario.durationMs)}${scenario.attachments.length ? `<br>${scenario.attachments.length} attachment${scenario.attachments.length === 1 ? '' : 's'}` : ''}</span><span class="chev" aria-hidden="true"></span></summary><div class="detailInline">${description}<div class="stepsHead"><p class="detailLabel">Steps</p>${copyFailure}</div><ol class="steps" aria-label="Steps and hooks">${inlineItems}</ol>${passedHooksGroup}${extraAttachments}<div class="detailMeta">${scenarioMeta}<span>Feature: ${escapeHtml(scenario.featureName)}</span><span>Attempt: ${scenario.attempt + 1}</span>${scenario.startedAt ? `<span>Started: ${dateLabel(scenario.startedAt)}</span>` : ''}${scenario.ruleName ? `<span>Rule: ${escapeHtml(scenario.ruleName)}</span>` : ''}</div></div></details>`;
}

function renderExamples(
  outline: ReportOutline,
  rows: ReportScenario[],
  featureIndex: number,
  idIndex: Map<string, number>,
): string {
  const description = renderDescription(outline.examplesDescription);
  const title = outline.examplesName
    ? `<span class="kw">${escapeHtml(outline.examplesKeyword)}:</span> ${escapeHtml(outline.examplesName)}`
    : `<span class="kw">${escapeHtml(outline.examplesKeyword)}:</span>`;
  return `<section class="examples" data-examples data-search="${escapeHtml(outline.examplesDescription)}">${tagsMarkup(outline.examplesTags)}<h4 class="examplesTitle">${title}</h4>${description}<div class="exampleRows">${rows
    .map((scenario) =>
      renderScenario(
        scenario,
        featureIndex,
        idIndex.get(scenario.id) ?? 0,
        true,
      ),
    )
    .join('')}</div></section>`;
}

function renderOutline(
  outline: ReportOutline,
  rows: ReportScenario[],
  featureIndex: number,
  idIndex: Map<string, number>,
): string {
  const blocks = new Map<string, { outline: ReportOutline; rows: ReportScenario[] }>();
  for (const row of rows) {
    if (!row.outline) continue;
    const block = blocks.get(row.outline.examplesId) ?? {
      outline: row.outline,
      rows: [],
    };
    block.rows.push(row);
    blocks.set(row.outline.examplesId, block);
  }
  const exampleBlocks = [...blocks.values()]
    .sort((a, b) => a.outline.examplesIndex - b.outline.examplesIndex)
    .map((block) =>
      renderExamples(block.outline, block.rows, featureIndex, idIndex),
    )
    .join('');
  const description = renderDescription(outline.description);
  return `<section class="outline" data-outline data-search="${escapeHtml(outline.description)}">${tagsMarkup(outline.tags)}<h3 class="outlineTitle"><span class="kw">${escapeHtml(outline.keyword)}:</span> ${escapeHtml(outline.name)}</h3>${description}${exampleBlocks}</section>`;
}

interface RenderItem {
  kind: 'scenario' | 'outline';
  status: ReportStatus;
  order: number;
  ruleId?: string;
  scenario?: ReportScenario;
  outline?: ReportOutline;
  rows?: ReportScenario[];
}

interface RuleBlock {
  kind: 'rule';
  status: ReportStatus;
  order: number;
  rule: ReportRule;
  items: RenderItem[];
}

function renderFeatureItem(
  item: RenderItem,
  featureIndex: number,
  idIndex: Map<string, number>,
  inRule: boolean,
): string {
  if (item.kind === 'outline' && item.outline && item.rows) {
    return renderOutline(item.outline, item.rows, featureIndex, idIndex);
  }
  if (item.scenario) {
    return renderScenario(
      item.scenario,
      featureIndex,
      idIndex.get(item.scenario.id) ?? 0,
      false,
      inRule,
    );
  }
  return '';
}

function renderRuleBlock(
  block: RuleBlock,
  featureIndex: number,
  idIndex: Map<string, number>,
): string {
  const rule = block.rule;
  const name = rule.name ? ` ${escapeHtml(rule.name)}` : '';
  const description = renderDescription(rule.description);
  return `<section class="rule" data-rule data-search="${escapeHtml(ruleSearchText(rule))}"><h3 class="ruleTitle"><span class="kw">${escapeHtml(rule.keyword)}:</span>${name}</h3>${tagsMarkup(rule.tags, 'ruleTags')}${description}${backgroundMarkup(rule.backgrounds)}<div class="ruleRows">${block.items
    .map((item) => renderFeatureItem(item, featureIndex, idIndex, true))
    .join('')}</div></section>`;
}

function renderFeature(
  { feature, scenarios }: OrderedFeature,
  featureIndex: number,
): string {
  const executed = executedOnly(scenarios);
  const open =
    executed.length === 0 ||
    executed.some(
      (scenario) =>
        scenario.status !== 'passed' ||
        scenario.attachments.some((attachment) => attachment.kind === 'image'),
    );
  const description = renderDescription(feature.description);
  // Triage and row anchors share this severity order; grouping only changes
  // the display order, never the ids.
  const idIndex = new Map(scenarios.map((scenario, index) => [scenario.id, index]));
  const inputIndex = new Map(
    feature.scenarios.map((scenario, index) => [scenario.id, index]),
  );
  const groups = new Map<
    string,
    {
      outline: ReportOutline;
      rows: ReportScenario[];
      order: number;
      ruleId?: string;
    }
  >();
  const items: RenderItem[] = [];
  for (const scenario of feature.scenarios) {
    if (scenario.outline) {
      const group = groups.get(scenario.outline.id) ?? {
        outline: scenario.outline,
        rows: [],
        order: inputIndex.get(scenario.id) ?? 0,
        ...(scenario.rule ? { ruleId: scenario.rule.id } : {}),
      };
      group.rows.push(scenario);
      groups.set(scenario.outline.id, group);
    } else {
      items.push({
        kind: 'scenario',
        status: scenario.status,
        order: inputIndex.get(scenario.id) ?? 0,
        ...(scenario.rule ? { ruleId: scenario.rule.id } : {}),
        scenario,
      });
    }
  }
  for (const group of groups.values()) {
    group.rows.sort((a, b) => {
      const outlineA = a.outline;
      const outlineB = b.outline;
      if (!outlineA || !outlineB) return 0;
      return (
        outlineA.examplesIndex - outlineB.examplesIndex ||
        outlineA.exampleIndex - outlineB.exampleIndex
      );
    });
    items.push({
      kind: 'outline',
      status: worstExecutedStatus(group.rows),
      order: group.order,
      ...(group.ruleId ? { ruleId: group.ruleId } : {}),
      outline: group.outline,
      rows: group.rows,
    });
  }
  items.sort((a, b) => {
    const status = compareStatus(a.status, b.status);
    return status !== 0 ? status : a.order - b.order;
  });

  const featureItems: RenderItem[] = [];
  const ruleBlocks = new Map<
    string,
    { rule: ReportRule; items: RenderItem[]; order: number }
  >();
  for (const item of items) {
    const rule = item.scenario?.rule ?? item.rows?.[0]?.rule;
    if (!item.ruleId || !rule) {
      featureItems.push(item);
      continue;
    }
    const block = ruleBlocks.get(item.ruleId) ?? {
      rule,
      items: [],
      order: item.order,
    };
    block.items.push(item);
    block.order = Math.min(block.order, item.order);
    ruleBlocks.set(item.ruleId, block);
  }
  const topItems: Array<RenderItem | RuleBlock> = [
    ...featureItems,
    ...[...ruleBlocks.values()].map(
      (block): RuleBlock => ({
        kind: 'rule',
        status: worstExecutedStatus(
          block.items.flatMap((item) =>
            item.scenario ? [item.scenario] : (item.rows ?? []),
          ),
        ),
        order: block.order,
        rule: block.rule,
        items: block.items,
      }),
    ),
  ];
  topItems.sort((a, b) => {
    const status = compareStatus(a.status, b.status);
    return status !== 0 ? status : a.order - b.order;
  });
  const backgroundSearch = escapeHtml(
    feature.backgrounds.map(backgroundText).join(' '),
  );
  return `<details class="feature ${feature.status === 'failed' ? 'has-fail' : 'has-pass'}" id="feature-${featureIndex + 1}" data-feature data-background-search="${backgroundSearch}" ${open ? 'open' : ''}><summary><span class="statusCell"><span class="statusText ${statusClass(feature.status)}">${statusLabel(feature.status)}</span></span><h2>${escapeHtml(feature.name)}</h2><span class="chev" aria-hidden="true"></span>${featureShape(feature, scenarios)}</summary>${description}${backgroundMarkup(feature.backgrounds)}<div class="rows">${topItems
    .map((item) =>
      item.kind === 'rule'
        ? renderRuleBlock(item, featureIndex, idIndex)
        : renderFeatureItem(item, featureIndex, idIndex, false),
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
      const executed = executedOnly(feature.scenarios);
      const counts = countStatuses(executed);
      const cells = statuses
        .map((status) => {
          const count = counts[status] ?? 0;
          return `<td class="num${count === 0 ? ' zero' : ''}">${count}</td>`;
        })
        .join('');
      return `<tr><th scope="row"><span class="matrixName">${escapeHtml(feature.name)}</span><span class="matrixUri">${escapeHtml(displayUri(feature.uri))}</span></th><td class="num">${executed.length}</td>${cells}<td class="num">${durationLabel(feature.durationMs)}</td></tr>`;
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
  const ci = ciHeaderMarkup(model.environment?.ci);
  const date = dateLabel(model.startedAt);
  const ordered = orderFeatures(model.features);
  const features = ordered
    .map((feature, index) => renderFeature(feature, index))
    .join('');
  const triage = renderTriage(ordered);
  const sources = renderSourceStrip(model);
  const runHooks = renderRunHooks(model);
  const tags = scenarioTags(model);
  const tagFilter = tags.length
    ? `<label class="tagFilter"><span>Tag</span><select data-tag-filter><option value="">All tags</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('')}</select></label>`
    : '';
  return `<div class="tabPanel" id="report-view" role="tabpanel" aria-labelledby="view-report" tabindex="0"><main class="shell"><header class="runHead"><div><p class="path">${escapeHtml(model.source)} / ${escapeHtml(options.title)}</p><h1>${escapeHtml(options.title)}</h1><p class="meta">${date ? `<span>${date}</span>` : ''}<span>${model.counts.features} feature${model.counts.features === 1 ? '' : 's'}</span><span>${model.counts.scenarios.total} executed scenario${model.counts.scenarios.total === 1 ? '' : 's'}</span><span>${durationLabel(model.durationMs)}</span><span>${escapeHtml(model.source)}</span>${ci}${meta}</p></div><div class="health"><div class="healthTop"><strong>${percent}%</strong><span aria-hidden="true">${passed} / ${total}</span><span class="sr">${passed} / ${total} passed</span></div>${statusBar(model)}${countPills(model)}</div></header><div class="toolbar"><label class="search"><span aria-hidden="true">⌕</span><input data-search type="search" placeholder="Search scenario, feature or tag" aria-label="Search scenarios"></label>${tagFilter}<div class="filters">${displayStatuses(model)
    .map(
      (status) =>
        `<button class="filter" type="button" data-status="${status}" aria-pressed="true">${statusLabel(status)} <b>${model.counts.scenarios[status]}</b></button>`,
    )
    .join('')}</div><div class="expand"><button type="button" data-expand="all">Expand all</button><button type="button" data-expand="none">Collapse all</button></div></div><p class="live sr" id="tolkira-live" role="status" aria-live="polite" data-total="${total}"></p><p class="searchNote" id="tolkira-search-note" hidden></p>${triage}${sources}<div id="feature-list">${features || `<div class="empty">No scenarios in this report.</div>`}</div>${runHooks}<div class="empty" id="empty-results" hidden>No scenarios match the current search or filters.</div><p class="foot">Generated by Tolkira. Single file. No network requests. Screenshots are embedded.</p></main></div>`;
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
    ciDetailRows(model.environment?.ci),
  ].join('');
  const runRows = `<dt>Duration</dt><dd>${durationLabel(model.durationMs)}</dd><dt>Features</dt><dd>${model.counts.features}</dd><dt>Scenarios</dt><dd>${counts.total}</dd><dt>Steps (excl. hooks)</dt><dd>${model.counts.steps.total}</dd><dt>Hooks</dt><dd>${model.counts.hooks.total}</dd><dt>Attachments</dt><dd>${model.counts.attachments}</dd><dt>Attachment size</dt><dd>${model.counts.attachmentBytes} bytes</dd><dt>Source</dt><dd>${escapeHtml(model.source)}</dd>`;
  return `<div class="tabPanel" id="analysis-view" role="tabpanel" aria-labelledby="view-analysis" tabindex="0" hidden><main class="shell analysis"><header class="runHead"><div><p class="path">${escapeHtml(model.source)} / details</p><h1>Run details</h1><p class="meta">${dateLabel(model.startedAt) ? `<span>${dateLabel(model.startedAt)}</span>` : ''}<span>${escapeHtml(model.source)}</span></p></div><div class="health"><div class="healthTop"><strong>${counts.total === 0 ? 0 : Math.round((counts.passed / counts.total) * 1000) / 10}%</strong><span>${counts.passed} / ${counts.total} passed</span></div>${statusBar(model)}${countPills(model)}</div></header><div class="analysisGrid"><section class="panel"><h2>Features</h2><p>Where the run spent its scenarios and steps.</p><p class="matrixHint">Executed scenarios only. Scroll for all status columns.</p><div class="tableWrap" tabindex="0" role="region" aria-label="Feature status matrix">${renderFeatureMatrix(model)}</div></section><section class="panel"><h2>Status distribution</h2><p>Executed scenarios only.</p><div class="legend">${displayStatuses(model)
    .map(
      (status) =>
        `<div class="legendRow ${statusClass(status)}"><span class="marker ${statusClass(status)}"></span><span>${statusLabel(status)}</span><b>${counts[status]}</b></div>`,
    )
    .join('')}</div><h2 class="subhead">Run</h2><dl class="metaList">${runRows}</dl>${environmentRows ? `<h2 class="subhead">Cucumber environment</h2><dl class="metaList">${environmentRows}</dl>` : ''}${customRows ? `<h2 class="subhead">Custom metadata</h2><dl class="metaList">${customRows}</dl>` : ''}</section></div>${model.runAttachments.length ? `<section class="panel" style="margin-top:16px"><h2>Run attachments</h2>${model.runAttachments.map((attachment) => renderAttachment(attachment, 'Run attachments')).join('')}</section>` : ''}<section class="panel" style="margin-top:16px"><h2>Agent summary</h2><p>The same run as stable JSON for CI tools and agents. Its step counts include hook entries; the HTML counts above exclude them.</p><pre class="json" tabindex="0" aria-label="Agent summary JSON">${escapeHtml(JSON.stringify(preview))}</pre></section><p class="foot">Full summary: <code>tolkira ... --json</code></p></main></div>`;
}


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
  const clientScript = `<script>${CLIENT_SCRIPT.replace(/<\/script/gi, '<\\/script')}</script>`;
  const body = `<header class="topbar"><div class="topbarInner"><div class="brand">${logo}tol<span>kira</span></div><div class="views" role="tablist" aria-label="Report view"><button class="view" id="view-report" type="button" role="tab" data-view="report" aria-selected="true" aria-controls="report-view">Report</button><button class="view" id="view-analysis" type="button" role="tab" data-view="analysis" aria-selected="false" aria-controls="analysis-view">Details</button></div></div></header><p class="sr" id="tolkira-copy-live" aria-live="polite"></p>${renderReportView(model, options)}${renderAnalysisView(model, options, summary)}<dialog class="lightbox" id="tolkira-lightbox" aria-label="Full-size attachment"><button class="lightboxClose" type="button" data-lightbox-close>Close</button><img alt=""></dialog>${clientScript}`;
  const hashes = inlineScriptHashes(body);
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(options.title)}</title>\n${csp(hashes)}\n<style>${REPORT_CSS}${accent}</style>\n</head>\n<body>${body}</body>\n</html>`;
}
