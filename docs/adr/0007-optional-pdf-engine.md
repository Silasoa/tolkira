# ADR 0007 â€” Optional Playwright-based PDF export

## Status

Accepted and implemented in the `add-pdf-export` change (#13c), 2026-11-20.

## Context

The report has a complete print view: `@media print`, a light palette, fitted
tables, page breaks and a `beforeprint`/`afterprint` handler that opens every
view and detail. The browser's Save as PDF is the zero-dependency route, but CI
and headless workflows need a PDF file without a human print dialog.

The PDF engine research (`docs/research/pdf-engine-options.md`) compared
Playwright Chromium, Puppeteer, the Chrome/Edge headless CLI, PDFKit/pdf-lib,
WeasyPrint and wkhtmltopdf. A browser engine can reuse the print view; a pure JS
library would need a second report layout (cover, metrics, failures,
screenshots, tables, fonts, locale) and would not reuse the HTML. The Chrome CLI
is Letter-only by default and puts the local `file://` URL in its footer.

## Decision

- Add `--pdf <file>` and `renderPdf(html, options)` as an opt-in PDF export.
- Use **Playwright Chromium `page.pdf()`** as the engine. `playwright-core` is an
  **optional peer dependency**, version-aligned with the dev
  `@playwright/test`, imported dynamically only by `src/pdf.ts` and marked
  external in esbuild. `npm install tolkira` keeps its three runtime
  dependencies and the default dependency surface.
- Render the report HTML with `page.setContent` (no temporary file and no
  `--out` re-read), wait for `document.fonts.ready` and the images, then print
  A4 with 12 mm margins from the print CSS `@page`, `printBackground`,
  `preferCSSPageSize` and no header/footer. The native `page.pdf` fires
  `beforeprint`; no manual dispatch. The PDF contains the complete text and
  screenshot archive: all present views and details, the light palette and
  fitted tables. A fresh page has no CLI filter state; the browser print remains
  the filtered route.
- The default print timeout is five minutes (`PdfOptions.timeoutMs`,
  API-overridable), so the documented ~2.7-minute 10k print does not hit the 30 s
  browser default.
- Write the PDF atomically after the report and before the email/history/
  `--ci-out`/stdout: `report â†’ PDF â†’ email â†’ history â†’ --ci-out â†’ stdout`. A
  PDF failure exits 1, names the PDF path, keeps the report and skips the email/
  later outputs; no partial PDF remains.
- A missing engine exits 1 with install instructions (`playwright-core` plus a
  Chromium browser, with one tested install command in the docs). The default
  install, the report, JSON, CI, email and print view are unchanged.
- The first slice is Chromium-only, A4, without page numbers, custom headers, a
  CLI filter or a forced landscape; unusually wide runs may use the browser
  print's landscape. Video/audio are not printable. These are documented limits,
  not silent behaviour.
- Update the package peer metadata, docs (`docs/PDF.md`), README,
  AGENT-INTERFACE, ARCHITECTURE, LIMITATIONS, COMPATIBILITY, PRODUCT, CHANGELOG
  and BACKLOG.

## Consequences

- PDF users install about 14 MB (`playwright-core`) plus a 130â€“280 MB Chromium;
  the default dependency surface stays small. The browser gate already installs
  Chromium, so the PDF e2e adds no browser download; the package job stays
  peer-free and checks the missing-engine exit.
- The PDF is a second artifact; the self-contained HTML stays the primary
  output and the one-file default is unchanged. The PDF-only route has no
  report HTML file, logo or Trends (`--logo`/`--history` require `--out`) and no
  CLI filter; the docs state it.
- The browser engine keeps the print view and the report locale in one place;
  there is no second report layout to maintain.
- Chromium-only output; page numbers/headers, a CLI filter, a forced landscape,
  tagged PDF/accessibility and a pure-JS/hosted route are out of slice 1. The
  browser print remains the filtered/landscape route. Page identity and numbers
  are B-021/B-022, tagged PDF is B-027 and a size cap/streaming is B-028.
- No temporary HTML: `page.setContent` keeps report data out of the file system.
  The PDF can be large; the five-minute print timeout is API-overridable and the
  print volume limits apply.
- A Playwright/Chromium upgrade can change PDF text metrics; the PDF e2e
  asserts validity, page count and the A4 MediaBox, not pixel equality. The
  peer version aligns with the dev browser and the lockfile.

## Alternatives considered

- **Chrome/Edge headless CLI:** no npm dependency, but Letter-only default, a
  local `file://` footer and harder cross-platform/CI control; rejected.
- **Puppeteer / puppeteer-core:** the same Chromium engine with a heavier
  package and a second browser install; Playwright is already the test engine;
  rejected.
- **PDFKit / pdf-lib / pdfmake:** a second report layout, font and image work,
  no print-CSS reuse and a large slice; rejected for #13c.
- **WeasyPrint / wkhtmltopdf:** an external system binary, not portable and
  against the npm-only baseline; rejected.
- **Print view only:** the current browser Save as PDF; kept as the zero-install
  route, but CI/headless PDF needs the engine.
- **A hosted PDF service:** violates the offline/no-telemetry baseline; rejected.

## References

- `docs/research/pdf-engine-options.md`
- `docs/PDF.md`
- `docs/adr/0005-server-rendered-shell.md`
- `docs/adr/0006-inline-attachments.md`
- The print section of `DESIGN.md`
- Issue #13, sub-slice #13c

