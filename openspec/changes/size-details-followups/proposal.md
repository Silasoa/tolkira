# size-details-followups

## Why

`report-size-units` shipped the consistent Report HTML row in 0.5.0. Its review
left two follow-ups as backlog items:

- **B-046:** German Details `.metaList` never stacks at 560 px and below because
  `:lang(de) .metaList` outranks `.sizeMeta`; at 320 px and 200 % text the exact
  byte count splits mid-number. Pre-existing, visible on mobile.
- **B-045:** the render paths pass a pre-formatted `t.number()` string into
  `format.bytes`; a future target catalog with a plural branch on that key would
  call `Number("1.048.576")`, get `NaN` and throw. The email path already passes
  a raw number.

No remote issue yet; B-045 and B-046 are the local backlog items. The user asked
on 2026-11-23 for a small 0.5.1 with the open smaller adjustments. This is a
fixes-only patch: no new feature, catalog key, schema or dependency.

## What Changes

- One narrow-only German override makes the Details Run panel stack in one
  column at 560 px and below, as English already does. The German wide layout
  above 560 px and in print stays unchanged.
- `sizeLabel`, `exactSizeLabel` and the attachment size row pass the numeric byte
  count to `format.bytes` instead of a pre-formatted string, so a plural branch
  can select its category. The visible English/German byte-count text is
  unchanged.
- The `en.json` `format.bytes` description is corrected to "raw number"; no key
  or message changes, so `catalogs.ts` stays as generated.
- A German 560/1440/320 px e2e check pins the stacked narrow panel, the wide
  two-column panel and the unbroken grouped count; catalog-seam tests pin the
  numeric plural path and all three render call sites.

## Impact

- Capability: `report-rendering` and `localisation`.
- Code: `src/render/html.ts` (one narrow German override),
  `src/render/format.ts`, `src/render/attachments.ts`,
  `src/i18n/locales/en.json` (description only).
- Tests: `test/size-diagnostics.test.ts` (catalog seam, attachment row, default
  parity) and `test/e2e/size-diagnostics.spec.ts` (German stacked case).
- Release surface: `package.json`, both `package-lock.json` version fields,
  `src/index.ts`, `test/smoke.test.ts`, `README.md` release line and
  `docs/CHANGELOG.md` 0.5.1.
- Docs: `docs/BACKLOG.md` (B-045/B-046 resolved, `format.megabytes` limit
  recorded), `docs/I18N.md` (numeric `format.bytes` contract).
- German report HTML grows by the selector text (~15 bytes); the self-referential
  report-size row still resolves. English report HTML is byte-identical. No
  summary schema, history schema, catalog message, CSS asset or dependency
  change.

## Out of scope

- B-039 (long metadata links in the narrow value column) stays open: this change
  deliberately leaves the other metaLists at their German two-column layout.
- The `format.megabytes` pre-formatted string keeps its latent plural pattern;
  fixing it needs a precision-aware design.
- B-040, B-042 and B-044 remain unscheduled backlog features, not a 0.6.0
  promise.
