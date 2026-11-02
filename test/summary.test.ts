import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { summarizeReport } from '../src/index.js';

const messages = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const legacy = fileURLToPath(
  new URL('./fixtures/legacy/happy.json', import.meta.url),
);
const failed = fileURLToPath(
  new URL('./fixtures/legacy/failed.json', import.meta.url),
);

describe('machine-readable summary', () => {
  it('summarizes a Messages report', async () => {
    const summary = await summarizeReport(messages);

    expect(summary.schemaVersion).toBe(1);
    expect(summary.status).toBe('failed');
    expect(summary.counts.scenarios).toMatchObject({
      total: 2,
      passed: 1,
      failed: 1,
    });
    expect(summary.attachments.total).toBe(1);
    expect(summary.attachments.bytes).toBeGreaterThan(0);
    const screenshot = summary.scenarios.find(
      (scenario) => scenario.name === 'Attach a screenshot',
    );
    expect(screenshot).toMatchObject({
      uri: 'features/screenshot.feature',
      status: 'passed',
      attachments: 1,
    });
    const failing = summary.scenarios.find(
      (scenario) => scenario.name === 'Failing scenario',
    );
    expect(failing?.status).toBe('failed');
    expect(failing?.tags).toContain('@failing');
    expect(failing?.steps[0]?.message).toContain('Expected 1 to equal 2');
  });

  it('summarizes legacy scenarios and steps', async () => {
    const summary = await summarizeReport(legacy);

    expect(summary.status).toBe('passed');
    expect(summary.counts.scenarios).toMatchObject({
      total: 6,
      passed: 6,
    });
    expect(summary.counts.steps.total).toBe(30);
    expect(summary.durationMs).toBeGreaterThan(0);
    expect(summary.scenarios[0]?.feature).toBe('Happy HTML reporting');
    expect(
      summary.scenarios[0]?.steps.some((step) => step.keyword === 'Given'),
    ).toBe(true);
  });

  it('reports failures with messages and worst status', async () => {
    const summary = await summarizeReport(failed);

    expect(summary.status).toBe('failed');
    expect(summary.counts.scenarios).toMatchObject({
      total: 6,
      passed: 5,
      failed: 1,
    });

    const failing = summary.scenarios.find(
      (scenario) => scenario.status === 'failed',
    );
    expect(failing?.steps.some((step) => step.message?.includes('-8 !== 0'))).toBe(
      true,
    );
  });

  it('merges Messages and legacy input into one summary', async () => {
    const summary = await summarizeReport([messages, legacy]);

    expect(summary.counts.scenarios.total).toBe(8);
    expect(summary.attachments.total).toBe(3);
    expect(summary.scenarios.map((scenario) => scenario.uri)).toContain(
      'features/screenshot.feature',
    );
    expect(summary.scenarios.map((scenario) => scenario.uri)).toContain(
      'features/happy.feature',
    );
  });
});
