// An intentional output change runs `npx vitest run -u test/render-golden.test.ts`,
// then replaces the failing hashes from the failure output.
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readHistory } from '../src/history.js';
import { renderReport, summarizeReport } from '../src/index.js';

// Legacy JSON without a pinned run time emits a zero timestamp, so no output
// date remains to stabilise here.

const fixtures = [
  {
    name: 'messages screenshot',
    fixture: 'messages/screenshot.ndjson',
    sha256: '76e0a8132d03d6546a60c3eedf620165cff704fc227bf49511e387d0abd28e52',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '449db3d192200c91e45d6e47b8301bb73e241b2579f139ae7d02f52dde166909',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: 'd043fa8e6428d7a9d2b8a32fb3cfc74b58a15e8c892d75a789afae3ca6543a17',
  },
  {
    name: 'messages examples tables',
    fixture: 'messages/examples-tables.ndjson',
    sha256: 'fd6213d6f5d5fe88aaff18e241e1beeb4e6612a405f01f412167295d10a10167',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '82dae5021f85e54d987fb69708f42caf5db2eb7a8afd0da276fb1fd81ee6719e',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '882223ce2a234287782c1e3516c2bea87729c521bf4fd9ecb1683fc82f0d1727',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: 'ff4ef3a07e898d99f805cb0de58385abc2d9d2b2c5cd4fe77793422685752c29',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '151a14f212406ddaeeed6fed91054d1e09e37e35f134029d6be4ade4496df31c',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '97c72547caebfb9b96c2b68aa591e6c50316f1a757d0371a7fefe47f4d6d6da4',
  },
];

describe('render characterization', () => {
  it.each(fixtures)(
    'keeps the $name HTML byte-identical',
    async ({ fixture, sha256 }) => {
      const file = fileURLToPath(
        new URL(`./fixtures/${fixture}`, import.meta.url),
      );
      const html = await renderReport(file, { title: 'Characterization' });

      expect(createHash('sha256').update(html, 'utf8').digest('hex')).toBe(
        sha256,
      );
    },
  );

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
      '2e531bee1f05d69fb292203b2e1858cc0f1957a87a7c079ecac1f20188e58b7e',
    );
  });
});
