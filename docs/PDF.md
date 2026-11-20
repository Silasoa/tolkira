# PDF export

`--pdf <file>` prints the report to a PDF through the optional Playwright
Chromium engine. It is opt-in: without the flag no PDF is created, no browser is
started and the one-file HTML default is unchanged. The PDF is generated from the
same report HTML and the same print view the browser uses, so there is no second
layout.

```shell
# PDF beside the report
tolkira test-results/ --out report.html --pdf report.pdf

# PDF as the only artifact; the report is rendered in memory only
tolkira test-results/ --pdf report.pdf

# PDF, email, history and JSON in one run
tolkira test-results/ --out report.html --pdf report.pdf \
  --email email.html --history .history/history.json --json > summary.json
```

## Install the engine

The default `npm install tolkira` stays small: `playwright-core` is an optional
peer and is not installed automatically. Install it together with the Chromium
browser before the first `--pdf` run:

```shell
npm i -D playwright && npx playwright install chromium
```

On Linux CI hosts without the browser system libraries:

```shell
npm i -D playwright && npx playwright install --with-deps chromium
```

`playwright` includes `playwright-core`, so this one command satisfies the peer
and downloads the browser. There is no browser postinstall: the download is
explicit. Cost: about 14 MB for `playwright-core` plus 5 MB for `playwright`, and
130–280 MB for Chromium. The default dependency surface, report, email, JSON and
CI output do not change without `--pdf`.

If `playwright-core` or the browser is missing, the CLI exits 1 with the install
command; no partial PDF remains. The error also says to omit `--pdf` to keep the
HTML-only route.

## What the PDF contains

The PDF is the complete print archive of the report HTML:

- Report, Details and, when history is present, Trends;
- every closed feature, scenario and attachment detail opened;
- screenshots and other inline images;
- the light print palette, even when the screen uses dark mode;
- tables fitted to the printable width and each present view starting on a new
  page.

The PDF is A4 portrait with the print CSS `@page { margin: 12mm }`, so the page
size and inset come from the same stylesheet as browser print. Background
colours print (`printBackground`), the CSS page size wins
(`preferCSSPageSize`) and there is no browser header, footer, URL or page
number (`displayHeaderFooter: false`). The layout engine is Chromium only in
this slice; Firefox and WebKit are not PDF engines here.

The PDF is generated from a fresh page. The CLI search and filter state is not
applied, so the PDF always archives the whole run. Use the browser print if you
want the failures-only filtered view or landscape for an unusually wide matrix.
Video and audio attachments cannot print; screenshots, text attachments and the
skipped-attachment notice do. The PDF is a delivery artifact, not a pixel
contract: Chromium and font updates can shift line breaks.

## CLI contract

`--pdf` is another output, not a mode. It composes with `--out`, `--email`,
`--json`, `--ci`/`--ci-out` and `--history`:

```shell
tolkira test-results/ --out report.html --pdf report.pdf
tolkira test-results/ --pdf report.pdf --json > summary.json
tolkira test-results/ --pdf report.pdf --email email.html
tolkira test-results/ --out report.html --pdf report.pdf --locale de
```

- At least one input is required, and `--pdf` needs a non-empty file path.
- `--locale` is accepted with `--pdf` even without `--out` or `--email`. The PDF
  follows the report locale; the CLI, JSON and CI text stay English.
- `--accent` applies to the in-memory report HTML used for the PDF.
- Without `--out`, the PDF-only route writes no report HTML. `--logo` and
  `--history` still require `--out` and exit 2 with the PDF-only route.
- The write order is **report → PDF → email → history → `--ci-out` → stdout**.
  The PDF is written before the email that names it, so a PDF failure exits 1,
  names the PDF path, keeps an already written report and skips the email,
  history, `--ci-out` and stdout. No partial PDF remains.
- The PDF path is validated like the other outputs: it must not equal an input,
  the logo, `--out`, `--ci-out`, `--history` or `--email`, and must not lie
  inside an input directory. Paths are canonicalized, and Windows/macOS compare
  case-insensitively. A collision exits 2 and writes nothing.
