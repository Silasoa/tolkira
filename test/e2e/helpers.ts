import { expect, type Page } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import { runCli } from '../../src/cli.js';

export interface ReportFile {
  dir: string;
  output: string;
}

export interface EmailFile {
  dir: string;
  email: string;
  report?: string;
}

export async function writeInput(
  name: string,
  content: string,
  prefix = 'tolkira-input-',
): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  const file = path.join(dir, name);
  try {
    await writeFile(file, content, 'utf8');
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { dir, file };
}

// A 40-scenario legacy run for the Trends and print specs. The last two
// scenarios fail; the given indices carry the @flaky tag, so [0, 1] is a 5%
// share and [] is a flat 0.
export function legacyFlakyReport(tagged: number[]): string {
  const scenarios = 40;
  return JSON.stringify([
    {
      uri: 'features/flaky-trends.feature',
      name: 'Flaky trends',
      keyword: 'Feature',
      elements: Array.from({ length: scenarios }, (_, index) => ({
        keyword: 'Scenario',
        type: 'scenario',
        name: `scenario ${index + 1}`,
        line: index + 3,
        tags: tagged.includes(index)
          ? [{ name: '@flaky', line: index + 3 }]
          : [],
        steps: [
          {
            keyword: 'Given ',
            name: 'a step',
            result: {
              status: index < scenarios - 2 ? 'passed' : 'failed',
              duration: 1,
            },
          },
        ],
      })),
    },
  ]);
}

export async function writeReport(
  inputs: string[],
  title = '',
  prefix = 'tolkira-e2e-',
  locale = '',
  extraArgs: string[] = [],
): Promise<ReportFile> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  const output = path.join(dir, 'report.html');
  const args = [...inputs, '--out', output];
  if (title) args.push('--title', title);
  if (locale) args.push('--locale', locale);
  args.push(...extraArgs);
  let stderr = '';
  try {
    const code = await runCli(args, {
      stdout: () => undefined,
      stderr: (text) => {
        stderr += text;
      },
    });
    expect(code, stderr).toBe(0);
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { dir, output };
}

