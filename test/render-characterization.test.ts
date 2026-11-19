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
    sha256: '8a7813daf08f5730d44033384ba36788dfefb4fb4ba91242fbe97118f959910c',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '6bc1339a6aca678c30ac31c8de34476759a14c3a0ac9d1526afe6a6f046feaba',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '340827420a9ca2cf43faa2e47d8361491025a5804e69d832630e0c1a66413875',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '01730484573ceda9133468a4817163a1b8671d6fa28fee26f37abff7acb76281',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '4eb73d152f9f0cf9089a15ba4c860076874dae79dd28454bc04ffbc9ba429924',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '91ef0a9d91acd20a352ac0fe95b824c8d28ac1e236aec675a07c88046de99fbc',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: 'e8cb7bee0d32d1e7bf88d583cdd581d5394e5cf33db414cd294d1a2d6de7edda',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '3962a282fa8fbc453011b418173128889eb8057019c4280be85f1a04c21a1fa9',
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
