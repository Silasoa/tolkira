# Design

## German Details stacking (B-046)

The German overrides in `src/render/html.ts` include

```css
:lang(de) .metaList { grid-template-columns: minmax(0, 2fr) minmax(0, 3fr) }
```

Specificity `(0,2,0)` beats `.sizeMeta` `(0,1,0)` in the 560 px media query, so
the Run panel keeps two columns in German and the exact count splits inside the
narrow 1fr column.

Do **not** exclude `.sizeMeta` from that rule. `:lang(de) .metaList:not(.sizeMeta)`
would drop the German 2fr/3fr layout above 560 px too (and in A4 print), because
`.sizeMeta` would fall back to the base `minmax(0, auto) minmax(0, 1fr)` rule.
That is a regression in a fixes-only patch.

Instead append one narrow-only override after the existing German rules:

```css
@media (max-width:560px){:lang(de) .sizeMeta{grid-template-columns:minmax(0,1fr)}}
```

Same specificity `(0,2,0)`, later in the emitted locale CSS, so it wins only at
560 px and below. Above 560 px and in A4 print (the CLI `--pdf` path) the German
2fr/3fr columns stay exactly as today; narrower print page boxes follow the
stacked layout, as English already does, because the override is not
screen-scoped. Every other `.metaList` (metadata, custom metadata, environment)
is untouched. The existing `.sizeMeta dd { text-align: start }` already applies
in the stacked layout.

Alternative considered: raise `.sizeMeta` to `(0,3,0)` inside the base media
query. It works, but it encodes the conflict instead of scoping it. The narrow
German override states the intent and leaves the wide layout alone.

## Numeric byte counts (B-045)

`formatMessage` formats a numeric placeholder through `hashValue`: English keeps
`String(number)`, other locales use `Intl.NumberFormat`. Passing the raw count is
therefore output-identical to today's `t.number(...)` string, and a `plural`
branch can call `Number(value)` on a number instead of `Number("1.048.576")`.

Change the three render call sites:

- `sizeLabel`: `{ count: bytes }`.
- `exactSizeLabel`: `{ count: bytes }`.
- `attachments.ts`: `{ count: attachment.bytes }`.

The email path already passes a raw number (`countText`) and keeps its explicit
English grouping; no change. No catalog key or message changes. The `en.json`
`format.bytes` **description** changes to "Byte count; count is a raw number",
because the old text told translators the count is already locale-formatted —
the bug this change removes. `npm run i18n:check` and `npm run assets` stay
green; the generated module does not carry descriptions.

`format.megabytes` keeps the same latent pattern (it receives an `Intl` string).
Fixing that needs a precision-aware design and is out of scope for a patch; the
B-045 Resolved entry records the limit.

## Tests

- Unit, catalog seam: `createTranslator('de', { catalog: { 'format.bytes':
  '{count, plural, one {# Byte} other {# Bytes}}', 'format.megabytes':
  '{count} MB' } })`. `format.megabytes` is injected explicitly so the German
  case does not silently depend on the English fallback.
  - `exactSizeLabel(MIB, deSeam)` must return `1.048.576 Bytes (1,0 MB)` without
    throwing (today: `NaN` plural error, so RED).
  - `sizeLabel(MIB - 1, deSeam)` must return `1.048.575 Bytes` (the bytes
    branch; `sizeLabel(MIB)` returns the MB string and cannot test the seam).
  - English seam: `exactSizeLabel(MIB, enSeam)` returns `1048576 Bytes (1.0 MB)`.
  - Category selection: 0 and 2 → `other`, 1 → `one` for both locales.
- Unit, attachment call site: `renderAttachment` with a `kind: 'binary'`
  `ReportAttachment` and the German plural catalog. 1 → exact `, 1 Byte)`, 2 →
  `, 2 Bytes)`, 1 MiB → grouped `, 1.048.576 Bytes)`; a forgotten third call
  site fails.
- Unit, default output parity: `sizeLabel(1_000_000, de)` is
  `1.000.000 Byte` and `sizeLabel(0, de)` is `0 Byte`, next to the existing
  German MB test; the existing exact-size and MB assertions keep their strings.
- E2E: render a >1 MiB German report (reuse `sizeMessages(1_100_000)`, which
  also carries one environment row) with `locale: 'de'`. Open the Details tab
  and wait for `.sizeMeta` to be visible before reading computed style: a hidden
  subtree returns `minmax(0px, 1fr)`, which a whitespace split would misread as
  two tracks.
  - At 560 px: `.sizeMeta` computes one used-px track, the `dd` starts on the
    next line under its `dt`, the page has no horizontal overflow, and a
    non-`.sizeMeta` `.metaList` keeps two used-px tracks.
  - At 561 px and 1440 px (above 560): two used-px tracks remain and the first
    track keeps the German 2fr/3fr share (about 40 % of the pair).
  - In print media at the 703 px A4 content width: two used-px tracks at the
    2fr/3fr share; at 560 px in print media one used-px track remains, because
    the override is not screen-scoped. Then restore screen media.
  - At 320 px and 200 % text: the grouped byte count keeps a single client rect
    (no mid-number split) and the page has no horizontal overflow.

`bytesLabel` in the existing test file still builds the old `t.number()` string.
Keep it as the independent parity oracle; do not rewrite it to match production.

## Release and hosts

This is a fixes-only 0.5.1 patch. The version surface is one task and touches
every place 0.5.0 touched: `package.json`, both `package-lock.json` version
fields (root and `packages[""]`), `src/index.ts` (the exported version behind
`tolkira --version`), `test/smoke.test.ts` (pins it), the README release line
and a dated `docs/CHANGELOG.md` section. A package-only bump would ship a
`--version` that says 0.5.0.

The change touches the report shell (German CSS), so the required
`docs/DROP-IN-VALIDATION.md` rows apply. Run all five hosts on the final tree and
record host, pin and result, or record a written exception the user approves for
this version. Also run the AGENTS.md pre-release audit (identities, secret scan,
GitHub alerts, secrets list, npm maintainers, committed screenshots). Tag and
stage only after the user's per-version approval.

No feature belongs in 0.5.1; B-040, B-042 and B-044 remain unscheduled backlog
features.

## Out of scope

- B-039 (long metadata links in the narrow value column) stays open: this change
  deliberately leaves the other metaLists at their German two-column layout.
  The UXR pair-rhythm, nested size list and 320 px / 200 % label wrapping are
  pre-existing shell issues; B-039 covers the other-metaList squeeze.
- A5: print follows the stacked layout below 560 px by decision; the unchanged
  promise is A4 print (the CLI `--pdf` path). A narrower print page box inherits
  the 560 px breakpoint, exactly as English does.
- `format.bytes` has no non-breaking-space guard: the spec forbids only a
  mid-number split, and the measured 0.6 px slack is specific to the Windows
  font stack.
- The pre-existing English `1 bytes` singular grammar in triage/health notes.
- The 30-run history cap (B-044), the `format.megabytes` latent plural pattern
  (B-045) and any new feature.
