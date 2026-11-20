# Design

## Context

The print view is complete and tested. ADR 0007 chooses an optional Playwright
Chromium engine so the PDF reuses that exact HTML/print state. The default
install and runtime dependency surface stay unchanged; the package gains the PDF
docs. PDF users install the peer and a browser. The report HTML is the source;
there is no second PDF layout.

Data flow: the CLI parses `--pdf`, `--pdf-timeout` and the existing outputs →
`generateReport` produces the report HTML in memory → `renderPdf` sets it on a
local Chromium page with `page.setContent` (no temporary file), makes lazy
images eager, aborts HTTP(S) subresources, waits for fonts/images and prints
A4/12 mm with no header/footer under an explicit deadline → the PDF bytes → the
CLI writes the PDF atomically in the order report → PDF → email → history →
`--ci-out` → stdout. A PDF failure leaves the report, skips the email/later
outputs and removes the browser; the missing engine exits 1 with install
guidance.

## PDF module (`src/pdf.ts`)

- `renderPdf(html, options?)` returns a `Uint8Array`; it writes no output file
  and creates no temporary report. The HTML is loaded with
  `page.setContent(html, { waitUntil: 'load' })`; the inline CSP-hashed scripts
  and data-URI images work from the page.
- Dynamic `import('playwright-core')`; if that fails, resolve the peer with
  `createRequire(path.join(process.cwd(), 'package.json'))('playwright-core')`,
  so a globally installed or npx-cached Tolkira sees the caller's project.
  `chromium.launch({ headless: true })` keeps Playwright's default
  `chromiumSandbox: false`; enabling the OS sandbox is B-029. The module is
  external in esbuild; the peer is optional in `package.json`; the default bundle
  does not include it. No `import type` from `playwright-core` appears in emitted
  declarations.
- Before `setContent`, `page.route(/^https?:\/\//, route => route.abort())`
  enforces the offline contract for caller HTML; inline `data:` URIs are
  unaffected.
- The native `page.pdf` print lifecycle fires `beforeprint`; no manual event
  dispatch is needed. Await `document.fonts.ready` and image `decode()` (best
  effort) after setting every `img.loading = 'eager'`: lazy thumbnails below the
  fold otherwise never decode and the wait hangs. Then
  `page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true,
  displayHeaderFooter: false })`.
- `page.pdf` has no timeout option and Playwright/Chromium has no 30 s print
  default. The page load uses the `setContent` timeout; the font/image wait and
  the print are each raced against an explicit deadline. The default is five
  minutes (`PdfOptions.timeoutMs`, CLI `--pdf-timeout`); a large report does not
  fail early.
- The print CSS `@page { margin: 12mm }` supplies the margins; A4 comes from
  `format: 'A4'`. `preferCSSPageSize` only gives a declared CSS `size` priority,
  and the report declares none. The e2e asserts the A4 MediaBox.
- Close the browser in `finally` with a five-second close deadline that swallows
  a close timeout; the setContent route leaves no report temp. Return a
  `Uint8Array` view over the engine bytes rather than a full copy; the CLI writes
  them atomically.
- Missing `playwright-core`/Chromium: a clear Error naming one tested install
  command; the CLI maps it to exit 1 and the PDF path and truncates a raw engine
  error to one 500-character line.
- `PdfOptions`: `timeoutMs?`; no independent report options (the HTML carries
  the title/locale/content).

## Content and print state

The print view supplies everything: the complete Report/Details/Trends when
present, all details open, screenshots, the light palette, fitted tables, page
breaks and the light print palette. The PDF is generated from a fresh page, so
no CLI search/filter state applies; the browser print remains the filtered
route. The PDF is A4 with 12 mm margins from the print CSS; `preferCSSPageSize`
and `printBackground` keep the page and status colours. No browser header/
footer, URL or page number is added. The first slice is Chromium-only; video/
audio are not printable, and an unusually wide matrix may need the browser
print's landscape; the docs say so.

## CLI and output

- `--pdf <file>` is a required-path output; it can be the only report output
  (the HTML is generated in memory), with `--out`, `--email`, `--json`/`--ci`
  and `--history`. `--pdf-timeout <ms>` needs `--pdf`, accepts only a positive
  decimal integer up to 2,147,483,647 (no zero, sign, fraction or leading zero),
  and passes `{ timeoutMs }` to `renderPdf`.
- `--locale` is accepted with `--pdf`; the PDF uses the report locale; CLI/JSON/
  CI stay English. The `--logo` and `--history` still require `--out`; the PDF-
  only route has no logo/Trends; the docs state it. `--accent` applies to the
  in-memory report HTML.
- Write order: report → PDF → email → history → `--ci-out` → stdout. The PDF is
  written before the email that names it; the email note names the `--out`
  report, or the PDF when that is the only full artifact. `PDF written to
  <path>` appears when stdout is free; JSON/CI stdout stays unchanged.
- Path validation uses canonicalized `samePath`/`isInside` against inputs, the
  logo, `--out`, `--ci-out`, `--history`, `--email` and input directories; the
  PDF is written atomically after the report and before the email. A PDF write/
  render failure exits 1 with the PDF path, keeps the report, skips the email/
  later outputs and leaves no partial PDF.
- A missing engine exits 1 with the install instructions; with `--out` the
  report stays; an email is not written because the PDF precedes it.

## Package and CI

