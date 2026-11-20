# Tasks

## 1. Gate

- [x] 1.1 Run PIR and DXR over the proposal, spec and design; fix blockers.
- [x] 1.2 Confirm the archival-complete-print scope with the user; link #13.
- [x] 1.3 Record why ILA and SEC are not triggered.

## 2. TDD-Red

- [ ] 2.1 Print CSS tests: `REPORT_CSS` contains the print block; explicit
  chrome selectors (not all buttons) hide the toolbar/filters/copy/chevrons/
  lightbox while `.shotButton`/`.shot` stay visible; the filter marker is
  visible; tables fit at the A4 width; page breaks; the full light palette
  incl. status/soft/ANSI with prefixed and unprefixed `print-color-adjust`.
- [ ] 2.2 State tests: dispatch `beforeprint`, assert all panels and closed
  details open, lazy images eager and an open lightbox closed with the page
  overflow reset; dispatch `afterprint`, assert the prior state; no Trends
  panel without history.
- [ ] 2.3 Browser tests: A4-width (~794 px, ~703 px content) print media at
  1440 and 794, German fixture with history, dark screen + print (light
  `.statusText`/ANSI), no-JS active Report/closed details, failed-only print
  keeps the filtered rows and shows the count. At 320 only assert chrome hidden
  and content present.
- [ ] 2.4 PDF smoke: `test.skip(browserName !== 'chromium')`; dispatch
  `beforeprint` explicitly; `page.pdf({ format: 'A4', printBackground: true,
  preferCSSPageSize: true })`; assert `%PDF` and more than one page object for
  a history fixture; pagination stays a dated manual check.
- [ ] 2.5 Client budget/catalog test: bundle under 16 KB, no new catalog key,
  print listeners present.
- [ ] 2.6 Confirm the new tests fail for the right reason; record `tdd-red.md`.

## 3. Implement

- [ ] 3.1 Add the `@media print` block to `src/render/report.css`: full light
  palette (status/soft/ANSI), explicit chrome hiding with screenshots kept,
  filter marker, single-column analysis, fixed table layout with child widths
  reset, page breaks, `@page`.
- [ ] 3.2 Add the `beforeprint`/`afterprint` handler to
  `src/render/report-client.ts`: panels/details, lazy images, open lightbox and
  html overflow restore.
- [ ] 3.3 German print overrides in `src/render/html.ts` `localeCss` only where
  the `:lang(de)` screen rules conflict; keep `html.ts` under 100 lines.
- [ ] 3.4 Regenerate `styles.ts` and `client-bundle.ts`; update the
  characterization hashes and goldens intentionally; confirm the screen text is
  unchanged and the print rules/handler are the only CSS/script diff; record
  the CSS/client delta.

## 4. Docs

- [ ] 4.1 Add a "Print or Save as PDF" section to `README.md` (complete print,
  no-JS fallback, failed-only short PDF, browser headers/footers/URL warning,
  landscape, video/audio); replace the stale "printing captures the open tab"
  sentence.
- [ ] 4.2 Update `DESIGN.md`, `docs/LIMITATIONS.md`, `docs/COMPATIBILITY.md`,
  `docs/CHANGELOG.md`, `docs/PRODUCT.md`, `docs/BACKLOG.md` (email #13b, PDF
  engine #13c, print button, repeated print title/page header, page numbers).

## 5. Verification and review

- [ ] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [ ] 5.2 Run the review swarm: SCR, CR, DAR, UXR and CMP, plus PCA for the
  large-report print volume and the CSS/client budget. UXR covers the German
  print and `localeCss`; ILA is not triggered (no new copy).
- [ ] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md`.
- [ ] 5.4 Commit and push with #13 and the change reference.

## Gate record

To be filled after verification: unit/e2e counts, PDF smoke, CSS/client sizes,
review verdicts and any deferred item.
