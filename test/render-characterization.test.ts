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
    sha256: 'e8af933784abcfc0b531fef7d9cb891fbd196b631e42e02b7cc31749657555e4',
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
    sha256: '7dc8a1d974c41217414946a9cb16eb0c62b896ae6171cc77240cdaf20714f194',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: '121553d44c4340345270b2e37bfdbe1304ad6c81b1b3e90a9ab95b7de68b81c3',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: 'be394a564dbc9bd7bf6d64bd88f58f502d8c221f77be4800aba2281dc1674365',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '8e439623a167b2e549be9b82f37604029dedef752aad5a6b050105faa26f0d1a',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '084947a250043d9b6de5c87ccfbc93f1ddc5234137768262534fb20f59ae8243',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '05a4072aee50d8b747c01b84db8be355ff2dc5a8819a58c65ae699e00e5eabee',
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
      '98e75e27f14d9a4a10f1be5704b5fd1b2b265adcfa006a5b46922eeb64f74f50',
    );
  });
});
