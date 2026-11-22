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
    sha256: '9df6b0d715502632b0a369c62757e5467ee0072f9f99b9c40fca934d67fdea28',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '1da0f12b1611ccd919e092960c2f517bb8574db80cf3b2d47b86ffc77d5406e0',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: 'cff5659ab2effdbe7fe4b3af668e2779e18f9d37ae8444797ea7487a8179f0c6',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '3816362672c5dbbec6415d5bef997efd6d4c1b6cdb6fc61156edd844445bf6aa',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '6210059f27248d197dda4929d949ad31fbbae6d0383da8c4998e5c9f0619a1be',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: 'a976a8de0676db08f532736316c83aabb8d3c6ea0927a1c916e5b57131eaa453',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: 'debc5b312a9fc2a644af52d10533be92250eac49be3498915878fb301a8674f4',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '2787e29cec470561d85a0ff8ea145f43f8cc30e1932c3d19a70dacbed529c4ec',
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
