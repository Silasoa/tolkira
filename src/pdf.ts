// Opt-in PDF export: the report HTML printed by a local Chromium. The engine is
// an optional peer, loaded only when a PDF is requested.

import { createRequire } from 'node:module';
import path from 'node:path';

export interface PdfOptions {
  /** Print timeout in milliseconds; defaults to five minutes. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 300_000;
const CLOSE_TIMEOUT_MS = 5_000;

const INSTALL_GUIDANCE = `PDF output needs the optional Playwright Chromium engine.
In your project: npm i -D playwright-core@^1.65.0
Then: npx playwright-core install chromium-headless-shell
A project-local Tolkira install is recommended. Or omit --pdf.`;

type Chromium = typeof import('playwright-core').chromium;
type Engine = typeof import('playwright-core');

async function loadChromium(): Promise<Chromium> {
  let engine: Engine | undefined;
  try {
    engine = await import('playwright-core');
  } catch {
    // A globally installed or npx-cached Tolkira cannot see the caller's
    // project; resolve the peer from the directory the CLI was started in.
    try {
      const projectRequire = createRequire(
        path.join(process.cwd(), 'package.json'),
      );
      engine = projectRequire('playwright-core') as Engine;
    } catch {
      throw new Error(INSTALL_GUIDANCE);
    }
  }
  // Check ownership before reading: a mock or a partial module without the
  // export must fall into the install guidance, not a TypeError.
  const hasChromium =
    engine !== undefined && Object.hasOwn(engine, 'chromium');
  const chromium = hasChromium
    ? (engine as { chromium?: Chromium }).chromium
    : undefined;
  if (!chromium) throw new Error(INSTALL_GUIDANCE);
  return chromium;
}

function missingBrowser(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Executable doesn't exist|playwright install/i.test(message);
}

// `page.pdf` has no timeout option; bound each stage ourselves so a stuck
// Chromium cannot hang CI. The browser is closed by the caller's `finally`.
function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`PDF ${label} timed out after ${ms} ms`)),
      ms,
    );
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

// Close in a `finally` block, but never let a hung close keep the process (or
// CI) alive after the PDF bytes or the real error are ready.
async function closeBrowser(
  browser: Awaited<ReturnType<Chromium['launch']>>,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, CLOSE_TIMEOUT_MS);
    timer.unref?.();
  });
  try {
    await Promise.race([browser.close().catch(() => undefined), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Prints report HTML to A4 PDF bytes with Chromium. Writes no file and starts
 * no server; the native print lifecycle supplies `beforeprint`.
 */
export async function renderPdf(
  html: string,
  options: PdfOptions = {},
): Promise<Uint8Array> {
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const chromium = await loadChromium();
  let browser: Awaited<ReturnType<Chromium['launch']>> | undefined;
  try {
    try {
      browser = await chromium.launch({ headless: true });
    } catch (error) {
      if (missingBrowser(error)) {
        throw new Error(INSTALL_GUIDANCE, { cause: error });
      }
      throw error;
    }
    const page = await browser.newPage();
    // Caller HTML can carry external images; the PDF contract is offline.
    await page.route(/^https?:\/\//, (route) => route.abort());
    await page.setContent(html, { waitUntil: 'load', timeout });
    await withDeadline(
      page.evaluate(async () => {
        // Lazy thumbnails below the fold never load or decode until print;
        // make every image eager before waiting for it.
        for (const image of document.images) image.loading = 'eager';
        await document.fonts.ready.catch(() => undefined);
        await Promise.all(
          Array.from(document.images, (image) =>
            image.decode().catch(() => undefined),
          ),
        );
      }),
      timeout,
      'font/image wait',
    );
    const printOptions = {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    };
    const pdf = await withDeadline(
      page.pdf(printOptions),
      timeout,
      'print',
    );
    // Return a view over the engine bytes; the PDF can be large.
    return new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength);
  } finally {
    if (browser) await closeBrowser(browser);
  }
}
