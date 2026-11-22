# Tasks

## 1. Gate

- [x] 1.1 Validate the spec/design; confirm the line is Pickle metadata and not a
  JSON schema, CI or email change.
- [x] 1.2 Confirm no new locale key or dependency is needed.

## 2. TDD-Red

- [x] 2.1 Render tests: Playwright `file:line`, mixed Cucumber lines without a
  line, and a feature with no line without a trailing colon.
- [x] 2.2 Confirm RED for the missing model line/label behavior; keep existing
  render tests green.

## 3. Implement

- [x] 3.1 Add `line` to `ReportScenario` and map it from the Pickle location.
- [x] 3.2 Add the scenario-summary source line and keep `featureSourceLabel` on
  the one-URI/one-line rule; the scenario line must work when a project feature
  spans several spec files.
- [x] 3.3 Fix B-038: synthetic Playwright run-error pseudo-pickles use an
  unknown (0) line, not 1, so the error feature cannot show `errors:1`; the same
  unknown-line rule covers JUnit and line-less legacy and Playwright specs.
- [x] 3.4 Update `docs/PLAYWRIGHT-JSON.md`, `docs/BACKLOG.md` (B-035 and B-038
  resolved), `docs/DROP-IN-VALIDATION.md` and `docs/CHANGELOG.md`; no new catalog
  key.
- [x] 3.5 Keep `--json`, CI, email and the report bytes outside the source label
  unchanged; no new dependency.

## 4. Verification and review

- [x] 4.1 Run `npm run hygiene`, `npm run check`, `npm run test:e2e`.
  - Host rationale: this is a render-only label change covered by the unit
    render tests, so the Playwright host row is not re-run for this change; a
    release still runs the full host matrix in `docs/DROP-IN-VALIDATION.md`.
- [x] 4.2 Run SCR, CR, DAR, UXR and CMP; no SEC/PCA trigger beyond the existing
  render checks.
  - UXR note: the 320 px no-overflow check is a unit CSS assertion here; the
    browser viewport matrix stays the release gate.
- [x] 4.3 Fix findings; record decisions.
- [x] 4.4 Commit and push; no release.

## Gate record

- Hygiene: ok (633 tracked files, 259 commits).
- Check: 69 files, 1050 passed, 4 skipped; typecheck, lint, assets and build
  green.
- E2E: 355 passed, 8 skipped.
- Source line: 15 tests; Playwright multi-spec scenario lines, mixed Cucumber
  lines, no-line, JUnit and Playwright error pseudo-pickles without `:1`;
  summary/CI/email unchanged.
- Reviews: SCR, CR, DAR, UXR and CMP PASS after the fixer/recheck rounds.
- Deferred: the live Playwright host row was not re-run; the 320 px/200 % label
  is a CSS contract plus the release viewport gate. B-035 and B-038 are resolved;
  no schema, locale, dependency, JSON, CI or email change.
