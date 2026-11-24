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
    sha256: '33d3b24e254f00e82d38047236726cc3211e1f34fd6b0478f258fabe5fb55028',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '692f043b1492b613b4cdca7e291e10d7a14d19b2eaa0df0c0d11052d529ab781',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '562f5dffb29ac166d447f44fe3b4348aed936f247c0802b67ff17d29fdf36be4',
  },
  {
    name: 'messages examples tables',
    fixture: 'messages/examples-tables.ndjson',
    sha256: 'd3897710f9c525a2ef5a9b2ec3910753739c09656b57c973208644580d059c97',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: 'c8c81bf1aea5b6b61473346200c6c2e840751231ef39274196831b2dbb2fe4a9',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '14ce8f4477db489398594a14b0387176cb2f9891ebc3ef19fccbe8db5dc0bc57',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: 'eca469c980efc3cc4a2882da9dc2df05d97e466bbde6efa64cac9b894eb6860e',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '951a70237dd3a2daf5eacfe6916e94a1ab77be012cb4e2e8c1d410c4548f92f9',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: 'e456de9172b0794703e8739bdfaba7e680c85de4813fdaa899d0a6f5d3854d7c',
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

    expect(html.match(/<main\b/g) ?? []).toHaveLength(3);
    expect(createHash('sha256').update(html, 'utf8').digest('hex')).toBe(
      'c410f4dead4b759a66a6a4b266829a98125cb9a8eed5bb729b7f9c163fb32c21',
    );
  });
});
