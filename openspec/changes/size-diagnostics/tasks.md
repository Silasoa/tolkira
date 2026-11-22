# Tasks

## 1. Gate

- [x] 1.1 Validate the spec and design; confirm the additive
  `inputFiles`/`inputBytes`, contributor wording, one-measurement size loop and
  no schema/CI/email/dependency change.
- [x] 1.2 Confirm the loader byte/file seam, the existing Run panel rows,
  `src/i18n/locales/*.json` sources, `.gitattributes` renormalization and the
  golden update path.

## 2. TDD-Red

- [x] 2.1 Loader: per-group `bytes`, summed `inputBytes` and `inputFiles`;
  duplicate-content files are skipped and not double counted; `GeneratedReport`
  exposes the additive fields.
- [x] 2.2 Run panel: input/attachment/report contributor rows and the note; top
  three attachments in descending byte order; a step/hook attachment appears
  once; omit input without bytes and largest without attachments.
- [x] 2.3 Exact report HTML size row uses bytes and equals
  `Buffer.byteLength`; one document measurement; marker token in escaped content
  is unchanged; `sizeLabel` 1 MiB boundary.
- [x] 2.4 CLI warning names report/report-file/decoded attachment sizes and
  asserts the values against `Buffer.byteLength(html)`, `generated.inputBytes`
  and `summary.attachments.bytes`; below threshold prints none; panel attachment
  bytes and the summary agree for a representative fixture.
- [x] 2.5 en/de JSON keys, sorted and described; 320/390/1440 layout with a long
  attachment name and 200% text zoom.
- [x] 2.6 Confirm RED for the missing rows/warning; existing tests stay green.

## 3. Implement

- [x] 3.1 Add loader bytes/files and thread `inputFiles`/`inputBytes` through
  `index.ts`, `RenderOptions` and `GeneratedReport`; document the loader-group
  contract.
- [x] 3.2 Extend the Run panel, add `.sizeList`, `sizeLabel` and
  `format.megabytes`; rebuild generated styles.
- [x] 3.3 Add the one-measurement exact report-size loop and the empty-element
  marker.
- [x] 3.4 Add the CLI warning composition with MB-only formatting.
- [x] 3.5 Edit `src/i18n/locales/en.json`/`de.json`, run the assets build, add
  `.gitattributes`, renormalize fixtures and update goldens intentionally.
- [x] 3.6 Update README, `docs/AGENT-INTERFACE.md`, CHANGELOG, BACKLOG B-040
  ("early input-size warning") and the host row; keep summary/CI/email,
  `RenderReportOptions`, dependencies and the one-file rule unchanged.

## 4. Verification and review

- [x] 4.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 4.2 Re-run the Seed-Test compat smoke and the Playwright 320/1440
  report-shell check; record host, pin and result.
- [x] 4.3 Run SCR, CR, DAR, UXR, SEC (new HTML panel), ILA (new keys), CMP and
  STR.
- [x] 4.4 Fix findings; record deferred decisions.
- [x] 4.5 Commit and push; archive after the gate.

## Gate record

- Hygiene: ok (677 tracked files, 271 commits).
- Check: 74 files, 1106 passed, 4 skipped; typecheck, lint, build and i18n
  green.
- E2E: 364 passed, 8 skipped (Chromium, Firefox and WebKit; 320/390/768/1024/
  1440 and 320 at 200% text zoom).
- Host: Seed-Test 2026-11-22, pin `ce2cad8`, working-tree tarball 546,574 B;
  `report.service.spec.ts` 35/35; story/group reports show the report-file,
  decoded attachment and exact report HTML rows plus the largest attachments;
  no overflow at 1440/390/320 + 200% and no console errors. Playwright
  movies-app pin `5d2cdf0`, 8/8 tests, 3 attachments / 85 B, top three, 89,904
  B exact report HTML; no overflow at the same widths.
- Reviews: SCR, CR, DAR, UXR, SEC, ILA, CMP and STR PASS after the fixer and
  rechecks.
- Deferred: B-040 early input-size warning; B-041 ungrouped exact report-byte
  row; `inputFiles` counts loader groups, including validation-only files that
  produced no envelopes. The exact report row is ungrouped; the rows are
  contributors, not a sum.
- No summary schema, CI/email output or dependency change. Six new en/de keys,
  `.gitattributes` fixture normalization, CSS/goldens and the report HTML
  change; external Playwright path attachments appear only in the decoded
  attachment row, not in `inputBytes`.
