// An intentional output change runs `npx vitest run -u test/render-golden.test.ts`,
// then replaces the failing hashes from the failure output.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderReport } from '../src/index.js';

// The legacy parser falls back to `new Date()` for a missing start time, so the
// clock is pinned to keep the hashes stable.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const fixtures = [
  {
    name: 'messages screenshot',
    fixture: 'messages/screenshot.ndjson',
    sha256: '482c16cef12fe3c1854e4fe971facfbf82073f8c895f97bd972783a1d7d35c37',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: 'a5d574bfd94904a55fb323d450f4badd7e83df15df917bec7a8edac5392ce9f3',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '2f84ef940b92e61eafcb563db48dbe39de3f1ad9103e5372d125d4f1ac95bdd2',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '50fb49bc4a53a122130e43113f263eab33f070e85e3172c75ed43280cc17c1d9',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '893672892917d390f1338e9264fff7d3e64a1bd1cda104eda34e48fe69c142ea',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: 'ad992c3f127caea86fee8c98f91ae999e88296eb95cbf98dff8459031b3491a7',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '1c0c87fdd9cdddffaa9ff46a26d797f9b695acb174b0e9cec6c823b3992cdf59',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '6efabb2f3cf7c1be58938ab085bdd0703b4a13f84f4e90cca8e7eaa1f3bf50f2',
  },
];

describe('render characterization', () => {
  it.each(fixtures)('keeps the $name HTML byte-identical', async ({
    fixture,
    sha256,
  }) => {
    const file = fileURLToPath(
      new URL(`./fixtures/${fixture}`, import.meta.url),
    );
    const html = await renderReport(file, { title: 'Characterization' });

    expect(createHash('sha256').update(html, 'utf8').digest('hex')).toBe(
      sha256,
    );
  });
});
