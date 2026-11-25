import { expect, test } from '@playwright/test';
import {
  copyFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
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

const CRC_TABLE = Array.from({ length: 256 }, (_, seed) => {
  let value = seed;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] as number);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4, 'ascii');
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])), 0);
  return Buffer.concat([header, data, checksum]);
}

// A real 160x90 RGB screenshot with a per-scenario gradient, so every
// attachment embeds distinct pixels and its own PDF image XObject.
function screenshotPng(seed: number): Buffer {
  const width = 160;
  const height = 90;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      raw[offset] = (seed * 47 + x * 3) % 256;
      raw[offset + 1] = (seed * 83 + y * 5) % 256;
      raw[offset + 2] = (seed * 29 + x + y) % 256;
      offset += 3;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function screenshotReport(scenarios: number): string {
  const elements = Array.from({ length: scenarios }, (_, index) => ({
    id: `volume;screenshot-${index + 1}`,
    keyword: 'Scenario',
    line: index + 2,
    name: `Scenario ${index + 1} with screenshot`,
    steps: [
      {
        arguments: [],
        keyword: 'Given ',
        name: `screenshot ${index + 1}`,
        result: { status: 'passed', duration: 1_000_000 },
        line: index + 2,
        embeddings: [
          {
            data: screenshotPng(index + 1).toString('base64'),
            media: { type: 'image/png' },
          },
        ],
        match: { location: 'features/volume.feature:2' },
      },
    ],
    tags: [],
    type: 'scenario',
  }));
  return JSON.stringify([
    {
      description: 'Screenshot volume',
      elements,
      id: 'volume',
      keyword: 'Feature',
      line: 1,
      name: 'Screenshot volume',
      tags: [],
      uri: 'features/volume.feature',
    },
  ]);
}

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

  const text = info.text.replaceAll(/\s+/g, '');
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
      expect(info.text.replaceAll(/\s+/g, '')).toContain('AufgezeichneteLäufe');
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

  test('prints forty lazy screenshot scenarios without hanging', async ({
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'the PDF engine is Chromium');
    test.setTimeout(120_000);

    const inputDir = await mkdtemp(path.join(tmpdir(), 'tolkira-pdf-volume-'));
    const input = path.join(inputDir, 'volume.json');
    await writeFile(input, screenshotReport(40), 'utf8');
    let file: PdfFile | undefined;
    try {
      // The deadline makes a lazy-image regression fail in 30 s, not minutes.
      file = await writePdf([input], {
        title: 'Screenshot volume',
        prefix: 'tolkira-pdf-volume-out-',
        timeoutMs: 30_000,
      });

      const bytes = await readFile(file.pdf);
      const info = readPdf(bytes);
      console.log(
        `PDF volume: ${info.pages} pages, ${bytes.byteLength} bytes, ` +
          `${info.images} embedded images`,
      );
      expect(info.pages, 'later pages').toBeGreaterThanOrEqual(2);
      expect(
        info.images,
        'one embedded image per screenshot',
      ).toBeGreaterThanOrEqual(40);
      const text = info.text.replaceAll(/\s+/g, '');
      expect(text).toContain('Scenario40withscreenshot');
      expect(info.width, 'A4 width').toBeGreaterThan(590);
      expect(info.width, 'A4 width').toBeLessThan(600);
    } finally {
      if (file) await removeReport(file.dir);
      await rm(inputDir, { recursive: true, force: true });
    }
  });
});
