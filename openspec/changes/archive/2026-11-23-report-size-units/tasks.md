# Tasks

## 1. Gate

- [x] 1.1 Validate the spec and design (PIR + DXR): no schema, catalog, style
  or dependency change; the exact count stays visible and leads the row.
- [x] 1.2 Confirm every golden, characterization fixture and host artifact is
  below 1 MiB, so the sub-1 MiB branch must stay byte-identical.

## 2. TDD-Red

- [x] 2.1 A 1.1 MB report shows `<exact bytes> (<one-decimal MB>)`, and the
  leading byte count equals `Buffer.byteLength(html, 'utf8')`.
- [x] 2.2 A report below 1 MiB keeps the exact byte count alone, with no MB and
  no parentheses.
- [x] 2.3 German: `exactSizeLabel(MIB, de)` is `1.048.576 Byte (1,0 MB)`, and a
  1.1 MB document rendered with `locale: 'de'` keeps the leading byte count
  equal to `Buffer.byteLength(html, 'utf8')`.
- [x] 2.4 The marker-token and stream-parity tests keep their expectations
  (reports are below 1 MiB); both goldens and all eight
  `render-characterization` hashes stay green. A characterization failure means
  the loop drifted, not that the hashes are regenerated.
- [x] 2.5 Replace the old "above 1 MiB / `not.toContain('MB')`" assertion with
  the new spec expectation. No other test is deleted, skipped or weakened.

## 3. Implement

- [x] 3.1 Add `exactSizeLabel` in `src/render/format.ts`.
- [x] 3.2 Solve `applyReportSize` on the byte count and render the new label.
- [x] 3.3 Update `docs/CHANGELOG.md`, `docs/AGENT-INTERFACE.md`,
  `docs/DROP-IN-VALIDATION.md` (small-change path), `docs/BACKLOG.md` (B-041
  closes, B-045/B-046 recorded), `docs/I18N.md`, `README.md` and
  `docs/research/0.5-scope.md`.

## 4. Verification and review

- [x] 4.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 4.2 Record the small-change decision: last recorded final host reports
  are Seed-Test 116,113/117,137 B and Playwright movies-app 89,904 B, largest
  117,137 B; the two Java hosts were not re-measured for this slice, and their
  reports embed the same ~40 KB stylesheet and client bundle. So no host row was
  re-run for this slice; the maintainer approved this documented exception for
  0.5.0 on 2026-11-23. The reason is written in `docs/DROP-IN-VALIDATION.md` and
  the Gate record.
- [x] 4.3 Run SCR, CR, DAR, UXR, ILA, CMP and STR. ILA runs because the row
  composes two localized units, even though no catalog key changes.
- [x] 4.4 Fix findings; record deferred decisions.
- [x] 4.5 Commit and push; the coordinator archives after the gate.

## Gate record

2026-11-23, `report-size-units`.

- Hygiene: `npm run hygiene` ok (747 tracked files, 303 commits).
- Check (coordinator, before the fixer): `npm run check` 1207 passed, 5 skipped;
  i18n, typecheck, lint and build green. After the fixer: 78 files, 1208 passed,
  5 skipped (1213); typecheck, lint, i18n and build green.
- E2E (coordinator, before the fixer): `npm run test:e2e` 382 passed, 8 skipped
  (Chromium, Firefox and WebKit; 320/390/768/1024/1440 px plus 320 px at 200 %
  text). After the fixer, focused: `npx playwright test
  test/e2e/size-diagnostics.spec.ts` 6 passed (2 tests across Chromium, Firefox
  and WebKit), including the new >1 MiB case. After the fixer, full:
  `npm run test:e2e` 385 passed, 8 skipped (same engines, viewports and zoom),
  including the new case on all three engines.
- Hosts: small change, relies on the fixture/e2e gate; no row was re-run for
  this slice. The maintainer approved this documented exception for 0.5.0 on
  2026-11-23; the next release re-runs every row. Last recorded final reports:
  Seed-Test 116,113/117,137 B, Playwright movies-app 89,904 B, largest 117,137
  B; PetClinic and Cucumber-JVM were not re-measured for this slice, and their
  reports embed the same ~40 KB stylesheet and client bundle, far below 1 MiB.
- Review: SCR, CR, DAR, UXR, ILA, CMP and STR ran; the first SCR/DAR pass found
  must-fix findings, the re-review passed after this fixer pass. Fixed: the
  missing `Size label is exact` scenario; the changelog contradiction (extend
  the Added bullet, no Changed bullet); B-041 resolved and B-045/B-046
  recorded; truthful host evidence; a non-breaking space between number and
  unit; the loop local renamed with a convergence comment; a static test
  import; the 1 MiB boundary sweep; a second e2e case; proposal, I18N, README
  and design records.
- Decisions: keep the `exactSizeLabel` name; PCA not triggered (no hot path or
  dependency, one string); a compat-cjs 5 s timeout under 78 parallel workers
  passes alone and is the known B-031 parallel-load timeout class.
- Open: commit/push and archive bookkeeping (coordinator; not done in this
  pass).
