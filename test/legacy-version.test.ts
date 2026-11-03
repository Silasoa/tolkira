import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/index.js';
import { parseLegacyJson } from '../src/input/legacy.js';
import { buildReportModel } from '../src/report/model.js';

const versions = [
  '2.3.1',
  '3.2.1',
  '4.2.1',
  '5.1.0',
  '6.0.7',
  '7.3.2',
  '13.3.0',
];

describe('legacy cucumber-js versions', () => {
  for (const version of versions) {
    it(`parses and renders cucumber-js ${version} JSON`, async () => {
      const file = fileURLToPath(
        new URL(
          `./fixtures/legacy/cucumber-js-${version}.json`,
          import.meta.url,
        ),
      );
      const content = await readFile(file, 'utf8');
      const envelopes = parseLegacyJson(content, file, {
        idPrefix: `v${version}`,
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      const model = buildReportModel(envelopes);

      expect(model.counts.scenarios.total).toBe(2);
      expect(model.counts.scenarios.passed).toBe(1);
      expect(model.counts.scenarios.failed).toBe(1);
      const failed = model.scenarios.find((scenario) => scenario.status === 'failed');
      expect(failed?.name).toBe('fails');
      expect(
        failed?.steps.some((step) => step.message?.includes('boom')),
      ).toBe(true);

      const html = await renderReport(file, {
        title: `cucumber-js ${version}`,
      });
      expect(html).toContain('Old cucumber compatibility');
      expect(html).toContain('fails');
    });
  }
});
