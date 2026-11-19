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
    sha256: 'c593ab7e20add614987c0d6beb1f4a9dc43fb2507d92c6a453af5004619f14bb',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '33f72a9c2444603bbd1cf31899561f62ed4ad7f63f816dd28f8d8e84faa86a8c',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '9d58b06d4c7d7f1f2dc138040a13bab2e91168efd9eb2eeeeccce2c97702d2fa',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '8d3c6dbbc219c6d16ec510d2c7646cf3aadccbad63a1dffa8be2e15907e95b16',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '081c88b7c0d930cef81f8c89d390eeec7a7f22b9c7c5254470e8725d28806d80',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '5d9cdfd897c0760b554e6a1e5f421ef85a2a1da96303d2bdaef43fe166d33fba',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: 'b6e4476ef792750df421abcc4b951f76c024924530d450f667e8ba3cadc752a5',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '15e12b7ee3c1ea9aec9f81bac1bc3e578e39b63194e52a0d69199f2289a40efa',
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
