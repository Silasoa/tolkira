import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { buildReportModel } from '../src/report/model.js';
import { renderHtml } from '../src/render/html.js';
import { summarizeEnvelopes, displayUri } from '../src/summary.js';

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
    expect(html).toContain('<h4>Steps</h4>');
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
    scenarios: Array<{ name: string; status: string }>;
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
              result: { status: scenario.status, duration: 1 },
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
