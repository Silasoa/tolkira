import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseLegacyJson } from '../src/input/legacy.js';
import { renderReport, summarizeReport } from '../src/index.js';
import { behaveProducerFixture } from './fixtures.js';

const behaveAttachments = behaveProducerFixture(
  'behave-real-attachments.json',
);
const behaveSampleImage = behaveProducerFixture(
  'features/attachments/sample.png',
);
const behaveFeature = behaveProducerFixture('features/behave_rich.feature');
const behaveSteps = behaveProducerFixture('features/steps/steps.py');
const behaveProvenance = behaveProducerFixture('PROVENANCE.md');

async function legacyEnvelopes(path: string) {
  const content = await readFile(path, 'utf8');
  return parseLegacyJson(content, path, {
    idPrefix: 'test',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('Behave producer fixtures', () => {
  it('records the real Behave argument, error and embedding shapes', async () => {
    const raw = JSON.parse(await readFile(behaveAttachments, 'utf8')) as Array<{
      elements?: Array<{
        name?: string;
        steps?: Array<{
          name?: string;
          text?: unknown;
          result?: { status?: string; error_message?: unknown };
          embeddings?: Array<{ mime_type?: string; data?: string }>;
        }>;
      }>;
    }>;
    const [docStringScenario, errorScenario, failedScenario] =
      raw[0]?.elements ?? [];

    expect(docStringScenario?.steps?.[0]?.text).toEqual([
      'first line',
      'second line',
    ]);
    expect(errorScenario?.steps?.[0]?.result?.status).toBe('error');
    expect(failedScenario?.steps?.[0]?.result?.error_message).toEqual([
      'ASSERT FAILED: first line',
      'second line',
    ]);

    const imageStep = docStringScenario?.steps?.find(
      (step) => step.name === 'a screenshot is attached',
    );
    expect(imageStep?.embeddings?.[0]?.mime_type).toBe('image/png');
    expect(imageStep?.embeddings?.[0]?.data).toMatch(
      /^[A-Za-z0-9+/]+={0,2}$/,
    );
  });

  it('keeps the real Behave fixture artifacts public-safe', async () => {
    const artifacts: Array<[string, string]> = [
      ['recorded JSON', await readFile(behaveAttachments, 'utf8')],
      ['feature', await readFile(behaveFeature, 'utf8')],
      ['step definitions', await readFile(behaveSteps, 'utf8')],
      ['provenance', await readFile(behaveProvenance, 'utf8')],
      ['image bytes', await readFile(behaveSampleImage, 'latin1')],
    ];

    for (const [label, content] of artifacts) {
      expect(content, label).not.toMatch(/[A-Za-z]:[\\/]/);
      expect(content, label).not.toContain('/Users/');
      expect(content, label).not.toContain('/home/');
      expect(content, label).not.toMatch(/https?:\/\//);
      expect(content, label).not.toMatch(/\bfile:/);
    }
  });

  it('normalises real Behave doc strings, tables, attachments and durations', async () => {
    const envelopes = await legacyEnvelopes(behaveAttachments);
    const document = envelopes.find(
      (envelope) => envelope.gherkinDocument,
    )?.gherkinDocument;
    const scenarios =
      document?.feature?.children.flatMap((child) =>
        child.scenario ? [child.scenario] : [],
      ) ?? [];
    const passing = scenarios.find(
      (scenario) => scenario.name === 'Doc string, data table and screenshot',
    );

    expect(passing?.steps[0]?.docString?.content).toBe(
      'first line\nsecond line',
    );
    expect(
      passing?.steps[1]?.dataTable?.rows.map((row) =>
        row.cells.map((cell) => cell.value),
      ),
    ).toEqual([
      ['name', 'value'],
      ['alpha', '1'],
      ['beta', '2'],
    ]);

    const attachment = envelopes.find(
      (envelope) => envelope.attachment,
    )?.attachment;
    const image = await readFile(behaveSampleImage);
    expect(attachment?.mediaType).toBe('image/png');
    expect(attachment?.contentEncoding).toBe('BASE64');
    expect(attachment?.body).toBe(image.toString('base64'));

    const durations = envelopes.flatMap((envelope) => {
      const duration = envelope.testStepFinished?.testStepResult.duration;
      return duration
        ? [duration.seconds * 1000 + duration.nanos / 1_000_000]
        : [];
    });
    expect(durations).toHaveLength(6);
    expect(durations.every((milliseconds) => milliseconds > 0)).toBe(true);
    // The recorded 0.008718013763427734 seconds for the screenshot step only
    // yields this value when seconds are scaled by 1e9, not by 1e6.
    expect(durations[2]).toBe(8.718014);
  });

  it('summarises the real Behave fixture as one pass and two failures', async () => {
    const summary = await summarizeReport(behaveAttachments);
    const image = await readFile(behaveSampleImage);

    expect(summary.status).toBe('failed');
    expect(summary.counts.scenarios).toMatchObject({
      total: 3,
      passed: 1,
      failed: 2,
    });
    expect(summary.attachments).toEqual({ total: 1, bytes: image.length });

    const failedAssertion = summary.scenarios.find(
      (scenario) => scenario.name === 'Failed assertion with a multiline message',
    );
    expect(failedAssertion?.status).toBe('failed');
    expect(failedAssertion?.steps[0]?.message).toContain('first line');
    expect(failedAssertion?.steps[0]?.message).toContain('second line');

    const errorScenario = summary.scenarios.find(
      (scenario) => scenario.name === 'Unexpected step error',
    );
    expect(errorScenario?.status).toBe('failed');
    expect(errorScenario?.steps).toHaveLength(1);
    expect(errorScenario?.steps[0]?.message).toBeUndefined();
  });

  it('renders the real Behave doc string, table, attachment and failure', async () => {
    const html = await renderReport(behaveAttachments, {
      title: 'Real Behave',
    });

    expect(html).toContain('first line');
    expect(html).toContain('second line');
    expect(html).toContain('alpha');
    expect(html).toContain('beta');
    expect(html).toContain('image/png');
    expect(html).toContain('ASSERT FAILED: first line\nsecond line');
    expect(html).toContain(
      '<pre class="docString">first line\nsecond line</pre>',
    );
    expect(html).toContain(
      '<table class="dataTable"><tbody>' +
        '<tr><th>name</th><th>value</th></tr>' +
        '<tr><td>alpha</td><td>1</td></tr>' +
        '<tr><td>beta</td><td>2</td></tr>' +
        '</tbody></table>',
    );
    expect(html).toContain('<img class="shot"');
    expect(html).toContain('src="data:image/png;base64,');
    const errorScenarioTag = (html.match(/<details\b[^>]*>/g) ?? []).find(
      (tag) => tag.includes('data-scenario-name="Unexpected step error"'),
    );
    expect(errorScenarioTag).toBeDefined();
    expect(errorScenarioTag).toContain('data-status="failed"');
  });
});