- `PDF written to <path>` is printed only when stdout is free. With `--json` or
  `--ci` on stdout, the machine bytes are unchanged and the PDF line is
  suppressed. With `--ci-out`, the PDF line is printed.
- The email note names `--out` when a report is written; without `--out` it
  names the PDF as the full artifact. The PDF is written first, so the note never
  points at a missing file.
- A directory or an unwritable PDF target is a write failure: exit 1, the report
  stays, no temporary file is left behind.

## API

`renderPdf(html, options?)` prints already-rendered report HTML and returns the
PDF bytes. It writes no file, starts no server and makes no network request. Use
`generateReport` to get the exact CLI HTML:

```ts
import { writeFile } from 'node:fs/promises';
import { generateReport, renderPdf } from 'tolkira';

const { html } = await generateReport(['test-results/'], {
  title: 'Checkout acceptance',
  locale: 'de',
});
const pdf = await renderPdf(html);
await writeFile('report.pdf', pdf);
```

| Option | Meaning |
| --- | --- |
| `timeoutMs` | Print timeout in milliseconds; default `300000` (five minutes) |

The CLI and `renderPdf` produce equivalent PDFs for the same HTML and engine.
The API returns `Uint8Array`; it never writes an output file. The call is
asynchronous because it launches Chromium, loads the HTML with
`page.setContent` (no temporary report file or `file://` page) and waits for
fonts and images before printing.

## Timeouts and print volume

Chromium's own print default is 30 seconds, which is too short for large
reports. Tolkira passes a five-minute default to the page load and the print,
overridable through `PdfOptions.timeoutMs`. The documented print volume on
Chromium (2026-11-20) is about 5 s for 2,000 scenarios and 670 A4 pages, 21 s for
4,000 and about 2.7 minutes for 10,000 and about 3,337 pages. The 10 MB report
warning is not a PDF size cap; the PDF inherits the print volume limits. Very
large reports mean a large PDF, more memory and a longer run.

The browser is closed in a `finally` block after success or failure. `setContent`
keeps report data out of the file system; only the final PDF you asked for is
written.

## Missing engine

Without the optional engine, `--pdf` fails cleanly:

```text
tolkira: Cannot render PDF for report.pdf: PDF output needs the optional Playwright Chromium engine.
Install beside Tolkira: npm i -D playwright
Then: npx playwright install chromium
Or omit --pdf.
```

An already written report stays. The email, history, `--ci-out` and stdout
outputs are skipped because the PDF comes first; no temporary PDF remains.

## CI example

The browser gate already installs Chromium, so a job that runs Tolkira's e2e
suite pays no extra download. A PDF-only job needs both the peer and the browser:

```yaml
- name: Generate report and PDF
  if: always()
  run: |
    npm ci
    npm i -D playwright
    npx playwright install --with-deps chromium
    npx tolkira test-results/ --out report.html --pdf report.pdf \
      --email email.html --json > summary.json

- name: Upload artifacts
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: cucumber-report
    path: |
      report.html
      report.pdf
      email.html
      summary.json
```

The PDF is local: no hosted renderer, no telemetry and no network request from
the report. The browser download is the only network step, and it comes from
Playwright's own browser distribution.

## Limits

- Chromium only; one engine, one print layout.
- A4 portrait, 12 mm margins and no header/footer, URL or page numbers in this
  slice. Tagged PDF/accessibility, custom headers, page numbers and landscape
  are follow-ups ([BACKLOG.md](BACKLOG.md), B-021/B-022).
- No CLI search/filter state; the browser print is the filtered route.
- Video/audio do not print. An unusually wide matrix may need browser landscape.
- The PDF-only route has no logo or Trends; `--logo`/`--history` require `--out`.
- The engine is an optional install: 19 MB of packages plus a 130–280 MB
  browser, and the render is CPU/memory-heavy on very large suites.
- The PDF is not byte-deterministic across Chromium, font and OS versions.
