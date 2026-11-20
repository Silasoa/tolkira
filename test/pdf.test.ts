import { beforeEach, describe, expect, it, vi } from 'vitest';

// The PDF unit test must never launch a browser in `npm run check`: the engine
// is replaced by this fake page/browser pair.
const engine = vi.hoisted(() => {
  const page = {
    setContent: vi.fn(),
    evaluate: vi.fn(),
    pdf: vi.fn(),
  };
  const browser = {
    newPage: vi.fn(),
    close: vi.fn(),
  };
  const chromium = {
    launch: vi.fn(),
  };
  return { page, browser, chromium };
});

type RenderPdf = (
  html: string,
  options?: { timeoutMs?: number },
) => Promise<Uint8Array>;

const HTML =
  '<!doctype html>\n<html lang="en" dir="ltr"><head><title>PDF run</title></head><body><h1>Report</h1></body></html>';

// Not valid UTF-8 on purpose: the CLI must keep the engine bytes untouched.
const PDF_BYTES = Buffer.from([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xff, 0xfe,
  0x00, 0x01, 0x80, 0x7f,
]);

const INSTALL_GUIDANCE = {
  engine: /optional Playwright Chromium engine/i,
  install: /npm i(?:nstall)? -D playwright(?:-core)?/,
  browser: /playwright(?:-core)? install chromium/,
};

async function loadRenderPdf(): Promise<RenderPdf> {
  const module = (await import('../src/pdf.js')) as {
    renderPdf: RenderPdf;
  };
  return module.renderPdf;
}

beforeEach(() => {
  vi.resetModules();
  vi.doMock('playwright-core', () => ({ chromium: engine.chromium }));

  engine.chromium.launch.mockReset().mockResolvedValue(engine.browser);
  engine.browser.newPage.mockReset().mockResolvedValue(engine.page);
  engine.browser.close.mockReset().mockResolvedValue(undefined);
  engine.page.setContent.mockReset().mockResolvedValue(undefined);
  engine.page.evaluate.mockReset().mockResolvedValue(undefined);
  engine.page.pdf.mockReset().mockResolvedValue(PDF_BYTES);
});

describe('renderPdf', () => {
  it('loads the report HTML directly and returns the Chromium PDF bytes', async () => {
    const renderPdf = await loadRenderPdf();

    const pdf = await renderPdf(HTML);

    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(pdf)).toEqual(PDF_BYTES);
    expect(engine.chromium.launch).toHaveBeenCalledWith({ headless: true });
    expect(engine.browser.newPage).toHaveBeenCalledTimes(1);
    expect(engine.page.setContent).toHaveBeenCalledTimes(1);
    expect(engine.page.setContent).toHaveBeenCalledWith(
      HTML,
      expect.objectContaining({ waitUntil: 'load' }),
    );
    // `setContent` means no temporary report file and no URL navigation.
    expect(
      (engine.page as { goto?: unknown }).goto,
      'no page.goto navigation',
    ).toBeUndefined();
    expect(engine.browser.close).toHaveBeenCalledTimes(1);
  });

  it('prints A4 with the print CSS, background and no header/footer', async () => {
    const renderPdf = await loadRenderPdf();

    await renderPdf(HTML);

    expect(engine.page.pdf).toHaveBeenCalledTimes(1);
    expect(engine.page.pdf).toHaveBeenCalledWith({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      timeout: 300_000,
    });
  });

  it('uses the five-minute print timeout by default and shares it', async () => {
    const renderPdf = await loadRenderPdf();

    await renderPdf(HTML);

    expect(engine.page.setContent).toHaveBeenCalledWith(
      HTML,
      expect.objectContaining({ timeout: 300_000 }),
    );
    expect(engine.page.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 300_000 }),
    );
  });

  it('accepts an API print timeout and applies it to the page', async () => {
    const renderPdf = await loadRenderPdf();

    await renderPdf(HTML, { timeoutMs: 120_000 });

    expect(engine.page.setContent).toHaveBeenCalledWith(
      HTML,
      expect.objectContaining({ timeout: 120_000 }),
    );
    expect(engine.page.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 120_000 }),
    );
  });

  it('awaits fonts and images before printing and leaves beforeprint to page.pdf', async () => {
    const renderPdf = await loadRenderPdf();

    await renderPdf(HTML);

    const sources = engine.page.evaluate.mock.calls
      .map((call) => String(call[0]))
      .join('\n');
    expect(sources).toContain('document.fonts.ready');
    expect(sources).toMatch(/document\.images|img|images/i);
    expect(sources).toContain('decode');
    // The native page.pdf lifecycle fires beforeprint; a manual dispatch would
    // print the wrong state and is not part of the contract.
    expect(sources).not.toMatch(/dispatchEvent|beforeprint|afterprint/);

    expect(engine.page.setContent.mock.invocationCallOrder[0]).toBeLessThan(
      engine.page.evaluate.mock.invocationCallOrder[0] ?? Number.NaN,
    );
    expect(engine.page.evaluate.mock.invocationCallOrder[0]).toBeLessThan(
      engine.page.pdf.mock.invocationCallOrder[0] ?? Number.NaN,
    );
  });

  it('closes the browser when printing fails and keeps the error', async () => {
    const renderPdf = await loadRenderPdf();
    engine.page.pdf.mockRejectedValue(new Error('print failed'));

    await expect(renderPdf(HTML)).rejects.toThrow('print failed');

    expect(engine.browser.close).toHaveBeenCalledTimes(1);
  });

  it('closes the browser when loading the HTML fails', async () => {
    const renderPdf = await loadRenderPdf();
    engine.page.setContent.mockRejectedValue(new Error('content failed'));

    await expect(renderPdf(HTML)).rejects.toThrow('content failed');

    expect(engine.browser.close).toHaveBeenCalledTimes(1);
  });

  it('reports a missing playwright-core engine with install guidance', async () => {
    // A package that resolves but exposes no Chromium is as unusable as an
    // absent one: both must name the install commands instead of leaking a
    // TypeError from the engine.
    vi.resetModules();
    vi.doMock('playwright-core', () => ({}));
    const renderPdf = await loadRenderPdf();

    const error = await renderPdf(HTML).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toMatch(INSTALL_GUIDANCE.engine);
    expect(message).toMatch(INSTALL_GUIDANCE.install);
    expect(message).toMatch(INSTALL_GUIDANCE.browser);
    expect(engine.chromium.launch).not.toHaveBeenCalled();
  });

  it('reports a missing Chromium browser with install guidance', async () => {
    const renderPdf = await loadRenderPdf();
    engine.chromium.launch.mockRejectedValue(
      new Error(
        "browserType.launch: Executable doesn't exist at C:\\browsers\\chrome.exe",
      ),
    );

    const error = await renderPdf(HTML).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toMatch(INSTALL_GUIDANCE.engine);
    expect(message).toMatch(INSTALL_GUIDANCE.install);
    expect(message).toMatch(INSTALL_GUIDANCE.browser);
  });

  it('is exported from the package root', async () => {
    const { renderPdf } = (await import('../src/pdf.js')) as {
      renderPdf: RenderPdf;
    };
    const root = (await import('../src/index.js')) as unknown as {
      renderPdf?: RenderPdf;
    };

    expect(root.renderPdf).toBe(renderPdf);
  });
});
