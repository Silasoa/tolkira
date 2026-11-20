# Tasks

## 1. Gate

- [x] 1.1 Run PIR and DXR over the proposal, spec and design; fix blockers.
- [x] 1.2 Confirm the archival-complete-print scope with the user; link #13.
- [x] 1.3 Record why ILA and SEC are not triggered.

## 2. TDD-Red

- [x] 2.1 Print CSS tests: `REPORT_CSS` contains the print block; explicit
  chrome selectors (not all buttons) hide the toolbar/filters/copy/chevrons/
  lightbox while `.shotButton`/`.shot` stay visible; the filter marker is
  visible; every `.tableWrap` table fits at the A4 width and 320 px; page
  breaks; the full light palette incl. status/soft and all 16 ANSI slots with
  prefixed and unprefixed `print-color-adjust`; the `printing` reveal lives
  inside `@media print`.
- [x] 2.2 State tests: dispatch `beforeprint`, assert all panels and closed
  details open, lazy images eager and an open lightbox closed with the page
  overflow reset while the active panel's `hidden` attribute is untouched;
  dispatch `afterprint`, assert the prior state; no Trends panel without
  history; the lightbox close is guarded.
- [x] 2.3 Browser tests: A4-width (~794 px, ~703 px content) print media at
  1440 and 794, German fixture with history, dark screen + print (light
  `.statusText` and all 16 ANSI slots), no-JS active Report/closed details,
  failed-only print keeps the filtered rows and shows the count, and a 320 px
  print check for hidden chrome, present content and no clipped table.
- [x] 2.4 PDF smoke: `test.skip(browserName !== 'chromium')`; guarded explicit
  `beforeprint` (Chromium `page.pdf` fires it too);
  `page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })`;
  assert `%PDF` and at least three page objects (Report, Details, Trends) for a
  history fixture; pagination stays a dated manual check.
- [x] 2.5 Print budget/catalog test: client bundle under 16 KB and free of the
  print handler, `PRINT_SCRIPT` carries the print listeners, no new catalog key.
- [x] 2.6 Confirm the new tests fail for the right reason; record `tdd-red.md`.

## 3. Implement

- [x] 3.1 Add the `@media print` block to `src/render/report.css`: full light
  palette (status/soft/ANSI), explicit chrome hiding with screenshots kept,
  filter marker, single-column analysis, fixed feature/matrix layout with auto
  Trends columns and child widths reset, page breaks, `@page`.
- [x] 3.2 Add the `beforeprint`/`afterprint` lifecycle as the static
  `src/render/print-script.ts` (body `printing` class, originally closed
  details, lazy images, open lightbox and html overflow) and embed it as a
  second CSP-hashed inline script.
- [x] 3.3 German print overrides in `src/render/html.ts` `localeCss` only where
  the `:lang(de)` screen rules conflict; keep `html.ts` under 100 lines.
- [x] 3.4 Regenerate `styles.ts` and `client-bundle.ts`; update the
  characterization hashes and goldens intentionally; confirm the screen text is
  unchanged and the print rules/hook plus the separate print script are the only
  CSS/script diff; record the CSS/client/report delta.

## 4. Docs

- [x] 4.1 Add a "Print or Save as PDF" section to `README.md` (complete print by
  default, filter carry-over, failures-only archival print, no-JS fallback,
  browser headers/footers/URL and page-identity warning, landscape,
  video/audio); replace the stale "printing captures the open tab" sentence.
- [x] 4.2 Update `DESIGN.md`, `docs/LIMITATIONS.md`, `docs/COMPATIBILITY.md`,
  `docs/CHANGELOG.md`, `docs/PRODUCT.md`, `docs/BACKLOG.md` (email #13b, PDF
  engine #13c, print button, repeated print title/page header, page numbers).

## 5. Verification and review

- [x] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 5.2 Run the review swarm: SCR, CR, DAR, UXR and CMP, plus PCA for the
  large-report print volume and the CSS/client budget. UXR covers the German
  print and `localeCss`; ILA is not triggered (no new copy).
- [x] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md`.
- [x] 5.4 Commit and push with #13 and the change reference.

## Gate record

- Unit: 13/13 print unit tests. The suite pins all 45 light-palette properties,
  the print-only `.printing` reveal inside `@media print`, every `.tableWrap`
  table, the guarded `close?.()` / `showModal` lifecycle and the 16 KB client
  budget. `npm run check`: 906 passed, 3 skipped; i18n, assets, typecheck, lint
  and build green.
- Browser: `npm run test:e2e` 337 passed, 2 skipped. `test/e2e/print.spec.ts`
  34 passed, 2 skipped (PDF is Chromium-only) across Chromium, Firefox and
  WebKit, including the 320 px print check.
- PDF smoke: Chromium, `%PDF` and at least 3 page objects asserted. English
  history: 20 A4 pages / 237,221 B. German history: 6 A4 pages / 161,307 B;
  `pdftotext` keeps `Fehlgeschlagen`, `Übersprungen`, `Erfolgsquote` and
  `Aufgezeichnet am` intact. A long attachment can shift pagination by one page
  (20 vs 21), so pagination beyond the smoke stays a dated manual check.
- Sizes: `REPORT_CSS` 44,382 B; `CLIENT_SCRIPT` 15,268 B with 732 B under the
  16,000-byte gate; `PRINT_SCRIPT` 716 B inline (950 B source file). Reports:
  English 162,540 B, German 85,472 B.
- Trends: `table-layout: auto`, 14% date column, nowrap headers/status
  pills/`Current` chip, wrapping title column. The title column is narrow and
  wraps titles (accepted).
- Output: 8 characterization hashes and 2 goldens updated intentionally. The
  golden body text, ordinary screen CSS and client script are byte-identical to
  the pre-print baseline; only the `.printing` hook inside the print block, the
  appended print block, the added print script and the second CSP hash moved.
- Hygiene: `npm run hygiene` ok.
- Review findings: SCR, CR, DAR, UXR, CMP and PCA notes were addressed in the
  docs and tests on 2026-11-20; all six re-checks PASS. UXR re-rendered the
  German Trends PDF with attachments (11 pages; `Fehlgeschlagen`,
  `Übersprungen`, `Erfolgsquote`, `Aufgezeichnet am` intact; table 675/703 px;
  screenshots complete) and the English 20-page PDF; no clipped pages. Deferred:
  email #13b, PDF engine #13c, print button, repeated print title/page header
  and custom page numbers in `docs/BACKLOG.md`, each with a revisit trigger.
