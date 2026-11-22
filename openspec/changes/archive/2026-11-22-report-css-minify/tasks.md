# Tasks

## 1. Gate

- [x] 1.1 Validate the spec/design; confirm esbuild is an existing dev
  dependency and no runtime/bundle change is needed.

## 2. TDD-Red

- [x] 2.1 Add the stylesheet drift test (minified equality) and adapt the exact
  dark-mode/palette/print-spacing assertions without losing their intent;
  confirm RED before minification.
- [x] 2.2 Keep goldens/e2e as the layout guard.

## 3. Implement

- [x] 3.1 Minify in `scripts/build-styles.mjs`; regenerate `styles.ts`.
- [x] 3.2 Refresh goldens/characterization hashes and any exact byte fixtures.
- [x] 3.3 Update CHANGELOG/comparison size notes only where measured.

## 4. Verification and review

- [x] 4.1 `npm run hygiene`, `npm run check` (1177 passed / 5 skipped) and
  `npm run test:e2e` (373 passed / 8 skipped) are green.
- [x] 4.2 Playwright movies-app pin `5d2cdf0` at 1440 and 390 with the minified
  report: 84,752 B, no overflow, no console errors; row in
  `docs/DROP-IN-VALIDATION.md`.
- [x] 4.3 SCR, CR, DAR, UXR, PCA and STR PASS.
- [x] 4.4 Review notes fixed (comparison size, architecture line, TDD-RED claim,
  host row); no deferred decisions.
- [ ] 4.5 Commit and push; archive after the gate.

## Gate record

- Sizes: `report.css` 46,344 B -> `REPORT_CSS` 40,290 B (-6,054 B, -13.06 %).
  Both render goldens shrink by the same 6,054 B.
- `npm run hygiene`: pass.
- `npm run check`: pass, 1177 passed / 5 skipped.
- `npm run test:e2e`: pass, 373 passed / 8 skipped.
- Host: Playwright movies-app pin `5d2cdf0`, `playwright.json` 24,760 B (8/8
  tests, 36/36 steps, 3 attachments / 85 B); minified report 84,752 B; no
  overflow at 1440x900 (1425/1440 px) or 390x844 (375/390 px); no console
  errors.
- Reviews: SCR, CR, DAR, UXR, PCA, STR PASS; no blocking findings.
- Risk: the minified bytes are esbuild-version dependent. `esbuild` is
  `^0.28.2`; a differently resolved version changes the output and needs
  `npm run assets` plus refreshed goldens and size records.
