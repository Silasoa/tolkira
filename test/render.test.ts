import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { buildReportModel } from '../src/report/model.js';
import { renderHtml } from '../src/render/html.js';

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
    expect(html).toContain('role="region" aria-label="Feature summary table"');
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
    scenarios: Array<{ name: string; status: string }>;
  }>,
) {
  return parseLegacyJson(
    JSON.stringify(
      features.map((feature) => ({
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
    expect(html).not.toContain('Behave feature</a>');
  });

  it('omits the index when every scenario passed', async () => {
    const html = await renderHtml(await legacyEnvelopes('behave.json', 'behave'), {
      title: 'Clean run',
    });

    expect(html).not.toContain('Needs attention');
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
    expect(manyHtml).toContain('1 more feature below');

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
