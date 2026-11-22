# Design

## Input files and bytes

`loadInputs` already `stat`s every file and checks the 100 MB cap. Add
`bytes: number` to `LoadedInput` and set it from the file size of each group.
`loadRun` records `inputFiles = groups.length` and
`inputBytes = groups.reduce(sum of bytes)`. Duplicate-content files are skipped
before a group is pushed, so they are not counted; the values describe the
unique report files that produced loader groups. Inline base64 in a Messages or
legacy file is part of that file's size; Playwright path attachments are read
and inlined separately and are **not** added to `inputBytes`, so the attachment
row is their contributor. This is why the rows are not additive.

Thread `inputFiles` and `inputBytes` through `RenderOptions` and expose both as
additive `GeneratedReport` fields. `RenderReportOptions` stays unchanged;
`renderReport` computes the values internally. `CucumberHtmlStream` and direct
`renderHtml` callers omit them, so the panel omits the input row. Document the
new `GeneratedReport` fields in `docs/AGENT-INTERFACE.md`.

## Details Run panel

Extend the existing `runPanel` in `src/render/details.ts`; do not add a second
panel or repeat the existing attachment count/size row.

- After the existing attachment rows, add a small note: input bytes are the
  report file sizes; attachment bytes are decoded payloads from inline or
  external files; the rows are contributions and do not add up.
- Input data: `N files · <size>` only when both `inputFiles` and `inputBytes`
  are finite non-negative numbers. `details.inputFiles` is a plural key
  (`one {# file} other {# files}` / `one {# Datei} other {# Dateien}`); the
  size is the report file size, not the decoded attachment payload.
- Report HTML: the exact final size marker.
- Largest attachments: the top three by decoded `bytes` from
  `model.scenarios.flatMap((scenario) => scenario.attachments)`,
  `model.runHooks.flatMap((hook) => hook.attachments)` and
  `model.runAttachments`. Scenario attachments already contain step, hook and
  extra attachments, so never add those separately. Sort descending; stable
  ties keep the model order. Omit the row when the model has no attachments.

Use the existing `.metaList` for the rows and a small `.sizeList` for the
attachment list (`display:grid` with a flexible name column and an auto size
column, tabular sizes, `break-inside:avoid`). The run list also carries
`.sizeMeta`, which stacks label and value at 560 px and below. The existing
attachment count/size rows remain in place; the attachment size row adopts
`sizeLabel` so it and the input row share units, while the new largest list is a
contributor view, not a second total.

## Size formatting and exactness

Add `sizeLabel(bytes, t)` in `src/render/format.ts` for the input and attachment
contributor rows (including the existing attachment size row):

- `>= 1 MiB`: `format.megabytes` with one decimal and the locale number format.
  Use `Intl.NumberFormat(t.lang, { minimumFractionDigits: 1,
  maximumFractionDigits: 1 })` so 1 MiB reads `1.0 MB` in English and `1,0 MB`
  in German.
- below: `format.bytes` with the locale number format.

The **Report HTML** row uses `format.bytes` directly, so its displayed count is
the exact UTF-8 byte length; it never rounds to MB. The CLI warning uses
one-decimal MB for the report, report-file and decoded attachment totals because
it targets the default 10 MB threshold; its test asserts the values against
`Buffer.byteLength(html)`, `generated.inputBytes` and
`summary.attachments.bytes`. The panel's `sizeLabel` switches at 1 MiB; the CLI
warning is MB-only. Add the `format.megabytes` key to both catalogs.

## Exact report bytes

`details.ts` exports `REPORT_BYTES_MARKER = '<dd data-report-bytes></dd>'` and
`applyReportSize(html, t)`. Escaped user content cannot contain the raw `<`, so
the complete empty element cannot collide with a text attachment. The marker is
rendered directly after the `Report HTML` `<dt>`.

`renderHtml` builds the document once and calls `applyReportSize`, which solves
the fixed point without re-serializing the document:

```ts
const markerBytes = Buffer.byteLength(REPORT_BYTES_MARKER, 'utf8');
const baseBytes = Buffer.byteLength(html, 'utf8') - markerBytes;
const replacement = (text: string) => `<dd>${escapeHtml(text)}</dd>`;
let shown = '';
for (let i = 0; i < 5; i += 1) {
  const next = t.t('format.bytes', {
    count: t.number(
      baseBytes + Buffer.byteLength(replacement(shown), 'utf8'),
    ),
  });
  if (next === shown) break;
  shown = next;
}
return html.replace(REPORT_BYTES_MARKER, replacement(shown));
```

At convergence the displayed value is the final document's exact UTF-8 byte
length, including the wrapper. The marker sits in a `<dd>`, not a script, so CSP
hashes are unaffected. Add a boundary test at 1 MiB for `sizeLabel`, a 1 MiB
boundary for the exact report row, and a test where an attachment contains the
marker's inner token; the escaped payload must not be replaced.

## CLI warning

Keep the threshold and post-render timing. The warning adds the contributor
values:

```text
tolkira: warning: report HTML is 12.3 MB (input 8.1 MB, attachments 9.2 MB
decoded), above the 10 MB threshold; large screenshots or videos inflate the
HTML and the PDF.
```

The CLI reads `generated.inputBytes` and `summary.attachments.bytes`. Add a test
that the panel's existing attachment bytes and the summary's attachment bytes
agree for a representative fixture; if they intentionally differ for a retry or
orphan case, document the source instead of changing either contract.

## i18n, styles and goldens

Edit the JSON sources, never the generated module:

- `src/i18n/locales/en.json`: new keys with non-empty descriptions.
- `src/i18n/locales/de.json`: German values.
- `npm run assets` regenerates `src/i18n/catalogs.ts`.

New keys: `details.inputData`, `details.inputFiles` (plural), `details.reportHtml`,
`details.largestAttachments`, `details.sizeNote`, `format.megabytes`. Keep keys
sorted.

Add `.gitattributes` with `test/fixtures/** text eol=lf` and
`test/fixtures/**/*.png binary`, then renormalize the fixtures so the on-disk
input bytes used by the new panel are checkout-stable; update goldens
intentionally after the renormalization. `src/render/report.css` is the style
source; rebuild `src/render/styles.ts` with `npm run styles`.

## Parity and integration

The official formatter streams and shows no size; CHR/MCHR, Allure and
Playwright show no report-size composition. This is an exceed for the
diagnostic, not a parity conflict. The existing 10 MB warning stays, the summary
stays schemaVersion 2, and the one-file/CSP/caps rules are unchanged.

This is a report-shell change: re-run the Seed-Test compat smoke and the
Playwright 320/1440 report-shell check, and record the host, pin and result.
The true early warning before rendering needs a cheap input-size scan seam and
is recorded as B-040 ("early input-size warning"); it can cover input bytes, not
the final HTML size.

## Risks

- Input bytes are report file sizes; inline media inside a report file is part
  of that size, while external path attachments appear only in the decoded
  attachment row. The rows are contributors, not a sum.
- The fixed-point loop has five iterations and a boundary test; if it fails to
  converge, the last value is off by a few bytes.
- Goldens change because the Run panel is always present; the `.gitattributes`
  normalization removes the checkout-dependent input-size failure.
- Very large attachment names wrap in `.sizeList`; the 320/390/1440 and 200%
  text gate covers it.
