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
    sha256: '6f318b424f439a18f99c4eb9aff22d5cd562443fb527042cfc3e2b16903cbd44',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '1e5486baa6a29c6b5277fd2ed8bfa3bda3a3fea0bfce88ae2e6c98937fbfda93',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: 'd977d3927a2bdb020c7f8c6d1579d1768237d24e367c03e7db6491e83d2e6db7',
  },
  {
    name: 'messages examples tables',
    fixture: 'messages/examples-tables.ndjson',
    sha256: 'a99f7a9b85a3ad4a61a04b829121951c17895415233ad0b48acd17be86c1cdcf',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: 'b67390ca099e33fec812bd5da384ee65146a9fc11117ee28361c3c95465873b5',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: 'd3b7f8c1ff588e0d79ac39e05a8a4f0edaf012423e9b8c2b564868737f098cf2',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '6c9a49ca36363950fd1a4568377d401813765934cc83fb487158cf68abd041e9',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '192b8c83b9a2c7bba6ff469fc68667bd3f6f913770435a51570d3a609e1aa19c',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '2ef881cec69d8ac3a18bfa3c50ddac802f1048863aabbd49918aeaf480855160',
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
      'c8c4c6f3f38bd76220a6321ca613ed2c213578e1b3ab19f41045f8b0f46472d1',
    );
  });
});
