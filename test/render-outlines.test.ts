import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseMessages } from '../src/input/messages.js';
import { renderHtml } from '../src/render/html.js';
import { messagesFixture } from './fixtures.js';
import { renderMessagesFile } from './render-helpers.js';

const examplesTables = messagesFixture('examples-tables.ndjson');

describe('scenario outlines', () => {
  it('renders two outlines with examples headings and numbering', async () => {
    const html = await renderMessagesFile(examplesTables);

    expect(
      html.match(/<section class="outline" data-outline[^>]*>/g),
    ).toHaveLength(2);
    expect(
      html.match(/<section class="examples" data-examples[^>]*>/g),
    ).toHaveLength(3);
    expect(html).toContain('Scenario Outline:</span> Eating cucumbers');
    expect(html).toContain(
      'Scenario Outline:</span> Eating cucumbers with &lt;friends&gt; friends',
    );
    expect(html).toContain('Examples:</span> These are passing');
    expect(html).toContain('Examples:</span> These are failing');
    expect(html).toContain(
      '<h4 class="examplesTitle"><span class="kw">Examples:</span></h4>',
    );
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
    const document = envelopes.find(
      (envelope) => envelope.gherkinDocument,
    )?.gherkinDocument;
    const scenario = document?.feature?.children.find(
      (child) => child.scenario,
    )?.scenario;
    const examples = scenario?.examples[0];
    expect(scenario).toBeDefined();
    expect(examples).toBeDefined();
    if (!scenario || !examples) return;

    scenario.keyword = '<img src=x onerror=alert(1)>';
    scenario.description = '<script>outline</script>';
    scenario.tags = [
      {
        id: 'outline-tag',
        name: '@outline-x',
        location: { line: 1, column: 1 },
      },
    ];
    examples.keyword = '<svg onload=alert(1)>';
    examples.name = '" onmouseover="alert(1)';
    examples.description = '<script>examples</script>';
    examples.tags = [
      {
        id: 'examples-tag',
        name: '@examples-x',
        location: { line: 1, column: 1 },
      },
      {
        id: 'examples-xss',
        name: '@<svg onload=alert(1)>',
        location: { line: 1, column: 1 },
      },
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
      html.match(
        /<div class="description">\s*<p>&lt;script&gt;outline&lt;\/script&gt;<\/p>\s*<\/div>/g,
      ),
    ).toHaveLength(1);
    expect(
      html.match(
        /<div class="description">\s*<p>&lt;script&gt;examples&lt;\/script&gt;<\/p>\s*<\/div>/g,
      ),
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
    const document = envelopes.find(
      (envelope) => envelope.gherkinDocument,
    )?.gherkinDocument;
    const scenario = document?.feature?.children.find(
      (child) => child.scenario,
    )?.scenario;
    const rowIds = new Set(
      (scenario?.examples?.[0]?.tableBody ?? []).map((row) => row.id),
    );
    const pickleIds = new Set(
      envelopes
        .filter((envelope) =>
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
    expect(
      html.match(/<section class="examples" data-examples[^>]*>/g),
    ).toHaveLength(2);
  });

  it('omits one unexecuted row but keeps the block heading', async () => {
    const content = await readFile(examplesTables, 'utf8');
    const envelopes = parseMessages(content, examplesTables);
    const document = envelopes.find(
      (envelope) => envelope.gherkinDocument,
    )?.gherkinDocument;
    const scenario = document?.feature?.children.find(
      (child) => child.scenario,
    )?.scenario;
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
      if (envelope.testCase && pickleIds.has(envelope.testCase.pickleId))
        return false;
      if (
        envelope.testCaseStarted &&
        testCaseIds.has(envelope.testCaseStarted.testCaseId)
      )
        return false;
      if (
        envelope.testCaseFinished &&
        startedIds.has(envelope.testCaseFinished.testCaseStartedId)
      )
        return false;
      if (
        envelope.testStepFinished &&
        startedIds.has(envelope.testStepFinished.testCaseStartedId)
      )
        return false;
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
      ?.gherkinDocument?.feature?.children.find(
        (child) => child.scenario,
      )?.scenario;
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
    const document = envelopes.find(
      (envelope) => envelope.gherkinDocument,
    )?.gherkinDocument;
    expect(document).toBeDefined();
    if (!document) return;
    delete (document as unknown as { uri?: string }).uri;

    const html = await renderHtml(envelopes, { title: 'No URI' });
    expect(
      html.match(/<section class="outline" data-outline[^>]*>/g),
    ).toHaveLength(2);
  });

  it('groups an outline inside a Rule', async () => {
    const content = await readFile(examplesTables, 'utf8');
    const envelopes = parseMessages(content, examplesTables);
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
    expect(
      html.match(/<section class="outline" data-outline[^>]*>/g),
    ).toHaveLength(2);
    expect(html).toContain('Rule: A rule');
  });

  it('falls back flat for an executed outline without examples', async () => {
    const content = await readFile(examplesTables, 'utf8');
    const envelopes = parseMessages(content, examplesTables);
    const scenario = envelopes
      .find((envelope) => envelope.gherkinDocument)
      ?.gherkinDocument?.feature?.children.find(
        (child) => child.scenario,
      )?.scenario;
    expect(scenario).toBeDefined();
    if (!scenario) return;

    scenario.examples = [];

    const html = await renderHtml(envelopes, { title: 'No examples' });
    expect(
      html.match(/<section class="outline" data-outline[^>]*>/g),
    ).toHaveLength(1);
    expect(html.match(/data-example="/g)).toHaveLength(3);
    expect(html.match(/<details class="scenario"/g)).toHaveLength(7);
    expect(html.match(/data-scenario-name="Eating cucumbers"/g)).toHaveLength(
      4,
    );
  });

  it('keeps the heading order valid', async () => {
    const html = await renderMessagesFile(examplesTables);
    const headings = [
      ...html.matchAll(
        /<(h[2-5])[^>]*class="(outlineTitle|examplesTitle|scenarioName)"/g,
      ),
    ].map((match) => [match[1], match[2]]);

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
