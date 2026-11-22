import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderReport, summarizeReport } from '../src/index.js';

const jvm = fileURLToPath(
  new URL('./fixtures/legacy/cucumber-jvm-7.22.1.json', import.meta.url),
);
const jvmHooks = fileURLToPath(
  new URL('./fixtures/legacy/cucumber-jvm-hook-output.json', import.meta.url),
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

  it('renders the real Cucumber-JVM hook output fixture', async () => {
    const summary = await summarizeReport(jvmHooks);

    expect(summary.counts.features).toBe(3);
    expect(summary.counts.scenarios.total).toBe(9);
    expect(summary.counts.steps.total).toBe(52);
    expect(
      summary.scenarios
        .flatMap((scenario) => scenario.steps)
        .filter((step) => step.keyword === 'Hook'),
    ).toHaveLength(12);
    expect(summary.attachments.total).toBe(12);

    const html = await renderReport(jvmHooks, { title: 'Cucumber-JVM hooks' });
    expect(html).toContain('text/plain');
    expect(html).toContain('Before hook output');
    expect(html).toContain('After hook output');
    expect(html).toContain('Runs before each scenarios *not* tagged with @foo');
    expect(html).toContain('Runs after each scenarios');
  });
});
