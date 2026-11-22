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
    sha256: '753bcdff05a3fc20d9f74cc1b88e2421a830089d0794671ec71ca8e181d5afb1',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '0c76c6fd40304d9f854c3a1421d3290dafa7631969b20813d4e70f9acd7f449f',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '1e66d29f5d77539618579de50b52e76e8aab73b9c9133f89896b07feb5cfc0f8',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: 'b6f6edebc33b83a9dccb553fd1b0ec36cf5cfcb670ffd1674bc1ea44a529dfd5',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: 'ec7825a4f45f9f946617a41565f3a0ee95e28aaa49f44861751e31bfd93345eb',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: 'b7dbfbe34e32d8b5bc6c7a1471f7a4cd4e92305e74e16cbd42c9f6033529930d',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: 'f4d71b1c76ea2f444c8de18bb220c24c72ae3fc291d4e2af250a647305748466',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '0aefc9d6cb422ec9b8af6f99e2b84906ae40a7a50dc262adde450bd29ccd763b',
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