export async function removeReport(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export async function waitForImages(page: Page): Promise<void> {
  await page.evaluate(() => {
    const images = Array.from(document.images);
    images.forEach((image) => {
      image.loading = 'eager';
    });
    return Promise.all(
      images.map((image) => image.decode().catch(() => undefined)),
    );
  });
}

// Writes the email, optionally together with the report, in one CLI run.
export async function writeEmail(
  inputs: string[],
  title = '',
  prefix = 'tolkira-email-e2e-',
  locale = '',
  withReport = false,
): Promise<EmailFile> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  const email = path.join(dir, 'email.html');
  const report = withReport ? path.join(dir, 'report.html') : undefined;
  const args = [...inputs, '--email', email];
  if (report) args.push('--out', report);
  if (title) args.push('--title', title);
  if (locale) args.push('--locale', locale);
  let stderr = '';
  try {
    const code = await runCli(args, {
      stdout: () => undefined,
      stderr: (text) => {
        stderr += text;
      },
    });
    expect(code, stderr).toBe(0);
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { dir, email, ...(report === undefined ? {} : { report }) };
}

// Writes one report that reads and appends the shared history sidecar; call it
// twice with different inputs to build a multi-run file.
export async function writeReportWithHistory(
  inputs: string[],
  history: string,
  title = '',
  prefix = 'tolkira-history-e2e-',
  locale = '',
  extraArgs: string[] = [],
): Promise<ReportFile> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  const output = path.join(dir, 'report.html');
  const args = [...inputs, '--out', output, '--history', history];
  if (title) args.push('--title', title);
  if (locale) args.push('--locale', locale);
  args.push(...extraArgs);
  let stderr = '';
  try {
    const code = await runCli(args, {
      stdout: () => undefined,
      stderr: (text) => {
        stderr += text;
      },
    });
    expect(code, stderr).toBe(0);
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { dir, output };
}

export interface PdfFile {
  dir: string;
  pdf: string;
  report?: string;
}

// Writes the PDF, optionally with a report and history, in one CLI run.
export async function writePdf(
  inputs: string[],
  options: {
    title?: string;
    prefix?: string;
    locale?: string;
    withReport?: boolean;
    history?: string;
    timeoutMs?: number;
  } = {},
): Promise<PdfFile> {
  if (options.history !== undefined && !options.withReport) {
    throw new Error('--history requires --out, so withReport must be true');
  }
  const dir = await mkdtemp(path.join(tmpdir(), options.prefix ?? 'tolkira-pdf-e2e-'));
  const pdf = path.join(dir, 'run.pdf');
  const report = options.withReport ? path.join(dir, 'report.html') : undefined;
  const args = [...inputs, '--pdf', pdf];
  if (report) args.push('--out', report);
  if (options.history) args.push('--history', options.history);
  if (options.title) args.push('--title', options.title);
  if (options.locale) args.push('--locale', options.locale);
  if (options.timeoutMs !== undefined) {
    args.push('--pdf-timeout', String(options.timeoutMs));
  }
  let stderr = '';
  try {
    const code = await runCli(args, {
      stdout: () => undefined,
      stderr: (text) => {
        stderr += text;
      },
    });
    expect(code, stderr).toBe(0);
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { dir, pdf, ...(report === undefined ? {} : { report }) };
}

export interface PdfInfo {
  pages: number;
  width: number;
  height: number;
  images: number;
  text: string;
  /** Page insets in points; the print CSS uses 12 mm (34.02 pt). */
  insets: { left: number; right: number; top: number; bottom: number };
}

function pdfLatin(pdf: Uint8Array): string {
  return Buffer.from(pdf).toString('latin1');
}

function pdfObject(
  latin: string,
  number: number,
): { body: string; index: number } | undefined {
  const pattern = new RegExp(`(?:^|[\\r\\n])${number} 0 obj\\b`);
  const match = pattern.exec(latin);
  if (!match) return undefined;
  const index = match.index + match[0].indexOf('obj') + 3;
  const end = latin.indexOf('endobj', index);
  if (end < 0) return undefined;
  return { body: latin.slice(index, end), index };
}

function pdfStream(
  pdf: Uint8Array,
  latin: string,
  number: number,
): string | undefined {
  const object = pdfObject(latin, number);
  if (!object) return undefined;
  const streamIndex = latin.indexOf('stream', object.index);
  if (streamIndex < 0) return undefined;
  const start = latin.indexOf('\n', streamIndex) + 1;
  const end = latin.indexOf('endstream', start);
  if (end < 0) return undefined;
  try {
    return inflateSync(pdf.subarray(start, end)).toString('latin1');
  } catch {
    return undefined;
  }
}

function pdfDict(text: string, key: string): string | undefined {
  const start = text.indexOf(`/${key}`);
  if (start < 0) return undefined;
  let index = text.indexOf('<<', start);
  if (index < 0) return undefined;
  let depth = 0;
  for (; index < text.length; index += 1) {
    if (text.startsWith('<<', index)) {
      depth += 1;
      index += 1;
    } else if (text.startsWith('>>', index)) {
      depth -= 1;
      index += 1;
      if (depth === 0) return text.slice(start + key.length + 2, index - 1);
    }
  }
  return undefined;
}

function pdfUtf16(hex: string): string {
  const bytes = Buffer.from(hex, 'hex');
  return bytes.length % 2 === 0 ? bytes.swap16().toString('utf16le') : '';
}

interface PdfCMap {
  map: Map<number, string>;
  sourceBytes: number;
}

function parsePdfCMap(text: string): PdfCMap {
  const map = new Map<number, string>();
  let sourceBytes = 1;
  const codespace = /begincodespacerange\s*<([0-9A-Fa-f]+)>/.exec(text);
  if (codespace) sourceBytes = (codespace[1] ?? '').length / 2;
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const match of (block[1] ?? '').matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g,
    )) {
      map.set(parseInt(match[1] ?? '', 16), pdfUtf16(match[2] ?? ''));
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const match of (block[1] ?? '').matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g,
    )) {
      const start = parseInt(match[1] ?? '', 16);
      const end = parseInt(match[2] ?? '', 16);
      const target = parseInt(match[3] ?? '', 16);
      for (let code = start; code <= end && code - start < 65536; code += 1) {
        // PDF CMaps map UTF-16 code units; a surrogate pair arrives as two
        // separate consecutive targets, so a code-point conversion is wrong.
        // oxlint-disable-next-line unicorn/prefer-code-point
        map.set(code, String.fromCharCode(target + (code - start)));
      }
    }
  }
  return { map, sourceBytes };
}

function pdfCMapFor(
  pdf: Uint8Array,
  latin: string,
  fontRef: number,
): PdfCMap | undefined {
  const font = pdfObject(latin, fontRef);
  const ref = /\/ToUnicode\s+(\d+) 0 R/.exec(font?.body ?? '');
  if (!ref) return undefined;
  const text = pdfStream(pdf, latin, Number(ref[1]));
  return text ? parsePdfCMap(text) : undefined;
}

