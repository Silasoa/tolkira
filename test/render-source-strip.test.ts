import { describe, expect, it } from 'vitest';
import { renderHtml } from '../src/render/html.js';
import { buildReportModel } from '../src/report/model.js';
import { legacyEnvelopes, syntheticRun } from './render-helpers.js';

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
