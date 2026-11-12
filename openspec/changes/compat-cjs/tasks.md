# Tasks

## 1. TDD-Red

- [ ] 1.1 Add a CJS fixture/test that requires the compat subpath, awaits
  `generate` on a legacy report and asserts the HTML plus summary shape.
- [ ] 1.2 Add tests for rejected options/report-write errors and `default`
  being undefined.
- [ ] 1.3 Add a test that requiring the package root still fails as ESM-only.
- [ ] 1.4 Add a type test or `.cjs` TypeScript fixture for the require path.

## 2. Implementer

- [ ] 2.1 Add the `.cjs` wrapper and `require` export condition; verify 1.1–
  1.3 green.
- [ ] 2.2 Add `.d.cts` types and make the type test pass.
- [ ] 2.3 Run `npm run check`, `npm run test:e2e` and `npm pack --dry-run`;
  verify the wrapper is shipped.

## 3. Documentation and review

- [ ] 3.1 Update `docs/COMPATIBILITY.md`, `docs/CHANGELOG.md` and ADR 0002.
- [ ] 3.2 Run SCR, CR, DAR, SEC, UXR, PCA, CMP, STR and MKT; fix every blocker.
- [ ] 3.3 Re-run the gate and archive after user approval.

## Workflow follow-up

- Archive after the review set and user approval.
