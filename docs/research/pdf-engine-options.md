# PDF engine options for Tolkira (#13c)

Research note, 2026-11-20. Scope: which engine turns the print view into an
offline PDF, how to keep `npm install tolkira` small, and the first slice.

The print slice already covers every view and detail: `@media print`, plus
`beforeprint` opening closed details, closing the lightbox and making lazy
images eager (`src/render/print-script.ts`). The PDF must reuse that and cover
header, metrics, features, failures, tables and screenshots on A4; locale is
already in the HTML (`en`, `de`; no RTL by scope).

## Browser renderers

Probe on 2026-11-20: Windows, Chrome 157.0.8103.79, Edge 157.0.4341.60 and
Playwright 1.65.1 (Chromium 158.0.8127.18), using a page with a print-only
block, a closed `details` and a `beforeprint` handler.

| Path | Cost | Print CSS / `beforeprint` | A4 and headers |
| --- | --- | --- | --- |
| Playwright `page.pdf()` | `playwright-core` 14 MB (`playwright` +5 MB); browser separate | Yes / yes | A4, margins, footers, `tagged` |
| Puppeteer `page.pdf()` | `puppeteer-core` 6.4 MB; `puppeteer` auto-downloads 170–280 MB | Yes / yes | A4, footers |
| Chrome/Edge `--print-to-pdf` | 0 npm bytes; installed browser | Yes / yes | Letter only; `@page size` ignored; no custom page numbers |
| `@sparticuz/chromium` | 70 MB, Linux only | Via Chromium | Lambda only |

