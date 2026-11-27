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
    sha256: 'a8498d0c99a9fffed6dadd237d8a91a2ea6bc2102f5ea0453add07d83d36c4be',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '5c910050d1c585e4e99da74075756ad67c7c4bec64d5924f5e3a99948e63149a',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '982e1f88dd0fe9db8d440ab702dbb47dc8e69772d59c85ba945999b189331186',
  },
  {
    name: 'messages examples tables',
    fixture: 'messages/examples-tables.ndjson',
    sha256: '174b89a5198d3ce447341121e1fc6d7f2f0d2e68934263b6203eaa8431a5361a',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: 'd941cd76accfc56927ecc68d4c548d2c4fdebcc9b5f80b72070246a7868b3701',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '3a91eae9cd9b18a5505f157b46e9a8928698d475aadb20d4e7c1301bfa3a8962',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '5154692443cdea305120722af29da792df6d41ab32324c180403c8fdd8acee43',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: 'b967619a7b76ceed7a599044ac4fc11a1215e078bf1901f9448b5d90fa84735c',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: 'd3771adb424fc068f13ccd48b32c1c479212da711beac8c9e07c41bc0d544d9b',
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
      '2471bf1f010053c6d6cbcd0614f0cc2d77ddb0fda2affb59bcebbfb6c5fe70c8',
    );
  });
});
