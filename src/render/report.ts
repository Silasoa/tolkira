import type {
  ReportBackground,
  ReportFeature,
  ReportHook,
  ReportModel,
  ReportOutline,
  ReportRule,
  ReportRunHook,
  ReportScenario,
  ReportStep,
} from '../report/model.js';
import type { SkippedAttachment } from '../attempt-diagnostics.js';
import type { ReportStatus } from '../report/status.js';
import { worstExecutedStatus } from '../report/status.js';
import { displayUri } from '../summary.js';
import { compareText } from '../text.js';
import { renderAttachment } from './attachments.js';
import {
  applyBaselineChanges,
  baselineBadge,
  renderBaselinePanel,
} from './baseline.js';
import { ciHeaderMarkup } from './ci.js';
import {
  DOM_IDS,
  FILTER_PRESET_ATTRIBUTE,
  FILTER_STATUS_ATTRIBUTE,
  SCENARIO_ATTRIBUTE,
  encodeScenario,
  featureId,
  scenarioId,
} from './dom-contract.js';
import { escapeHtml } from './escape.js';
import {
  STEP_GLYPHS,
  attentionCounts,
  compareStatus,
  countPills,
  dateLabel,
  displayStatuses,
  durationLabel,
  executedOnly,
  featureBar,
  featureSourceLabel,
  flakyScenarioCount,
  healthMarkup,
  hookLabel,
  isFlakyScenario,
  metadataValueHtml,
  orderFeatures,
  scenarioSourceLabel,
  statusBar,
  statusClass,
  statusLabel,
  tagsMarkup,
} from './format.js';
import { renderDescription } from './markdown.js';
import type { MessageKey, Translator } from './i18n.js';
import { renderSourceStrip, renderTriage } from './triage.js';
import type { OrderedFeature, RenderOptions } from './types.js';

const SEARCH_MESSAGE_LIMIT = 2000;
const UNDEFINED_LEAD = 'No step definition found.';
const AMBIGUOUS_LEAD = 'Multiple matching step definitions found:';
const SKIP_REASON_KEYS: Record<SkippedAttachment['reason'], MessageKey> = {
  outside: 'report.attachmentSkipOutside',
  missing: 'report.attachmentSkipMissing',
  unreadable: 'report.attachmentSkipUnreadable',
  'not-regular': 'report.attachmentSkipNotRegular',
  'non-local': 'report.attachmentSkipNonLocal',
};

function scenarioTags(model: ReportModel): string[] {
  return [...new Set(model.scenarios.flatMap((scenario) => scenario.tags))].sort(
    compareText,
  );
}

function renderDiagnostic(step: ReportStep, t: Translator): string {
  if (step.status === 'undefined') {
    const suggestions = step.suggestions ?? [];
    const lead = suggestions.length
      ? t.t('report.diagnostic.undefinedSuggestions')
      : t.t('report.diagnostic.undefined');
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
    return `<div class="diagnostic" data-diagnostic="ambiguous"><p class="diagnosticLead">${t.t('report.diagnostic.ambiguous')}</p>${list}</div>`;
  }
  return '';
}

function renderStepText(step: ReportStep): string {
  const parameters = step.parameters;
  if (!parameters?.length) return escapeHtml(step.text);

  let cursor = 0;
  for (const parameter of parameters) {
    const end = parameter.start + parameter.value.length;
    if (
      !Number.isInteger(parameter.start) ||
      parameter.start < cursor ||
      !parameter.value.length ||
      end > step.text.length ||
      step.text.slice(parameter.start, end) !== parameter.value
    ) {
      return escapeHtml(step.text);
    }
    cursor = end;
  }

  cursor = 0;
  let html = '';
  for (const parameter of parameters) {
    const end = parameter.start + parameter.value.length;
    const matched = step.text.slice(parameter.start, end);
    html += escapeHtml(step.text.slice(cursor, parameter.start));
    html += `<span class="param" data-parameter-type="${escapeHtml(parameter.type)}">${escapeHtml(matched)}</span>`;
    cursor = end;
  }
  return html + escapeHtml(step.text.slice(cursor));
}

