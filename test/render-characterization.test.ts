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
    sha256: '8e975447b87866f45058463ba572741b5c2479d3f92ad017a9f08c0892369a19',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: 'fae0dbf8775859f66619c9e4b923e6dc8afef47e5eee78f1c29dbf1af4591fd4',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '4392e17488d3b3f929e915a36837b5a06e8b6302cd2835c2cd6b4ce336b80009',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '2524a1be3721b51f56cb1da10f723a244edc02c28466d350b5c34c46ee898fd2',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: 'b9f03b6d856e2219a7e369bb46a5f48cbe48fcbe1fec79cef5e99366c5972513',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: 'bbdbe91738160aee16b6cd66497a7ff12b4a2a1430c3cec893130f83ccc8bfbb',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '7f7c19c92220e0330c14e7568ed20161351dce021442fcdaba1e0dd13b871dd1',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '3b6b0cf20aa116aa7b8dbf5e7bca06d198f5b837a7d1fb223c4591f5febdec26',
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
