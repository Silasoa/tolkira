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
    sha256: '823aa984a22856c2c68633a43b168d063936f065dce5f995e2f19515c0d00539',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '5fde7546efbc6f5f7b36fef4a1ea344efa1afee35450f69f54b4c5b9959879f3',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '75fb4594bc30572826d03b80fbb87cca56027236c8cc1cea7fd4aad6e7cf9b39',
  },
  {
    name: 'messages examples tables',
    fixture: 'messages/examples-tables.ndjson',
    sha256: '924859631fd86c2701a9f9795aa64e6270be0bfed52c47b25a3585fca9d05de7',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '22870cc70433c48b360e73e651ffa3e2f15ab849af49316c3dd3b31d387b904c',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '3a469f8f6626148c4838c1c3212f06f3541d42cecd042dcd1a55da0dca93fc8d',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '52063fa223da1f0e3034a3c93dc4cc1df71175e70c8bf1d91ee4e3d766474168',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: 'ec6fbeb6a0cf10829ad2f9de13f9648283bb1c2005c689c7cc29c801c6f4a9a8',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '0028f262d9a8d804adb1a90ea22391176e83108527a43bc746b6035f956789af',
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
      'fcc6d797ce8adca5c397d3b6df1eb338b19975b860318b2232f9e4e8be44d787',
    );
  });
});
