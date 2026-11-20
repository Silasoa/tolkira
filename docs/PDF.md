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
browser before the first `--pdf` run, in the project where Tolkira runs:

```shell
npm i -D playwright-core@^1.65.0 playwright@^1.65.0
npx playwright install chromium
```

A project-local Tolkira install is recommended. A globally installed or
npx-cached Tolkira resolves `playwright-core` beside itself first, then from the
current project directory, so the peer must be visible to that project.

On Linux CI hosts without the browser system libraries:

```shell
npm i -D playwright-core@^1.65.0 playwright@^1.65.0
npx playwright install --with-deps chromium
```

`playwright` includes `playwright-core`, so the pair satisfies the peer and
downloads the browser. There is no browser postinstall: the download is
explicit. Cost: about 14 MB for `playwright-core` plus 5 MB for `playwright`, and
130–280 MB for Chromium. The default runtime dependencies, report, email, JSON
and CI output do not change without `--pdf`.

If `playwright-core` or the browser is missing, the CLI exits 1 with the install
command; no partial PDF remains. The error also says to omit `--pdf` to keep the
HTML-only route.

## What the PDF contains

The PDF is the complete print archive of the report HTML, not a one-page
executive summary. `--email` is the concise summary:

- Report, Details and, when history is present, Trends;
- every closed feature, scenario and attachment detail opened;
- screenshots and other inline images;
- the light print palette, even when the screen uses dark mode;
- tables fitted to the printable width and each present view starting on a new
  page.

The PDF is A4 portrait. A4 comes from `format: 'A4'`, and the 12 mm inset comes
from the print CSS `@page { margin: 12mm }`. `preferCSSPageSize` only lets a
declared CSS `size` take priority; the report declares none today, so A4
applies. Background colours print (`printBackground`), and there is no browser
header, footer, URL or page number (`displayHeaderFooter: false`). The layout
engine is Chromium only in this slice; Firefox and WebKit are not PDF engines
here. Letter and custom paper are not exposed; use browser print for those or
follow B-030.

The PDF is generated from a fresh page. The CLI search and filter state is not
applied, so the PDF always archives the whole run. Use the browser print if you
want the failures-only filtered view or landscape for an unusually wide matrix.
Video and audio attachments cannot print; screenshots, text attachments and the
skipped-attachment notice do. The PDF is a delivery artifact, not a pixel
contract: Chromium and font updates can shift line breaks. The PDF-only route has
no logo or Trends because `--logo` and `--history` require `--out`.

## CLI contract

`--pdf` is another output, not a mode. It composes with `--out`, `--email`,
`--json`, `--ci`/`--ci-out` and `--history`, and needs at least one input:

```shell
tolkira test-results/ --out report.html --pdf report.pdf
tolkira test-results/ --pdf report.pdf --json > summary.json
tolkira test-results/ --pdf report.pdf --email email.html
tolkira test-results/ --out report.html --pdf report.pdf --locale de
tolkira test-results/ --pdf report.pdf --pdf-timeout 600000
```

- At least one of `--out`, `--pdf`, `--json`, `--ci` or `--email` is required,
  and `--pdf` needs a non-empty file path.
- `--locale` is accepted with `--pdf` even without `--out` or `--email`. The PDF
  follows the report locale; the CLI, JSON and CI text stay English.
- `--accent` applies to the in-memory report HTML used for the PDF.
- Without `--out`, the PDF-only route writes no report HTML. `--logo` and
  `--history` still require `--out` and exit 2 with the PDF-only route.
- `--pdf-timeout <ms>` overrides the render deadline. It requires `--pdf`,
  accepts a positive integer up to `2147483647` and rejects `0`, negative,
  fractional, non-numeric and leading-zero values with exit 2.
- The write order is **report → PDF → email → history → `--ci-out` → stdout**.
  The PDF is written before the email that names it, so a PDF failure exits 1,
  names the PDF path, keeps an already written report and skips the email,
  history, `--ci-out` and stdout. No partial PDF remains.
- The PDF path is validated like the other outputs: it must not equal an input,
  the logo, `--out`, `--ci-out`, `--history` or `--email`, and must not lie
  inside an input directory. Paths are canonicalized, and Windows/macOS compare
  case-insensitively. A collision exits 2 and writes nothing.
- `PDF written to <path>` is printed only when stdout is free. With `--json`
  (including `--json --ci-out`) or `--ci` on stdout, the machine bytes are
  unchanged and the PDF line is suppressed. With only `--ci-out` and no
  `--json`, the PDF line is printed.
