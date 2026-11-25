import { describe, expect, it } from 'vitest';
import { renderHtml } from '../src/render/html.js';
import { buildReportModel } from '../src/report/model.js';
import { summarizeEnvelopes } from '../src/summary.js';
import {
  featureList,
  legacyEnvelopes,
  matrixTable,
  syntheticRun,
} from './render-helpers.js';

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
    expect(html).toContain('1 passed of 2 attempted · 1 unknown');
    expect(html).toContain('1 of 3 scenarios need attention.');
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
      ...Array.from({ length: 6 }, () => 'Happy HTML reporting'),
      ...Array.from({ length: 4 }, () => 'Unhappy HTML reporting'),
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