All desktop paths applied print CSS and ran `beforeprint`; closed details
printed open. Playwright's `margin` option is unset by default; the print CSS
`@page { margin: 12mm }` supplies the inset (verified), so no explicit `margin`
is needed. Chrome's default footer prints
the date, title, page number and the local `file://` URL, so disable it
(`--no-pdf-header-footer`).
Playwright defaults `displayHeaderFooter` to `false`
([`page.pdf`](https://playwright.dev/docs/api/class-page#page-pdf)).

The Playwright CLI does it as a fallback: `npx playwright pdf --paper-format A4
<url> <file>` (1.65); document it only beside the API. Browsers are a separate
download (`npx playwright install chromium`; `--with-deps` on Linux); neither
package has a browser postinstall ([browsers](https://playwright.dev/docs/browsers)).

## Pure JS and external binaries

| Engine | Cost | Reuses HTML/CSS |
| --- | --- | --- |
| `pdfkit` 0.21.0 | 4.8 MB, 6 deps | No |
| `pdf-lib` 1.17.1 | 19.5 MB, 4 deps | No |
| `pdfmake` 0.3.15 | 12 MB, 5 deps | No |
| `jspdf` 4.2.1 | 30 MB; optional `html2canvas` | No |
| WeasyPrint 70.0 | Python ≥ 3.10, Pango, native libs | HTML/CSS, no JS |
| wkhtmltopdf 0.12.6 | External Qt4/WebKit binary | Old CSS subset |

The JS engines need a second renderer for layout, tables, page breaks and fonts;
the external engines reuse HTML but cannot run the print script. PDFKit has
tables and fonts but must reproduce the shell, German labels and dates
([PDFKit](https://pdfkit.org/)); pdfmake needs a full mapping
([pdfmake](https://pdfmake.github.io/docs/0.3/getting-started/server-side/)).
WeasyPrint is a print CSS engine but a Python app without JavaScript
([WeasyPrint](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html));
wkhtmltopdf is a 2012 engine its maintainer calls unmaintained
([status](https://wkhtmltopdf.org/status.html)).

## Optional dependency patterns

| Pattern | Default install | Opt-in |
| --- | --- | --- |
| `dependencies` | Adds ~14 MB for all; browser still separate | None |
| `optionalDependencies` | Installed by default; failure tolerated | Weak |
| `peerDependenciesMeta.optional` | Not installed automatically | Explicit |
| Dynamic `import()` + typed error | Zero cost until `--pdf` | Explicit |

npm documents that optional peers are **not** installed automatically, while
`optionalDependencies` are installed by default
([peers](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#peerdependenciesmeta),
[optional](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#optionaldependencies)).
A dynamic `import('playwright-core')` keeps the engine out of the bundle and
turns absence into one message. Tarball before the PDF docs: 507 KB / 2.1 MB
unpacked; the package gains `docs/PDF.md`, the runtime dependency surface does
not change.
CI cost is mostly paid: the Playwright gate (Linux/macOS) installs Chromium, and
a PDF test can reuse it. Playwright advises against caching browsers
([CI](https://playwright.dev/docs/ci)); a PDF-only job adds one 130–280 MB
download per OS.

## Testing and CI

- **Vitest:** CLI parsing, `--pdf` path conflicts, input-directory containment,
  atomic binary write, missing-engine error, `%PDF-` magic; inject a fake engine.
- **Playwright:** one Chromium-only spec. The in-repo PDF reader in
  `test/e2e/helpers.ts` (inflate plus font `ToUnicode` CMaps) asserts more than
  one page, A4, the 12 mm inset, German text and embedded screenshot XObjects;
  no extra PDF library is needed.
- **Determinism:** creation timestamps make byte equality wrong; assert page
  count, page size and title.
- **Budgets:** PDF code is Node-only and dynamically imported, so the 16 KB
  client bundle and 5 MB report budget do not change. Measure PDF size on a
  screenshot-heavy fixture.

## Competitor practice

The Cucumber HTML formatter, multiple-cucumber-html-reporter, pytest-html and
Playwright's reporter document HTML only
([Cucumber](https://github.com/cucumber/html-formatter),
[MCHR](https://github.com/WasiqB/multiple-cucumber-html-reporter),
[pytest-html](https://pytest-html.readthedocs.io/en/latest/)); Allure exports
CSV, not PDF ([Allure](https://allurereport.org/docs/export-csv/)).
Server/CI teams wrap headless Chromium, use WeasyPrint, or keep wkhtmltopdf in
legacy pipelines. No Cucumber CLI here turns its own HTML into PDF; Playwright's
`pdf` command is the closest.

## Recommendation (final, 2026-11-20)

**Engine and dependency:** Playwright Chromium `page.pdf()`, with
`playwright-core` as an optional peer (`^1.65.0`, aligned with the dev
`playwright`/`@playwright/test`) imported only by `src/pdf.ts`. Keep it out of
`dependencies`/`optionalDependencies`; mark it external in `esbuild.mjs`; the
default dependency surface stays at three runtime dependencies.

**CLI/API:** `tolkira <input...> --pdf <file>`, alone or with `--out`,
`--email`, `--json`/`--ci` and `--history`. Public
`renderPdf(html, options?)` takes the exact `generateReport` HTML, not inputs;
`PdfOptions` is `{ timeoutMs? }` (default five minutes). Validate `--pdf` like
every output: no collision with an input, logo, `--out`, `--ci-out`, `--email`
or `--history`, and not inside an input directory (canonicalized). Write the
bytes atomically; on failure remove them, name the path and exit 1. Order:
report → PDF → email → history → `--ci-out`.

**Reuse and print state:** set the HTML directly with `page.setContent` (no
temporary `file://` copy), let the native `page.pdf` fire `beforeprint`, set
every `img.loading = 'eager'`, guard against HTTP(S) subresources, await
`document.fonts.ready` and every `img.decode()`, then:

```js
page.pdf({ format: 'A4', printBackground: true, displayHeaderFooter: false,
  preferCSSPageSize: true })
```

A4 comes from `format: 'A4'`; the print CSS `@page { margin: 12mm }` supplies
the inset (verified 595.92×842.88 pt, ~34 pt). `preferCSSPageSize` only lets a
declared CSS `size` win, and the report declares none. Explicit margins are not
required. `page.pdf` has no timeout option, so the font/image wait and the print
are bounded by an explicit five-minute deadline (`--pdf-timeout`/
`PdfOptions.timeoutMs`); there is no 30 s browser print default. A fresh page has
no URL state, so the PDF covers the whole run with all details open; the browser
print remains the filtered/landscape route.

**Page size and headers:** A4 portrait, 12 mm @page inset, no header/footer or
page numbers in slice 1; B-021/B-022 page identity is deferred.

**Engine missing (exit 1):**

```
PDF output needs the optional Playwright Chromium engine.
In your project: npm i -D playwright-core@^1.65.0 playwright@^1.65.0
Then: npx playwright install chromium
A project-local Tolkira install is recommended. Or omit --pdf.
```

The engine is resolved beside Tolkira first, then through
`createRequire(cwd/package.json)`, so a globally installed or npx-cached Tolkira
sees the caller's project. The default `chromiumSandbox: false` is kept for
root/container CI; B-029 tracks the OS sandbox.

No browser-path/channel option in slice 1; the Playwright-managed Chromium is
the tested engine. A browser path is a follow-up, not part of the peer contract.

**Cost:** the default dependency surface is unchanged; the opt-in adds about
14 MB (`playwright-core`) plus a 130–280 MB browser. The Chromium gate already
installs the browser; CI adds no download.

**First slice:** `src/pdf.ts` with `setContent`, `--pdf`, path/atomic/error,
a mocked unit test, a Chromium PDF e2e and a missing-engine CLI/package smoke.

**Follow-ups:** page numbers/tagged PDF (B-021/B-022/B-027), PDF size
warning/streaming (B-028), Chromium OS sandbox (B-029), Letter/custom paper
(B-030), a browser path option, landscape (unscheduled), Lambda/existing HTML.

## ADR 0007

**Status:** Accepted and implemented in `add-pdf-export` (#13c); see
[ADR 0007](../adr/0007-optional-pdf-engine.md).

**Decision:** Playwright Chromium `page.pdf()` as an optional engine;
`playwright-core` is an optional peer imported only by `renderPdf`/`--pdf`.
Same HTML via `setContent`, A4/12 mm, no header/footer; PDF before email; page
numbers later. Default deps, one-file HTML and the offline promise stay
unchanged.

**Alternatives:** Chrome CLI — zero npm, Letter-only, no custom page numbers,
path footer. Puppeteer — auto-downloads Chrome, duplicates Playwright.
PDFKit/pdf-lib/pdfmake/jsPDF — second renderer. WeasyPrint/wkhtmltopdf —
external or unmaintained engine.

**Consequences:** PDF needs an explicit install and browser download; a missing
engine exits 1. Output is Chromium-only, A4 portrait and not byte-deterministic.
Report, email and history are unaffected without `--pdf`; the default runtime
dependency surface is unchanged and the package gains the PDF docs.

## Open questions

- Page numbers/tagged PDF: deferred; the browser print can add headers.
- PDF size cap/streaming for very large reports: backlog; the five-minute
  deadline and the print volume limits apply.
- A browser-path/channel option: follow-up; slice 1 uses the Playwright browser.

The temp-`file://` question is resolved by `setContent`; the filter state is
not part of the PDF (the browser print covers it).

## Sources

All accessed 2026-11-20.

- Playwright `page.pdf`: https://playwright.dev/docs/api/class-page#page-pdf
- Playwright browsers: https://playwright.dev/docs/browsers
- Playwright CI: https://playwright.dev/docs/ci
- Puppeteer installation: https://pptr.dev/guides/installation
- Chrome `--print-to-pdf`: https://developer.chrome.com/blog/headless-chrome
- `@sparticuz/chromium`: https://github.com/Sparticuz/chromium
- PDFKit: https://pdfkit.org/
- PDF-Lib: https://pdf-lib.js.org/
- pdfmake: https://pdfmake.github.io/docs/0.3/getting-started/server-side/
- jsPDF: https://github.com/parallax/jsPDF
- WeasyPrint: https://doc.courtbouillon.org/weasyprint/stable/first_steps.html
- wkhtmltopdf: https://wkhtmltopdf.org/status.html
- npm peers: https://docs.npmjs.com/cli/v11/configuring-npm/package-json#peerdependenciesmeta
- Cucumber formatter: https://github.com/cucumber/html-formatter
- MCHR: https://github.com/WasiqB/multiple-cucumber-html-reporter
- pytest-html: https://pytest-html.readthedocs.io/en/latest/
- Allure CSV: https://allurereport.org/docs/export-csv/
- Package sizes: https://registry.npmjs.org/playwright-core/latest
