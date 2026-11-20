import { expect, test } from '@playwright/test';
import { copyFile, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { messagesFixture } from '../fixtures.js';
import { readPdf, removeReport, writePdf, type PdfFile } from './helpers.js';

// 12 mm in PDF points.
const PAGE_INSET = (12 / 25.4) * 72;

const germanInput = fileURLToPath(
  new URL('../fixtures/i18n/german-testdata.json', import.meta.url),
);
const presentation = messagesFixture('attachments-presentation.ndjson');
const historyFixture = fileURLToPath(
  new URL('../fixtures/history/two-runs.json', import.meta.url),
);

function expectA4Pdf(file: PdfFile, bytes: Uint8Array) {
  expect(Buffer.from(bytes.subarray(0, 4)).toString('latin1')).toBe('%PDF');

  const info = readPdf(bytes);
  expect(info.pages, 'Report, Details and Trends pages').toBeGreaterThanOrEqual(
    3,
  );
  // Chromium's A4 MediaBox is 595.92 x 842.88 pt; allow a small engine drift.
  expect(info.width, 'A4 width').toBeGreaterThan(590);
  expect(info.width, 'A4 width').toBeLessThan(600);
  expect(info.height, 'A4 height').toBeGreaterThan(838);
  expect(info.height, 'A4 height').toBeLessThan(846);
  for (const [side, inset] of Object.entries(info.insets)) {
    expect(inset, `${side} 12 mm inset`).toBeGreaterThan(PAGE_INSET - 2);
    expect(inset, `${side} 12 mm inset`).toBeLessThan(PAGE_INSET + 2);
  }

  // The print archive embeds screenshot pixels, not just their file names.
  expect(info.images, 'embedded screenshots').toBeGreaterThan(0);

  const text = info.text.replace(/\s+/g, '');
  expect(text).toContain('Fehlgeschlagen');
  expect(text).toContain('SzenarienmitErgebnissen');
  expect(text).toContain('Laufdetails');
  expect(text).toContain('ÜberweisungohneDeckung');
  // No browser header/footer, URL, page number or temporary path. `about:blank`
  // is the page URL Chrome would print, `file.dir` any file URL from the report
  // directory. The fixture's own links.txt carries `file:///etc/passwd` as user
  // data; the complete archive must print it, so a bare `file://` check would
  // reject correct output.
  expect(text).not.toContain('about:blank');
  expect(text).not.toContain(file.dir);
  // Chrome's default footer renders the page as `N/M`.
  expect(text).not.toMatch(/Page\d+of\d+/i);

  return info;
}

test.describe('CLI --pdf', () => {
  test('writes a German A4 PDF with the complete archive next to the report', async ({
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'the PDF engine is Chromium');
    test.setTimeout(180_000);

    const historyDir = await mkdtemp(
      path.join(tmpdir(), 'tolkira-pdf-history-'),
    );
    const history = path.join(historyDir, 'history.json');
    await copyFile(historyFixture, history);
    let file: PdfFile | undefined;
    try {
      file = await writePdf([germanInput, presentation], {
        title: 'Druckbericht',
        locale: 'de',
        withReport: true,
        history,
        prefix: 'tolkira-pdf-out-',
      });

      expect(file.report).toBeDefined();
      await expect(readFile(file.report as string, 'utf8')).resolves.toContain(
        '<html',
      );
      const info = expectA4Pdf(file, await readFile(file.pdf));
      expect(info.text.replace(/\s+/g, '')).toContain(
        'AufgezeichneteLäufe',
      );
      expect((await readdir(file.dir)).sort()).toEqual([
        'report.html',
        'run.pdf',
      ]);
    } finally {
      if (file) await removeReport(file.dir);
      await rm(historyDir, { recursive: true, force: true });
    }
  });

  test('writes a German PDF without a report file', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'the PDF engine is Chromium');
    test.setTimeout(180_000);

    let file: PdfFile | undefined;
    try {
      file = await writePdf([germanInput, presentation], {
        title: 'Druckbericht',
        locale: 'de',
        prefix: 'tolkira-pdf-only-',
      });

      expect(file.report).toBeUndefined();
      expect(await readdir(file.dir)).toEqual(['run.pdf']);
      expectA4Pdf(file, await readFile(file.pdf));
    } finally {
      if (file) await removeReport(file.dir);
    }
  });
});
