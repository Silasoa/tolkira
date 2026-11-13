import {
  DOM_IDS,
  FILTER_STATUS_ATTRIBUTE,
  SCENARIO_ATTRIBUTE,
  STATUS_ATTRIBUTE,
  decodeScenario,
  scenarioVisible,
} from './dom-contract.js';
import {
  SEARCH_OPEN_CAP,
  compileTagExpression,
  parseUrlState,
  rememberHiddenOpen,
  rowsToOpen,
  serializeUrlState,
  type UrlState,
} from './search.js';

const views = [...document.querySelectorAll<HTMLElement>('[data-view]')];
const report = document.getElementById(DOM_IDS.reportView);
const analysis = document.getElementById(DOM_IDS.analysisView);

function showView(name: string | null): void {
  if (!report || !analysis) return;
  report.hidden = name !== 'report';
  analysis.hidden = name !== 'analysis';
  for (const button of views) {
    const active = button.getAttribute('data-view') === name;
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  window.scrollTo(0, 0);
}

for (const button of views) {
  button.addEventListener('click', () => {
    showView(button.getAttribute('data-view'));
  });
}

const tablist = document.querySelector<HTMLElement>('[role="tablist"]');
tablist?.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = views.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? views.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + views.length) %
          views.length;
  views[next]?.focus();
  showView(views[next]?.getAttribute('data-view') ?? null);
});

const state = { query: '', hidden: new Set<string>(), tag: '' };
let searchOpened: HTMLDetailsElement[] = [];
let searchOpenedHooks: HTMLDetailsElement[] = [];
const hiddenOpen = new WeakMap<HTMLDetailsElement, boolean>();
const scenarios = [
  ...document.querySelectorAll<HTMLDetailsElement>(`[${SCENARIO_ATTRIBUTE}]`),
];
const highlightTargets = [
  ...scenarios,
  ...document.querySelectorAll<HTMLElement>(
    '.outlineTitle, .examplesTitle, .ruleTitle, .backgroundTitle',
  ),
];
const features = [
  ...document.querySelectorAll<HTMLDetailsElement>('[data-feature]'),
];
interface RowGroup {
  group: HTMLElement;
  rows: HTMLDetailsElement[];
}
const exampleGroups: RowGroup[] = [
  ...document.querySelectorAll<HTMLElement>('[data-examples]'),
].map((group) => ({
  group,
  rows: [
    ...group.querySelectorAll<HTMLDetailsElement>(`[${SCENARIO_ATTRIBUTE}]`),
  ],
}));
const outlineGroups: RowGroup[] = [
  ...document.querySelectorAll<HTMLElement>('[data-outline]'),
].map((group) => ({
  group,
  rows: [
    ...group.querySelectorAll<HTMLDetailsElement>(`[${SCENARIO_ATTRIBUTE}]`),
  ],
}));
const ruleGroups: RowGroup[] = [
  ...document.querySelectorAll<HTMLElement>('[data-rule]'),
].map((group) => ({
  group,
  rows: [
    ...group.querySelectorAll<HTMLDetailsElement>(`[${SCENARIO_ATTRIBUTE}]`),
  ],
}));
const live = document.getElementById(DOM_IDS.live);
const searchNote = document.getElementById(DOM_IDS.searchNote);
const triage = document.querySelector<HTMLDetailsElement>('[data-triage]');
const sources = document.querySelector<HTMLElement>('[data-sources]');

function groupSearch(scenario: HTMLDetailsElement): string {
  const outline = scenario.closest<HTMLElement>('[data-outline]');
  const examples = scenario.closest<HTMLElement>('[data-examples]');
  const rule = scenario.closest<HTMLElement>('[data-rule]');
  const feature = scenario.closest<HTMLElement>('[data-feature]');
  return (
    (outline ? ` ${outline.getAttribute('data-search') ?? ''}` : '') +
    (examples ? ` ${examples.getAttribute('data-search') ?? ''}` : '') +
    (rule ? ` ${rule.getAttribute('data-search') ?? ''}` : '') +
    (feature ? ` ${feature.getAttribute('data-background-search') ?? ''}` : '')
  );
}

function hideEmptyGroups(groups: RowGroup[]): void {
  for (const entry of groups) {
    entry.group.hidden = !entry.rows.some((row) => !row.hidden);
  }
}

