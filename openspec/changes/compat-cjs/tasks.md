# Tasks

## 1. TDD-Red

- [x] 1.1 Add a CJS fixture/test that requires the compat subpath, awaits
  `generate` on a legacy report and asserts the HTML plus summary shape.
- [x] 1.2 Add callback-form, rejected-option/report-write error and
  `default`-undefined tests.
- [x] 1.3 Add a test that requiring the package root fails with
  `ERR_PACKAGE_PATH_NOT_EXPORTED` and no root default exists.
- [x] 1.4 Add a `.cts` NodeNext type fixture for the require path.

## 2. Implementer

- [x] 2.1 Add the tracked `.cts` wrapper, nested `require`/`import` export
  conditions and callback forwarding; verify 1.1–1.3 green.
- [x] 2.2 Ensure `tsc` emits `.cjs`/`.d.cts` and make the NodeNext type test
  pass.
- [x] 2.3 Reorder `check` so the built package exists before the CJS fixture
  (or test the packed tarball); run `npm run check`, `npm run test:e2e` and
  `npm pack --dry-run`, asserting both wrapper files ship.

## 3. Documentation and review

- [x] 3.1 Update `docs/COMPATIBILITY.md`, `docs/CHANGELOG.md`, `README.md`,
  the Seed-Test paragraph and ADR 0002; remove the “cannot be required” claims
  and state the async, shim-only CJS support.
- [ ] 3.2 Run SCR, CR, DAR, SEC, UXR, PCA, CMP, STR and MKT; fix every blocker.
- [ ] 3.3 Re-run the gate and archive after user approval.

## Workflow follow-up

- Archive after the review set and user approval.
