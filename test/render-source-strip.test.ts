import type { Envelope } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import { createTranslator } from '../src/render/i18n.js';
import { renderHtml } from '../src/render/html.js';
import { renderSourceStrip } from '../src/render/triage.js';
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

  it('keeps provenance for absolute and file-URL feature URIs', () => {
    const envelopesFor = (uri: string, id: string, name: string) =>
      [
        {
          gherkinDocument: {
            uri,
            comments: [],
            feature: {
              location: { line: 1, column: 1 },
              tags: [],
              language: 'en',
              keyword: 'Feature',
              name,
              description: '',
              children: [
                {
                  scenario: {
                    id: `${id}-scenario`,
                    location: { line: 3, column: 3 },
                    tags: [],
                    keyword: 'Scenario',
                    name: 'a scenario',
                    description: '',
                    steps: [
                      {
                        id: `${id}-step-def`,
                        location: { line: 4, column: 5 },
                        keyword: 'Given ',
                        keywordType: 'Context',
                        text: 'a step',
                      },
                    ],
                    examples: [],
                  },
                },
              ],
            },
          },
        },
        {
          pickle: {
            id: `${id}-pickle`,
            uri,
            name: 'a scenario',
            language: 'en',
            astNodeIds: [`${id}-scenario`],
            tags: [],
            steps: [
              { id: `${id}-pickle-step`, text: 'a step', astNodeIds: [] },
            ],
          },
        },
        {
          testCase: {
            id: `${id}-case`,
            pickleId: `${id}-pickle`,
            testSteps: [
              { id: `${id}-step`, pickleStepId: `${id}-pickle-step` },
            ],
          },
        },
        {
          testCaseStarted: {
            id: `${id}-start`,
            testCaseId: `${id}-case`,
            attempt: 0,
            timestamp: { seconds: 1, nanos: 0 },
          },
        },
        {
          testStepFinished: {
            testCaseStartedId: `${id}-start`,
            testStepId: `${id}-step`,
            testStepResult: {
              status: 'PASSED',
              duration: { seconds: 0, nanos: 1 },
            },
            timestamp: { seconds: 1, nanos: 1 },
          },
        },
      ] as unknown as Envelope[];

    const firstUri = 'file:///home/alice/proj/one.feature';
    const secondUri = '/mnt/c/Users/alice/proj/two.feature';
    const envelopes = [
      ...envelopesFor(firstUri, 'one', 'One'),
      ...envelopesFor(secondUri, 'two', 'Two'),
    ];
    const provenance = new Map([
      [firstUri, 'one.json'],
      [secondUri, 'two.json'],
    ]);
    const model = buildReportModel(envelopes, provenance);
    const strip = renderSourceStrip(model, createTranslator('en'));

    expect(model.features.map((feature) => feature.sourceFile)).toEqual([
      'one.json',
      'two.json',
    ]);
    expect(strip).toContain('class="sources"');
    expect(strip).toContain('one.json');
    expect(strip).toContain('two.json');
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