function apply(): void {
  const query = state.query;
  const tag = state.tag;
  const expression = compileTagExpression(state.query);
  let visible = 0;
  for (const scenario of scenarios) {
    const facts = decodeScenario(scenario);
    const match = scenarioVisible(facts, {
      query,
      tag,
      hidden: state.hidden,
      ...(expression ? { expression } : {}),
      groupSearch: groupSearch(scenario),
    });
    if (!match) {
      if (!scenario.hidden) {
        hiddenOpen.set(
          scenario,
          rememberHiddenOpen(scenario.open, searchOpened.includes(scenario)),
        );
      }
      scenario.open = false;
    } else if (scenario.hidden && hiddenOpen.has(scenario)) {
      scenario.open = hiddenOpen.get(scenario) ?? false;
      hiddenOpen.delete(scenario);
    }
    scenario.hidden = !match;
    if (match) visible += 1;
  }
  for (const feature of features) {
    const any = [
      ...feature.querySelectorAll<HTMLDetailsElement>(`[${SCENARIO_ATTRIBUTE}]`),
    ].some((child) => !child.hidden);
    feature.hidden = !any;
    if (any && (query || state.hidden.size || tag)) feature.open = true;
  }
  hideEmptyGroups(exampleGroups);
  hideEmptyGroups(outlineGroups);
  hideEmptyGroups(ruleGroups);
  for (const scenario of searchOpened) scenario.open = false;
  searchOpened = [];
  for (const group of searchOpenedHooks) group.open = false;
  searchOpenedHooks = [];
  const toOpen = query
    ? rowsToOpen(
        scenarios.map((scenario) => ({
          visible: !scenario.hidden,
          open: scenario.open,
        })),
      )
    : [];
  for (const index of toOpen) {
    const scenario = scenarios[index];
    if (!scenario) continue;
    scenario.open = true;
    searchOpened.push(scenario);
  }
  const opened = toOpen.length;
  if (query) {
    for (const scenario of scenarios) {
      if (scenario.hidden || !scenario.open) continue;
      for (const group of scenario.querySelectorAll<HTMLDetailsElement>(
        'details.hookGroup',
      )) {
        if (!group.open) {
          group.open = true;
          searchOpenedHooks.push(group);
        }
      }
    }
  }
  if (live) {
    live.textContent = `${visible} of ${scenarios.length} scenarios visible`;
  }
  if (searchNote) {
    if (query && opened === SEARCH_OPEN_CAP && visible > SEARCH_OPEN_CAP) {
      searchNote.textContent = `${SEARCH_OPEN_CAP} of ${visible} matches expanded. Use Expand all to open the rest.`;
      searchNote.hidden = false;
    } else {
      searchNote.hidden = true;
      searchNote.textContent = '';
    }
  }
  const empty = document.getElementById(DOM_IDS.emptyResults);
  if (empty) empty.hidden = visible !== 0;
  if (triage) triage.hidden = Boolean(query || tag || state.hidden.size);
  if (sources) sources.hidden = Boolean(query || tag || state.hidden.size);
  highlightSearch();
}

function clearHighlights(): void {
  if (typeof CSS === 'undefined' || !CSS.highlights) return;
  CSS.highlights.delete('tolkira-search');
}

function escapeRegex(value: string): string {
  let out = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const character = value.charAt(index);
    const special =
      code === 92 ||
      code === 94 ||
      code === 36 ||
      code === 46 ||
      code === 42 ||
      code === 43 ||
      code === 63 ||
      code === 40 ||
      code === 41 ||
      code === 91 ||
      code === 93 ||
      code === 123 ||
      code === 125 ||
      code === 124;
    out += special ? String.fromCharCode(92) + character : character;
  }
  return out;
}

function highlightSearch(): void {
  if (
    typeof CSS === 'undefined' ||
    !CSS.highlights ||
    typeof Highlight === 'undefined'
  ) {
    return;
  }
  const needle = state.query.trim();
  if (needle.length < 2) {
    clearHighlights();
    return;
  }
  try {
    const pattern = new RegExp(escapeRegex(needle), 'gi');
    const ranges: Range[] = [];
    for (const target of highlightTargets) {
      if (target.hidden || target.closest('[hidden]') || ranges.length >= 200) {
        continue;
      }
      if (
        target.hasAttribute(SCENARIO_ATTRIBUTE) &&
        !(target as HTMLDetailsElement).open
      ) {
        continue;
      }
      const walker = document.createTreeWalker(
        target,
        NodeFilter.SHOW_TEXT,
        null,
      );
      let node: Node | null;
      while (ranges.length < 200 && (node = walker.nextNode())) {
        const value = node.nodeValue;
        if (!value) continue;
        const parent = node.parentElement;
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
          continue;
        }
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while (ranges.length < 200 && (match = pattern.exec(value)) !== null) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
          if (match[0].length === 0) pattern.lastIndex += 1;
        }
      }
    }
    clearHighlights();
    if (ranges.length) {
      CSS.highlights.set('tolkira-search', new Highlight(...ranges));
    }
  } catch {
    clearHighlights();
  }
}

