# TDD-Red record

Changed `test/size-diagnostics.test.ts` only (+58/-6). No production code,
fixture, golden, package script or other test was touched.

- Replaced the old "keeps exact bytes above 1 MiB" assertion
  (`not.toContain('MB')`) with one test that pins the full new label:
  `${bytesLabel(bytes)} (${megabytes(bytes)} MB)` where `bytes` is the final
  document's UTF-8 length.
- Added a German document-level test on the 1.1 MB fixture
  (`locale: 'de'`): the leading token equals
  `Intl.NumberFormat('de').format(bytes)` and the whole row equals
  `${grouped} Byte (${mb} MB)` with the MB built from
  `Intl.NumberFormat('de', { minimumFractionDigits: 1, maximumFractionDigits: 1 })`.
- Added a below-1-MiB assertion (no `MB`, no `(`) beside the existing
  exactness assertion.
- Added a new `exactSizeLabel` describe with three boundary tests:
  `MIB - 1` returns the byte label alone, `MIB` returns
  `1048576 bytes (1.0 MB)`, and German `MIB` returns
  `1.048.576 Byte (1,0 MB)`.

## Red (5/22 tests in the file)

- English 1.1 MB row: `'1166240 bytes (1.1 MB)'` expected, `'1166240 bytes'`
  received. The exact-count part already matches; only the parenthetical MB is
  missing.
- German 1.1 MB row: `'1.167.727 Byte (1,1 MB)'` expected, `'1.167.727 Byte'`
  received. The leading grouped count equals `Buffer.byteLength(html, 'utf8')`;
  only the parenthetical MB is missing.
- `exactSizeLabel` is not exported: `TypeError: exactSizeLabel is not a
  function` in all three boundary tests.

Each failure maps to an unimplemented contract row; the new assertions were not
weakened, skipped or split into weaker variants.

## Green guards (17 passing)

- The below-1-MiB document test still passes with the added no-`MB`/no-`(`
  assertions (the small report already renders exact bytes alone).
- All other size-diagnostics tests stay green: loader bytes, report fields,
  run panel, marker escaping, CLI warning, catalog keys.
- Untouched suites stay green: `test/stream.test.ts`,
  `test/render-characterization.test.ts`, `test/render-golden.test.ts`
  (17 tests total), confirming the goldens, characterization hashes and
  stream-parity normalizer are unaffected at this stage.

## Type errors

`npx tsc --noEmit` reports three expected errors, one per boundary test:

```text
test/size-diagnostics.test.ts(472,13): error TS2339: Property 'exactSizeLabel' does not exist on type 'typeof import(".../src/render/format")'.
test/size-diagnostics.test.ts(480,13): error TS2339: Property 'exactSizeLabel' does not exist on type 'typeof import(".../src/render/format")'.
test/size-diagnostics.test.ts(486,13): error TS2339: Property 'exactSizeLabel' does not exist on type 'typeof import(".../src/render/format")'.
```

No locale-option type error appears: `RenderReportOptions` already carries
`locale?: string` (`src/options.ts`), so `generateReport(file, { locale: 'de' })`
typechecks today. The German test fails only on the missing label contract.
