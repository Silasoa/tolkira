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
    sha256: 'a5f0a18ee83646e6e4d566406eef068591f943aeb7e468fe38566e97dcc201d5',
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
    sha256: '85222cdaa70ffa664f3bbdcebdc59fb44d995a8619005e6f38d75bb89d54dcce',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: 'afc2cc2ebf67da844a6d0bb1217e3f0f0e80b1d87ed070d14af907178e1429d7',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: 'b93ac40672be81ca54530ce95e12b9473763d4a4038e41b55db5f54fffa1d071',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '8366fed0ad1b4f2ffae308bc52b3bf8842e56ad0afee918c966622e123508d00',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '084947a250043d9b6de5c87ccfbc93f1ddc5234137768262534fb20f59ae8243',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '8b22da12ce45a2efc3732afef564d0f11aeb6f2e4d3929fdfc575abcb2236ccf',
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
      '7da62053f4c8806ecedaf60dfe10b50bcd7d05e12532b035f84bd7d2ea829b94',
    );
  });
});
