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
    sha256: '58cbc65009ef068a89a4f8979ae8bb9d579d7bdcd83a1cec242f90ee235350f9',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: 'f02bc99e63772d724ced5af889336bf3fcc3fa66c2868be62dfcaa10ea7f16d5',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '67acdd39335cb569c7953daedb589a3aa981cca6a6e80d16b0d560f2e3ea67d9',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '510bc4f85c2a222db00d462f20a752a2c79d6cdc6ba8126fb16239e5d5a3a74f',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '9c326122e11ca633177ae38003810aaa0937d17e1f297c07c0fbc69ebb9b9380',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '4f1db0a4ad0cb6310e86446950b4f15b968dfc0488c2f8b89666b2eead691570',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '5d0ce1603199196d80a3fbd3237652f472d3e5dda2034ed8d6f62b5e451a3494',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '9414164cda25693772f42604d6f25f4d3d06c7a00fcbff1a01394f88c302e8de',
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
