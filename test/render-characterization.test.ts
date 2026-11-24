// An intentional output change runs `npx vitest run -u test/render-golden.test.ts`,
// then replaces the failing hashes from the failure output.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readHistory } from '../src/history.js';
import { renderReport, summarizeReport } from '../src/index.js';

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
    sha256: 'd7cbc6eb0c9f004ae76fda050524ff2daf6988d2e7df82ab7e46a3477e0b4cbc',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '694e9f2bfe5dbc3cb37d8203d2ae1e7c215ba068c4a8b0300dc785aa64d7e0c6',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: 'f449feccc1f55d5acf4d6e8aec1f49cb6b62f616bfcc3795c66e56e2798bb944',
  },
  {
    name: 'messages examples tables',
    fixture: 'messages/examples-tables.ndjson',
    sha256: 'b3f11a2ff34f353870f35cfe28417abf1b6b970f5dfea45cb51ae47d76518059',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '1efd26b77a00de44e0e0b791205892bc2220b8fbf8914c7fa5397e9d20f33d10',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '97a112578ff1949a078d6bb91c5f1b93349667c78d57cac8119c8deeb56d63f2',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '08c184f6a472df45d2157c6dc8f04417f8e26045e7ea52aa09607e3b157773bc',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '6d629a4bed1dba95854758b8c03d729a6a2380c17db7f2377d9db12ec088f0e1',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: 'c706977608eaadc8628e5381ea319b1f09c9e4b67ab352de9f4ba73c81df7261',
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

  it('keeps the outline summary minus example at the pre-change bytes', async () => {
    // Generated from 08a0449 with the same fixture and serialization:
    // `JSON.stringify(summary, null, 2) + '\n'` was 6,152 bytes.
    const file = fileURLToPath(
      new URL('./fixtures/messages/examples-tables.ndjson', import.meta.url),
    );
    const summary = await summarizeReport(file);
    for (const scenario of summary.scenarios) delete scenario.example;
    const json = `${JSON.stringify(summary, null, 2)}\n`;

    expect(Buffer.byteLength(json, 'utf8')).toBe(6152);
    expect(createHash('sha256').update(json, 'utf8').digest('hex')).toBe(
      '88c7fb2528ac1647267ab8cc141ab5ad8427797aab87418480c7916a21d1c6b4',
    );
  });

  it('keeps the default two-run Trends HTML byte-identical', async () => {
    const file = fileURLToPath(
      new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
    );
    const historyFile = fileURLToPath(
      new URL('./fixtures/history/two-runs.json', import.meta.url),
    );
    const history = await readHistory(historyFile);
    const html = await renderReport(file, {
      title: 'Characterization',
      history,
    });

    expect(html.match(/<main\b/g) ?? []).toHaveLength(1);
    expect(createHash('sha256').update(html, 'utf8').digest('hex')).toBe(
      '808f7dc9ee74aaf644d80ec781985ee333fa5b6d8aa75797d9f26b2b0bdf89fd',
    );
  });
});