- `peerDependencies: { "playwright-core": "^1.65.0" }` with
  `peerDependenciesMeta.playwright-core.optional = true`. The dev
  `@playwright/test` (`^1.64.1`, resolves 1.65.0) stays; add `playwright`
  `^1.65.0` as an explicit dev dependency so the installed browser and peer
  align; update `package-lock.json`. `esbuild.mjs` marks `playwright-core`
  external for the index/CLI bundles.
- The default install and runtime dependency surface are unchanged; the package
  gains the PDF docs. PDF users install `playwright-core` and a Chromium browser
  with one tested command in the project where Tolkira runs. The browser gate
  already installs Chromium, so the e2e adds no download. The package job stays
  peer-free and asserts the `--pdf` missing-engine exit code 1, the exact
  guidance, no PDF file and no `playwright-core` in the installed tree.
- The PDF unit test does not launch a browser: it mocks `playwright-core` and
  asserts the `page.pdf` options/lifecycle/error mapping. Real PDF bytes/pages/
  MediaBox run in the Chromium e2e with a small fixture and an explicit
  `test.setTimeout` (the gate is fully parallel and the default 30 s applies).

## Tests

- `test/pdf.test.ts` (mock `playwright-core`): `page.setContent` with the HTML,
  the print options (A4/12 mm/preferCSSPageSize/printBackground/no header), the
  five-minute deadline, the native `beforeprint` expectation, eager lazy images,
  the font/image deadline, aborted HTTP(S) routes, the cwd `createRequire`
  fallback, a no-copy byte view, browser close, missing-engine error, no output
  file.
- `test/cli-pdf.test.ts`: `--pdf` alone/with
  `--out`/`--email`/`--json`/`--ci`; `--pdf-timeout` success, invalid values and
  missing `--pdf`; the order report→PDF→email and later-output suppression;
  collisions/input containment; missing-engine exit; confirmation; the locale;
  the email naming the PDF; the report/JSON/CI bytes; the PDF-only size warning;
  the capped one-line render error; the binary atomic write/failure.
- `test/e2e/pdf.spec.ts` (Chromium only): a history/attachment report; `%PDF`,
  at least three `/Type /Page` objects, A4 MediaBox and 12 mm inset; the German
  labels; the screenshots; no header/footer; both the `--out` and PDF-only
  routes; no `file://` temp required. A 40-scenario report with a distinct real
  screenshot per scenario runs with `--pdf-timeout 30000`, completes, embeds at
  least 40 images and reaches a later page. Extend the existing print
  spec rather than duplicating the print content.
- Existing print/email/CLI tests and goldens stay green; no report changes;
  the package/peer metadata and the package-job missing-engine smoke are
  checked.

## Docs

`docs/PDF.md` (new): the install (peer + browser, project-local recommendation),
`--pdf`/`--pdf-timeout`/`renderPdf`, the complete print archive, A4 portrait/
no header/no page numbers/Chromium-only, Letter not exposed, HTTP(S) aborts and
inline data URIs, the no-OS-sandbox accepted risk, the composition with
report/email/JSON/CI/history, the PDF-only logo/history limits, the setContent
privacy (no temp), the missing engine, the deadline and print volume, the cost
(14 MB peer + 130–280 MB browser), B-021/B-022/B-027/B-028/B-029/B-030 and the
CI example. Update `README.md`,
`DESIGN.md`, `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`,
`docs/LIMITATIONS.md`, `docs/COMPATIBILITY.md`, `docs/PRODUCT.md`,
`docs/CHANGELOG.md`, `docs/BACKLOG.md`, `docs/EMAIL.md`/`docs/CI.md` (PDF order/
email note), `docs/README.md`, `llms.txt`; add ADR 0007 and the research note;
`package.json` peer/files. Fix the ADR's nonexistent `docs/PRINT.md` reference,
the research's proposed/`playwright-core`-vs-`playwright`/`TOLKIRA_BROWSER`
stale points, and the B-021/B-022 triggers now that a shared multi-page PDF
exists.

## Alternatives considered

See ADR 0007: the Chrome CLI (Letter/footer), Puppeteer (same Chromium, heavier),
PDFKit/pdf-lib (second layout), WeasyPrint/wkhtmltopdf (system binary), a hosted
service (offline/no-telemetry) and print-only (no headless PDF).

## Risks

- The optional install is 14 MB + 130–280 MB Chromium; the default install is
  unchanged but the feature is heavy by design. The docs/ADR state it.
- Playwright launches Chromium without the OS sandbox (`--no-sandbox`) by
  default. The accepted risk, the CSP/escaped-attachment boundary and the
  container/VM advice are in `docs/PDF.md`; B-029 tracks the sandbox.
- Chromium-only output and font metrics can differ from other engines; the PDF
  is a delivery artifact, not a pixel contract. Tagged PDF/accessibility is a
  follow-up.
- The PDF engine can be slow/memory-heavy on very large reports (all details,
  screenshots); the print volume limits apply. The five-minute deadline and PCA
  cover the large fixture; `--pdf-timeout`/`timeoutMs` are the CI lever; the PDF
  has no separate size cap (the 10 MB report warning is not a PDF cap).
- A missing engine or render failure must fail cleanly before the email, not
  leave a partial PDF or a dangling note; the order and close paths are tested.
- The `playwright-core`/Chromium versions must align with the dev browser; the
  peer range, lockfile and browser gate are documented.
- The PDF-only route has no logo/history and no CLI filter; the docs make the
  trade-off explicit.
