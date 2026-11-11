import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { TestStepResultStatus } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { buildReportModel } from '../src/report/model.js';
import { renderHtml } from '../src/render/html.js';
import { summarizeEnvelopes } from '../src/summary.js';

const fixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const legacyTableFixture = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);
const passedOnlyFixture = fileURLToPath(
  new URL('./fixtures/legacy/behave.json', import.meta.url),
);
const minimalFixture = fileURLToPath(
  new URL('./fixtures/legacy/minimal.json', import.meta.url),
);
const examplesTables = fileURLToPath(
  new URL('./fixtures/messages/examples-tables.ndjson', import.meta.url),
);
const hooksFixture = fileURLToPath(
  new URL('./fixtures/messages/hooks.ndjson', import.meta.url),
);
const globalHooksFixture = fileURLToPath(
  new URL('./fixtures/messages/global-hooks.ndjson', import.meta.url),
);
const globalHookAttachments = fileURLToPath(
  new URL('./fixtures/messages/global-hooks-attachments.ndjson', import.meta.url),
);
const undefinedFixture = fileURLToPath(
  new URL('./fixtures/messages/undefined.ndjson', import.meta.url),
);
const ambiguousFixture = fileURLToPath(
  new URL('./fixtures/messages/ambiguous.ndjson', import.meta.url),
);
const allStatusesFixture = fileURLToPath(
  new URL('./fixtures/messages/all-statuses.ndjson', import.meta.url),
);
const junitFixture = fileURLToPath(
  new URL('./fixtures/junit/basic.xml', import.meta.url),
);
const unhappyFixture = fileURLToPath(
  new URL('./fixtures/legacy/unhappy.json', import.meta.url),
);
const legacyAmbiguousFixture = fileURLToPath(
  new URL('./fixtures/legacy/ambiguous.json', import.meta.url),
);
const rulesFixture = fileURLToPath(
  new URL('./fixtures/messages/rules.ndjson', import.meta.url),
);
const backgroundsFixture = fileURLToPath(
  new URL('./fixtures/messages/backgrounds.ndjson', import.meta.url),
);
const rulesBackgroundsFixture = fileURLToPath(
  new URL('./fixtures/messages/rules-backgrounds.ndjson', import.meta.url),
);
const tagsFixture = fileURLToPath(
  new URL('./fixtures/messages/tags.ndjson', import.meta.url),
);
const emptyFixture = fileURLToPath(
  new URL('./fixtures/messages/empty.ndjson', import.meta.url),
);
const emptyNoneFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-none.ndjson', import.meta.url),
);
const emptyMixedFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-mixed.ndjson', import.meta.url),
);
const emptyStatusesFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-statuses.ndjson', import.meta.url),
);
const emptyAllUnexecutedFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-all-unexecuted.ndjson', import.meta.url),
);
const emptyHookOnlyFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-hook-only.ndjson', import.meta.url),
);
const emptyRetryFixture = fileURLToPath(
  new URL('./fixtures/messages/empty-retry.ndjson', import.meta.url),
);

async function renderMessagesFile(file: string): Promise<string> {
  const content = await readFile(file, 'utf8');
  return renderHtml(parseMessages(content, file), { title: 'Outlines' });
}

