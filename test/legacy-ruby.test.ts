import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderReport, summarizeReport } from '../src/index.js';

const cucumberRuby = fileURLToPath(
  new URL('./fixtures/legacy/cucumber-ruby-12.0.1.json', import.meta.url),
);

describe('cucumber-ruby legacy JSON', () => {
  it('parses cucumber-ruby 12.0.1 output', async () => {
    const summary = await summarizeReport(cucumberRuby);

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

    const html = await renderReport(cucumberRuby, { title: 'cucumber-ruby' });
    expect(html).toContain('Old cucumber-ruby compatibility');
  });
});
