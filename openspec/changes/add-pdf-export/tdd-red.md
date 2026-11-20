# TDD-Red record: add-pdf-export (#13c)

Date: 2026-11-20. Worker: TDD-Red. Scope: failing tests and test-only
helpers/fixtures only. No `src/` change, no docs, no config, no golden or hash
update, no commit.

## Files

Added:

- `test/pdf.test.ts` — `renderPdf` unit contract with a mocked
  `playwright-core` (no browser in `npm run check`).
- `test/cli-pdf.test.ts` — `--pdf` CLI contract with a mocked `../src/pdf.js`
  (the real engine only runs in the e2e).
- `test/e2e/pdf.spec.ts` — real Chromium PDF, `--out` and PDF-only routes.
- `test/package-pdf.test.ts` — peer/lock/esbuild/declaration/package-job
  contract.

Changed (test-only):

- `test/e2e/helpers.ts` — added `writePdf`, `readPdf` and `PdfInfo`/`PdfFile`.
  `readPdf` extracts the page count, A4 MediaBox, image XObjects and text from
  the PDF (inflate + font `ToUnicode` CMaps) and derives the first-page content
  clip, which exposes the print-CSS inset.

Untouched: `src/`, `package.json`, `package-lock.json`, `esbuild.mjs`, CI
workflows, docs, existing product tests, goldens and hashes.

## Red commands and observed failures

### 1. Unit and CLI

```bash
npx vitest run test/pdf.test.ts test/cli-pdf.test.ts
```

Observed: `2 failed` test files, `29 failed | 1 passed` of 30 tests.

- `test/pdf.test.ts`: 10/10 fail with
  `Error: Cannot find module '/src/pdf.js' imported from .../test/pdf.test.ts`.
  Every test loads `src/pdf.ts` through a dynamic import after
  `vi.resetModules()`; the missing module is the missing `renderPdf` contract.
- `test/cli-pdf.test.ts`: 19/20 fail.
  - Most fail at the first success assertion with
    `tolkira: Unknown option '--pdf' ...` and exit 2 instead of 0.
  - The empty-path test fails the message contract
    (`--pdf requires a file path`), and `--help` lacks `--pdf <file>`.
  - The collision/containment tests fail because the usage dump does not name
    `--pdf`; `Unknown option` is explicitly rejected as a pass reason.
  - The PDF-failure, missing-engine and directory-path tests expect exit 1 and
    receive the unknown-option exit 2.
  - The one passing test is a guard: no catalog key contains `pdf`. It is
    expected to pass before and after implementation.

Why this is the right red: the failures are the absent module, the absent flag,
the absent write order/confirmation, the absent path rules, and the absent
engine error. Existing report, email, JSON, CI and history behavior is not
touched and keeps running.

### 2. Chromium e2e

```bash
npx playwright test test/e2e/pdf.spec.ts --project=chromium
```

Observed: `2 failed` of 2, both at the `writePdf` helper assertion
`expect(code, stderr).toBe(0)` with `Unknown option '--pdf'` and exit 2. The
spec never reaches the PDF assertions, which is correct: the CLI cannot produce
a PDF yet.

### 3. Package metadata (additional red)

```bash
npx vitest run test/package-pdf.test.ts
```

Observed: `5 failed | 1 passed` of 6.

- peer `playwright-core` is `undefined` (expected `^1.65.0` with optional
  metadata; dev `playwright` missing).
- the lock root has no peer entries.
- `esbuild.mjs` does not mark `playwright-core` external.
- `dist/index.d.ts` has no `renderPdf` declaration (and must not leak a
  `playwright-core` type once it has one).
- the package job in `.github/workflows/ci.yml` has no `--pdf` missing-engine
  smoke.
- the passing test is the guard that the default runtime surface stays at
  `@cucumber/messages`, `fast-xml-parser` and `markdown-it`.

## Pinned contracts by file

### `test/pdf.test.ts` (mock engine)

- Dynamic `playwright-core`, `chromium.launch({ headless: true })`, one fresh
  page, browser closed in `finally` after success and after `setContent`/`pdf`
  failures.
- `page.setContent(html, { waitUntil: 'load', timeout })`; no `page.goto`, so
  no temporary report file or URL state.
- `page.pdf` exactly `format: 'A4'`, `printBackground: true`,
  `preferCSSPageSize: true`, `displayHeaderFooter: false`, `timeout: 300000`.
- Default five-minute timeout, shared with `setContent`; `renderPdf(html,
  { timeoutMs: 120000 })` overrides both.