function decodePdfHex(hex: string, cmap: PdfCMap): string {
  const bytes = Buffer.from(hex, 'hex');
  let out = '';
  for (
    let index = 0;
    index + cmap.sourceBytes <= bytes.length;
    index += cmap.sourceBytes
  ) {
    const code =
      cmap.sourceBytes === 1
        ? (bytes[index] ?? 0)
        : bytes.readUInt16BE(index);
    out += cmap.map.get(code) ?? '';
  }
  return out;
}

function pdfPageText(
  pdf: Uint8Array,
  latin: string,
  page: string,
): string {
  const resources = pdfDict(page, 'Resources');
  const fontsBlock = pdfDict(resources ?? '', 'Font');
  const fonts = new Map<string, PdfCMap | undefined>();
  for (const match of (fontsBlock ?? '').matchAll(
    /\/([A-Za-z0-9]+)\s+(\d+) 0 R/g,
  )) {
    fonts.set(match[1] ?? '', pdfCMapFor(pdf, latin, Number(match[2])));
  }

  const refs: number[] = [];
  const direct = /\/Contents\s+(\d+) 0 R/.exec(page);
  if (direct) refs.push(Number(direct[1]));
  const array = /\/Contents\s*\[([^\]]*)\]/.exec(page);
  if (array) {
    for (const match of (array[1] ?? '').matchAll(/(\d+) 0 R/g)) {
      refs.push(Number(match[1]));
    }
  }

  let text = '';
  for (const ref of refs) {
    const content = pdfStream(pdf, latin, ref);
    if (!content) continue;
    let current: PdfCMap | undefined;
    for (const token of content.matchAll(
      /\/([A-Za-z0-9]+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj|\[([^\]]*)\]\s*TJ/g,
    )) {
      if (token[1]) {
        current = fonts.get(token[1]);
        continue;
      }
      if (token[2]) {
        text += `${current ? decodePdfHex(token[2], current) : ''} `;
        continue;
      }
      for (const part of (token[3] ?? '').matchAll(/<([0-9A-Fa-f]+)>/g)) {
        text += current ? decodePdfHex(part[1] ?? '', current) : '';
      }
      text += ' ';
    }
  }
  return text;
}

/**
 * Reads the PDF facts the Chromium e2e asserts: page count, A4 MediaBox,
 * embedded images, extractable text and the print-CSS page inset.
 */
export function readPdf(pdf: Uint8Array): PdfInfo {
  const latin = pdfLatin(pdf);
  const pages = [...latin.matchAll(/(\d+) 0 obj\b([\s\S]*?)endobj/g)]
    .filter((match) => /\/Type\s*\/Page\b/.test(match[2] ?? ''))
    .map((match) => Number(match[1]));

  const box = /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/.exec(
    latin,
  );
  if (!box) throw new Error('PDF has no MediaBox');
  const width = Number(box[3]) - Number(box[1]);
  const height = Number(box[4]) - Number(box[2]);

  let text = '';
  for (const pageNumber of pages) {
    const page = pdfObject(latin, pageNumber);
    text += `${pdfPageText(pdf, latin, page?.body ?? '')}\n`;
  }

  const firstPage = pages[0] ? pdfObject(latin, pages[0]) : undefined;
  const contents = /\/Contents\s+(\d+) 0 R/.exec(firstPage?.body ?? '');
  const content = contents ? pdfStream(pdf, latin, Number(contents[1])) : '';
  const transform = /([\d.]+) 0 0 -?[\d.]+ 0 ([\d.]+) cm/.exec(content ?? '');
  const clip = /([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re\s+W\*\s*n/.exec(
    content ?? '',
  );
  if (!transform || !clip) {
    throw new Error('PDF has no page content clip');
  }
  const scale = Number(transform[1]);
  const [x, y, clipWidth, clipHeight] = clip.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const insets = {
    left: x * scale,
    bottom: y * scale,
    right: width - (x + clipWidth) * scale,
    top: height - (y + clipHeight) * scale,
  };

  return {
    pages: pages.length,
    width,
    height,
    images: (latin.match(/\/Subtype\s*\/Image/g) ?? []).length,
    text,
    insets,
  };
}

export function reportUrl(output: string, search = ''): string {
  return `${pathToFileURL(output).href}${search}`;
}

export async function stubClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied =
            text;
          return Promise.resolve();
        },
      },
    });
  });
}

export async function stubClipboardFailure(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error('blocked')),
      },
    });
    document.execCommand = () => false;
  });
}

export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (window as unknown as { __tolkiraCopied?: string }).__tolkiraCopied ?? '',
  );
}
