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
    sha256: '18405db0d27a9e2c20a769bd2d388412b307f3a70d352b5edcab88174cc9c21a',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '973240d80ea38b4b86e5de90f53e3dbfa6f858473bbe6e17a5d3a71a5c29edef',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '9b2577ee579fb8f87c37bd050e246528a3a9f7f95f5003cb2813ddd38e8a0f0e',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '9dd45badb4cbdc5565a0e3c11254155550021c56d0815c7bf2b4a1b0cd4bac77',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '7021dcf46bd0235fb05924c47b1742ec715bb1fbcef24e75d51be57f402fb995',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '33947b43b346e19d7bfe9982f9c985b9971d208d86d0ba871a16408e6434f5f9',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '055c4574fbd8044b5f07fab5266c66c8d556f569c7740da7d33144a5033008fc',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: 'c39df5a4c59d60242a87e81d26571791281b33c312531da4c1d2b18609934321',
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