- Fonts/images await `document.fonts.ready` and image `decode()`; no manual
  `beforeprint`/`afterprint` dispatch (the native `page.pdf` lifecycle owns it).
- Missing engine (module resolves without Chromium) and missing browser
  (`Executable doesn't exist`) both throw install guidance naming
  `playwright`/`playwright-core`, `npm i -D ...` and `install chromium`.
- Bytes are returned as `Uint8Array`; the package root exports the same
  function.

### `test/cli-pdf.test.ts` (mocked `renderPdf`)

- `--pdf` alone writes only the PDF, exits 0 and prints
  `PDF written to <path>`; no report file.
- Order: report → PDF → email → history → `--ci-out` → stdout. The mock
  snapshots that the report exists while the email, history update and
  `--ci-out` do not yet exist at PDF time.
- Confirmation order Report → PDF → Email when `--ci-out` frees stdout.
- JSON and CI stdout stay byte-identical; report bytes stay identical; PDF
  confirmation is suppressed when JSON/CI owns stdout.
- PDF failure exits 1, names the path, keeps the report, skips email, history,
  `--ci-out`, JSON and stdout, and leaves no `.tmp`.
- Missing engine exits 1 with install guidance and keeps the report; no email.
- Empty `--pdf` is usage exit 2; at least one input is required.
- Collisions with input, logo, `--out`, `--ci-out`, `--history` and `--email`
  are exit 2 and write nothing; input-directory and symlinked-directory
  containment are exit 2; case-variant collision is covered on case-folding
  platforms.
- A directory PDF path is a write failure: exit 1, report kept, no temp file.
- Engine bytes are written unchanged (non-UTF-8 byte sequence).
- `--locale de` works with `--pdf` and without `--out`; the in-memory HTML is
  German and English JSON stdout is unchanged.
- No catalog key contains `pdf`.
- `--logo`/`--history` still require `--out` with `--pdf`.
- Email names `report.html` with `--out`; without `--out` the PDF is written
  before the email and the email names `run.pdf`.
- Help lists `--pdf <file>` and the output requirement names it.

### `test/e2e/pdf.spec.ts` + `test/e2e/helpers.ts`

- Chromium-only (`test.skip` elsewhere), `test.setTimeout(180_000)`.
- German history fixture with a screenshot attachment; `--out report.html` and
  PDF-only routes.
- `%PDF` header; at least 3 `/Type /Page`; A4 MediaBox near 595.92 × 842.88 pt
  (tolerance in the test); 12 mm inset on all four sides from the first-page
  content clip (34.02 pt, ±2).
- Embedded `/Subtype /Image` objects prove screenshot pixels, not only names.
- Extractable German text: `Fehlgeschlagen`, `Szenarien mit Ergebnissen`,
  `Laufdetails`, `Überweisung ohne Deckung` (whitespace-insensitive), plus
  `Aufgezeichnete Läufe` on the `--out`/history route.
- No header/footer/URL/temp path (`about:blank`, `file://`, the temp dir).
- `--out` route leaves `report.html` + `run.pdf`; PDF-only leaves only
  `run.pdf`.

The helper was validated against real Chromium 1.65 PDFs before the Red run:
A4 MediaBox `595.91998 × 842.88`, first-page inset 33.75–34.18 pt, 6 pages and
2 image XObjects for the German history fixture, and intact German text after
CMap decoding. The e2e is therefore red on the missing CLI flag, not on the
parser.

### `test/package-pdf.test.ts`

- `peerDependencies.playwright-core = ^1.65.0` and
  `peerDependenciesMeta.playwright-core.optional = true`.
- dev `playwright = ^1.65.0`; lockfile root mirrors both; installed
  `playwright`, `playwright-core` and `@playwright/test` resolve 1.65.x
  together.
- Default runtime dependencies stay exactly the three existing packages and
  `optionalDependencies` stays absent.
- `playwright-core` is external in the shared `esbuild.mjs` config.
- Built `dist/index.d.ts` contains `renderPdf` and no `playwright-core` type.
- The CI `package` job contains a `--pdf` missing-engine smoke with an expected
  failure/cleanup assertion.

## Decisions recorded

- `page.setContent` (not a temporary `file://` page) is pinned by the unit test:
  the HTML is set directly and `page.goto` is absent.
- The PDF is generated from a fresh page: the browser report filter/search
  state is not applied. The browser print remains the filtered route.
- The PDF is written by the CLI, not by `renderPdf`: the API returns bytes and
  writes no file.
- The real PDF runs only in the Chromium e2e; `npm run check` uses mocks and
  launches no browser.
