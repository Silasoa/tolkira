import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { buildReportModel } from '../src/report/model.js';

const happy = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);
const screenshot = fileURLToPath(
  new URL('./fixtures/legacy/screenshot.json', import.meta.url),
);
const messages = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);

async function modelFor(file: string) {
  const content = await readFile(file, 'utf8');
  return buildReportModel(
    parseLegacyJson(content, file, {
      idPrefix: 'model',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
  );
}

describe('report model', () => {
  it('groups scenarios, features and steps', async () => {
    const model = await modelFor(happy);

    expect(model.counts.features).toBe(1);
    expect(model.counts.scenarios.total).toBe(6);
    expect(model.counts.steps.total).toBe(30);
    expect(model.features[0]?.name).toBe('Happy HTML reporting');
    expect(model.features[0]?.description).toContain('cucumber reports');
    expect(model.scenarios[0]?.status).toBe('passed');
    expect(model.scenarios[0]?.steps[0]?.keyword).toBe('Hook');
    expect(model.scenarios[0]?.steps.some((step) => step.keyword === 'Given')).toBe(true);
  });

  it('keeps doc strings, tables and errors', async () => {
    const model = await modelFor(happy);

    expect(
      model.scenarios.some((scenario) =>
        scenario.steps.some((step) => step.docString?.includes('Doc String')),
      ),
    ).toBe(true);
    expect(
      model.scenarios.some((scenario) =>
        scenario.steps.some((step) => (step.dataTable?.length ?? 0) > 0),
      ),
    ).toBe(true);
  });

  it('maps image attachments to data URIs', async () => {
    const model = await modelFor(screenshot);
    const attachment = model.scenarios
      .flatMap((scenario) => scenario.attachments)
      .find((entry) => entry.kind === 'image');

    expect(attachment?.fileName).toBe('attachment-1.png');
    expect(attachment?.dataUri).toMatch(/^data:image\/png;base64,/);
    expect(attachment?.bytes).toBeGreaterThan(0);
  });

  it('uses the latest finished attempt for a scenario', async () => {
    const model = await modelFor(happy);
    expect(model.scenarios.every((scenario) => scenario.attempt === 0)).toBe(true);
  });

  it('keeps case-level and run-level attachments', async () => {
    const lines = (await readFile(messages, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const started = lines.find((line) => line.testCaseStarted)?.testCaseStarted as
      | { id: string }
      | undefined;
    expect(started).toBeDefined();

    lines.push({
      attachment: {
        body: Buffer.from('case-level log').toString('base64'),
        contentEncoding: 'BASE64',
        mediaType: 'text/plain',
        testCaseStartedId: started?.id,
      },
    });
    lines.push({
      attachment: {
        body: Buffer.from('run-level log').toString('base64'),
        contentEncoding: 'BASE64',
        mediaType: 'text/plain',
      },
    });

    const envelopes = parseMessages(
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'attachments.ndjson',
    );
    const model = buildReportModel(envelopes);

    expect(model.scenarios[0]?.extraAttachments).toHaveLength(1);
    expect(model.scenarios[0]?.extraAttachments[0]?.text).toBe('case-level log');
    expect(model.runAttachments).toHaveLength(1);
    expect(model.runAttachments[0]?.text).toBe('run-level log');
    expect(model.counts.attachments).toBe(3);
  });
});