function renderStep(
  step: ReportStep,
  scenarioName: string,
  t: Translator,
  staticMode = false,
): string {
  const diagnostic = renderDiagnostic(step, t);
  const docString = step.docString
    ? `<pre class="docString">${escapeHtml(step.docString)}</pre>`
    : '';
  const table = step.dataTable
    ? `<div class="tableWrap" tabindex="0" role="region" aria-label="${t.t('report.dataTable', { step: escapeHtml(step.text) })}"><table class="dataTable"><tbody>${step.dataTable
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
    .map((attachment) => renderAttachment(attachment, context, t, staticMode))
    .join('');
  return `<li class="step"${step.status === 'failed' ? ' data-status="failed"' : ''}><span class="stepMarker ${statusClass(step.status)}"><span aria-hidden="true">${STEP_GLYPHS[step.status]}</span><span class="sr">${statusLabel(step.status, t)}</span></span><div><span class="kw">${escapeHtml(step.keyword)}</span> <span class="stepText">${renderStepText(step)}</span>${diagnostic}${error}${docString}${table}${attachments}</div><span class="dur">${durationLabel(step.durationMs, t)}</span></li>`;
}

function renderHook(
  hook: ReportHook | ReportRunHook,
  scenarioName: string,
  t: Translator,
  bareName = false,
  staticMode = false,
): string {
  const error = hook.message
    ? `<pre class="error">${escapeHtml(hook.message)}</pre>`
    : '';
  const label = hookLabel(hook, bareName);
  const attachments = hook.attachments
    .map((attachment) =>
      renderAttachment(attachment, `${scenarioName}: ${label}`, t, staticMode),
    )
    .join('');
  return `<li class="hook" data-status="${hook.status}"><span class="stepMarker ${statusClass(hook.status)}"><span aria-hidden="true">${STEP_GLYPHS[hook.status]}</span><span class="sr">${statusLabel(hook.status, t)}</span></span><div><span class="hookLabel">${escapeHtml(label)}</span>${error}${attachments}</div><span class="dur">${durationLabel(hook.durationMs, t)}</span></li>`;
}

function renderRunHooks(
  model: ReportModel,
  t: Translator,
  staticMode = false,
): string {
  if (model.runHooks.length === 0) return '';
  return `<section class="runHooks" data-run-hooks aria-labelledby="run-hooks-heading"><h2 id="run-hooks-heading">${t.t('report.runHooks')}</h2><ul class="hooks">${model.runHooks.map((hook) => renderHook(hook, t.t('report.run'), t, true, staticMode)).join('')}</ul></section>`;
}

function backgroundText(background: ReportBackground): string {
  return [background.name, background.description].join(' ');
}

function backgroundMarkup(
  backgrounds: ReportBackground[],
  t: Translator,
): string {
  return backgrounds
    .filter((background) => background.name || background.description)
    .map((background) => {
      const name = background.name
        ? ` ${escapeHtml(background.name)}`
        : '';
      const description = renderDescription(background.description, t);
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

function scenarioSummary(
  scenario: ReportScenario,
  heading: string,
  visibleName: string,
  image: ReportScenario['attachments'][number] | undefined,
  rowTags: string,
  t: Translator,
): string {
  const flaky = isFlakyScenario(scenario);
  const statusCell = scenario.executed
    ? `<span class="statusCell"><span class="statusText ${statusClass(scenario.status)}">${statusLabel(scenario.status, t)}</span></span>`
    : `<span class="statusCell"><span class="sr">${t.t('report.notExecuted')}</span></span>`;
  const hooks = scenario.hooks.length
    ? ` · ${t.t('report.hookCount', { count: scenario.hooks.length })}`
    : '';
  const attachments = scenario.attachments.length
    ? `<br>${t.t('report.attachmentCount', { count: scenario.attachments.length })}`
    : '';
  const source = scenarioSourceLabel(scenario);
  const flakyBadge = flaky
    ? `<span class="flakyBadge" aria-hidden="true">${escapeHtml(t.t('report.flakyBadge'))}</span> `
    : '';
  const changeBadge = baselineBadge(scenario.change, t);
  return `<summary class="scenarioButton">${statusCell}<span class="thumbCell">${image ? `<img class="thumb" src="${escapeHtml(image.dataUri ?? '')}" alt="" loading="lazy">` : ''}</span><span class="scenarioMain"><${heading} class="scenarioName">${visibleName}</${heading}><span class="scenarioSub">${changeBadge}${flakyBadge}${t.t('report.stepCount', { count: scenario.steps.length })}${hooks}${rowTags ? ` ${rowTags}` : ''}${source ? `<span class="scenarioSource">${escapeHtml(source)}</span>` : ''}</span></span><span class="rowRight">${durationLabel(scenario.durationMs, t)}${attachments}</span><span class="chev" aria-hidden="true"></span></summary>`;
}

function skippedAttachmentNotice(
  scenario: ReportScenario,
  t: Translator,
): string {
  const entries = scenario.skippedAttachmentEntries ?? [];
  const count = Math.max(scenario.skippedAttachments ?? 0, entries.length);
  if (count <= 0) return '';
  const items = entries
    .map(
      (entry) =>
        `<li><code>${escapeHtml(entry.name)}</code> - ${escapeHtml(t.t(SKIP_REASON_KEYS[entry.reason]))}</li>`,
    )
    .join('');
  const list = items ? `<ul class="attachmentSkipList">${items}</ul>` : '';
  const remaining = count - entries.length;
  const more =
    entries.length > 0 && remaining > 0
      ? `<p class="attachmentSkipMore">${escapeHtml(t.t('report.attachmentSkipMore', { count: remaining }))}</p>`
      : '';
  return `<div class="attachmentWarning" role="note">${escapeHtml(t.t('report.attachmentSkipNotice', { count }))}${list}${more}</div>`;
}

function renderEarlierAttempts(
  scenario: ReportScenario,
  t: Translator,
  staticMode = false,
): string {
  const attempts = scenario.earlierAttempts ?? [];
  if (attempts.length === 0) return '';
  const total = scenario.earlierAttemptTotal ?? attempts.length;
  const summary = t.t('report.earlierAttempts', {
    // One branch renders the fully shown list; the other states the cap.
    count: attempts.length === total ? 1 : attempts.length,
    shown: attempts.length,
    total,
  });
  const items = attempts
    .map((attempt) => {
      const message = attempt.message
        ? `<pre class="earlierAttemptMessage">${escapeHtml(attempt.message)}</pre>`
        : '';
      const images = attempt.attachments
        .map((attachment) =>
          renderAttachment(
            attachment,
            t.t('report.earlierAttemptImage', { count: attempt.attempt }),
            t,
            staticMode,
          ),
        )
        .join('');
      return `<li><div class="earlierAttemptHead"><span>${escapeHtml(t.t('report.earlierAttempt', { count: attempt.attempt }))}</span><span class="statusText ${statusClass(attempt.status)}">${statusLabel(attempt.status, t)}</span><span>${durationLabel(attempt.durationMs, t)}</span></div>${message}${images}</li>`;
    })
    .join('');
  return `<details class="earlierAttempts"${staticMode ? ' open' : ''}><summary>${escapeHtml(summary)}</summary><ol class="earlierAttemptList">${items}</ol></details>`;
}

function scenarioBody({
  scenario,
  description,
  inlineItems,
  passedHooksGroup,
  earlierAttempts,
  extraAttachments,
  scenarioMeta,
  t,
  staticMode = false,
}: {
  scenario: ReportScenario;
  description: string;
  inlineItems: string;
  passedHooksGroup: string;
  earlierAttempts: string;
  extraAttachments: string;
  scenarioMeta: string;
  t: Translator;
  staticMode?: boolean;
}): string {
  const copyFailure =
    !staticMode && scenario.status === 'failed'
      ? `<button class="copyFailure" type="button" data-copy-failure>${t.t('report.copyFailure')}</button>`
      : '';
  const started = scenario.startedAt
    ? `<span>${t.t('report.startedMeta', { date: dateLabel(scenario.startedAt, t) })}</span>`
    : '';
  const rule = scenario.ruleName
    ? `<span>${t.t('report.ruleMeta', { name: escapeHtml(scenario.ruleName) })}</span>`
    : '';
  const attachmentNotice = skippedAttachmentNotice(scenario, t);
  return `<div class="detailInline">${description}<div class="stepsHead"><p class="detailLabel">${t.t('report.steps')}</p>${copyFailure}</div><ol class="steps" aria-label="${t.t('report.stepsAndHooks')}">${inlineItems}</ol>${passedHooksGroup}${earlierAttempts}${attachmentNotice}${extraAttachments}<div class="detailMeta">${scenarioMeta}<span>${t.t('report.featureMeta', { name: escapeHtml(scenario.featureName) })}</span><span>${t.t('report.attemptMeta', { count: scenario.attempt + 1 })}</span>${started}${rule}</div></div>`;
}

function renderScenario(
  scenario: ReportScenario,
  featureIndex: number,
  scenarioIndex: number,
  t: Translator,
  grouped = false,
  inRule = false,
  staticMode = false,
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
    staticMode ||
    (scenario.executed &&
      (scenario.status !== 'passed' || (!grouped && Boolean(image))));
  const passedHooks = scenario.hooks.filter(
    (hook) => hook.status === 'passed',
  );
  const inlineItems = [
    ...scenario.steps.map((step) => ({
      order: step.order,
      html: renderStep(step, scenario.name, t, staticMode),
    })),
    ...scenario.hooks
      .filter((hook) => hook.status !== 'passed')
      .map((hook) => ({
        order: hook.order,
        html: renderHook(hook, scenario.name, t, false, staticMode),
      })),
  ]
    .sort((a, b) => a.order - b.order)
    .map((item) => item.html)
    .join('');
  const passedHooksGroup = passedHooks.length
    ? `<details class="hookGroup"${staticMode ? ' open' : ''}><summary>${t.t('report.hookCount', { count: passedHooks.length })}</summary><ul class="hooks" aria-label="${t.t('report.passedHooks')}">${passedHooks.map((hook) => renderHook(hook, scenario.name, t, false, staticMode)).join('')}</ul></details>`
    : '';
  const description = grouped ? '' : renderDescription(scenario.description, t);
  const screenReaderLabel =
    grouped && outline
      ? (() => {
          const parts = [
            scenario.name,
            t.t('report.outlineLabel', { outline: outline.name }),
          ];
          if (outline.examplesName) {
            parts.push(
              t.t('report.examplesLabel', { examples: outline.examplesName }),
            );
          }
          parts.push(t.t('report.exampleLabel', { example }));
          return `<span class="sr">${escapeHtml(parts.join(', '))}</span>`;
        })()
      : '';
  const visibleName = grouped
    ? `<span class="exampleNo" aria-hidden="true">${escapeHtml(example)}</span>${screenReaderLabel}`
    : escapeHtml(scenario.name);
  // Grouped rows keep their tags on the outline/examples sections; standalone
  // rows show only their own tags and never repeat inherited feature/rule tags.
  const rowTags = grouped ? '' : tagsMarkup(scenario.ownTags);
  const extraAttachments = scenario.extraAttachments.length
    ? `<div role="group" aria-label="${t.t('report.attachments')}"><p class="detailLabel">${t.t('report.attachments')}</p>${scenario.extraAttachments.map((attachment) => renderAttachment(attachment, scenario.name, t, staticMode)).join('')}</div>`
    : '';
  const scenarioMeta =
    grouped && outline
      ? `<span>${t.t('report.scenarioMeta', { name: escapeHtml(scenario.name) })}</span>`
      : '';
  const attributes = encodeScenario({
    ...(scenario.executed ? { status: scenario.status } : {}),
    name: scenario.name,
    uri: displayUri(scenario.uri),
    tags: scenario.tags,
    ...(grouped
      ? { example, examplesName: outline?.examplesName ?? '' }
      : {}),
    search: scenarioText(scenario),
  })
    .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
    .join(' ');
  return `<details class="scenario" id="${scenarioId(featureIndex, scenarioIndex)}" ${SCENARIO_ATTRIBUTE} ${attributes} ${open ? 'open' : ''}>${scenarioSummary(scenario, heading, visibleName, image, rowTags, t)}${scenarioBody({ scenario, description, inlineItems, passedHooksGroup, earlierAttempts: renderEarlierAttempts(scenario, t, staticMode), extraAttachments, scenarioMeta, t, staticMode })}</details>`;
}

function renderExamples(
  outline: ReportOutline,
  rows: ReportScenario[],
  featureIndex: number,
  idIndex: Map<string, number>,
  t: Translator,
  staticMode = false,
): string {
  const description = renderDescription(outline.examplesDescription, t);
  const title = outline.examplesName
    ? `<span class="kw">${escapeHtml(outline.examplesKeyword)}:</span> ${escapeHtml(outline.examplesName)}`
    : `<span class="kw">${escapeHtml(outline.examplesKeyword)}:</span>`;
  return `<section class="examples" data-examples data-search="${escapeHtml(outline.examplesDescription)}">${tagsMarkup(outline.examplesTags)}<h4 class="examplesTitle">${title}</h4>${description}<div class="exampleRows">${rows
    .map((scenario) =>
      renderScenario(
        scenario,
        featureIndex,
        idIndex.get(scenario.id) ?? 0,
        t,
        true,
        false,
        staticMode,
      ),
    )
    .join('')}</div></section>`;
}

function renderOutline(
  outline: ReportOutline,
  rows: ReportScenario[],
  featureIndex: number,
  idIndex: Map<string, number>,
  t: Translator,
  staticMode = false,
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
      renderExamples(block.outline, block.rows, featureIndex, idIndex, t, staticMode),
    )
    .join('');
  const description = renderDescription(outline.description, t);
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
  t: Translator,
  staticMode = false,
): string {
  if (item.kind === 'outline' && item.outline && item.rows) {
    return renderOutline(
      item.outline,
      item.rows,
      featureIndex,
      idIndex,
      t,
      staticMode,
    );
  }
  if (item.scenario) {
    return renderScenario(
      item.scenario,
      featureIndex,
      idIndex.get(item.scenario.id) ?? 0,
      t,
      false,
      inRule,
      staticMode,
    );
  }
  return '';
}

function renderRuleBlock(
  block: RuleBlock,
  featureIndex: number,
  idIndex: Map<string, number>,
  t: Translator,
  staticMode = false,
): string {
  const rule = block.rule;
  const name = rule.name ? ` ${escapeHtml(rule.name)}` : '';
  const description = renderDescription(rule.description, t);
  return `<section class="rule" data-rule data-search="${escapeHtml(ruleSearchText(rule))}"><h3 class="ruleTitle"><span class="kw">${escapeHtml(rule.keyword)}:</span>${name}</h3>${tagsMarkup(rule.tags, 'ruleTags')}${description}${backgroundMarkup(rule.backgrounds, t)}<div class="ruleRows">${block.items
    .map((item) => renderFeatureItem(item, featureIndex, idIndex, true, t, staticMode))
    .join('')}</div></section>`;
}

function featureShape(
  feature: ReportFeature,
  scenarios: ReportScenario[],
  t: Translator,
): string {
  const executed = executedOnly(scenarios);
  const passed = executed.filter(
    (scenario) => scenario.status === 'passed',
  ).length;
  const attempted = executed.filter(
    (scenario) => scenario.status !== 'skipped',
  ).length;
  const attention = attentionCounts(executed, t);
  const counts =
    attempted === 0
      ? attention
        ? t.t('report.featureCountsZeroAttention', { passed, attention })
        : t.t('report.featureCountsZero', { passed })
      : attention
        ? t.t('report.featureCountsAttention', { passed, attempted, attention })
        : t.t('report.featureCounts', { passed, attempted });
  const source = feature.sourceFile
    ? `<span class="featureSource">${t.t('report.sourceFrom', { file: escapeHtml(feature.sourceFile) })}</span>`
    : '';
  return `<span class="featureShape"><span class="featureCounts">${counts}</span>${featureBar(scenarios)}${source}<span class="featureUri">${escapeHtml(featureSourceLabel(feature, t))}</span>${tagsMarkup(feature.tags, 'featureTags')}</span>`;
}

function featureSummary(
  feature: ReportFeature,
  scenarios: ReportScenario[],
  t: Translator,
): string {
  return `<summary><span class="statusCell"><span class="statusText ${statusClass(feature.status)}">${statusLabel(feature.status, t)}</span></span><h2>${escapeHtml(feature.name)}</h2><span class="chev" aria-hidden="true"></span>${featureShape(feature, scenarios, t)}</summary>`;
}

function renderFeature(
  { feature, scenarios }: OrderedFeature,
  featureIndex: number,
  t: Translator,
  staticMode = false,
): string {
  const executed = executedOnly(scenarios);
  const open =
    staticMode ||
    executed.length === 0 ||
    executed.some(
      (scenario) =>
        scenario.status !== 'passed' ||
        scenario.attachments.some((attachment) => attachment.kind === 'image'),
    );
  const description = renderDescription(feature.description, t);
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
  return `<details class="feature ${feature.status === 'failed' ? 'has-fail' : 'has-pass'}" id="${featureId(featureIndex)}" data-feature data-background-search="${backgroundSearch}" ${open ? 'open' : ''}>${featureSummary(feature, scenarios, t)}${description}${backgroundMarkup(feature.backgrounds, t)}<div class="rows">${topItems
    .map((item) =>
      item.kind === 'rule'
        ? renderRuleBlock(item, featureIndex, idIndex, t, staticMode)
        : renderFeatureItem(item, featureIndex, idIndex, false, t, staticMode),
    )
    .join('')}</div></details>`;
}

function metadataLine(metadata: Record<string, string> | undefined): string {
  return Object.entries(metadata ?? {})
    .filter(([key, value]) => key.length > 0 && String(value ?? '').length > 0)
    .map(
      ([key, value]) =>
        `<span><b>${escapeHtml(key)}</b> ${metadataValueHtml(value)}</span>`,
    )
    .join('');
}

function reportHeader(
  model: ReportModel,
  options: RenderOptions,
  t: Translator,
): string {
  const total = model.counts.scenarios.total;
  const unexecuted = model.scenarios.filter(
    (scenario) => !scenario.executed,
  ).length;
  const flaky = flakyScenarioCount(model);
  const meta = metadataLine(options.metadata);
  const ci = ciHeaderMarkup(model.environment?.ci, t);
  const date = dateLabel(model.startedAt, t);
  const flakyMeta =
    flaky > 0
      ? `<span class="flakyMeta">${t.t('report.flakySummary', { count: flaky })}</span>`
      : '';
  return `<header class="runHead"><div><p class="path">${escapeHtml(model.source)} / ${escapeHtml(options.title)}</p><h1>${escapeHtml(options.title)}</h1><p class="meta">${date ? `<span>${date}</span>` : ''}<span>${t.t('report.featureCount', { count: model.counts.features })}</span><span>${t.t('report.scenarioWithResults', { count: total })}</span>${flakyMeta}${unexecuted > 0 ? `<span>${t.t('report.unexecuted', { count: unexecuted })}</span>` : ''}<span title="${t.t('report.testTimeTitle')}"><b>${t.t('report.testTime')}</b> ${durationLabel(model.durationMs, t)}</span><span>${escapeHtml(model.source)}</span>${ci}${meta}</p></div><div class="health">${healthMarkup(model, t)}${statusBar(model)}${countPills(model, t)}</div></header>`;
}

function toolbar(model: ReportModel, t: Translator): string {
  const tags = scenarioTags(model);
  const tagFilter = tags.length
    ? `<label class="tagFilter"><span>${t.t('report.tag')}</span><select data-tag-filter><option value="">${t.t('report.allTags')}</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('')}</select></label>`
    : '';
  const statuses = displayStatuses(model);
  const preset =
    model.counts.scenarios.failed > 0 &&
    (statuses.length > 1 ||
      model.scenarios.some((scenario) => !scenario.executed))
      ? `<button class="filter presetFilter" type="button" ${FILTER_PRESET_ATTRIBUTE}="failed" aria-pressed="false">${t.t('report.failedOnly')}</button>`
      : '';
  return `<div class="toolbar"><label class="search"><span aria-hidden="true">⌕</span><input data-search type="search" placeholder="${t.t('report.searchPlaceholder')}" aria-label="${t.t('report.searchLabel')}"></label>${tagFilter}<div class="filters">${statuses
    .map(
      (status) =>
        `<button class="filter" type="button" ${FILTER_STATUS_ATTRIBUTE}="${status}" aria-pressed="true">${statusLabel(status, t)} <b>${t.number(model.counts.scenarios[status])}</b></button>`,
    )
    .join('')}${preset}</div><div class="expand"><button type="button" data-expand="all">${t.t('report.expandAll')}</button><button type="button" data-expand="none">${t.t('report.collapseAll')}</button></div></div>`;
}

export function renderReportView(
  model: ReportModel,
  options: RenderOptions,
  t: Translator,
  staticMode = false,
): string {
  const total = model.counts.scenarios.total;
  if (options.comparison) {
    applyBaselineChanges(model, options.comparison.changes);
  }
  const baselinePanel = options.comparison
    ? renderBaselinePanel(options.comparison, t)
    : '';
  const ordered = orderFeatures(model.features);
  const features = ordered
    .map((feature, index) => renderFeature(feature, index, t, staticMode))
    .join('');
  const triage = renderTriage(ordered, t, staticMode);
  const sources = renderSourceStrip(model, t);
  const runHooks = renderRunHooks(model, t, staticMode);
  const shell = `${reportHeader(model, options, t)}${staticMode ? '' : toolbar(model, t)}<p class="live sr" id="${DOM_IDS.live}" role="status" aria-live="polite" data-total="${total}"></p><p class="searchNote" id="${DOM_IDS.searchNote}" hidden></p>${baselinePanel}${triage}${sources}<div id="feature-list">${features || `<div class="empty">${t.t('report.noScenarios')}</div>`}</div>${runHooks}${staticMode ? '' : `<div class="empty" id="${DOM_IDS.emptyResults}" hidden>${t.t('report.noMatches')}</div>`}<p class="foot">${t.t('report.footer')}</p>`;
  return staticMode
    ? `<div class="tabPanel" id="${DOM_IDS.reportView}"><div class="shell">${shell}</div></div>`
    : `<div class="tabPanel" id="${DOM_IDS.reportView}" role="tabpanel" aria-labelledby="view-report" tabindex="0"><div class="shell">${shell}</div></div>`;
}
