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
    sha256: '2ad5baf9a2ffc1b74db4176e590663bc4defe79c92d666375d717a718c0c53c8',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '43014dbdc985da0d59c2edf31b94f6375dfe37ffcd113ae278a48bb15b1a8946',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '324d053a955cf91c5324d6ceb6c9a9e97676b7b2bd742ab223fc1fea8313b813',
  },
  {
    name: 'messages examples tables',
    fixture: 'messages/examples-tables.ndjson',
    sha256: 'e521029907b2049aca7bc193633f2b091c1c1b92beb767bba4bf224b8be01ec1',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: 'f27901089742260ba2bef42f20cdaaae3491fdc581e80502e87eeb9dc67d9b8d',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: 'e4c3eaeac5471be27f89601b3827dbe10095c889be3b8e948664930674de155c',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '34f6202a6de9c62129c8c7ed6ce43b0f7e21964cc8b97f0241ea6d7f799bd283',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '7dc2335107bcbef3bb4b54c71c0d18eca39ca34dada02a79ac4bffe462460cba',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: 'e38006b36d7afc7f89fef01b533f2cf7614c57b78c702611c45870f0f6e8e580',
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
      '4252629f6a7c07debe45be03c74cc3f68b44230f6d5b031706502f7289d27e96',
    );
  });
});