const search = document.querySelector<HTMLInputElement>('input[data-search]');
const tagFilter = document.querySelector<HTMLSelectElement>('[data-tag-filter]');
const statusButtons = [
  ...document.querySelectorAll<HTMLButtonElement>(
    `button.filter[${FILTER_STATUS_ATTRIBUTE}]`,
  ),
];

function syncUrl(): void {
  try {
    const next = serializeUrlState(location.href, {
      query: state.query,
      hidden: [...state.hidden],
      tag: state.tag,
    });
    if (typeof history.replaceState === 'function') {
      history.replaceState(null, '', next);
    }
  } catch {}
}

function restoreUrlState(): void {
  const knownStatuses = statusButtons.map(
    (button) => button.getAttribute(FILTER_STATUS_ATTRIBUTE) ?? '',
  );
  const knownTags = tagFilter
    ? Array.from(tagFilter.options)
        .map((option) => option.value)
        .filter(Boolean)
    : [];
  let parsed: UrlState;
  try {
    parsed = parseUrlState(location.search, knownStatuses, knownTags);
  } catch {
    return;
  }
  if (parsed.query) {
    state.query = parsed.query;
    if (search) search.value = parsed.query;
  }
  for (const status of parsed.hidden) state.hidden.add(status);
  for (const button of statusButtons) {
    button.setAttribute(
      'aria-pressed',
      state.hidden.has(button.getAttribute(FILTER_STATUS_ATTRIBUTE) ?? '')
        ? 'false'
        : 'true',
    );
  }
  if (parsed.tag && tagFilter) {
    state.tag = parsed.tag;
    tagFilter.value = parsed.tag;
  }
  if (state.query || state.hidden.size || state.tag) apply();
}

search?.addEventListener('input', () => {
  state.query = search.value;
  apply();
  syncUrl();
});
tagFilter?.addEventListener('change', () => {
  state.tag = tagFilter.value;
  apply();
  syncUrl();
});
for (const button of statusButtons) {
  button.addEventListener('click', () => {
    const status = button.getAttribute(FILTER_STATUS_ATTRIBUTE) ?? '';
    const active = button.getAttribute('aria-pressed') !== 'false';
    if (active) {
      state.hidden.add(status);
      button.setAttribute('aria-pressed', 'false');
    } else {
      state.hidden.delete(status);
      button.setAttribute('aria-pressed', 'true');
    }
    apply();
    syncUrl();
  });
}
for (const button of document.querySelectorAll<HTMLButtonElement>(
  '[data-expand]',
)) {
  button.addEventListener('click', () => {
    const open = button.getAttribute('data-expand') === 'all';
    for (const feature of features) feature.open = open;
    for (const scenario of scenarios) scenario.open = open;
  });
}

const copyLive = document.getElementById(DOM_IDS.copyLive);

function legacyCopy(text: string): boolean {
  const active = document.activeElement as HTMLElement | null;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.top = '-1000px';
  document.body.appendChild(field);
  let ok = false;
  try {
    field.select();
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    field.remove();
    active?.focus();
  }
  return ok;
}

function writeClipboard(text: string, done: (ok: boolean) => void): void {
  let settled = false;
  function finish(ok: boolean): void {
    if (settled) return;
    settled = true;
    done(ok);
  }
  function fallback(): void {
    finish(legacyCopy(text));
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      navigator.clipboard.writeText(text).then(
        () => finish(true),
        fallback,
      );
    } catch {
      fallback();
    }
  } else {
    fallback();
  }
}

