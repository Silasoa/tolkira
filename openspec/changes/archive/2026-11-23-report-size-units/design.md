# Design

## Label helper

Add one function beside `sizeLabel` in `src/render/format.ts`:

```ts
/** Report size: the exact byte count, plus MB at 1 MiB and above. */
export function exactSizeLabel(bytes: number, t: Translator): string {
  const exact = t.t('format.bytes', { count: t.number(bytes) });
  return bytes >= MIB ? `${exact} (${sizeLabel(bytes, t)})` : exact;
}
```

The exact count leads and the contributor MB closes the string. On desktop the
right-aligned value column puts the MB at the same right edge as the
neighbouring `12.3 MB` rows, while the precise value stays the primary text.
Below 1 MiB the label is the plain exact count, identical to `sizeLabel` and to
the neighbouring rows.

`Translator.number` is raw for English (`1169700`) and grouped for other
locales (`1.048.576`), so the examples are `1169700 bytes (1.1 MB)` and
`1.048.576 Byte (1,0 MB)`. Both branches pass `t.number(bytes)` into
`format.bytes`; formatting the number ad hoc would drift from the neighbour
rows. 1 MiB means 1048576 bytes, so `12345678` bytes is 11.8 MB, not 12.3 MB.
The parentheses and the space are punctuation, not a translatable string; the
units and the number format still come from the existing `format.megabytes` /
`format.bytes` keys and `Translator.number`. No catalog change and no
`npm run assets`.

The helper returns text without markup. The row stays a plain `<dd>` text node:
the parity normalizer in `test/stream.test.ts` (`<dd>[^<]*</dd>`) and the
`rowValue` extraction keep working, and no style is needed.

## Fixed point

`applyReportSize` currently iterates on the formatted text and measures
`<dd>${text}</dd>`. With a longer label the text length is not the byte count,
so iterate on the byte count and build the markup from it:

```ts
const replacement = (bytes: number): string =>
  `<dd>${escapeHtml(exactSizeLabel(bytes, t))}</dd>`;
let displayed = 0;
for (let i = 0; i < 5; i += 1) {
  const next = baseBytes + Buffer.byteLength(replacement(displayed), 'utf8');
  if (next === displayed) break;
  displayed = next;
}
return html.replace(REPORT_BYTES_MARKER, () => replacement(displayed));
```

Starting at `0` and measuring the full replacement each round keeps the
five-iteration cap as a guard. The map is non-decreasing and the loop starts
below the fixed point, so it climbs to the lowest fixed point; the MB crossing
adds about twelve label bytes and still converges within four rounds. The loop
breaks only on equality, so the leading byte count is the final document's
UTF-8 length. The new boundary sweep and the 1.1 MB unit and e2e tests pin
convergence at the crossing; if the guard were ever hit, the value would be a
few bytes off. The literal stays as it is: one loop, one guard, no new constant.

## UX

- The exact count leads and the MB closes the row; on desktop the right-aligned
  value column keeps the same right edge as the neighbouring MB rows.
- Same unit decision as the neighbours: below 1 MiB both show exact bytes; at
  1 MiB and above both show MB.
- The exact value stays visible in the same row; no tooltip, no second row, no
  extra click.
- The row stays right-aligned at desktop; in locales that stack at 560 px and
  below it is start-aligned. German keeps two columns and can split the exact
  count mid-number at 320 px and 200 % text (B-046, pre-existing). `.metaList dd`
  already has `overflow-wrap: anywhere`, so the longer string wraps at 320 px and
  200 % text without a style change.
- The MB value joins its number with a non-breaking space (`1.1 MB`), so 200 %
  text does not break between `1.1` and `MB` at the tested widths; the pair can
  still break before the parenthesis, and `overflow-wrap: anywhere` can force a
  break if it is wider than the column.
- The German locale renders `1.048.576 Byte (1,0 MB)`; the English locale
  renders `1048576 bytes (1.0 MB)`.

## Documentation

- `docs/AGENT-INTERFACE.md` Run-panel paragraph: after "shows the exact final
  report HTML bytes", add that at 1 MiB and above the row adds one-decimal MB
  in parentheses. No API or schema sentence changes.
- `docs/CHANGELOG.md`: extend the existing 0.5.0 "Report size diagnostics"
  Added bullet (no separate Changed entry) and date the section 2026-11-23.
- `README.md` feature list: name the exact bytes plus one-decimal MB above
  1 MiB.
- `docs/I18N.md`: record the accepted punctuation join.
- `docs/DROP-IN-VALIDATION.md`: the small-change note.
- `docs/BACKLOG.md`: B-041 closes; B-045 (pre-formatted `format.bytes` input)
  and B-046 (German `.metaList` mobile stacking) are recorded;
  `docs/research/0.5-scope.md`: B-041 names the `report-size-units` change.

## Tests and canaries

- `test/size-diagnostics.test.ts` "keeps exact bytes above 1 MiB" asserts the
  old contract (`not.toContain('MB')`); the Red pair replaces that expectation
  with the new spec, it is not weakened or skipped.
- `test/render-characterization.test.ts` pins eight full-document SHA-256
  hashes. Every fixture is below 1 MiB, so all eight must stay green; a failure
  means the new loop drifted, not that the hashes should be regenerated. The
  same holds for both golden files.
- Render the 1.1 MB fixture with `locale: 'de'` and assert that the leading
  byte count equals `Buffer.byteLength(html, 'utf8')`, so the German grouping
  separators (which change label length) go through the fixed point. The 1.1 MB
  English test pins the MB branch; the boundary sweep below pins the crossing
  itself.
- A boundary sweep over `applyReportSize` from `MIB - 40` to `MIB` proves the
  label's own bytes can tip the file over 1 MiB and still converge; it asserts
  the leading count equals the result's UTF-8 length and the MB appears exactly
  when the final length is at least 1 MiB.
- `test/e2e/size-diagnostics.spec.ts` renders a >1 MiB report, reads the written
  file in Node, and checks the Details row against its byte length and MB value
  at 320, 390 and 1440 px and at 320 px with 200 % text, with no document
  overflow.

## Omission and scope

No host re-run is planned for this slice. The last recorded final host reports
are Seed-Test 116,113/117,137 B and Playwright movies-app 89,904 B, largest
117,137 B. The two Java hosts (PetClinic, Cucumber-JVM) were not re-measured for
this slice; their reports embed the same ~40 KB stylesheet and client bundle, so
they stay far below 1 MiB. The changed branch therefore cannot appear in a
recorded host report; the sub-1 MiB branch is byte-identical and the ≥1 MiB
branch is exercised by the 1.1 MB unit and e2e fixtures. Record the reason in
`docs/DROP-IN-VALIDATION.md` where integrators and the release gate look, with
the same numbers, and repeat it in the Gate record under the small-change path:
"small change, relies on the fixture/e2e gate; no host row was re-run for this
slice". The maintainer approved this documented exception for 0.5.0 on
2026-11-23; the next release re-runs the host rows.

B-040 (early input warning) and B-042 (no-JS static mode) stay out of scope.