describe('scenario outlines', () => {
  it('renders two outlines with examples headings and numbering', async () => {
    const html = await renderMessagesFile(examplesTables);

    expect(html.match(/<section class="outline" data-outline[^>]*>/g)).toHaveLength(2);
    expect(html.match(/<section class="examples" data-examples[^>]*>/g)).toHaveLength(3);
    expect(html).toContain('Scenario Outline:</span> Eating cucumbers');
    expect(html).toContain(
      'Scenario Outline:</span> Eating cucumbers with &lt;friends&gt; friends',
    );
    expect(html).toContain('Examples:</span> These are passing');
    expect(html).toContain('Examples:</span> These are failing');
    expect(html).toContain('<h4 class="examplesTitle"><span class="kw">Examples:</span></h4>');
    expect(html.match(/class="exampleNo"/g)).toHaveLength(7);
    expect(html).toContain('class="exampleNo" aria-hidden="true">#1.1');
    expect(html).toContain('class="exampleNo" aria-hidden="true">#2.2');
    expect(html).toContain('data-example="#2.1"');
    expect(html).toContain('<h5 class="scenarioName">');
    expect(html).not.toContain('<h4>Steps</h4>');
  });

  it('renders outline and examples metadata once and escapes it', async () => {
    const content = await readFile(examplesTables, 'utf8');
    const envelopes = parseMessages(content, examplesTables);
    const document = envelopes.find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument;
    const scenario = document?.feature?.children.find((child) => child.scenario)
      ?.scenario;
    const examples = scenario?.examples[0];
    expect(scenario).toBeDefined();
    expect(examples).toBeDefined();
    if (!scenario || !examples) return;

    scenario.keyword = '<img src=x onerror=alert(1)>';
    scenario.description = '<script>outline</script>';
    scenario.tags = [
      { id: 'outline-tag', name: '@outline-x', location: { line: 1, column: 1 } },
    ];
    examples.keyword = '<svg onload=alert(1)>';
    examples.name = '" onmouseover="alert(1)';
    examples.description = '<script>examples</script>';
    examples.tags = [
      { id: 'examples-tag', name: '@examples-x', location: { line: 1, column: 1 } },
      { id: 'examples-xss', name: '@<svg onload=alert(1)>', location: { line: 1, column: 1 } },
    ];

    const html = await renderHtml(envelopes, { title: 'Escaped outlines' });

    expect(html).toContain('&lt;script&gt;outline&lt;/script&gt;');
    expect(html).not.toContain('<script>outline</script>');
    expect(html).toContain('&lt;script&gt;examples&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;svg onload=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<svg onload');
    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).toContain('&quot; onmouseover=&quot;alert(1)');
    expect(
      html.match(/<p class="description">&lt;script&gt;outline&lt;\/script&gt;<\/p>/g),
    ).toHaveLength(1);
    expect(
      html.match(/<p class="description">&lt;script&gt;examples&lt;\/script&gt;<\/p>/g),
    ).toHaveLength(1);
    expect(html.match(/class="tag">@outline-x/g)).toHaveLength(1);
    expect(html.match(/class="tag">@examples-x/g)).toHaveLength(1);
  });

  it('asserts the exact numbering of both outlines', async () => {
    const html = await renderMessagesFile(examplesTables);
    const numbers = [...html.matchAll(/class="exampleNo"[^>]*>([^<]+)</g)].map(
      (match) => match[1],
    );

    expect(numbers).toEqual([
      '#1.1',
      '#1.2',
      '#2.1',
      '#2.2',
      '#1.1',
      '#1.2',
      '#1.3',
    ]);
  });

  it('omits an unexecuted examples block and keeps its AST numbering', async () => {
    const content = await readFile(examplesTables, 'utf8');
    const envelopes = parseMessages(content, examplesTables);
    const document = envelopes.find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument;
    const scenario = document?.feature?.children.find((child) => child.scenario)
      ?.scenario;
    const rowIds = new Set(
      (scenario?.examples?.[0]?.tableBody ?? []).map((row) => row.id),
    );
    const pickleIds = new Set(
      envelopes
        .filter(
          (envelope) =>
            envelope.pickle?.astNodeIds.some((id) => rowIds.has(id)),
        )
        .map((envelope) => envelope.pickle?.id),
    );
    const testCaseIds = new Set(
      envelopes
        .filter(
          (envelope) =>
            envelope.testCase && pickleIds.has(envelope.testCase.pickleId),
        )
        .map((envelope) => envelope.testCase?.id),
    );
    const startedIds = new Set(
      envelopes
        .filter(
          (envelope) =>
            envelope.testCaseStarted &&
            testCaseIds.has(envelope.testCaseStarted.testCaseId),
        )
        .map((envelope) => envelope.testCaseStarted?.id),
    );
    const filtered = envelopes.filter((envelope) => {
      if (envelope.testCase && pickleIds.has(envelope.testCase.pickleId)) {
        return false;
      }
      if (
        envelope.testCaseStarted &&
        testCaseIds.has(envelope.testCaseStarted.testCaseId)
      ) {
        return false;
      }
      if (
        envelope.testCaseFinished &&
        startedIds.has(envelope.testCaseFinished.testCaseStartedId)
      ) {
        return false;
      }
      if (
        envelope.testStepFinished &&
        startedIds.has(envelope.testStepFinished.testCaseStartedId)
      ) {
        return false;
      }
      return true;
    });

    const html = await renderHtml(filtered, { title: 'Partial execution' });
    expect(html).not.toContain('These are passing');
    expect(
      [...html.matchAll(/class="exampleNo"[^>]*>([^<]+)</g)].map(
        (match) => match[1],
      ),
    ).toEqual(['#2.1', '#2.2', '#1.1', '#1.2', '#1.3']);
    expect(html.match(/<section class="examples" data-examples[^>]*>/g)).toHaveLength(
      2,
    );
  });

  it('omits one unexecuted row but keeps the block heading', async () => {
    const content = await readFile(examplesTables, 'utf8');
    const envelopes = parseMessages(content, examplesTables);
    const document = envelopes.find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument;
    const scenario = document?.feature?.children.find((child) => child.scenario)
      ?.scenario;
    const rowId = scenario?.examples?.[0]?.tableBody?.[0]?.id;
    expect(rowId).toBeDefined();
    if (!rowId) return;
    const pickleIds = new Set(
      envelopes
        .filter((envelope) => envelope.pickle?.astNodeIds.includes(rowId))
        .map((envelope) => envelope.pickle?.id),
    );
    const testCaseIds = new Set(
      envelopes
        .filter(
          (envelope) =>
            envelope.testCase && pickleIds.has(envelope.testCase.pickleId),
        )
        .map((envelope) => envelope.testCase?.id),
    );
    const startedIds = new Set(
      envelopes
        .filter(
          (envelope) =>
            envelope.testCaseStarted &&
            testCaseIds.has(envelope.testCaseStarted.testCaseId),
        )
        .map((envelope) => envelope.testCaseStarted?.id),
    );
    const filtered = envelopes.filter((envelope) => {
      if (envelope.testCase && pickleIds.has(envelope.testCase.pickleId)) return false;
      if (envelope.testCaseStarted && testCaseIds.has(envelope.testCaseStarted.testCaseId)) return false;
      if (envelope.testCaseFinished && startedIds.has(envelope.testCaseFinished.testCaseStartedId)) return false;
      if (envelope.testStepFinished && startedIds.has(envelope.testStepFinished.testCaseStartedId)) return false;
      return true;
    });

    const html = await renderHtml(filtered, { title: 'One row missing' });
    expect(html).toContain('These are passing');
    expect(
      [...html.matchAll(/class="exampleNo"[^>]*>([^<]+)</g)].map(
        (match) => match[1],
      ),
    ).toEqual(['#1.2', '#2.1', '#2.2', '#1.1', '#1.2', '#1.3']);
  });

  it('does not index examples table values', async () => {
    const content = await readFile(examplesTables, 'utf8');
    const envelopes = parseMessages(content, examplesTables);
    const scenario = envelopes
      .find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument?.feature?.children.find((child) => child.scenario)
      ?.scenario;
    const row = scenario?.examples?.[0]?.tableBody?.[0];
    expect(row).toBeDefined();
    if (!row) return;
    (row.cells as unknown as Array<{ value: string }>).push({
      value: 'SENTINEL-TABLE-VALUE',
    });

    const html = await renderHtml(envelopes, { title: 'Table values' });
    expect(html).not.toContain('SENTINEL-TABLE-VALUE');
  });

  it('groups a URI-less Gherkin document', async () => {
    const content = await readFile(examplesTables, 'utf8');
    const envelopes = parseMessages(content, examplesTables);
    const document = envelopes.find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument;
    expect(document).toBeDefined();
    if (!document) return;
    delete (document as unknown as { uri?: string }).uri;

    const html = await renderHtml(envelopes, { title: 'No URI' });
    expect(html.match(/<section class="outline" data-outline[^>]*>/g)).toHaveLength(2);
  });

  it('groups an outline inside a Rule', async () => {
    const content = await readFile(examplesTables, 'utf8');
    const envelopes = parseMessages(content, examplesTables);
    const feature = envelopes.find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument?.feature;
    const child = feature?.children.find(
      (entry) => entry.scenario?.name === 'Eating cucumbers with <friends> friends',
    );
    expect(feature).toBeDefined();
    expect(child).toBeDefined();
    if (!feature || !child?.scenario) return;

    const children = feature.children as unknown as Array<
      (typeof feature.children)[number]
    >;
    const index = children.indexOf(child);
    children[index] = {
      rule: {
        id: 'rule-1',
        keyword: 'Rule',
        name: 'A rule',
        description: '',
        tags: [],
        location: { line: 1, column: 1 },
        children: [{ scenario: child.scenario }],
      },
    };

    const html = await renderHtml(envelopes, { title: 'Rule outline' });
    expect(html.match(/<section class="outline" data-outline[^>]*>/g)).toHaveLength(2);
    expect(html).toContain('Rule: A rule');
  });

  it('falls back flat for an executed outline without examples', async () => {
    const content = await readFile(examplesTables, 'utf8');
    const envelopes = parseMessages(content, examplesTables);
    const scenario = envelopes
      .find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument?.feature?.children.find((child) => child.scenario)
      ?.scenario;
    expect(scenario).toBeDefined();
    if (!scenario) return;

    scenario.examples = [];

    const html = await renderHtml(envelopes, { title: 'No examples' });
    expect(html.match(/<section class="outline" data-outline[^>]*>/g)).toHaveLength(1);
    expect(html.match(/data-example="/g)).toHaveLength(3);
    expect(html.match(/<details class="scenario"/g)).toHaveLength(7);
    expect(html.match(/data-scenario-name="Eating cucumbers"/g)).toHaveLength(4);
  });

  it('keeps the heading order valid', async () => {
    const html = await renderMessagesFile(examplesTables);
    const headings = [...html.matchAll(/<(h[2-5])[^>]*class="(outlineTitle|examplesTitle|scenarioName)"/g)].map(
      (match) => [match[1], match[2]],
    );

    expect(headings.slice(0, 3)).toEqual([
      ['h3', 'outlineTitle'],
      ['h4', 'examplesTitle'],
      ['h5', 'scenarioName'],
    ]);
  });

  it('labels triage and copied failures with example context', async () => {
    const html = await renderMessagesFile(examplesTables);

    expect(html).toContain('These are failing #2.1 · Eating cucumbers');
    expect(html).toContain('These are failing #2.2 · Eating cucumbers');
    expect(html).toContain('data-scenario-name="Eating cucumbers"');
    expect(html).toContain('data-examples-name="These are failing"');
    expect(html).toContain('<h3 class="outlineTitle">');
  });
});

describe('hooks rendering', () => {
  it('renders per-scenario hooks separately from steps', async () => {
    const html = await renderMessagesFile(hooksFixture);

    expect(html).toContain('class="hookGroup"');
    expect(html).toContain('class="hook"');
    expect(html).not.toContain('data-run-hooks');
    expect(html).toContain('Steps (excl. hooks)');
    expect(html).toContain('<dt>Hooks</dt>');
  });

  it('renders test-run hooks below the feature list', async () => {
    const html = await renderMessagesFile(globalHooksFixture);

    expect(html).toContain('data-run-hooks');
    expect(html).toContain('BeforeAll');
    expect(html).toContain('AfterAll');
    expect(html.indexOf('data-run-hooks')).toBeGreaterThan(
      html.indexOf('id="feature-list"'),
    );
  });

  it('renders run-hook attachments in the Hooks section', async () => {
    const html = await renderMessagesFile(globalHookAttachments);

    expect(html).toContain('data-run-hooks');
    expect(html).toContain('class="attachmentText"');
    expect(html).toContain('Attachment from BeforeAll hook');
  });

  it('uses a failed hook for triage when no step failed', async () => {
    const content = await readFile(hooksFixture, 'utf8');
    const envelopes = parseMessages(content, hooksFixture);
    const pickle = envelopes.find(
      (envelope) => envelope.pickle?.name === 'No tags and a passed step',
    )?.pickle;
    expect(pickle).toBeDefined();
    if (!pickle) return;
    const testCase = envelopes.find(
      (envelope) => envelope.testCase?.pickleId === pickle.id,
    )?.testCase;
    const started = envelopes.find(
      (envelope) => envelope.testCaseStarted?.testCaseId === testCase?.id,
    )?.testCaseStarted;
    const hookStep = testCase?.testSteps.find((step) => step.hookId);
    expect(started).toBeDefined();
    expect(hookStep).toBeDefined();
    if (!started || !hookStep) return;
    const result = envelopes.find(
      (envelope) =>
        envelope.testStepFinished?.testCaseStartedId === started.id &&
        envelope.testStepFinished.testStepId === hookStep.id,
    )?.testStepFinished;
    expect(result).toBeDefined();
    if (!result) return;
    result.testStepResult.status = TestStepResultStatus.FAILED;
    result.testStepResult.message = 'hook boom';

    const html = await renderHtml(envelopes, { title: 'Hook failure' });
    expect(html).toContain('class="hook" data-status="failed"');
    expect(html).toContain('hook boom');
    expect(html).toContain('data-copy-failure');
    expect(html).toContain('Before — hook boom');
  });

  it('renders a hook without Hook metadata with a generic label', async () => {
    const content = await readFile(hooksFixture, 'utf8');
    const envelopes = parseMessages(content, hooksFixture).filter(
      (envelope) => !envelope.hook,
    );
    const html = await renderHtml(envelopes, { title: 'Generic hooks' });
    expect(html).toContain('class="hook"');
    expect(html).toContain('class="hookLabel">Hook');
  });

  it('renders a named hook with its type and name', async () => {
    const content = await readFile(hooksFixture, 'utf8');
    const envelopes = parseMessages(content, hooksFixture);
    const hook = envelopes.find((envelope) => envelope.hook)?.hook;
    expect(hook).toBeDefined();
    if (!hook) return;
    hook.name = 'seed database';

    const html = await renderHtml(envelopes, { title: 'Named hooks' });
    expect(html).toContain('Before: seed database');
    expect(html).toContain('seed database');
  });

  it('escapes hook names and messages', async () => {
    const content = await readFile(hooksFixture, 'utf8');
    const envelopes = parseMessages(content, hooksFixture);
    const hook = envelopes.find((envelope) => envelope.hook)?.hook;
    expect(hook).toBeDefined();
    if (!hook) return;
    hook.name = '<script>alert(1)</script>';

    const html = await renderHtml(envelopes, { title: 'Escaped hooks' });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('messages rendering', () => {
  it('renders the simple report and analysis view', async () => {
    const html = await renderReport(fixture, { title: 'Tolkira test' });

    expect(html).toContain('<title>Tolkira test</title>');
    expect(html).toContain('<h1>Tolkira test</h1>');
    expect(html).toContain('id="report-view"');
    expect(html).toContain('id="analysis-view"');
    expect(html).toContain('id="report-view" role="tabpanel" aria-labelledby="view-report" tabindex="0"');
    expect(html).toContain('id="analysis-view" role="tabpanel" aria-labelledby="view-analysis" tabindex="0" hidden');
    expect(html).toContain('aria-label="Agent summary JSON"');
    expect(html).toContain('<p class="detailLabel">Steps</p>');
    expect(html).toContain('class="stepMarker');
    expect(html).toContain('Cucumber environment');
    expect(html).toContain('Producer');
    expect(html).toContain('id="view-analysis"');
    expect(html).toContain('data-view="report"');
    expect(html).toContain('data-view="analysis"');
    expect(html).toContain('1 feature');
    expect(html).toContain('2 scenarios');
    expect(html).toContain('>1</b> passed');
    expect(html).toContain('>1</b> failed');
    expect(html).toContain('1 attachment');
    expect(html).toContain('Screenshot attachment');
    expect(html).toContain('screenshot.png');
    expect(html).toContain('image/png');
    expect(html).toContain('data-expand="all"');
    expect(html).toContain('data-expand="none"');
    expect(html).toContain('class="thumb"');
    expect(html).toContain('class="chev"');
    expect(html).toContain('class="shotButton"');
    expect(html).toContain('id="tolkira-lightbox"');
    expect(html).toContain('Runtime');
    expect(html).toContain('Protocol');
    expect(html.length).toBeGreaterThan(20_000);
  });

  it('opens failed and image-bearing scenarios by default', async () => {
    const html = await renderReport(fixture, { title: 'Open state' });

    expect(html).toContain('data-status="failed"');
    expect(html).toContain('data-scenario');
    expect(html).toContain('class="shot"');
    expect(html).toContain(
      'alt="Screenshot for Attach a screenshot: Given I attach a screenshot: screenshot.png (image/png)"',
    );
  });

  it('escapes the report title', async () => {
    const html = await renderReport(fixture, {
      title: '<script>alert(1)</script>',
    });

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<title><script>');
  });

  it('injects and escapes metadata', async () => {
    const html = await renderReport(fixture, {
      title: 'Metadata',
      metadata: {
        Browser: 'Chrome',
        Evil: '<script>alert(1)</script>',
      },
    });

    expect(html).toContain('Browser');
    expect(html).toContain('Chrome');
    expect(html).toContain('Custom metadata');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('wraps data and feature tables in focusable scroll regions', async () => {
    const html = await renderReport(legacyTableFixture, { title: 'Tables' });

    expect(html).toContain('role="region" aria-label="Data table for:');
    expect(html).toContain('role="region" aria-label="Feature status matrix"');
  });

  it('renders filters only for statuses with scenarios', async () => {
    const html = await renderReport(passedOnlyFixture, { title: 'Passed only' });

    expect(html).toContain('data-status="passed"');
    expect(html).not.toMatch(
      /<button class="filter"[^>]+data-status="failed"/,
    );
    expect(html).not.toMatch(
      /<details class="scenario"[^>]+data-status="failed"/,
    );
  });

  it('renders a tag filter with sorted unique scenario tags', async () => {
    const html = await renderReport(fixture, { title: 'Tag filter' });
    const tableHtml = await renderReport(legacyTableFixture, {
      title: 'Tag filter table',
    });
    const options = [...tableHtml.matchAll(/<option value="(@[^"]*)">/g)].map(
      (match) => match[1],
    );

    expect(html).toContain('data-tag-filter');
    expect(html).toContain('<option value="">All tags</option>');
    expect(html).toContain('<option value="@failing">@failing</option>');
    expect(html).toContain('data-tags="@failing"');
    expect(options).toEqual([
      '@testAttachDebugData',
      '@testDataTable',
      '@testDocString',
      '@testPassing',
      '@testScenarioOutline',
    ]);
  });

  it('omits the tag filter when no scenario has tags', async () => {
    const html = await renderReport(minimalFixture, { title: 'No tags' });

    expect(html).not.toContain('<select data-tag-filter');
    expect(html).not.toContain('All tags');
  });

  it('ships the search highlight hook and styling', async () => {
    const html = await renderReport(fixture, { title: 'Highlight' });

    expect(html).toContain('CSS.highlights');
    expect(html).toContain("CSS.highlights.set('tolkira-search'");
    expect(html).toContain('new Highlight');
    expect(html).toContain('::highlight(tolkira-search)');
  });

  it('renders a copy failure button for failed scenarios only', async () => {
    const html = await renderReport(fixture, { title: 'Copy failure' });
    const passedHtml = await renderReport(passedOnlyFixture, {
      title: 'Copy failure passed',
    });

    expect(html).toContain('data-copy-failure');
    expect(html).toContain('>Copy failure</button>');
    expect(html).toMatch(/<li class="step" data-status="failed">/);
    expect(html.match(/class="copyFailure"/g)).toHaveLength(1);
    expect(passedHtml).not.toContain('class="copyFailure"');
    expect(passedHtml).not.toContain('>Copy failure</button>');
  });

  it('does not load external scripts or stylesheets', async () => {
    const html = await renderReport(fixture, { title: 'Offline' });

    expect(html).not.toMatch(/<script[^>]+src=["']https?:/i);
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
  });

  it('escapes untrusted feature, scenario and step names', async () => {
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          name: '<img src=x onerror=alert(1)>',
          elements: [
            {
              keyword: 'Scenario',
              name: '<script>alert(2)</script>',
              tags: ['<img src=x onerror=5>'],
              steps: [
                {
                  keyword: 'Given ',
                  name: '<svg onload=alert(3)>',
                  result: { status: 'passed', duration: 1 },
                },
              ],
            },
          ],
        },
      ]),
      'xss-names.json',
    );

    const html = await renderHtml(envelopes, { title: 'XSS names' });

    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).not.toContain('<svg onload=alert(3)>');
    expect(html).not.toContain('<img src=x onerror=5>');
  });

  it('does not render a malicious attachment file name as HTML', async () => {
    const lines = (await readFile(fixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const attachment = lines.find((line) => line.attachment)?.attachment as
      | Record<string, unknown>
      | undefined;
    if (attachment) {
      attachment.fileName = '<img src=x onerror=alert(4)>.png';
    }

    const envelopes = parseMessages(
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'malicious-name.ndjson',
    );
    const html = await renderHtml(envelopes, { title: 'Malicious name' });

    expect(html).not.toContain('<img src=x');
  });

  it('does not render a remote logo URL', async () => {
    const html = await renderReport(fixture, {
      title: 'Remote logo',
      logo: 'https://tolkira-probe.invalid/logo.png',
    });

    expect(html).not.toContain('tolkira-probe.invalid');
  });

  it('carries a restrictive content security policy', async () => {
    const html = await renderReport(fixture, { title: 'CSP' });

    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("script-src 'sha256-");
    expect(html).not.toMatch(/url\((?:https?:)?\/\//i);
  });

  it('normalizes absolute Messages URIs in the report', async () => {
    const lines = (await readFile(fixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map(
        (line) =>
          JSON.parse(line) as {
            gherkinDocument?: { uri?: string };
            pickle?: { uri?: string };
          },
      );
    const absolute = 'C:\\Users\\name\\proj\\features\\screenshot.feature';
    for (const line of lines) {
      if (line.gherkinDocument) line.gherkinDocument.uri = absolute;
      if (line.pickle) line.pickle.uri = absolute;
    }

    const envelopes = parseMessages(
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'absolute.ndjson',
    );
    const html = await renderHtml(envelopes, { title: 'Absolute URI' });

    expect(html).not.toContain('Users');
    expect(html).toContain('features/screenshot.feature');
  });

  it('defaults a missing Messages attempt to zero', async () => {
    const lines = (await readFile(fixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map(
        (line) =>
          JSON.parse(line) as {
            testCaseStarted?: { attempt?: number };
          },
      );
    for (const line of lines) {
      if (line.testCaseStarted) delete line.testCaseStarted.attempt;
    }

    const envelopes = parseMessages(
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'no-attempt.ndjson',
    );
    const model = buildReportModel(envelopes);
    const html = await renderHtml(envelopes, { title: 'No attempt' });

    expect(model.scenarios.every((scenario) => scenario.attempt === 0)).toBe(
      true,
    );
    expect(html).not.toContain('Attempt: NaN');
  });

  it('clamps negative message durations in the model', async () => {
    const lines = (await readFile(fixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map(
        (line) =>
          JSON.parse(line) as {
            testStepFinished?: { testStepResult: { duration: unknown } };
          },
      );
    for (const line of lines) {
      if (line.testStepFinished) {
        line.testStepFinished.testStepResult.duration = { seconds: -5, nanos: 0 };
      }
    }

    const envelopes = parseMessages(
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'negative-duration.ndjson',
    );
    const model = buildReportModel(envelopes);

    expect(model.durationMs).toBe(0);
    expect(model.scenarios.every((scenario) => scenario.durationMs === 0)).toBe(
      true,
    );
    expect(
      model.scenarios
        .flatMap((scenario) => scenario.steps)
        .every((step) => step.durationMs === 0),
    ).toBe(true);

    const html = await renderHtml(envelopes, { title: 'Negative duration' });
    expect(html).not.toContain('-5000');
    expect(html).toContain('0 ms');
  });
});

async function legacyEnvelopes(name: string, idPrefix: string) {
  const content = await readFile(
    fileURLToPath(new URL(`./fixtures/legacy/${name}`, import.meta.url)),
    'utf8',
  );
  return parseLegacyJson(content, name, { idPrefix });
}

function syntheticRun(
  features: Array<{
    name: string;
    uri?: string;
    scenarios: Array<{ name: string; status: string; message?: string }>;
  }>,
) {
  return parseLegacyJson(
    JSON.stringify(
      features.map((feature) => ({
        uri: feature.uri,
        name: feature.name,
        elements: feature.scenarios.map((scenario) => ({
          keyword: 'Scenario',
          type: 'scenario',
          name: scenario.name,
          steps: [
            {
              keyword: 'Given ',
              name: 'a step',
              result: {
                status: scenario.status,
                duration: 1,
                ...(scenario.message ? { error_message: scenario.message } : {}),
              },
            },
          ],
        })),
      })),
    ),
    'synthetic.json',
  );
}

function featureList(html: string): string {
  return html.slice(
    html.indexOf('id="feature-list"'),
    html.indexOf('id="empty-results"'),
  );
}

function matrixTable(html: string): string {
  const start = html.indexOf('<table class="featureTable">');
  return html.slice(start, html.indexOf('</table>', start));
}

describe('triage overview', () => {
  it('lists non-passing features and scenarios first', async () => {
    const html = await renderHtml(
      [
        ...(await legacyEnvelopes('behave.json', 'behave')),
        ...(await legacyEnvelopes('unhappy.json', 'unhappy')),
        ...(await legacyEnvelopes('failed.json', 'failed')),
      ],
      { title: 'Triage order' },
    );

    const list = featureList(html);
    const features = [...list.matchAll(/<h2>(.*?)<\/h2>/g)].map(
      (match) => match[1],
    );
    expect(features).toEqual([
      'Happy HTML reporting',
      'Unhappy HTML reporting',
      'Behave feature',
    ]);

    const unhappy = list.slice(
      list.indexOf('Unhappy HTML reporting'),
      list.indexOf('Behave feature'),
    );
    const scenarios = [...unhappy.matchAll(/<h3 class="scenarioName">(.*?)<\/h3>/g)].map(
      (match) => match[1],
    );
    expect(scenarios).toEqual([
      'Fred wants to see if steps are pending in the HTML report',
      'Fred wants to see if steps are undefined on the HTML report',
      'Fred wants to see if steps are skipped on the HTML report',
      'Fred wants to see a Screenshot attached to the HTML report',
    ]);
  });

  it('keeps the model in input order', async () => {
    const model = buildReportModel([
      ...(await legacyEnvelopes('behave.json', 'behave')),
      ...(await legacyEnvelopes('unhappy.json', 'unhappy')),
      ...(await legacyEnvelopes('failed.json', 'failed')),
    ]);

    expect(model.features.map((feature) => feature.name)).toEqual([
      'Behave feature',
      'Unhappy HTML reporting',
      'Happy HTML reporting',
    ]);
  });

  it('renders a needs-attention index with counts and anchors', async () => {
    const html = await renderHtml(
      [
        ...(await legacyEnvelopes('behave.json', 'behave')),
        ...(await legacyEnvelopes('unhappy.json', 'unhappy')),
        ...(await legacyEnvelopes('failed.json', 'failed')),
      ],
      { title: 'Triage index' },
    );

    expect(html).toContain('Needs attention');
    expect(html).toContain('4 of 11 scenarios need attention.');
    expect(html).toContain('href="#feature-1"');
    expect(html).toContain('href="#scenario-1-1"');
    expect(html).toContain('href="#scenario-2-1"');
    expect(html).toContain('1 failed');
    expect(html).toContain('2 undefined, 1 pending');
    expect(html).toContain('triageStatus fail">Failed');
    expect(html).toContain('triageStatus undefined">Undefined');
    expect(html).not.toContain('Behave feature</a>');
    const triage = html.slice(
      html.indexOf('class="triageBox"'),
      html.indexOf('id="feature-list"'),
    );
    expect(triage).toContain('First failure:');
    expect(triage).toContain('Expected values to be strictly equal');
  });

  it('omits the index when every scenario passed', async () => {
    const html = await renderHtml(await legacyEnvelopes('behave.json', 'behave'), {
      title: 'Clean run',
    });

    expect(html).not.toContain('Needs attention');
  });

  it('omits features without scenarios from list and matrix', async () => {
    const html = await renderHtml(
      syntheticRun([
        { name: 'Empty feature', scenarios: [] },
        {
          name: 'Broken feature',
          scenarios: [{ name: 'fails', status: 'failed' }],
        },
      ]),
      { title: 'Featureless run' },
    );

    const list = featureList(html);
    expect(list).not.toContain('Empty feature');
    expect(list).toContain('Broken feature');
    expect(matrixTable(html)).not.toContain('Empty feature');
  });

  it('treats a passed and unknown feature as needing attention', async () => {
    const html = await renderHtml(
      syntheticRun([
        {
          name: 'Passed feature',
          scenarios: [{ name: 'ok', status: 'passed' }],
        },
        {
          name: 'Mixed feature',
          scenarios: [
            { name: 'passes', status: 'passed' },
            { name: 'unknown', status: 'unknown' },
          ],
        },
      ]),
      { title: 'Mixed unknown',
        provenance: new Map([
          ['features/legacy-1.feature', 'mixed.json'],
          ['features/legacy-0.feature', 'passed.json'],
        ]),
      },
    );

    const names = [...featureList(html).matchAll(/<h2>(.*?)<\/h2>/g)].map(
      (match) => match[1],
    );
    expect(names).toEqual(['Mixed feature', 'Passed feature']);
    expect(html).toContain('1 of 2 passed · 1 unknown');
    expect(html).toContain('1 of 3 scenarios needs attention.');
    expect(html).toContain('<span class="triageStatus unknown">Unknown</span>');
    const sources = html.slice(
      html.indexOf('class="sources"'),
      html.indexOf('id="feature-list"'),
    );
    expect(sources).toContain('triageStatus unknown">Unknown');
  });

  it("keeps the JSON summary's documented order", async () => {
    const summary = summarizeEnvelopes([
      ...(await legacyEnvelopes('behave.json', 'behave')),
      ...(await legacyEnvelopes('unhappy.json', 'unhappy')),
      ...(await legacyEnvelopes('failed.json', 'failed')),
    ]);

    expect(summary.scenarios.map((scenario) => scenario.feature)).toEqual([
      'Behave feature',
      ...Array(6).fill('Happy HTML reporting'),
      ...Array(4).fill('Unhappy HTML reporting'),
    ]);
  });

  it('caps feature rows and scenario links', async () => {
    const many = syntheticRun(
      Array.from({ length: 21 }, (_, index) => ({
        name: `Feature ${index + 1}`,
        scenarios: [{ name: `Scenario ${index + 1}`, status: 'failed' }],
      })),
    );
    const manyHtml = await renderHtml(many, { title: 'Many features' });
    expect(manyHtml.match(/class="triageItem"/g) ?? []).toHaveLength(20);
    expect(manyHtml).toContain('Show 15 more features');
    expect(manyHtml).toContain('1 more feature below');

    const twenty = syntheticRun(
      Array.from({ length: 20 }, (_, index) => ({
        name: `Feature ${index + 1}`,
        scenarios: [{ name: `Scenario ${index + 1}`, status: 'failed' }],
      })),
    );
    const twentyHtml = await renderHtml(twenty, { title: 'Twenty features' });
    expect(twentyHtml.match(/class="triageItem"/g) ?? []).toHaveLength(20);
    expect(twentyHtml).toContain('Show 15 more features');
    expect(twentyHtml).not.toContain('more feature below');

    const noisy = syntheticRun([
      {
        name: 'Noisy feature',
        scenarios: Array.from({ length: 4 }, (_, index) => ({
          name: `Scenario ${index + 1}`,
          status: 'failed',
        })),
      },
    ]);
    const noisyHtml = await renderHtml(noisy, { title: 'Many failures' });
    expect(noisyHtml.match(/class="triageScenario"/g) ?? []).toHaveLength(3);
    expect(noisyHtml).toContain('+1 more in the report');

    const three = syntheticRun([
      {
        name: 'Three failures',
        scenarios: Array.from({ length: 3 }, (_, index) => ({
          name: `Scenario ${index + 1}`,
          status: 'failed',
        })),
      },
    ]);
    const threeHtml = await renderHtml(three, { title: 'Three failures' });
    expect(threeHtml.match(/class="triageScenario"/g) ?? []).toHaveLength(3);
    expect(threeHtml).not.toContain('more in the report');

    const six = syntheticRun(
      Array.from({ length: 6 }, (_, index) => ({
        name: `Feature ${index + 1}`,
        scenarios: [{ name: `Scenario ${index + 1}`, status: 'failed' }],
      })),
    );
    const sixHtml = await renderHtml(six, { title: 'Six features' });
    expect(sixHtml.match(/class="triageItem"/g) ?? []).toHaveLength(6);
    expect(sixHtml).toContain('Show 1 more feature');
  });

  it('caps failure text in the search index', async () => {
    const long = 'x'.repeat(5000);
    const html = await renderHtml(
      syntheticRun([
        {
          name: 'Long error',
          scenarios: [{ name: 'fails', status: 'failed', message: long }],
        },
      ]),
      { title: 'Long error' },
    );
    const dataSearch = html.match(/data-search="([^"]*)"/)?.[1] ?? '';

    expect(dataSearch.length).toBeLessThan(4000);
    expect(html).toContain(long);
  });

  it('escapes untrusted names in the index', async () => {
    const html = await renderHtml(
      syntheticRun([
        {
          name: '<img src=x onerror=alert(1)>',
          scenarios: [{ name: '<script>alert(2)</script>', status: 'failed' }],
        },
      ]),
      { title: 'Hostile triage' },
    );

    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).toContain('&lt;img src=x');
  });
});

describe('feature overview and matrix', () => {
  async function mixedReport(): Promise<string> {
    return renderHtml(
      [
        ...(await legacyEnvelopes('behave.json', 'behave')),
        ...(await legacyEnvelopes('unhappy.json', 'unhappy')),
        ...(await legacyEnvelopes('failed.json', 'failed')),
      ],
      { title: 'Feature overview' },
    );
  }

  it('names every non-passing status in a feature row', async () => {
    const html = await renderHtml(
      syntheticRun([
        {
          name: 'Mixed row',
          scenarios: [
            { name: 'passes', status: 'passed' },
            { name: 'fails', status: 'failed' },
            { name: 'waits', status: 'pending' },
          ],
        },
      ]),
      { title: 'Mixed row' },
    );
    const list = featureList(html);

    expect(list).toContain('1 of 3 passed · 1 failed, 1 pending');
    const bar = list.slice(list.indexOf('class="bar"'));
    expect(bar.indexOf('class="pass"')).toBeLessThan(
      bar.indexOf('class="fail"'),
    );
    expect(bar.indexOf('class="fail"')).toBeLessThan(
      bar.indexOf('class="pending"'),
    );
  });

  it('shows counts and a proportion bar on each feature row', async () => {
    const list = featureList(await mixedReport());

    const happy = list.slice(
      list.indexOf('Happy HTML reporting'),
      list.indexOf('Unhappy HTML reporting'),
    );
    expect(happy).toContain('5 of 6 passed · 1 failed');
    expect(happy.match(/<i class="(pass|fail)"/g) ?? []).toHaveLength(2);
    const bar = happy.slice(happy.indexOf('class="bar"'));
    expect(bar.indexOf('class="pass"')).toBeLessThan(
      bar.indexOf('class="fail"'),
    );
    expect(happy).toContain('class="featureUri"');

    const behave = list.slice(list.indexOf('Behave feature'));
    expect(behave).toContain('1 of 1 passed');
    expect(behave.match(/<i class="pass"/g) ?? []).toHaveLength(1);
    expect(behave).not.toContain('passed ·');
  });

  it('renders a feature by status matrix in Details', async () => {
    const matrix = matrixTable(await mixedReport());
    const headers = [...matrix.matchAll(/<th>(.*?)<\/th>/g)].map(
      (match) => match[1],
    );
    expect(headers).toEqual([
      'Feature',
      'Total',
      'Failed',
      'Undefined',
      'Pending',
      'Passed',
      'Duration',
    ]);

    const names = [
      ...matrix.matchAll(
        /<tr><th scope="row"><span class="matrixName">(.*?)<\/span>/g,
      ),
    ].map((match) => match[1]);
    expect(names).toEqual([
      'Behave feature',
      'Unhappy HTML reporting',
      'Happy HTML reporting',
    ]);

    const row = matrix.match(
      /<tr><th scope="row"><span class="matrixName">Happy HTML reporting<\/span>.*?<\/tr>/,
    )?.[0];
    expect(row).toBeDefined();
    const cells = [...row!.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(
      (match) => match[1],
    );
    expect(cells.slice(0, 5)).toEqual(['6', '1', '0', '0', '5']);
    expect(cells[5]).toMatch(/^\d+(\.\d+)? (ms|s)$/);
    expect(matrix).toContain('class="num zero"');
  });

  it('shows only present status columns in the matrix', async () => {
    const html = await renderHtml(
      await legacyEnvelopes('behave.json', 'behave'),
      { title: 'Clean matrix' },
    );
    const headers = [...matrixTable(html).matchAll(/<th>(.*?)<\/th>/g)].map(
      (match) => match[1],
    );
    expect(headers).toEqual(['Feature', 'Total', 'Passed', 'Duration']);
  });
});

function scenarioOpeningTag(html: string, name: string): string {
  const marker = `data-scenario-name="${name}"`;
  const index = html.indexOf(marker);
  expect(index, `scenario ${name}`).toBeGreaterThan(-1);
  const start = html.lastIndexOf('<details class="scenario"', index);
  return html.slice(start, html.indexOf('>', index) + 1);
}

function featureOpeningTag(html: string): string {
  const start = html.indexOf('<details class="feature');
  return html.slice(start, html.indexOf('>', start) + 1);
}

describe('parity diagnostics rendering', () => {
  it('renders an undefined-step snippet', async () => {
    const html = await renderReport(undefinedFixture, { title: 'Undefined' });

    expect(html).toContain('data-diagnostic="undefined"');
    expect(html).toContain(
      'No step definition found. Implement with the snippet(s) below:',
    );
    expect(html).toContain('class="snippet"');
    expect(html).toContain(
      'Given(&quot;a step that is yet to be defined&quot;, () =&gt; {',
    );
  });

  it('renders every suggestion with its language label', async () => {
    const html = await renderReport(undefinedFixture, { title: 'Snippets' });

    expect(html).toContain('a list of {int} things');
    expect(html).toContain('a list of {float} things');
    expect(html).toContain('class="snippetLang">typescript');
  });

  it('renders the undefined lead without snippet data', async () => {
    const envelopes = parseMessages(
      await readFile(undefinedFixture, 'utf8'),
      undefinedFixture,
    ).filter((envelope) => !envelope.suggestion);
    const html = await renderHtml(envelopes, { title: 'No snippets' });

    expect(html).toContain('No step definition found.');
    expect(html).not.toContain('Implement with the snippet(s) below:');
    expect(html).not.toContain('class="snippet"');
  });

  it('renders ambiguous patterns with relative source references', async () => {
    const html = await renderReport(ambiguousFixture, { title: 'Ambiguous' });

    expect(html).toContain('data-diagnostic="ambiguous"');
    expect(html).toContain('Multiple matching step definitions found:');
    expect(html).toContain('^a (.*?) with (.*?)$');
    expect(html).toContain('^a step with (.*?)$');
    expect(html).toContain('samples/ambiguous/ambiguous.ts:3');
    expect(html).toContain('samples/ambiguous/ambiguous.ts:7');
  });

  it('renders the ambiguous lead without definition data', async () => {
    const envelopes = parseMessages(
      await readFile(ambiguousFixture, 'utf8'),
      ambiguousFixture,
    ).filter((envelope) => !envelope.stepDefinition);
    const html = await renderHtml(envelopes, { title: 'No definitions' });

    expect(html).toContain('Multiple matching step definitions found:');
    expect(html).not.toContain('class="definitions"');
  });

  it('shows the ambiguous lead for legacy input without definitions', async () => {
    const html = await renderReport(legacyAmbiguousFixture, {
      title: 'Legacy ambiguous',
    });

    expect(scenarioOpeningTag(html, 'Ambiguous legacy step')).toContain(' open>');
    expect(html).toContain('data-diagnostic="ambiguous"');
    expect(html).toContain('Multiple matching step definitions found:');
    expect(html).not.toContain('class="definitions"');
    expect(html).not.toContain('<code class="definitionPattern">');
  });

  it('reduces absolute definition sources to the report-relative form', async () => {
    const envelopes = parseMessages(
      await readFile(ambiguousFixture, 'utf8'),
      ambiguousFixture,
    );
    const definition = envelopes.find(
      (envelope) => envelope.stepDefinition,
    )?.stepDefinition;
    expect(definition).toBeDefined();
    if (!definition) return;
    definition.sourceReference.uri =
      'C:\\Users\\name\\proj\\features\\ambiguous.ts';

    const html = await renderHtml(envelopes, { title: 'Absolute source' });

    expect(html).toContain('features/ambiguous.ts:3');
    expect(html).not.toContain('Users');
  });

  it('escapes snippets, patterns and source references', async () => {
    const undefinedEnvelopes = parseMessages(
      await readFile(undefinedFixture, 'utf8'),
      undefinedFixture,
    );
    const suggestion = undefinedEnvelopes.find(
      (envelope) => envelope.suggestion,
    )?.suggestion;
    expect(suggestion).toBeDefined();
    if (suggestion) {
      suggestion.snippets[0].code = '<script>alert(1)</script>';
    }
    const undefinedHtml = await renderHtml(undefinedEnvelopes, {
      title: 'Escaped snippets',
    });

    expect(undefinedHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(undefinedHtml).not.toContain('<script>alert(1)</script>');

    const ambiguousEnvelopes = parseMessages(
      await readFile(ambiguousFixture, 'utf8'),
      ambiguousFixture,
    );
    const definition = ambiguousEnvelopes.find(
      (envelope) => envelope.stepDefinition,
    )?.stepDefinition;
    expect(definition).toBeDefined();
    if (!definition) return;
    definition.pattern.source = '<img src=x onerror=alert(2)>';
    definition.sourceReference.uri = '"><svg onload=alert(3)>';
    const ambiguousHtml = await renderHtml(ambiguousEnvelopes, {
      title: 'Escaped definitions',
    });

    expect(ambiguousHtml).toContain(
      '&lt;img src=x onerror=alert(2)&gt;',
    );
    expect(ambiguousHtml).not.toContain('<img src=x');
    expect(ambiguousHtml).toContain(
      '&quot;&gt;&lt;svg onload=alert(3)&gt;',
    );
    expect(ambiguousHtml).not.toContain('<svg onload');
  });

  it('does not render a diagnostic on a passed step with definitions', async () => {
    const html = await renderReport(undefinedFixture, { title: 'Passed step' });
    const marker = html.indexOf('an implemented step</div>');
    expect(marker).toBeGreaterThan(-1);
    const start = html.lastIndexOf('<li class="step"', marker);
    const end = html.indexOf('</li>', marker);
    const passedStep = html.slice(start, end);

    expect(passedStep).toContain('an implemented step');
    expect(passedStep).not.toContain('data-diagnostic');
    expect(html.match(/<div class="diagnostic"/g) ?? []).toHaveLength(4);
  });

  it('indexes diagnostic snippets and patterns for search', async () => {
    const undefinedHtml = await renderReport(undefinedFixture, {
      title: 'Search snippets',
    });
    const undefinedSearch =
      undefinedHtml.match(
        /data-scenario-name="Snippets reflect parameter types"[^>]*data-search="([^"]*)"/,
      )?.[1] ?? '';
    expect(undefinedSearch).toContain('No step definition found.');
    expect(undefinedSearch).toContain('a list of {int} things');
    expect(undefinedSearch).toContain('a list of {float} things');

    const ambiguousHtml = await renderReport(ambiguousFixture, {
      title: 'Search patterns',
    });
    const ambiguousSearch =
      ambiguousHtml.match(
        /data-scenario-name="Multiple step definitions for a step"[^>]*data-search="([^"]*)"/,
      )?.[1] ?? '';
    expect(ambiguousSearch).toContain('Multiple matching step definitions found:');
    expect(ambiguousSearch).toContain('^a (.*?) with (.*?)$');
    expect(ambiguousSearch).toContain('samples/ambiguous/ambiguous.ts:3');
  });

  it('keeps model and summary scenario counts in parity', async () => {
    const envelopes = parseMessages(
      await readFile(allStatusesFixture, 'utf8'),
      allStatusesFixture,
    );
    const model = buildReportModel(envelopes);
    const summary = summarizeEnvelopes(envelopes);

    expect(model.counts.scenarios).toEqual(summary.counts.scenarios);
  });

  it('caps diagnostic text in the search index', async () => {
    const envelopes = parseMessages(
      await readFile(ambiguousFixture, 'utf8'),
      ambiguousFixture,
    );
    const definition = envelopes.find(
      (envelope) => envelope.stepDefinition,
    )?.stepDefinition;
    expect(definition).toBeDefined();
    if (!definition) return;
    const long = 'x'.repeat(5000);
    definition.pattern.source = long;

    const html = await renderHtml(envelopes, { title: 'Long pattern' });
    const dataSearch = html.match(/data-search="([^"]*)"/)?.[1] ?? '';

    expect(dataSearch.length).toBeLessThan(4000);
    expect(html).toContain(long);
  });
});

describe('default open state', () => {
  it('opens non-passed features and scenarios and keeps passed ones collapsed', async () => {
    const html = await renderReport(allStatusesFixture, {
      title: 'All statuses',
    });

    expect(featureOpeningTag(html)).toContain(' open>');
    for (const name of ['Failing', 'Pending', 'Skipped', 'Undefined', 'Ambiguous']) {
      expect(scenarioOpeningTag(html, name), name).toContain(' open>');
    }
    expect(scenarioOpeningTag(html, 'Passing')).not.toContain(' open>');
  });

  it('opens an unknown scenario and its feature', async () => {
    const html = await renderHtml(
      syntheticRun([
        {
          name: 'Unknown feature',
          scenarios: [{ name: 'Unknown scenario', status: 'unknown' }],
        },
      ]),
      { title: 'Unknown' },
    );

    expect(featureOpeningTag(html)).toContain(' open>');
    expect(scenarioOpeningTag(html, 'Unknown scenario')).toContain(' open>');
  });

  it('keeps passed scenarios without images collapsed', async () => {
    const html = await renderReport(minimalFixture, { title: 'Passed only' });

    expect(html.match(/<details class="scenario"[^>]* open>/g) ?? []).toHaveLength(
      0,
    );
  });

  it('opens non-passed legacy and JUnit rows without diagnostics', async () => {
    const legacyHtml = await renderReport(unhappyFixture, {
      title: 'Legacy open',
    });
    expect(
      scenarioOpeningTag(
        legacyHtml,
        'Fred wants to see if steps are undefined on the HTML report',
      ),
    ).toContain(' open>');
    expect(legacyHtml).toContain('No step definition found.');
    expect(legacyHtml).not.toContain('class="snippet"');
    expect(legacyHtml).not.toContain(
      '<div class="diagnostic" data-diagnostic="ambiguous"',
    );

    const junitHtml = await renderReport(junitFixture, { title: 'JUnit open' });
    expect(scenarioOpeningTag(junitHtml, 'slow payment')).toContain(' open>');
    expect(junitHtml).not.toContain('<div class="diagnostic"');
  });

  it('renders 1000 non-passed scenarios with every row open', async () => {
    const run = syntheticRun([
      {
        name: 'Mass failure feature',
        scenarios: Array.from({ length: 1000 }, (_, index) => ({
          name: `Scenario ${index + 1}`,
          status: 'undefined',
        })),
      },
    ]);
    const html = await renderHtml(run, { title: 'Stress non-passed' });

    expect(
      html.match(/<details class="scenario"[^>]* open>/g) ?? [],
    ).toHaveLength(1000);
    expect(html.length).toBeLessThan(5 * 1024 * 1024);
  });
});

describe('source strip', () => {
  const provenance = new Map([
    ['features/behave.feature', 'behave.json'],
    ['features/unhappy.feature', 'unhappy.json'],
    ['features/happy.feature', 'failed.json'],
  ]);

  async function mixedEnvelopes() {
    return [
      ...(await legacyEnvelopes('behave.json', 'behave')),
      ...(await legacyEnvelopes('unhappy.json', 'unhappy')),
      ...(await legacyEnvelopes('failed.json', 'failed')),
    ];
  }

  it('renders one card per input, worst first', async () => {
    const envelopes = await mixedEnvelopes();
    const html = await renderHtml(envelopes, {
      title: 'Sources',
      provenance,
    });
    const strip = html.slice(
      html.indexOf('class="sources"'),
      html.indexOf('id="feature-list"'),
    );

    expect(
      [...strip.matchAll(/class="sourceName">(.*?)<\/span>/g)].map(
        (match) => match[1],
      ),
    ).toEqual(['failed.json', 'unhappy.json', 'behave.json']);
    expect(strip).toContain('1 feature · 6 scenarios · 1 failed');
    expect(strip).toContain('1 feature · 1 scenario');

    const model = buildReportModel(envelopes, provenance);
    expect(
      model.features.find((feature) => feature.name === 'Happy HTML reporting')
        ?.sourceFile,
    ).toBe('failed.json');
  });

  it('escapes hostile source file names', async () => {
    const html = await renderHtml(await mixedEnvelopes(), {
      title: 'Hostile source',
      provenance: new Map([
        ['features/behave.feature', '"><img src=x onerror=alert(1)>.json'],
        ['features/unhappy.feature', 'unhappy.json'],
        ['features/happy.feature', 'failed.json'],
      ]),
    });

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('omits the strip when provenance is incomplete', async () => {
    const html = await renderHtml(await mixedEnvelopes(), {
      title: 'Partial sources',
      provenance: new Map([['features/happy.feature', 'failed.json']]),
    });

    expect(html).not.toContain('class="sources"');
    expect(html).not.toContain('class="featureSource"');
  });

  it('omits the strip for a single input file', async () => {
    const html = await renderHtml(
      await legacyEnvelopes('behave.json', 'behave'),
      {
        title: 'Single source',
        provenance: new Map([['features/behave.feature', 'behave.json']]),
      },
    );

    expect(html).not.toContain('class="sources"');
  });

  it('caps source cards and states the remainder', async () => {
    const run = syntheticRun(
      Array.from({ length: 21 }, (_, index) => ({
        name: `Source ${index + 1}`,
        uri: `features/source-${index + 1}.feature`,
        scenarios: [{ name: 'ok', status: 'passed' }],
      })),
    );
    const provenance = new Map(
      Array.from({ length: 21 }, (_, index) => [
        `features/source-${index + 1}.feature`,
        `source-${index + 1}.json`,
      ]),
    );
    const html = await renderHtml(run, {
      title: 'Many sources',
      provenance,
    });

    expect(html.match(/class="sourceItem"/g) ?? []).toHaveLength(6);
    expect(html).toContain('15 more inputs');
  });
});

function scenarioSummary(html: string, name: string): string {
  const marker = `data-scenario-name="${name}"`;
  const index = html.indexOf(marker);
  if (index < 0) return '';
  const start = html.lastIndexOf('<details class="scenario"', index);
  return html.slice(
    html.indexOf('>', start) + 1,
    html.indexOf('</summary>', index),
  );
}

function sectionAt(html: string, start: number): string {
  let depth = 0;
  let index = start;
  while (index < html.length) {
    const open = html.indexOf('<section', index);
    const close = html.indexOf('</section>', index);
    if (close < 0) return html.slice(start);
    if (open >= 0 && open < close) {
      depth += 1;
      index = open + 8;
    } else {
      depth -= 1;
      index = close + 10;
      if (depth === 0) return html.slice(start, index);
    }
  }
  return html.slice(start);
}

function failPickle(
  envelopes: ReturnType<typeof parseMessages>,
  name: string,
): void {
  const pickle = envelopes.find((envelope) => envelope.pickle?.name === name)
    ?.pickle;
  const testCase = envelopes.find(
    (envelope) => envelope.testCase?.pickleId === pickle?.id,
  )?.testCase;
  const started = envelopes.find(
    (envelope) => envelope.testCaseStarted?.testCaseId === testCase?.id,
  )?.testCaseStarted;
  const step = testCase?.testSteps.find((entry) => entry.pickleStepId);
  const finished = envelopes.find(
    (envelope) =>
      envelope.testStepFinished?.testCaseStartedId === started?.id &&
      envelope.testStepFinished?.testStepId === step?.id,
  )?.testStepFinished;
  if (finished) finished.testStepResult.status = TestStepResultStatus.FAILED;
}

describe('parity rules rendering', () => {
  it('renders feature and rule tags once and keeps inherited tags off rows', async () => {
    const html = await renderMessagesFile(tagsFixture);

    expect(html.match(/class="tag">@feature-tag/g)).toHaveLength(1);
    expect(html.match(/class="tag">@rule-tag/g)).toHaveLength(1);
    expect(html.match(/class="tag">@scenario-tag/g)).toHaveLength(1);
    expect(html.match(/class="tag">@some-tag/g)).toHaveLength(1);

    const featureHead = html.slice(
      html.indexOf('<details class="feature'),
      html.indexOf('</summary>'),
    );
    expect(featureHead).toContain('@feature-tag');
    expect(featureHead).not.toContain('@rule-tag');

    const tagged = scenarioSummary(html, 'tagged scenario');
    expect(tagged).toContain('@scenario-tag');
    expect(tagged).not.toContain('@feature-tag');
    expect(tagged).not.toContain('@rule-tag');
    expect(tagged).not.toContain('@some-tag');

    const inheritedOnly = scenarioSummary(html, 'Enough money');
    expect(inheritedOnly).not.toContain('@feature-tag');
    expect(inheritedOnly).not.toContain('@rule-tag');

    const firstRule = sectionAt(html, html.indexOf('<section class="rule"'));
    expect(firstRule).toContain('class="tag">@rule-tag');
    expect(firstRule).not.toContain('class="tag">@feature-tag');

    expect(html.match(/data-tags="[^"]*@feature-tag/g)).not.toBeNull();
    expect(html.match(/data-tags="[^"]*@rule-tag/g)).not.toBeNull();
  });

  it('renders rule sections with heading and their scenarios', async () => {
    const html = await renderMessagesFile(rulesFixture);

    expect(html.match(/<section class="rule" data-rule/g)).toHaveLength(2);
    expect(html).toContain(
      'Rule:</span> A sale cannot happen if the customer does not have enough money',
    );
    expect(html).toContain(
      'Rule:</span> a sale cannot happen if there is no stock',
    );

    const firstStart = html.indexOf('<section class="rule"');
    const first = sectionAt(html, firstStart);
    expect(first).toContain('Not enough money');
    expect(first).toContain('Enough money');
    expect(first).not.toContain('No chocolates left');
    expect(first).not.toContain('@some-tag');

    const secondStart = html.indexOf(
      '<section class="rule"',
      firstStart + 1,
    );
    const second = sectionAt(html, secondStart);
    expect(second).toContain('@some-tag');
    expect(second).toContain('No chocolates left');
  });

  it('keeps an outline inside its rule section', async () => {
    const envelopes = parseMessages(
      await readFile(examplesTables, 'utf8'),
      examplesTables,
    );
    const feature = envelopes.find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument?.feature;
    const child = feature?.children.find(
      (entry) =>
        entry.scenario?.name === 'Eating cucumbers with <friends> friends',
    );
    expect(feature).toBeDefined();
    expect(child).toBeDefined();
    if (!feature || !child?.scenario) return;

    const children = feature.children as unknown as Array<
      (typeof feature.children)[number]
    >;
    const index = children.indexOf(child);
    children[index] = {
      rule: {
        id: 'rule-outline',
        keyword: 'Rule',
        name: 'Outline rule',
        description: 'Outline rule description.',
        tags: [
          {
            id: 'rule-outline-tag',
            name: '@rule-outline',
            location: { line: 1, column: 1 },
          },
        ],
        location: { line: 1, column: 1 },
        children: [{ scenario: child.scenario }],
      },
    };

    const html = await renderHtml(envelopes, { title: 'Rule outline' });
    const start = html.indexOf('<section class="rule"');
    const ruleHtml = sectionAt(html, start);

    expect(start).toBeGreaterThan(-1);
    expect(ruleHtml).toContain('@rule-outline');
    expect(ruleHtml).toContain('Outline rule description.');
    expect(ruleHtml).toContain('<section class="outline"');
    expect(ruleHtml).toContain(
      'Scenario Outline:</span> Eating cucumbers with &lt;friends&gt; friends',
    );
    expect(ruleHtml.match(/<section class="examples"/g)).toHaveLength(1);
    expect(ruleHtml.match(/class="exampleNo"/g)).toHaveLength(3);
  });

  it('orders top-level items by severity without crossing rule boundaries', async () => {
    const envelopes = parseMessages(
      await readFile(rulesFixture, 'utf8'),
      rulesFixture,
    );
    const feature = envelopes.find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument?.feature;
    expect(feature).toBeDefined();
    if (!feature) return;
    const children = feature.children as unknown as Array<
      (typeof feature.children)[number]
    >;
    const ruleChild = children.find((entry) => entry.rule);
    const scenarioChild = ruleChild?.rule?.children.find(
      (entry) => entry.scenario,
    );
    expect(ruleChild?.rule).toBeDefined();
    expect(scenarioChild?.scenario).toBeDefined();
    if (!ruleChild?.rule || !scenarioChild?.scenario) return;
    ruleChild.rule.children = ruleChild.rule.children.filter(
      (entry) => entry !== scenarioChild,
    );
    children.unshift({ scenario: scenarioChild.scenario });

    failPickle(envelopes, 'Enough money');
    const html = await renderHtml(envelopes, { title: 'Mixed order' });
    const ruleStart = html.indexOf('<section class="rule"');
    const featureScenario = html.indexOf(
      'data-scenario-name="Not enough money"',
    );

    expect(ruleStart).toBeGreaterThan(-1);
    expect(featureScenario).toBeGreaterThan(-1);
    expect(ruleStart).toBeLessThan(featureScenario);

    const ruleHtml = sectionAt(html, ruleStart);
    expect(ruleHtml).toContain('data-scenario-name="Enough money"');
    expect(ruleHtml).not.toContain('data-scenario-name="Not enough money"');
  });

  it('renders no background heading for a legacy synthetic background', async () => {
    const html = await renderReport(passedOnlyFixture, {
      title: 'Legacy background',
    });

    expect(html).not.toContain('<section class="background" data-background>');
    expect(html).not.toContain('Shared setup');
  });

  it('omits empty background headings and keeps background steps once', async () => {
    const html = await renderMessagesFile(backgroundsFixture);

    expect(html).not.toContain('<section class="background"');
    expect(
      html.match(/<\/span> an order for &quot;eggs&quot;<\/div>/g),
    ).toHaveLength(2);
    expect(
      html.match(/<\/span> an order for &quot;milk&quot;<\/div>/g),
    ).toHaveLength(2);
    expect(html.match(/<\/span> an action<\/div>/g)).toHaveLength(2);
  });

  it('renders a feature background heading and description once', async () => {
    const envelopes = parseMessages(
      await readFile(backgroundsFixture, 'utf8'),
      backgroundsFixture,
    );
    const background = envelopes
      .find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument?.feature?.children.find((child) => child.background)
      ?.background;
    expect(background).toBeDefined();
    if (!background) return;
    background.name = 'Shared order';
    background.description = 'Order setup.';

    const html = await renderHtml(envelopes, { title: 'Feature background' });
    expect(html.match(/<section class="background"/g)).toHaveLength(1);
    expect(html).toContain('Background:</span> Shared order');
    expect(html).toContain('Order setup.');
    expect(
      html.match(/<\/span> an order for &quot;eggs&quot;<\/div>/g),
    ).toHaveLength(2);
    expect(
      html.match(/<\/span> an order for &quot;milk&quot;<\/div>/g),
    ).toHaveLength(2);
  });

  it('renders rule background headings inside the rule section', async () => {
    const envelopes = parseMessages(
      await readFile(rulesBackgroundsFixture, 'utf8'),
      rulesBackgroundsFixture,
    );
    const feature = envelopes.find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument?.feature;
    expect(feature).toBeDefined();
    if (!feature) return;
    const featureBackground = feature.children.find((child) => child.background)
      ?.background;
    const ruleChild = feature.children.find((child) => child.rule);
    const rule = ruleChild?.rule;
    const ruleBackground = rule?.children.find((child) => child.background)
      ?.background;
    expect(featureBackground).toBeDefined();
    expect(rule).toBeDefined();
    expect(ruleBackground).toBeDefined();
    if (!featureBackground || !rule || !ruleBackground) return;
    featureBackground.name = 'Feature setup';
    featureBackground.description = 'Feature setup description.';
    ruleBackground.name = 'Rule setup';
    ruleBackground.description = 'Rule setup description.';
    rule.name = 'Searchable rule';
    rule.description = 'A rule description.';
    rule.tags = [
      {
        id: 'rule-search-tag',
        name: '@rule-search',
        location: { line: 1, column: 1 },
      },
    ];

    const html = await renderHtml(envelopes, { title: 'Rule background' });
    expect(html.match(/<section class="background"/g)).toHaveLength(2);
    expect(html).toContain('Background:</span> Feature setup');
    expect(html).toContain('Background:</span> Rule setup');

    const ruleStart = html.indexOf('<section class="rule"');
    const ruleHtml = sectionAt(html, ruleStart);
    expect(ruleHtml).toContain('Background:</span> Rule setup');
    expect(ruleHtml).toContain('Rule setup description.');
    expect(ruleHtml).not.toContain('Background:</span> Feature setup');
    expect(ruleHtml).not.toContain('Feature setup description.');

    const ruleSearch =
      html.match(
        /<section class="rule" data-rule data-search="([^"]*)"/,
      )?.[1] ?? '';
    expect(ruleSearch).toContain('Searchable rule');
    expect(ruleSearch).toContain('A rule description.');
    expect(ruleSearch).toContain('@rule-search');
    expect(ruleSearch).toContain('Rule setup');
    expect(ruleSearch).toContain('Rule setup description.');

    const featureSearch =
      html.match(/data-background-search="([^"]*)"/)?.[1] ?? '';
    expect(featureSearch).toContain('Feature setup');
    expect(featureSearch).toContain('Feature setup description.');
  });

  it('leaves rule and background keywords out of the search index', async () => {
    const html = await renderMessagesFile(rulesBackgroundsFixture);

    const ruleSearch =
      html.match(
        /<section class="rule" data-rule data-search="([^"]*)"/,
      )?.[1] ?? '';
    expect(ruleSearch.trim()).toBe('');
    expect(ruleSearch.toLowerCase()).not.toContain('rule');

    const featureSearch =
      html.match(/data-background-search="([^"]*)"/)?.[1] ?? '';
    expect(featureSearch.trim()).toBe('');
    expect(featureSearch.toLowerCase()).not.toContain('background');
  });

  it('escapes rule and background text', async () => {
    const envelopes = parseMessages(
      await readFile(rulesBackgroundsFixture, 'utf8'),
      rulesBackgroundsFixture,
    );
    const feature = envelopes.find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument?.feature;
    expect(feature).toBeDefined();
    if (!feature) return;
    const featureBackground = feature.children.find((child) => child.background)
      ?.background;
    const rule = feature.children.find((child) => child.rule)?.rule;
    const ruleBackground = rule?.children.find((child) => child.background)
      ?.background;
    expect(featureBackground).toBeDefined();
    expect(rule).toBeDefined();
    expect(ruleBackground).toBeDefined();
    if (!featureBackground || !rule || !ruleBackground) return;
    featureBackground.name = '<img src=x onerror=alert(1)>';
    featureBackground.description = '<script>feature background</script>';
    rule.name = '<script>rule</script>';
    rule.description = '<svg onload=alert(2)>';
    rule.tags = [
      {
        id: 'xss-tag',
        name: '@<img src=x onerror=alert(3)>',
        location: { line: 1, column: 1 },
      },
    ];
    ruleBackground.name = '<script>rule background</script>';
    ruleBackground.description = '<img src=x onerror=alert(4)>';

    const html = await renderHtml(envelopes, { title: 'Escaped rules' });
    expect(html).not.toContain('<script>rule</script>');
    expect(html).not.toContain('<script>feature background</script>');
    expect(html).not.toContain('<script>rule background</script>');
    expect(html).not.toContain('<svg onload=alert(2)>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;rule&lt;/script&gt;');
    expect(html).toContain('&lt;script&gt;feature background&lt;/script&gt;');
    expect(html).toContain('&lt;script&gt;rule background&lt;/script&gt;');
    expect(html).toContain('&lt;svg onload=alert(2)&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('keeps counts, triage, matrix, tags and summary in parity', async () => {
    const envelopes = parseMessages(
      await readFile(tagsFixture, 'utf8'),
      tagsFixture,
    );
    failPickle(envelopes, 'tagged scenario');

    const model = buildReportModel(envelopes);
    const summary = summarizeEnvelopes(envelopes);
    const html = await renderHtml(envelopes, { title: 'Rules integration' });

    expect(summary.schemaVersion).toBe(1);
    expect(model.counts.scenarios).toEqual(summary.counts.scenarios);
    expect(model.counts.steps).toEqual(summary.counts.steps);
    expect(model.counts.features).toBe(summary.counts.features);
    expect(html.match(/<details class="scenario"/g)).toHaveLength(
      model.scenarios.length,
    );

    const triage = html.slice(
      html.indexOf('class="triageBox"'),
      html.indexOf('id="feature-list"'),
    );
    expect(triage).toContain('tagged scenario');
    expect(triage).toContain('1 of 3 scenario');

    const matrix = matrixTable(html);
    const row = matrix.match(
      /<tr><th scope="row"><span class="matrixName">Tags in rules<\/span>.*?<\/tr>/,
    )?.[0];
    expect(row).toBeDefined();
    expect(row).toContain('<td class="num">3</td>');

    for (const tag of [
      '@feature-tag',
      '@rule-tag',
      '@scenario-tag',
      '@some-tag',
    ]) {
      expect(html).toContain(`<option value="${tag}">${tag}</option>`);
    }
  });
});

describe('empty-run rendering', () => {
  it('renders an empty run as 0 / 0 without triage and with a blank row', async () => {
    const html = await renderReport(emptyFixture, { title: 'Empty run' });

    expect(html).toContain('0 / 0');
    expect(html).not.toContain('0 of 0 passed');
    expect(html).toContain('<strong>0%</strong>');
    expect(html).not.toContain('Needs attention');

    const list = featureList(html);
    expect(list).toContain('Empty Scenarios');
    expect(list).toContain('0 of 0 passed');
    expect(list).not.toContain('· 1 unknown');
    expect(list).not.toContain('class="bar"');

    const featureTag = html.slice(
      html.indexOf('data-feature'),
      html.indexOf('>', html.indexOf('data-feature')),
    );
    expect(featureTag).toContain('open');

    const rowTag = scenarioOpeningTag(html, 'Blank Scenario');
    expect(rowTag).not.toContain('data-status');
    expect(rowTag).not.toContain(' open');
    const rowSummary = html.slice(
      html.indexOf(rowTag),
      html.indexOf('</summary>', html.indexOf(rowTag)),
    );
    expect(rowSummary).not.toContain('statusText');
    expect(rowSummary).not.toContain('Unknown');
  });

  it('renders 0 / 0 and the empty state when the run has no scenario rows', async () => {
    const html = await renderReport(emptyNoneFixture, { title: 'No rows' });

    expect(html).toContain('0 / 0');
    expect(html).not.toContain('0 of 0 passed');
    expect(html).toContain('No scenarios in this report.');
    expect(html).not.toContain('Needs attention');
    expect(html).not.toContain('<details class="feature"');
  });

  it('keeps a blank row visible and searchable in a mixed run', async () => {
    const html = await renderReport(emptyMixedFixture, { title: 'Mixed run' });

    expect(html).toContain('1 / 1');
    expect(html).not.toContain('1 of 2 passed');
    expect(html).toContain('<strong>100%</strong>');
    expect(html).not.toContain('Needs attention');

    const list = featureList(html);
    expect(list).toContain('1 of 1 passed');
    expect(list.match(/data-scenario-name=/g) ?? []).toHaveLength(2);
    expect(list).toContain('Blank started scenario');
    expect(list).not.toContain('Never started scenario');

    const rowTag = scenarioOpeningTag(html, 'Blank started scenario');
    expect(rowTag).not.toContain('data-status');
    expect(rowTag).not.toContain(' open');
    expect(rowTag).toContain('data-search=');
    expect(rowTag).toContain('data-uri="samples/empty-mixed/empty-mixed.feature"');
    expect(
      html.slice(
        html.indexOf(rowTag),
        html.indexOf('</summary>', html.indexOf(rowTag)),
      ),
    ).not.toContain('statusText');
  });

  it('counts only executed rows in the header, feature row, triage and bar', async () => {
    const html = await renderReport(emptyStatusesFixture, {
      title: 'Mixed statuses',
    });

    expect(html).toContain('1 / 2');
    expect(html).not.toContain('1 of 3 passed');
    expect(html).toContain('<strong>50%</strong>');

    const triage = html.slice(
      html.indexOf('class="triageBox"'),
      html.indexOf('id="feature-list"'),
    );
    expect(triage).toContain('1 of 2 scenarios need attention.');
    expect(triage).toContain('Failed scenario');
    expect(triage).not.toContain('Blank unexecuted scenario');
    expect(triage).not.toContain('2 of 3 scenarios need attention.');

    const list = featureList(html);
    expect(list).toContain('1 of 2 passed · 1 failed');
    expect(list).not.toContain('1 unknown');
    const featureSummary = list.slice(
      list.indexOf('Mixed statuses'),
      list.indexOf('<div class="rows">', list.indexOf('Mixed statuses')),
    );
    expect(featureSummary).toContain('class="pass"');
    expect(featureSummary).toContain('class="fail"');
    expect(featureSummary).not.toContain('class="unknown"');
    expect(html).not.toMatch(
      /<button class="filter"[^>]+data-status="unknown"/,
    );
  });

  it('shows 0 scenarios and muted zero cells for an all-unexecuted source', async () => {
    const allUnexecuted = parseMessages(
      await readFile(emptyAllUnexecutedFixture, 'utf8'),
      emptyAllUnexecutedFixture,
    );
    const mixed = parseMessages(
      await readFile(emptyMixedFixture, 'utf8'),
      emptyMixedFixture,
    );
    const html = await renderHtml([...allUnexecuted, ...mixed], {
      title: 'Sources',
      provenance: new Map([
        [
          'samples/empty-all-unexecuted/empty-all-unexecuted.feature',
          'all-unexecuted.ndjson',
        ],
        ['samples/empty-mixed/empty-mixed.feature', 'mixed.ndjson'],
      ]),
    });

    const sources = html.slice(
      html.indexOf('class="sources"'),
      html.indexOf('id="feature-list"'),
    );
    const cards = sources.split('<li class="sourceItem">');
    const blankCard = cards.find((card) => card.includes('all-unexecuted.ndjson'));
    expect(blankCard).toBeDefined();
    expect(blankCard).toContain('1 feature · 0 scenarios');
    expect(blankCard).toContain('Unknown');
    expect(blankCard).not.toContain('class="bar"');

    const mixedCard = cards.find((card) => card.includes('mixed.ndjson'));
    expect(mixedCard).toBeDefined();
    expect(mixedCard).toContain('1 feature · 1 scenario');
    expect(mixedCard).toContain('class="bar"');

    const matrix = matrixTable(html);
    const headers = [...matrix.matchAll(/<th>(.*?)<\/th>/g)].map(
      (match) => match[1],
    );
    expect(headers).toEqual(['Feature', 'Total', 'Passed', 'Duration']);

    const blankRow = matrix.slice(
      matrix.indexOf('All unexecuted'),
      matrix.indexOf('</tr>', matrix.indexOf('All unexecuted')),
    );
    expect(blankRow).toContain('<td class="num">0</td>');
    expect(blankRow).toContain('<td class="num zero">0</td>');

    const mixedRow = matrix.slice(
      matrix.indexOf('Mixed executed and unexecuted'),
      matrix.indexOf('</tr>', matrix.indexOf('Mixed executed and unexecuted')),
    );
    expect(mixedRow).toContain('<td class="num">1</td><td class="num">1</td>');
  });

  it('renders a hook-only scenario as a failed executed row', async () => {
    const html = await renderReport(emptyHookOnlyFixture, {
      title: 'Hook only',
    });

    expect(html).toContain('0 / 1');
    expect(html).toContain('1 of 1 scenario needs attention.');
    expect(scenarioOpeningTag(html, 'Hook-only scenario')).toContain(
      'data-status="failed"',
    );
    expect(html).toContain('before hook failed');
  });

  it('keeps the latest unexecuted retry row blank and collapsed', async () => {
    const html = await renderReport(emptyRetryFixture, { title: 'Retry' });

    expect(html).toContain('0 / 0');
    expect(html).not.toContain('Needs attention');
    const rowTag = scenarioOpeningTag(html, 'Retried scenario');
    expect(rowTag).not.toContain('data-status');
    expect(rowTag).not.toContain(' open');
    expect(html.slice(html.indexOf(rowTag))).toContain('Attempt: 2');
  });
});
