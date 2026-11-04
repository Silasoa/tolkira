import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderReport, summarizeReport } from '../src/index.js';

const jvm = fileURLToPath(
  new URL('./fixtures/legacy/cucumber-jvm-7.22.1.json', import.meta.url),
);

describe('cucumber-jvm legacy JSON', () => {
  it('parses cucumber-jvm 7.22.1 output', async () => {
    const summary = await summarizeReport(jvm);

    expect(summary.counts.scenarios).toMatchObject({
      total: 2,
      passed: 1,
      failed: 1,
    });
    const failed = summary.scenarios.find(
      (scenario) => scenario.status === 'failed',
    );
    expect(failed?.name).toBe('fails');
    expect(failed?.steps[0]?.message).toContain('boom');
    expect(failed?.durationMs).toBeGreaterThan(0);

    const html = await renderReport(jvm, { title: 'cucumber-jvm' });
    expect(html).toContain('Old cucumber-jvm compatibility');
    expect(html).toContain('fails');
  });
});
