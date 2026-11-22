# size-diagnostics

## Why

The `--max-size` warning only states the final HTML size. When a report is 80 MB
or 500 MB, the user cannot see whether the inputs or the embedded attachments
dominate. This continues the 0.5 "Trust & ship" direction with a small
report-shell diagnostic; it is not a new output format and does not change the
one-file rule.

The user granted autonomy for this slice on 2026-11-22.

## What Changes

- The Details **Run** panel gains report-size contributors: unique processed
  report files and bytes, attachment count and decoded bytes, the exact report
  HTML bytes, and the three largest attachments by decoded bytes. A note states
  that the rows are contributors, not a sum.
- `GeneratedReport` gains additive `inputFiles` and `inputBytes`; the CLI
  `--max-size` warning names the report, report-file and decoded attachment
  sizes.
- One shared `sizeLabel` formats the panel's contributor rows (one-decimal MB at
  1 MiB, exact bytes below); the CLI warning uses one-decimal MB directly, so it
  never shares the panel's byte threshold.
- The report HTML size is solved with one document measurement and a marker
  pinned to an empty element, then replaced once.
- New `en`/`de` labels in `src/i18n/locales/*.json` (regenerated
  `catalogs.ts`), a small `.sizeList` style and `.gitattributes` fixture
  normalization so input bytes are checkout-stable. Goldens change
  intentionally.
- No summary schema, CI, email or dependency change. A true pre-render warning
  needs an input-size scan seam and is recorded as B-040 ("early input-size
  warning").

## Impact

- Capability: `report-rendering`.
- Code: `src/input/load.ts`, `src/index.ts`, `src/render/types.ts`,
  `src/render/details.ts`, `src/render/html.ts`, `src/render/format.ts`,
  `src/cli.ts`, the i18n JSON sources, `src/render/report.css` (source) and the
  generated `styles.ts`.
- Tests, goldens, `.gitattributes`, README, `docs/AGENT-INTERFACE.md`,
  `docs/I18N.md` if needed, `docs/CHANGELOG.md`, `docs/BACKLOG.md`, and the
  Seed-Test/Playwright host check.
- The summary, CI text, email and `RenderReportOptions` stay compatible; the
  report HTML and its goldens change.