function failureText(button: HTMLElement): string {
  const scenario = button.closest<HTMLDetailsElement>(
    `[${SCENARIO_ATTRIBUTE}]`,
  );
  if (!scenario) return '';
  const facts = decodeScenario(scenario);
  const feature = scenario.closest<HTMLElement>('[data-feature]');
  const featureTitle = feature?.querySelector('h2');
  const scenarioTitle = scenario.querySelector('.scenarioName');
  const scenarioName = facts.name || scenarioTitle?.textContent || '';
  const step = scenario.querySelector<HTMLElement>(
    `.step[${STATUS_ATTRIBUTE}="failed"]`,
  );
  const hook = !step
    ? scenario.querySelector<HTMLElement>(`.hook[${STATUS_ATTRIBUTE}="failed"]`)
    : null;
  const keyword = step?.querySelector('.kw')?.textContent?.trim() ?? '';
  const text = step?.querySelector('.stepText')?.textContent ?? '';
  const error =
    step?.querySelector('.error') ?? hook?.querySelector('.error') ?? null;
  const stepLabel = hook
    ? hook.querySelector('.hookLabel')?.textContent?.trim() ?? 'Hook'
    : `${keyword} ${text.trim()}`.trim();
  const stepKind = hook ? 'Hook: ' : 'Step: ';
  const lines = [
    `Feature: ${featureTitle?.textContent ?? ''}`,
    `Scenario: ${scenarioName}`,
  ];
  if (facts.example) {
    lines.push(
      `Example: ${facts.example}${
        facts.examplesName ? ` (${facts.examplesName})` : ''
      }`,
    );
  }
  lines.push('URI: ' + facts.uri, stepKind + stepLabel);
  if (error?.textContent?.trim()) {
    lines.push('Error:\n' + error.textContent.trim());
  }
  return lines.join('\n');
}

function setupCopyButton(
  button: HTMLButtonElement,
  label: string,
  textFor: (button: HTMLButtonElement) => string,
  copiedMessage: string,
  failedMessage: string,
): void {
  let labelTimer: ReturnType<typeof setTimeout> | null = null;
  button.addEventListener('click', () => {
    button.focus();
    writeClipboard(textFor(button), (ok) => {
      if (labelTimer) clearTimeout(labelTimer);
      button.textContent = ok ? 'Copied' : 'Copy failed';
      if (copyLive) {
        copyLive.textContent = ok ? copiedMessage : failedMessage;
      }
      labelTimer = setTimeout(() => {
        button.textContent = label;
        if (copyLive) copyLive.textContent = '';
      }, 2000);
    });
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>(
  '[data-copy-failure]',
)) {
  setupCopyButton(
    button,
    'Copy failure',
    failureText,
    'Failure details copied to clipboard.',
    'Could not copy failure details.',
  );
}
for (const button of document.querySelectorAll<HTMLButtonElement>(
  '[data-copy-log]',
)) {
  button.hidden = false;
  setupCopyButton(
    button,
    'Copy log',
    (target) => {
      const details = target.closest('details');
      const pre = details?.querySelector('pre');
      return pre?.textContent ?? '';
    },
    'Log copied to clipboard.',
    'Could not copy the log.',
  );
}

const lightbox = document.getElementById(DOM_IDS.lightbox) as
  | HTMLDialogElement
  | null;
if (lightbox) {
  const dialog = lightbox;
  const lightboxImage = dialog.querySelector<HTMLImageElement>('img');
  const closeLightbox = dialog.querySelector<HTMLButtonElement>(
    '[data-lightbox-close]',
  );
  let lightboxTrigger: HTMLElement | null = null;
  let previousOverflow = '';
  function closeDialog(): void {
    if (typeof dialog.close === 'function') dialog.close();
    else {
      dialog.removeAttribute('open');
      restoreLightbox();
    }
  }
  function restoreLightbox(): void {
    document.documentElement.style.overflow = previousOverflow;
    lightboxTrigger?.focus();
    lightboxTrigger = null;
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '.shotButton',
  )) {
    button.addEventListener('click', () => {
      const image = button.querySelector<HTMLImageElement>('img');
      if (!image || !lightboxImage) return;
      lightboxImage.src = image.src;
      lightboxImage.alt = image.alt;
      lightboxTrigger = button;
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    });
  }
  closeLightbox?.addEventListener('click', closeDialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('close', restoreLightbox);
}

function revealHash(): void {
  if (!location.hash) return;
  let id = '';
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  const target = document.getElementById(id);
  if (!target) return;
  let node: HTMLElement | null = target;
  while (node) {
    if (node.tagName === 'DETAILS') {
      (node as HTMLDetailsElement).open = true;
    }
    node = node.parentElement;
  }
  const focusTarget =
    target.tagName === 'DETAILS'
      ? target.querySelector<HTMLElement>('summary')
      : target;
  if (focusTarget) {
    try {
      focusTarget.focus({ preventScroll: true });
    } catch {
      focusTarget.focus();
    }
  }
  target.scrollIntoView();
}

const compact = window.matchMedia('(max-width: 560px)');
function syncCompact(): void {
  if (triage) triage.open = !compact.matches;
}
if (compact.addEventListener) compact.addEventListener('change', syncCompact);
syncCompact();
window.addEventListener('hashchange', revealHash);
restoreUrlState();
showView('report');
revealHash();
