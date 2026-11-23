# 0.6-baseline-comparison

## Why

Trends answers "how has the run moved?" from aggregate rows, but not the first
question after a red build: **what changed?** The aggregate history sidecar
stores no scenario names or statuses, so it cannot label a failure as new. The
stable `--json` summary already carries the per-scenario identity and status a
comparison needs.

The anchor research (`docs/research/0.6-anchor.md`) restates the feature as a
comparison against an explicit earlier summary, not an automatic history
rebuild: point `--baseline` at the previous `--json` output. There is no remote
issue yet; this proposal is the local contract for the 0.6 anchor.

## What Changes

- Add `--baseline <summary.json>`: a read-only, explicit schema-2 summary from
  an earlier run. A missing, malformed, oversized or wrong-schema baseline exits
  1 and writes nothing; there is no silent empty comparison. An email-only or
  GitHub/Azure-only run is a usage error because it would show nothing.
- Match scenarios by feature name + scenario name. A unique base key matches.
  A repeated group refines by the outline example coordinate when every row on
  both sides carries `example`, then by the display URI when exactly one
  unmatched row on each side carries it; a group that still cannot be reduced
  to unique rows is ambiguous and makes no claim. No pickle id, position, line,
  tags, step text, status or order is used.
- Classify every baseline row outside an ambiguous group into exactly one of
  new failure, fixed, still failing, other (no claim) or not in this run; added
  is a separate informational count for unmatched current rows that do not fail.
- Show a server-rendered "Compared with baseline" panel and localized
  new-failure/fixed row badges in the HTML report, with no JavaScript and in
  print/PDF. The panel lives in the `report-rendering` delta; the option, JSON
  block and CI line live in `cli-api`.
- Add an additive `baseline` block and a per-scenario `change` field to the
  schema-2 summary only when `--baseline` is supplied. Add the outline example
  coordinate (`example: "#1.1"`) to every Messages outline row unconditionally
  so the next baseline can match it; the schema version stays 2. Legacy JSON
  arrives expanded and carries no `example`.
- Add one deterministic Markdown CI line after the counts table and before the
  empty-run/zero-executed returns. GitHub and Azure annotation bytes stay
  unchanged.
- Without `--baseline`: no baseline block, no change field, no CI line, no
  visible report change and byte-identical HTML; the only summary delta is the
  additive outline `example` field.

## Rollout order

D1: early-size → history → static → baseline. This change lands last; it owns
the combined `--static --baseline` interaction and the final byte
characterization.

## Impact

- Capabilities: `cli-api` (the option, the API surface, the JSON block and the
  CI line) and `report-rendering` (the panel and row badges).
- Code: `src/cli.ts`, `src/index.ts`, `src/options.ts`, `src/summary.ts`, a new
  `src/baseline.ts` (reader, matcher, classification), `src/ci.ts`,
  `src/render/baseline.ts`, a new `src/render/baseline.css` (a conditional
  string, not a `report.css` rule), `scripts/build-styles.mjs`,
  `src/render/report.ts`, `src/render/html.ts`, `src/i18n/locales/en.json` and
  `de.json`.
- Tests: a matcher decision table, baseline-reader security cases, summary/JSON
  key-order and `example` tests, CI text, render/no-JS/print cases and a two-run
  browser flow.
- Docs: `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`, `docs/CI.md`,
  `docs/LIMITATIONS.md`, `docs/PRODUCT.md`, `GLOSSARY.md`, `docs/I18N.md` and
  `docs/BACKLOG.md` at archive time.
- Size: the panel, badges and their CSS exist only with the flag; a run without
  the flag keeps today's HTML bytes. The summary `example` field adds a few
  bytes per Messages outline row.

## Out of scope

- An automatic baseline writer, scenario-level history in the sidecar, a
  30-run per-scenario store, first/last-seen or fail-streak trends.
- GitHub/Azure annotation changes; the email stays current-run only; the PDF
  inherits the report panel with no PDF-specific work.
- A "new only" filter or preset, stable deep links, a dashboard, server or
  telemetry.
- A new runtime dependency. The reader uses Node built-ins.

## Decisions

- **Identity order (D7):** name-first, then the outline example coordinate, then
  the display URI. A renamed `*.feature` file keeps identity when the base key
  is unique or the coordinate separates the group; a renamed feature or
  scenario is a remove plus an add.
- **German copy:** `Baseline`, `Neuer Fehler`, `Behoben`, `Weiterhin
  fehlgeschlagen`, `Nicht in diesem Lauf`, `Mehrdeutige Gruppe`. ILA reviews the
  catalog later; it is not an open question.
- **Added count surface (D8/D11):** `added` is in the JSON only; the panel and
  CI show the four tracked counts and the ambiguous group count.
- **GitHub/Azure alone:** `--baseline` needs a surface that shows it (`--out`,
  `--pdf`, `--json` or `--ci markdown`); `--ci github|azure` alone is a usage
  error, not a silent no-op.
- **Panel and filters:** the run-level panel stays visible when a search or
  filter is active; its counts describe the whole run. The triage index and
  source strip still hide.
