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

- [ ] 4.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [ ] 4.2 Re-run the Playwright 1440/390 report-shell row; record the result.
- [ ] 4.3 Run SCR, CR, DAR, UXR (layout/print), PCA (size) and STR.
- [ ] 4.4 Fix findings; record deferred decisions.
- [ ] 4.5 Commit and push; archive after the gate.

## Gate record

To be filled after verification.
