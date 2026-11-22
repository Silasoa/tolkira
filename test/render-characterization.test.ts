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
    sha256: '9edb50afb256dfd071d6b3299fdde5dffc8ac152c0788607a3a3f87132aca4ff',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '72a30a2176539607acfc87603cbe5cddb014d895a32af1fdc5f27d71a368346a',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '2c266fb4bf0dd3fa49aab5689f067b546cfcea6d01cd42a9fc7643b02c2f6fbd',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: 'fc92f09a0a9c62beefc78c087df8323641b1f5334c783f1fd729acddb9eb49f8',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '470f2ca4eeaa131d7e9cf8eb5dee99a7a844b4000ec782c4d2e10a19db020526',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '1333c4fe0578f7817c1cd723530c5d56018753f543cd3a48e118a416c7e64d01',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '4f3a01441881030bf806fbd8e4471ff51a838cca44fd96cc4fe5b71344a4b33a',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: 'd32827f4dfc501646b5f62d4ba98ba156dffe46d8d4510196a6e4c44551482d8',
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
