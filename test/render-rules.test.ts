import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';
import { parseMessages } from '../src/input/messages.js';
import { renderHtml } from '../src/render/html.js';
import { buildReportModel } from '../src/report/model.js';
import { summarizeEnvelopes } from '../src/summary.js';
import { legacyFixture, messagesFixture } from './fixtures.js';
import {
  failPickle,
  matrixTable,
  renderMessagesFile,
  scenarioSummary,
  sectionAt,
} from './render-helpers.js';

const tagsFixture = messagesFixture('tags.ndjson');
const rulesFixture = messagesFixture('rules.ndjson');
const examplesTables = messagesFixture('examples-tables.ndjson');
const backgroundsFixture = messagesFixture('backgrounds.ndjson');
const rulesBackgroundsFixture = messagesFixture('rules-backgrounds.ndjson');
const passedOnlyFixture = legacyFixture('behave.json');

describe('parity rules rendering', () => {
  it('renders feature and rule tags once and keeps inherited tags off rows', async () => {
    const html = await renderMessagesFile(tagsFixture, 'Rules');

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
    const html = await renderMessagesFile(rulesFixture, 'Rules');

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
    const html = await renderMessagesFile(backgroundsFixture, 'Rules');

    expect(html).not.toContain('<section class="background"');
    expect(
      html.match(/<\/span> <span class="stepText">an order for <span class="param" data-parameter-type="string">&quot;eggs&quot;<\/span><\/span><\/div>/g),
    ).toHaveLength(2);
    expect(
      html.match(/<\/span> <span class="stepText">an order for <span class="param" data-parameter-type="string">&quot;milk&quot;<\/span><\/span><\/div>/g),
    ).toHaveLength(2);
    expect(html.match(/<\/span> <span class="stepText">an action<\/span><\/div>/g)).toHaveLength(2);
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
      html.match(/<\/span> <span class="stepText">an order for <span class="param" data-parameter-type="string">&quot;eggs&quot;<\/span><\/span><\/div>/g),
    ).toHaveLength(2);
    expect(
      html.match(/<\/span> <span class="stepText">an order for <span class="param" data-parameter-type="string">&quot;milk&quot;<\/span><\/span><\/div>/g),
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
    const html = await renderMessagesFile(rulesBackgroundsFixture, 'Rules');

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

    expect(summary.schemaVersion).toBe(2);
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
