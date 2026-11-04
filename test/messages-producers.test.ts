import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderReport, summarizeReport } from '../src/index.js';

const fixtures = [
  {
    name: 'cucumber-jvm 7.22.1',
    feature: 'Old cucumber-jvm compatibility',
    path: './fixtures/messages/cucumber-jvm-7.22.1.ndjson',
  },
  {
    name: 'cucumber-ruby 12.0.1',
    feature: 'Old cucumber-ruby compatibility',
    path: './fixtures/messages/cucumber-ruby-12.0.1.ndjson',
  },
];

describe('Messages producers', () => {
  for (const fixture of fixtures) {
    it(`parses ${fixture.name} Messages`, async () => {
      const file = fileURLToPath(new URL(fixture.path, import.meta.url));
      const summary = await summarizeReport(file);

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

      const html = await renderReport(file, { title: fixture.name });
      expect(html).toContain(fixture.feature);
    });
  }
});
