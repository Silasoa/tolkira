# Tasks

## 1. Gate

- [x] 1.1 Run PIR and DXR over the proposal, spec, design and ADR 0007; fix blockers.
- [x] 1.2 Confirm the optional Playwright/Chromium scope, cost, setContent and first-slice limits with the user.
- [x] 1.3 Link #13c, B-019 and ADR 0007; record the optional dependency reason.

## 2. TDD-Red

- [x] 2.1 `renderPdf` unit with a mocked `playwright-core`: `page.setContent(html)`, the print options (A4 via `format`, 12 mm via `@page`, printBackground, no header), the five-minute/default deadline, the native `beforeprint`, fonts/images, browser close, the missing-engine install error and no output file.
- [x] 2.2 CLI: `--pdf` alone/with `--out`/`--email`/`--json`/`--ci`; the order report → PDF → email and later-output suppression; canonicalized collisions/input containment; the missing-engine exit; the confirmation; the locale without `--out`; the email note naming the PDF; the report/JSON/CI bytes; the binary atomic write and a directory-path failure.
- [x] 2.3 E2E (Chromium, small fixture, explicit `test.setTimeout`): a history/attachment report; `%PDF`, at least three `/Type /Page` objects, A4 MediaBox and 12 mm inset; the German labels; the screenshots; no header/footer; the `--out` and PDF-only routes; no `file://` temp.
- [x] 2.4 Package/peer: the `playwright-core` optional peer version-aligned with `@playwright/test`, explicit dev `playwright`, the updated lockfile, the esbuild external, no peer type in emitted declarations, the package job missing-engine smoke, the default dependency surface unchanged.
- [x] 2.5 Confirm the new tests fail for the right reason; record `tdd-red.md` (including the filter state removal and setContent decision).

## 3. Implement

- [x] 3.1 Add `src/pdf.ts` with `renderPdf(html, options?)`: dynamic `playwright-core`, Chromium, `page.setContent`, fonts/images, native `beforeprint`, A4/12 mm, printBackground/preferCSSPageSize, no header/footer, five-minute default deadline, browser close, errors, no file.
- [x] 3.2 Add `--pdf` parsing/usage, the locale guard, the order report → PDF → email → history → `--ci-out` → stdout, canonicalized path containment, the binary atomic write, the missing-engine exit, the confirmation, the email note naming the PDF and the PDF-only logo/history limits.
- [x] 3.3 Add the optional peer/peer metadata, the dev `playwright`, the lockfile update and the `playwright-core` external in esbuild; keep the default dependency surface and the report/HTML/JSON/CI bytes unchanged.
- [x] 3.4 Export `renderPdf`/`PdfOptions` from the package root; no peer type leaks into declarations.

## 4. Docs

- [x] 4.1 Add `docs/PDF.md` (install peer + browser with one tested project-local command, `--pdf`/`--pdf-timeout`/`renderPdf`, complete print archive, A4 portrait/no header/no page numbers/Chromium-only, composition/order, PDF-only logo/history limits, setContent/no-temp privacy, HTTP(S) abort, no-sandbox risk, missing engine, deadline/print volume, cost, CI example) and add it to `package.json` `files`, `docs/README.md`, `llms.txt`.
- [x] 4.2 Update `README.md`, `DESIGN.md`, `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`, `docs/LIMITATIONS.md`, `docs/COMPATIBILITY.md`, `docs/PRODUCT.md`, `docs/CHANGELOG.md`, `docs/BACKLOG.md`, `docs/EMAIL.md`/`docs/CI.md` (PDF order/email note); add ADR 0007 and the research note; fix the ADR `docs/PRINT.md`, the research proposed/`playwright-core`-vs-`playwright`/`TOLKIRA_BROWSER` stale points, the B-021/B-022 triggers and the PDF size/timeout/tagged-PDF backlog.

## Review fixes (2026-11-20)

- [x] Make lazy thumbnails eager before the font/image wait and bound that wait
  by the same deadline as the print; add the 40-screenshot Chromium e2e with
  `--pdf-timeout 30000`.
- [x] Resolve `playwright-core` from the project working directory when the
  import beside Tolkira fails; update the install guidance and docs; add the
  no-browser fallback unit test.
- [x] Add `--pdf-timeout <ms>` (positive integer, needs `--pdf`), pass
  `{ timeoutMs }` to `renderPdf`, and document it in the CLI, specs and docs.
- [x] Abort HTTP(S) subresources before `setContent`; document the offline
  boundary and the accepted no-OS-sandbox risk (B-029).
- [x] Correct the tarball, timeout, A4/preferCSSPageSize and backlog wording;
  add B-029 (sandbox) and B-030 (Letter/custom paper).
- [x] Fix the esbuild compat externals, the package-job smoke assertions, the
  usage wording, the PDF-only size warning, the capped one-line render error and
  the dead engine-catch.
- [x] Avoid the PDF byte copy, bound `browser.close()`, label the volume numbers
  as maintainer-measured and skip the declaration assertion without `dist`.
- [x] Run the CI missing-peer smoke from empty and fake-peer temp cwds; assert
  the fallback failure guidance and at least one embedded image per screenshot.

## 5. Verification and review

- [x] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e` (including the Chromium PDF smoke; the check suite must not launch a browser).
- [x] 5.2 Run the review swarm: SCR, CR, DAR, UXR, CMP, SEC and PCA, with tagged-PDF/accessibility and PDF size/timeout in UXR/PCA. ILA is not triggered (no new strings); STR is optional.
- [x] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md`.
- [x] 5.4 Commit and push with #13c and the change reference.

## Gate record

- `npm run hygiene`: ok (622 tracked files, 249 commits).
- `npm run check`: 67 files, 1017 passed, 4 skipped; typecheck, lint and
  build green.
- `npm run test:e2e`: 355 passed, 8 skipped; 3 PDF Chromium tests. The
  German A4 PDF has 5 pages and 139,695 bytes; the 40-screenshot report has
  19 pages, 3,118,618 bytes and 80 embedded images in 4.8 s.
- Engine: optional `playwright-core` `^1.65.0` plus Chromium (130–280 MB);
  the default install and runtime dependency surface are unchanged; the
  package gains `docs/PDF.md`.
- Reviews: SCR, CR, DAR, UXR, CMP, SEC and PCA PASS after the fixer rounds.
- Deferred: B-021/B-022 page identity/page numbers, B-027 tagged PDF, B-028
  size cap, B-029 Chromium OS sandbox, B-030 Letter/custom paper; landscape
  is unscheduled. B-031 records the parallel-load performance e2e flake.

