// Opt-in PDF export: the report HTML printed by a local Chromium. The engine is
// an optional peer, loaded only when a PDF is requested.

export interface PdfOptions {
  /** Print timeout in milliseconds; defaults to five minutes. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 300_000;

const INSTALL_GUIDANCE = `PDF output needs the optional Playwright Chromium engine.
Install beside Tolkira: npm i -D playwright
Then: npx playwright install chromium
Or omit --pdf.`;

type Chromium = typeof import('playwright-core').chromium;

async function loadChromium(): Promise<Chromium> {
  let engine: typeof import('playwright-core');
  try {
    engine = await import('playwright-core');
  } catch {
    throw new Error(INSTALL_GUIDANCE);
  }
  let chromium: Chromium | undefined;
  try {
    chromium = (engine as { chromium?: Chromium }).chromium;
  } catch {
    // A module mock without the export is as unusable as a missing package.
    throw new Error(INSTALL_GUIDANCE);
  }
  if (!chromium) throw new Error(INSTALL_GUIDANCE);
  return chromium;
}

function missingBrowser(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Executable doesn't exist|playwright install/i.test(message);
}

// `page.pdf` has no timeout option; bound the print ourselves so a stuck
// Chromium cannot hang CI. The browser is closed by the caller's `finally`.
function printWithin<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`PDF print timed out after ${ms} ms`)),
      ms,
    );
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
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
      if (missingBrowser(error)) throw new Error(INSTALL_GUIDANCE);
      throw error;
    }
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout });
    await page.evaluate(async () => {
      await document.fonts.ready.catch(() => undefined);
      await Promise.all(
        Array.from(document.images, (image) =>
          image.decode().catch(() => undefined),
        ),
      );
    });
    const printOptions = {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    };
    const pdf = await printWithin(page.pdf(printOptions), timeout);
    return new Uint8Array(pdf);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