- The email note names `--out` when a report is written; without `--out` it
  names the PDF as the full artifact. The PDF is written first, so the note never
  points at a missing file.
- A directory or an unwritable PDF target is a write failure: exit 1, the report
  stays, no temporary file is left behind.
- The report size warning also covers a PDF-only run; it measures the report
  HTML, not the PDF file.

## API

`renderPdf(html, options?)` prints already-rendered report HTML and returns the
PDF bytes. It writes no file, starts no server and makes no network request:
HTTP(S) subresources in the caller HTML are aborted before the page loads, while
inline `data:` URIs render. Use `generateReport` to get the exact CLI HTML:

```ts
import { writeFile } from 'node:fs/promises';
import { generateReport, renderPdf } from 'tolkira';

const { html } = await generateReport(['test-results/'], {
  title: 'Checkout acceptance',
  locale: 'de',
});
const pdf = await renderPdf(html, { timeoutMs: 300_000 });
await writeFile('report.pdf', pdf);
```

| Option | Meaning |
| --- | --- |
| `timeoutMs` | Render deadline in milliseconds; default `300000` (five minutes) |

The CLI and `renderPdf` produce equivalent PDFs for the same HTML and engine.
The API returns a `Uint8Array` view over the engine bytes; it never writes an
output file. The call is asynchronous because it launches Chromium, loads the
HTML with `page.setContent` (no temporary report file or `file://` page) and
waits for fonts and images before printing.

## Timeouts and print volume

`page.pdf` has no `timeout` option, and Playwright/Chromium has no 30-second
print default. Tolkira bounds each stage explicitly: `page.setContent` receives
the load timeout, and the font/image wait and the print are each raced against a
deadline. The default is 300,000 ms (five minutes); `--pdf-timeout` and
`PdfOptions.timeoutMs` replace it. Each stage can consume the full deadline, so a
pathological run can take up to about three times the configured value. The
browser close has a five-second deadline; a wedged Chromium child beyond that is
left for the runner or job to clean up.

Print volume measured on the maintainer's machine (Chromium, 2026-11-20), not in
CI: about 5 s for 2,000 scenarios and 670 A4 pages, 21 s for 4,000 and about
2.7 minutes for 10,000 and about 3,337 pages. CI machines can be slower; raise
`--pdf-timeout` when a large report needs it. The 10 MB report warning is not a
PDF size cap; the PDF inherits the print volume limits. Very large reports mean a
large PDF, more memory and a longer run.

The browser is closed in a `finally` block after success or failure.
`setContent` keeps report data out of the file system; only the final PDF you
asked for is written.

## Security

The render is local and makes no network request: HTTP(S) subresources in caller
HTML are aborted and inline `data:` images render. Playwright launches Chromium
with `chromiumSandbox: false` (`--no-sandbox`) by default, and Tolkira keeps that
default so root/container CI keeps working. The renderer is therefore not
OS-sandboxed. The security boundary is the report's Content Security Policy plus
escaped attachment content; run untrusted attachments in a container or VM.
Revisit the sandbox when the CI runner supports it (B-029).

## Missing engine

Without the optional engine, `--pdf` fails cleanly:

```text
tolkira: Cannot render PDF for report.pdf: PDF output needs the optional Playwright Chromium engine.
In your project: npm i -D playwright-core@^1.65.0 playwright@^1.65.0
Then: npx playwright install chromium
A project-local Tolkira install is recommended. Or omit --pdf.
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
    npm i -D playwright-core@^1.65.0 playwright@^1.65.0
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

The PDF is local: no hosted renderer and no telemetry. The Chromium browser
download is the only browser download the PDF feature adds; installing the npm
packages is a normal network step.

## Limits

- Chromium only; one engine, one print layout.
- A4 portrait only: 12 mm margins, no header/footer/URL/page numbers and no
  Letter or custom paper in this slice. Landscape is not exposed.
- Tagged PDF/accessibility is B-027, page identity is B-021, page numbers are
  B-022, a PDF size cap is B-028, the Chromium OS sandbox is B-029 and
  Letter/custom paper is B-030.
- No CLI search/filter state; the browser print is the filtered and landscape
  route.
- Video/audio do not print. An unusually wide matrix may need browser landscape.
- The PDF-only route has no logo or Trends; `--logo`/`--history` require `--out`.
- The engine is an optional install: 19 MB of packages plus a 130–280 MB
  browser, and the render is CPU/memory-heavy on very large suites.
- The PDF is not byte-deterministic across Chromium, font and OS versions.
