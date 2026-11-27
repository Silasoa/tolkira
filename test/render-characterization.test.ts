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
    sha256: 'fff697cda76c538b7f751478140682f6310e4962c0678f1281601faca9f71405',
  },
  {
    name: 'messages all statuses',
    fixture: 'messages/all-statuses.ndjson',
    sha256: '5c149c4527bf00da9fb269b9ea4c3452663069c794ceadaefb08d720831fe2db',
  },
  {
    name: 'messages empty statuses',
    fixture: 'messages/empty-statuses.ndjson',
    sha256: '91077626341ee9c23d1761fab53b822e9a6516509c086b4f2ff7ff3f863d8d13',
  },
  {
    name: 'messages examples tables',
    fixture: 'messages/examples-tables.ndjson',
    sha256: '390a5411c3d8c7b9daca9eaaa32843684ae6b8edec75aa48ba8e0950a0c03d37',
  },
  {
    name: 'legacy happy',
    fixture: 'legacy/happy.json',
    sha256: 'c4cdddaca563ab5a2b2caa3491d61bb5c6b992e812504b5a5e30a31ecd5f7366',
  },
  {
    name: 'legacy failed',
    fixture: 'legacy/failed.json',
    sha256: 'bb31ad0fe238d57107d52d4c76d21167b88e79b53acbf3f01d2ca6ea67c5c571',
  },
  {
    name: 'playwright real run',
    fixture: 'playwright/real-run.json',
    sha256: '830928aaafc29aedd5d9c190c76dace6ef7037e4c60fb3d6e8c989f7015d2a26',
  },
  {
    name: 'playwright two files',
    fixture: 'playwright/two-files.json',
    sha256: '3596e0ae9768f6ccf616d28adfa32663ec3cf0c5afb03491df6f7f08dadd7ed9',
  },
  {
    name: 'playwright skipped no steps',
    fixture: 'playwright/skipped-no-steps.json',
    sha256: '4bdba701a01cc6e3325726afdcf3c08cf31ebc80b1df8a44343a2acca6a20d3d',
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
      '5e51b1d53db3c37bfcadd4389f50945c814a4abdeb4ee735df3a291b387bae14',
    );
  });
});
