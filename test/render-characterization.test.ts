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
    sha256: '5eee7f129a439eb9f93cc881ffff5317d0d8cfeca46bd81966e057c82804a2fa',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '266529052466a6a334cc283b8e1eaab4d2872e108e009b4042f99c59ef298225',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '2658a0f983ef4a6d0461ce95deff71c4799e8ceb798897b910e3dbe70c0f302f',
  },
  {
    name: 'messages examples tables',
    fixture: 'messages/examples-tables.ndjson',
    sha256: 'cd64046de63c9930be29f73837160fe234e357e5695443a6990b9d96ad78e725',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: 'af93978b48b5a0b24655230907f9f17db7837e8c8cc84ba594ae781e9180b320',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: 'da1109990012f16891a0dacea34699b161688361dcb255b3b7cbdcba96f1eeed',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: 'bdc438cc7fccddd1738445ef6a3b1dee2ea17b27f782c249413a07dd6e217bc6',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '084947a250043d9b6de5c87ccfbc93f1ddc5234137768262534fb20f59ae8243',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: 'aab9fb019fa78109d00560a1c26f29721ef9ec6a336676a0a14f863f144de6c7',
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
      'e372bc13936bad44e5bd7d5e6d96741aca35c2deae52449eae662613df0aa6a3',
    );
  });
});
