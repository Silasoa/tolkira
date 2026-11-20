# Proposal

## Why

Browser print/Save as PDF is the zero-install route, but CI and headless
workflows need a PDF file without a human print dialog. The report already has
a complete print view; a PDF engine can reuse it. The #13 research and
`docs/research/pdf-engine-options.md` show that a browser renderer is the only
route that keeps one layout, while a pure-JS library would need a second report
layout and a system binary would break the npm-only baseline.

## What Changes

- Add `--pdf <file>`, `--pdf-timeout <ms>` and `renderPdf(html, options)` as an
  opt-in PDF export from the existing report HTML/print view.
- Use **Playwright Chromium** as an optional engine: `playwright-core` is an
  optional peer dependency, imported dynamically only for the PDF and marked
  external in the build. The default install and runtime dependency surface stay
  unchanged; the package gains the PDF documentation. The engine resolves beside
  Tolkira first, then from the project working directory, so a global or
  npx-cached Tolkira can use the caller's peer.
- Print the complete report through the print view: all present views and
  details, screenshots, light palette, fitted tables, A4 with 12 mm margins and
  no header/footer. The PDF is generated from a fresh page, so no CLI
  search/filter state applies; the browser print remains the filtered route.
- Use `page.setContent` with the report HTML (no temporary file), make lazy
  images eager, abort HTTP(S) subresources, wait for fonts and images, then
  `page.pdf` under an explicit deadline. The deadline defaults to five minutes
  and is overridable through `--pdf-timeout` and `PdfOptions.timeoutMs`.
- Write the PDF atomically in the order report → PDF → email → history →
  `--ci-out` → stdout. The PDF precedes the email that names it, so a PDF
  failure exits 1, names the PDF path, keeps the report and skips the email and
  later outputs; no partial PDF remains. A missing engine exits 1 with install
  instructions.
- Validate the PDF path like the other outputs (inputs, logo, report, CI,
  history, email, input-directory containment) and support `--locale` with
  `--pdf`. The PDF-only route has no logo or Trends (`--logo`/`--history`
  require `--out`).
- Document the PDF, the optional engine, the A4/no-header/no-page-number and
  Chromium-only limits, the composition with email/JSON/CI and the install.

Out of scope: page numbers or custom headers/footers, a pure-JS or system-binary
engine, a server/hosted renderer, forced landscape, PDF/A, and any change to
the one-file HTML default, report, summary, email or print view.

## Capabilities

### New Capabilities

- `pdf-export`: the opt-in PDF engine, content, print state, output safety and
  the optional dependency/API.

### Modified Capabilities

- `cli-api`: the `--pdf` option, write order, path safety, engine-missing error
  and the `renderPdf` API.
- `localisation`: the PDF follows the report locale; CLI/JSON/CI stay English
  and no new strings are added.

## Impact

- `src/pdf.ts` (new), `src/cli.ts` (`--pdf`, `--pdf-timeout`), `src/index.ts`,
  `esbuild.mjs` (external `playwright-core`), `package.json` (optional peer/peer
  metadata and files),
  tests (unit/CLI/e2e PDF), `docs/PDF.md` (new), `docs/adr/0007-optional-pdf-engine.md`,
  `docs/research/pdf-engine-options.md`, `README.md`, `DESIGN.md`,
  `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`, `docs/LIMITATIONS.md`,
  `docs/COMPATIBILITY.md`, `docs/PRODUCT.md`, `docs/CHANGELOG.md`,
  `docs/BACKLOG.md`, `docs/README.md`, `llms.txt`.
- No default runtime dependency, no network, no server. PDF users install
  `playwright-core` plus a Chromium browser; CI already installs Chromium for
  the browser gate. The default install and runtime dependency surface are
  unchanged; the package gains the PDF documentation.

## Review gate

PIR and DXR before implementation; implementation is a TDD pair; review swarm is
SCR, CR, DAR, UXR, CMP, SEC and PCA. ILA is not triggered (no new strings; the
PDF follows the report locale); STR is optional. Refs #13c, B-019 and ADR 0007.
