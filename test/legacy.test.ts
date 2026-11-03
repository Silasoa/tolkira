import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseLegacyJson } from '../src/input/legacy.js';
import { renderReport, summarizeReport } from '../src/index.js';

const happy = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);
const screenshot = fileURLToPath(
  new URL('./fixtures/legacy/screenshot.json', import.meta.url),
);
const unhappy = fileURLToPath(
  new URL('./fixtures/legacy/unhappy.json', import.meta.url),
);
const failed = fileURLToPath(
  new URL('./fixtures/legacy/failed.json', import.meta.url),
);
const behave = fileURLToPath(
  new URL('./fixtures/legacy/behave.json', import.meta.url),
);
const behaveReal = fileURLToPath(
  new URL('./fixtures/legacy/behave-real.json', import.meta.url),
);
const minimal = fileURLToPath(
  new URL('./fixtures/legacy/minimal.json', import.meta.url),
);

async function legacyEnvelopes(path: string) {
  const content = await readFile(path, 'utf8');
  return parseLegacyJson(content, path, {
    idPrefix: 'test',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('legacy JSON adapter', () => {
  it('preserves features, scenarios and attachments', async () => {
    const envelopes = await legacyEnvelopes(happy);

    expect(envelopes.filter((envelope) => envelope.gherkinDocument)).toHaveLength(1);
    expect(envelopes.filter((envelope) => envelope.pickle)).toHaveLength(6);
    expect(envelopes.filter((envelope) => envelope.testCase)).toHaveLength(6);
    expect(envelopes.filter((envelope) => envelope.attachment)).toHaveLength(2);
    expect(envelopes.filter((envelope) => envelope.testStepFinished)).toHaveLength(30);
    expect(envelopes.filter((envelope) => envelope.hook)).toHaveLength(6);

    const document = envelopes.find(
      (envelope) => envelope.gherkinDocument,
    )?.gherkinDocument;
    const scenarios =
      document?.feature?.children.flatMap((child) =>
        child.scenario ? [child.scenario] : [],
      ) ?? [];
    const docStringScenario = scenarios.find((scenario) =>
      scenario.name.includes('long doc string'),
    );
    const tableScenario = scenarios.find((scenario) =>
      scenario.name.includes('data table'),
    );
    const taggedScenario = scenarios.find((scenario) =>
      scenario.tags.some((tag) => tag.name === '@testPassing'),
    );

    expect(
      docStringScenario?.steps.some((step) =>
        step.docString?.content.includes('In order to see Doc String'),
      ),
    ).toBe(true);
    expect(
      tableScenario?.steps.some((step) => (step.dataTable?.rows.length ?? 0) > 0),
    ).toBe(true);
    expect(taggedScenario).toBeDefined();

    const attachment = envelopes.find((envelope) => envelope.attachment)?.attachment;
    expect(attachment?.contentEncoding).toBe('BASE64');
    expect(attachment?.mediaType).toBe('text/plain');
    expect(attachment?.body).toBe('dGVzdCBkYXRhIHRvIGJlIHByaW50ZWQ=');
  });

  it('renders a legacy report with its feature and attachment', async () => {
    const html = await renderReport(happy, { title: 'Legacy report' });

    expect(html).toContain('<title>Legacy report</title>');
    expect(html).toContain('Happy HTML reporting');
    expect(html).toContain('Fred wants to see passing scenarios');
    expect(html).toContain('text/plain');
  });

  it('renders a legacy screenshot as an image attachment', async () => {
    const html = await renderReport(screenshot, { title: 'Legacy image' });

    expect(html).toContain('image/png');
    expect(html).toContain('attachment-1.png');
  });

  it('preserves pending, undefined and skipped statuses', async () => {
    const envelopes = await legacyEnvelopes(unhappy);
    const statuses = envelopes
      .filter((envelope) => envelope.testStepFinished)
      .map((envelope) => envelope.testStepFinished?.testStepResult.status);

    expect(statuses).toContain('UNDEFINED');
    expect(statuses).toContain('PENDING');
    expect(statuses).toContain('SKIPPED');
    expect(envelopes.filter((envelope) => envelope.attachment)).toHaveLength(1);
  });

  it('renders a failed step with its error message', async () => {
    const envelopes = await legacyEnvelopes(failed);
    const statuses = envelopes
      .filter((envelope) => envelope.testStepFinished)
      .map((envelope) => envelope.testStepFinished?.testStepResult.status);
    expect(statuses).toContain('FAILED');

    const html = await renderReport(failed, { title: 'Failed report' });
    expect(html).toContain('Expected values to be strictly equal');
  });

  it('does not turn a background element into a scenario', () => {
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          name: 'Background feature',
          elements: [
            {
              keyword: 'Background',
              type: 'background',
              name: 'Shared setup',
              steps: [
                {
                  keyword: 'Given ',
                  name: 'a shared step',
                  result: { status: 'passed', duration: 1 },
                },
              ],
            },
            {
              keyword: 'Scenario',
              type: 'scenario',
              name: 'Real scenario',
              steps: [
                {
                  keyword: 'Given ',
                  name: 'a scenario-specific step',
                  result: { status: 'passed', duration: 1 },
                },
              ],
            },
          ],
        },
      ]),
      'background.json',
    );

    const pickles = envelopes.flatMap((envelope) =>
      envelope.pickle ? [envelope.pickle] : [],
    );
    expect(pickles).toHaveLength(1);
    expect(pickles[0]?.name).toBe('Real scenario');
    expect(pickles[0]?.steps.map((step) => step.text)).toEqual([
      'a shared step',
      'a scenario-specific step',
    ]);

    const background = envelopes.find(
      (envelope) => envelope.gherkinDocument,
    )?.gherkinDocument?.feature?.children.find((child) => child.background)
      ?.background;
    expect(background?.steps.map((step) => step.text)).toEqual([
      'a shared step',
    ]);
  });

  it('keeps relative URIs distinct', () => {
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          uri: 'a/login.feature',
          name: 'Feature A',
          elements: [
            {
              keyword: 'Scenario',
              name: 'A scenario',
              steps: [
                { keyword: 'Given ', name: 'a', result: { status: 'passed' } },
              ],
            },
          ],
        },
        {
          uri: 'b/login.feature',
          name: 'Feature B',
          elements: [
            {
              keyword: 'Scenario',
              name: 'B scenario',
              steps: [
                { keyword: 'Given ', name: 'b', result: { status: 'passed' } },
              ],
            },
          ],
        },
      ]),
      'collision.json',
    );

    const uris = envelopes.flatMap((envelope) =>
      envelope.gherkinDocument ? [envelope.gherkinDocument.uri] : [],
    );
    expect(uris).toEqual(['a/login.feature', 'b/login.feature']);
  });

  it('accepts Behave-shaped descriptions, tags, hooks and mime_type', async () => {
    const summary = await summarizeReport(behave);

    expect(summary.status).toBe('passed');
    expect(summary.counts.scenarios).toMatchObject({ total: 1, passed: 1 });
    expect(summary.counts.steps.total).toBe(3);
    expect(summary.scenarios[0]?.tags).toEqual(
      expect.arrayContaining(['@behave', '@scenario']),
    );
    expect(summary.attachments.total).toBe(1);
    expect(summary.attachments.bytes).toBeGreaterThan(0);

    const html = await renderReport(behave, { title: 'Behave' });
    expect(html).toContain('a background step');
    expect(html).toContain('image/png');
    expect(html).toContain('attachment-1.png');
  });

  it('normalises real Behave seconds to milliseconds', async () => {
    const summary = await summarizeReport(behaveReal);
    const failed = summary.scenarios.find(
      (scenario) => scenario.status === 'failed',
    );

    expect(failed?.name).toBe('fails');
    expect(failed?.durationMs).toBeGreaterThan(0);
    expect(failed?.steps[0]?.durationMs).toBeGreaterThan(0);
    expect(failed?.steps[0]?.message).toContain('boom');
  });

  it('rejects unknown legacy result statuses', () => {
    expect(() =>
      parseLegacyJson(
        JSON.stringify([
          {
            name: 'Bad status',
            elements: [
              {
                keyword: 'Scenario',
                name: 'Bad scenario',
                steps: [
                  {
                    keyword: 'Given ',
                    name: 'a step',
                    result: { status: 'BANANA' },
                  },
                ],
              },
            ],
          },
        ]),
        'bad-status.json',
      ),
    ).toThrow('result.status');
  });

  it('maps Behave doc strings, tables and locations', () => {
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          location: 'features/behave.feature:1',
          name: 'Behave arguments',
          elements: [
            {
              type: 'scenario',
              name: 'Arguments',
              steps: [
                {
                  keyword: 'Given ',
                  name: 'a doc string',
                  text: 'line one\nline two',
                  result: { status: 'passed', duration: 1 },
                },
                {
                  keyword: 'And ',
                  name: 'a table',
                  table: {
                    headings: ['name', 'value'],
                    rows: [['a', '1']],
                  },
                  result: { status: 'passed', duration: 1 },
                },
              ],
            },
          ],
        },
      ]),
      'behave-args.json',
    );

    const document = envelopes.find(
      (envelope) => envelope.gherkinDocument,
    )?.gherkinDocument;
    expect(document?.uri).toBe('features/behave.feature');
    const steps = document?.feature?.children[0]?.scenario?.steps ?? [];
    expect(steps[0]?.docString?.content).toContain('line one');
    expect(steps[1]?.dataTable?.rows).toHaveLength(2);
    expect(steps[1]?.dataTable?.rows[1]?.cells.map((cell) => cell.value)).toEqual([
      'a',
      '1',
    ]);
  });

  it('renders a minimal legacy fixture without attachments', async () => {
    const summary = await summarizeReport(minimal);
    expect(summary.counts.scenarios.total).toBe(1);
    expect(summary.attachments.total).toBe(0);

    const html = await renderReport(minimal, { title: 'Minimal' });
    expect(html).toContain('Minimal feature');
    expect(html).toContain('a minimal step');
  });

  it('uses deterministic IDs when a prefix is given', async () => {
    const first = await legacyEnvelopes(happy);
    const second = await legacyEnvelopes(happy);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
