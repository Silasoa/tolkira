# TDD-Red record

Added `test/size-diagnostics.test.ts` (16 tests) and
`test/e2e/size-diagnostics.spec.ts` (Chromium). No production or existing test
was changed.

## Red (12/16 unit tests)

- Loader: `group.bytes` is `undefined` (`[undefined, undefined]` vs
  `[22542, 16341]`); duplicate-content group and summed bytes are absent.
- `GeneratedReport`: `inputFiles`/`inputBytes` are `undefined` (expected
  `1`/`16341`).
- Run panel: no input row (`undefined`), the largest-attachments row is absent
  (`indexOf` returned `-1`), and the report row is absent (`undefined` vs
  `'96327 bytes'`).
- Exact size: no row at 1 MiB+ (`'1169700 bytes'`) and the marker payload stays
  escaped but its row is missing (`'69859 bytes'`).
- `sizeLabel` is not exported: `TypeError: sizeLabel is not a function`.
- CLI: only the old warning (`report HTML is 0.6 MB, above ...`); input
  (`NaN`) and decoded attachment values are absent.
- Catalogs: all six new keys are missing in `en.json`/`de.json`.
- E2E: `.sizeList` is not found at 320 px, so the 1440 px case never runs.

Each failure maps to an unimplemented contract row or warning; no existing
behaviour was weakened. `npx tsc --noEmit` reports 27 expected errors:
`bytes`, `inputFiles`, `inputBytes` and the new `MessageKey` literals. The
catalog errors clear only after `npm run assets`. Once `LoadedInput.bytes` is
required, the manual literals in `test/inputs.test.ts` need the same field.

## Green guards (4 passing)

- No size warning below threshold.
- No largest-attachments row without attachments.
- Panel attachment bytes/count already equal the summary.
- Summary, CI and email gain no size fields.

Existing `inputs`, `cli` and `parity-metadata` suites: 65 passed.
