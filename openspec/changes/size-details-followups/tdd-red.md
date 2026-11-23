# TDD-Red record — size-details-followups

Date: 2026-11-23
Scope: tests only. No production code, catalog, CSS, goldens or hashes were
changed.

## What was added

### `test/size-diagnostics.test.ts`

- Imports `renderAttachment` and the `ReportAttachment` type; `sizeLabel` is
  now a static import next to `exactSizeLabel`. The existing dynamic import in
  the old `sizeLabel` block and the `bytesLabel` old-path oracle are untouched.
- `describe('format.bytes catalog seam')`:
  - German seam (`createTranslator('de', { catalog: { 'format.bytes':
    '{count, plural, one {# Byte} other {# Bytes}}' } })`):
    `exactSizeLabel(MIB) === '1.048.576 Bytes (1,0\u00a0MB)'`,
    `sizeLabel(MIB - 1) === '1.048.575 Bytes'`, `sizeLabel(1) === '1 Byte'`,
    `sizeLabel(2) === '2 Bytes'`.
  - English seam: `exactSizeLabel(MIB) === '1048576 Bytes (1.0\u00a0MB)'`,
    `sizeLabel(1) === '1 Byte'`, `sizeLabel(2) === '2 Bytes'`.
  - Default parity: `sizeLabel(1_000_000, createTranslator('de')) ===
    '1.000.000 Byte'`.
- `describe('attachment size row')`: a `kind: 'binary'`, `textFormat: 'plain'`
  `ReportAttachment` with no `dataUri` passed to
  `renderAttachment(attachment, undefined, deSeam)` (same three-argument call
  shape as `src/render/details.ts`). Asserts the rendered label contains
  `1 Byte`, `2 Bytes`, and `1.048.576 Bytes` at 1 MiB.

### `test/e2e/size-diagnostics.spec.ts`

- Local helper `sizeMetaTracks(page)` reads the used
  `grid-template-columns` of the visible `dl.sizeMeta`.
- New German test built from the existing `sizeMessages(1_100_000)` and
  `writeReport([input.file], 'Size large de', 'tolkira-size-de-e2e-', 'de')`:
  - opens Details, waits for `dl.sizeMeta` visible (so a hidden subtree cannot
    return `minmax(0px, 1fr)`);
  - at 560 px: exactly one used-px track and the first `dd` top is below its
    `dt` top;
  - at 1440 px: exactly two used-px tracks;
  - at 320 px with root `font-size: 32px`: a Range over the grouped exact byte
    count (`Intl.NumberFormat('de')`, for example `1.167.735`) has
    `getClientRects().length === 1`, and `expectNoOverflow` (existing local
    helper) is green.
- The existing two e2e tests are untouched and stay green.

## RED evidence

Command: `npx vitest run test/size-diagnostics.test.ts` (exit 1)

```
❯ test/size-diagnostics.test.ts (29 tests | 2 failed) 223ms
  ❯ format.bytes catalog seam (4)
    × formats German exact and byte labels from the numeric count 3ms
  ❯ attachment size row (2)
    × groups a binary attachment at 1 MiB without parsing the string 1ms

FAIL test/size-diagnostics.test.ts > format.bytes catalog seam > formats German exact and byte labels from the numeric count
Error: Invalid message: plural parameter "count" is missing or not a number
 ❯ pluralValue src/render/i18n.ts:242:5
 ❯ formatNodes src/render/i18n.ts:266:19
 ❯ formatMessage src/render/i18n.ts:281:10
 ❯ Object.t src/render/i18n.ts:358:14
 ❯ exactSizeLabel src/render/format.ts:68:19
 ❯ test/size-diagnostics.test.ts:525:12

FAIL test/size-diagnostics.test.ts > attachment size row > groups a binary attachment at 1 MiB without parsing the string
Error: Invalid message: plural parameter "count" is missing or not a number
 ❯ formatNodes src/render/i18n.ts:266:19
 ❯ Object.t src/render/i18n.ts:358:14
 ❯ renderAttachment src/render/attachments.ts:157:19
 ❯ test/size-diagnostics.test.ts:573:12
```

Command: `npx playwright test test/e2e/size-diagnostics.spec.ts
--project=chromium` (exit 1)

```
x 2 [chromium] › test\e2e\size-diagnostics.spec.ts:288:1 › stacks the German Details run panel and keeps the wide layout (2.5s)
ok 1 [chromium] › test\e2e\size-diagnostics.spec.ts:239:1 › shows exact bytes with MB above 1 MiB without overflow (2.8s)
ok 3 [chromium] › test\e2e\size-diagnostics.spec.ts:209:1 › keeps the size list inside 320, 390 and 1440 px and 200% text (2.9s)

Error: 560px used tracks
expect(received).toHaveLength(expected)
Expected length: 1
Received length: 2
Received array:  ["190px", "285px"]
  at test/e2e/size-diagnostics.spec.ts:316:47
```

This is the intended RED: the German `:lang(de) .metaList` two-column rule
outranks `.sizeMeta` at 560 px, not a locator or timing failure.

Command: `npx tsc --noEmit` — clean, no output.

## Green guards at RED

- German seam 1/2 bytes select the `one`/`other` branch and pass today because
  `Number("1")` and `Number("2")` are valid. This is intended parity coverage,
  not RED; the grouped German count is the failing path.
- English seam passes today because the raw string `1048576` parses as a
  number; it guards against the fix regressing the English output.
- Default German parity `1.000.000 Byte` passes today and keeps the visible
  text pinned.
- Existing exact-size, MB-boundary, catalog and size-list tests are unchanged
  and green (27 of 29 unit tests passed at RED).
- Both pre-existing e2e size tests passed at RED.

## Sanity check of the non-RED e2e assertions

A throwaway script (outside the repo) generated a German report and injected
the design's narrow rule at runtime:
`@media (max-width:560px){:lang(de) .sizeMeta{grid-template-columns:minmax(0,1fr)}}`.
With the rule: 560 px tracks `["475px"]`, `dd` below `dt`; 1440 px tracks
`["124.469px", "186.719px"]`; 320 px / 200 % text grouped count
`1.167.735` has one client rect and overflow `-15`. This confirms the 1440 and
320 assertions are satisfiable and are not invented behaviour. No repo file was
changed for the check.

## Ambiguities

1. **Attachment 1/2 bytes are green at RED.** The contract's "German attachment
   expectations" could read as all three values failing, but only the 1 MiB
   path is a `format.bytes` plural error today; `Number("1")`/`Number("2")`
   parse. The 1/2 assertions remain as category-selection guards at the call
   site. No behaviour was invented.
2. **320 px Range target.** "Grouped exact byte-count substring" is read as the
   grouped number only (`1.167.735`), matching "not split mid-number" and the
   design's "grouped byte count keeps a single client rect". Including the
   trailing ` Bytes` would wrap at the space even after the fix because the Run
   panel content is narrower than the full phrase at 30 px text; that would be
   a space break, not a mid-number split. The runtime check above confirms the
   number-only range is one rect with the designed fix.
3. The e2e waiting step uses the German label `Bericht-HTML` for the report row
   and the visible-grid check before reading computed style, as the design
   requires.

## Status

- RED confirmed for the German plural seam, the grouped attachment row and the
  560 px German stacking.
- No existing test deleted, skipped or weakened.
- `npm run hygiene` green; `npx oxlint` on both changed test files green.
- Not committed and not archived at RED time.
