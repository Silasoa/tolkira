import type {
  ReportFeature,
  ReportModel,
  ReportScenario,
} from '../report/model.js';
import { worstExecutedStatus } from '../report/status.js';
import { featureId, scenarioId } from './dom-contract.js';
import { escapeHtml } from './escape.js';
import {
  attentionCounts,
  compareStatus,
  executedOnly,
  featureBar,
  featureSourceLabel,
  hookLabel,
  statusClass,
  statusLabel,
} from './format.js';
import type { Translator } from './i18n.js';
import type { OrderedFeature } from './types.js';

const TRIAGE_FEATURE_LIMIT = 20;
const TRIAGE_SCENARIO_LIMIT = 3;
const SOURCE_LIMIT = 6;

interface TriageEntry extends OrderedFeature {
  index: number;
}

function renderTriageRow({
  feature,
  scenarios,
  index,
}: TriageEntry, t: Translator): string {
  const failing = executedOnly(scenarios).filter(
    (scenario) => scenario.status !== 'passed',
  );
  const links = failing
    .slice(0, TRIAGE_SCENARIO_LIMIT)
    .map((scenario) => {
      const scenarioIndex = scenarios.indexOf(scenario);
      return `<li><a class="triageScenario" href="#${scenarioId(index, scenarioIndex)}"><span class="triageStatus ${statusClass(scenario.status)}">${statusLabel(scenario.status, t)}</span><span>${escapeHtml(scenarioLabel(scenario))}</span></a></li>`;
    })
    .join('');
  const more =
    failing.length > TRIAGE_SCENARIO_LIMIT
      ? `<li class="triageMore">${t.t('triage.moreInReport', { count: failing.length - TRIAGE_SCENARIO_LIMIT })}</li>`
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
  const firstLine = reasonMessage.split(/\r?\n/)[0] ?? '';
  const reason = reasonSource
    ? `${reasonSource} — ${firstLine.trim().slice(0, 120)}${firstLine.trim().length > 120 ? '…' : ''}`
    : '';
  return `<li class="triageItem"><a class="triageFeature" href="#${featureId(index)}" title="${escapeHtml(featureSourceLabel(feature, t))}"><span class="triageStatus ${statusClass(feature.status)}">${statusLabel(feature.status, t)}</span><span>${escapeHtml(feature.name)}</span></a><p class="triageCounts">${attentionCounts(scenarios, t)}</p><ul class="triageScenarios">${links}${more}</ul>${reason ? `<p class="triageReason"><span class="triageReasonLabel">${t.t('triage.firstFailure')}</span> ${escapeHtml(reason)}</p>` : ''}</li>`;
}

export function renderTriage(
  features: OrderedFeature[],
  t: Translator,
  staticMode = false,
): string {
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
  const rows = shown.map((entry) => renderTriageRow(entry, t)).join('');
  const restBlock = rest.length
    ? `<details class="triageRest"${staticMode ? ' open' : ''}><summary>${t.t('triage.showMore', { count: rest.length })}</summary><ol class="triageList">${rest.map((entry) => renderTriageRow(entry, t)).join('')}</ol></details>`
    : '';
  const remainder =
    attention.length > TRIAGE_FEATURE_LIMIT
      ? `<p class="triageMore">${t.t('triage.moreBelow', { count: attention.length - TRIAGE_FEATURE_LIMIT })}</p>`
      : '';
  const lead = t.t('triage.lead', { need, total });
  return `<details class="triageBox" data-triage open><summary class="triageSummary"><span class="triageTitle">${t.t('triage.needsAttention')}</span><span class="triageSummaryLead">${lead}</span><span class="chev" aria-hidden="true"></span></summary><nav class="triage" aria-label="${t.t('triage.needsAttention')}"><h2 id="triage-heading">${t.t('triage.needsAttention')}</h2><p class="triageLead">${lead}</p><ol class="triageList">${rows}</ol>${restBlock}${remainder}</nav></details>`;
}

export function renderSourceStrip(
  model: ReportModel,
  t: Translator,
): string {
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
      const attention = attentionCounts(entry.scenarios, t);
      const counts =
        `${t.t('triage.featureCount', { count: entry.features })} · ` +
        t.t('triage.scenarioCount', { count: entry.scenarios.length }) +
        (attention ? ` · ${attention}` : '');
      return `<li class="sourceItem"><div class="sourceHead"><span class="triageStatus ${statusClass(entry.status)}">${statusLabel(entry.status, t)}</span><span class="sourceName">${escapeHtml(entry.file)}</span></div><p class="sourceCounts">${counts}</p>${featureBar(entry.scenarios)}</li>`;
    })
    .join('');
  const more =
    remainder > 0
      ? `<p class="triageMore">${t.t('triage.moreInputs', { count: remainder })}</p>`
      : '';
  return `<section class="sources" aria-labelledby="sources-heading" data-sources><h2 id="sources-heading">${t.t('triage.sources')}</h2><ul class="sourceList">${items}</ul>${more}</section>`;
}

function scenarioLabel(scenario: ReportScenario): string {
  const outline = scenario.outline;
  if (!outline) return scenario.name;
  const number = `#${outline.examplesIndex + 1}.${outline.exampleIndex + 1}`;
  const examples = outline.examplesName ? `${outline.examplesName} ` : '';
  return `${examples}${number} · ${scenario.name}`.trim();
}
