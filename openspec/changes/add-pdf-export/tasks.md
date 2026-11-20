# Tasks

## 1. Gate

- [x] 1.1 Run PIR and DXR over the proposal, spec, design and ADR 0007; fix blockers.
- [x] 1.2 Confirm the optional Playwright/Chromium scope, cost, setContent and first-slice limits with the user.
- [x] 1.3 Link #13c, B-019 and ADR 0007; record the optional dependency reason.

## 2. TDD-Red

- [x] 2.1 `renderPdf` unit with a mocked `playwright-core`: `page.setContent(html)`, the print options (A4/12 mm via `preferCSSPageSize`, printBackground, no header), the five-minute/default timeout, the native `beforeprint`, fonts/images, browser close, the missing-engine install error and no output file.
- [x] 2.2 CLI: `--pdf` alone/with `--out`/`--email`/`--json`/`--ci`; the order report â†’ PDF â†’ email and later-output suppression; canonicalized collisions/input containment; the missing-engine exit; the confirmation; the locale without `--out`; the email note naming the PDF; the report/JSON/CI bytes; the binary atomic write and a directory-path failure.
- [x] 2.3 E2E (Chromium, small fixture, explicit `test.setTimeout`): a history/attachment report; `%PDF`, at least three `/Type /Page` objects, A4 MediaBox and 12 mm inset; the German labels; the screenshots; no header/footer; the `--out` and PDF-only routes; no `file://` temp.
- [x] 2.4 Package/peer: the `playwright-core` optional peer version-aligned with `@playwright/test`, explicit dev `playwright`, the updated lockfile, the esbuild external, no peer type in emitted declarations, the package job missing-engine smoke, the default dependency surface unchanged.
- [x] 2.5 Confirm the new tests fail for the right reason; record `tdd-red.md` (including the filter state removal and setContent decision).

## 3. Implement

- [x] 3.1 Add `src/pdf.ts` with `renderPdf(html, options?)`: dynamic `playwright-core`, Chromium, `page.setContent`, fonts/images, native `beforeprint`, A4/12 mm, printBackground/preferCSSPageSize, no header/footer, five-minute default timeout, browser close, errors, no file.
- [x] 3.2 Add `--pdf` parsing/usage, the locale guard, the order report â†’ PDF â†’ email â†’ history â†’ `--ci-out` â†’ stdout, canonicalized path containment, the binary atomic write, the missing-engine exit, the confirmation, the email note naming the PDF and the PDF-only logo/history limits.
- [x] 3.3 Add the optional peer/peer metadata, the dev `playwright`, the lockfile update and the `playwright-core` external in esbuild; keep the default dependency surface and the report/HTML/JSON/CI bytes unchanged.
- [x] 3.4 Export `renderPdf`/`PdfOptions` from the package root; no peer type leaks into declarations.

## 4. Docs

- [x] 4.1 Add `docs/PDF.md` (install peer + browser with one tested command, `--pdf`/`renderPdf`, complete print archive, A4/no header/no page numbers/Chromium-only, composition/order, PDF-only logo/history limits, setContent/no-temp privacy, missing engine, five-minute timeout/print volume, cost, CI example) and add it to `package.json` `files`, `docs/README.md`, `llms.txt`.
- [x] 4.2 Update `README.md`, `DESIGN.md`, `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`, `docs/LIMITATIONS.md`, `docs/COMPATIBILITY.md`, `docs/PRODUCT.md`, `docs/CHANGELOG.md`, `docs/BACKLOG.md`, `docs/EMAIL.md`/`docs/CI.md` (PDF order/email note); add ADR 0007 and the research note; fix the ADR `docs/PRINT.md`, the research proposed/`playwright-core`-vs-`playwright`/`TOLKIRA_BROWSER` stale points, the B-021/B-022 triggers and the PDF size/timeout/tagged-PDF backlog.

## 5. Verification and review

- [ ] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e` (including the Chromium PDF smoke; the check suite must not launch a browser).
- [ ] 5.2 Run the review swarm: SCR, CR, DAR, UXR, CMP, SEC and PCA, with tagged-PDF/accessibility and PDF size/timeout in UXR/PCA. ILA is not triggered (no new strings); STR is optional.
- [ ] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md`.
- [ ] 5.4 Commit and push with #13c and the change reference.

## Gate record

To be filled after verification: unit/e2e counts, PDF size/pages/MediaBox,
engine cost, review verdicts and any deferred item.

