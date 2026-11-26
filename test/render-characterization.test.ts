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
    sha256: 'aaf89399e88f20f710f3ecca076d0a904460b9afab9683d4121f210556ed9d2e',
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
    sha256: '9a1894b9c58c7166d7fa68883e293932203477e370ea5e2405e1826c323180cc',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '5c320248f06217e3860426922f381dbc53dd785e769995ca6c84544b2acc8b00',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: '8ffad1c32c56a6c6eabf63b66fc441c758946950292802ef72029f4846517cf3',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: 'e3c52a4300cdec6ea7fa1bc74f6aa31e7a6b4702d9b5264bdc8b7e8beef8ca39',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '084947a250043d9b6de5c87ccfbc93f1ddc5234137768262534fb20f59ae8243',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: 'e93b916632f80520c954bceb380a817364cb81d1788e2f82269e9a46dbc31065',
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
      'eaf49a897797c4c6924f42aa10121292dc2e4b37b8c6006d16cb8ce20c9b87be',
    );
  });
});
