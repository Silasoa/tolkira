# Design

## Context

See `proposal.md`. `buildReportModel` creates a row only for a pickle with a
started test case that either finished or produced results; a finished test case
with zero step results is currently counted as `unknown` (`empty.ndjson` gives
one scenario, one `unknown`). `summarizeEnvelopes` uses the same selection and
status derivation, has no `executed` concept, and emits `schemaVersion: 1`.
The header prints `X of Y passed`, and the feature row, triage, source strip and
matrix all read the unfiltered scenario lists or counts.

Relevant ADRs: 0001 (own the adapters and shell), 0004 (normalize to Messages)
and 0005 (server-rendered shell). No dependency, network surface or renderer
architecture changes.

## Goals / Non-Goals

**Goals:**

- Mark executed vs unexecuted rows and exclude unexecuted rows from every count
  surface and triage.
- Keep empty features/runs visible with no outcome and `0 / 0`.
- Add `executed` and bump the summary schema to 2.
- Keep legacy/JUnit detection and the offline/escaped baseline.
- State and test the legacy zero-step count change.

**Non-Goals:**

- G8/G10/G11/G12/G14/G15, themes, history, attempt history.

## Data flow

Envelopes -> per-pickle candidate `testCaseStarted` list -> selected attempt ->
raw `testStepFinished` results -> `ReportScenario.executed` and `status` ->
model counts and row lists -> header, feature bar, triage, source strip,
matrix, scenario rows -> embedded summary preview and `ReportSummary` with
schema version 2.

The same selection and executed rule are applied in `src/report/model.ts` and
`src/summary.ts` so the HTML and JSON cannot drift.

## Definitions

- **Raw test-step result**: one `testStepFinished` envelope for the selected
  test case, whether the test step is a pickle step or a hook. Step start or
  attachment envelopes are not results.
- **Selected test case**: the latest `testCaseStarted` for the pickle, chosen by
  highest `attempt`, then latest timestamp. An earlier retried attempt is
  ignored; a finished-preference is not used because it would hide a later
  unfinished attempt.
- **Executed**: the selected test case has at least one raw test-step result.
  A hook-only result makes the scenario executed.
- **Unexecuted**: the selected test case started but has zero raw test-step
  results. A started-but-unfinished test case is unexecuted.
- **Never started**: the pickle or outline example has no `testCaseStarted`.
  It stays pruned: no row, no count and no summary entry.
- **Count surface**: header scenario counts/pass rate, feature row count and
  proportion bar, triage index, source strip and Details feature matrix.

## Decisions

### Executed detection

`ReportScenario.executed` is set from the raw result list of the selected test
case. `status` stays `unknown` for an unexecuted row so existing type consumers
keep working; the renderer treats `executed: false` as “no outcome” and renders
no status label, status class or step outcome. `ReportStep` and `ReportHook`
keep their existing meaning. Outline examples use the same rule and keep their
outline metadata and numbering when started.

### Row creation

The model and summary select the latest started attempt even when it has zero
results, so a started-but-unfinished row exists. An earlier attempt with
results does not replace the latest unexecuted attempt. A pickle with no start
still produces no row; existing pruning for never-started outline examples and
blocks is unchanged.

### Feature status and opening

A feature's status is the worst status among its executed scenarios; a feature
with no executed scenarios is `unknown`. Mixed features derive their status and
bar from executed rows only. `unknown`/other non-passed executed scenarios open
by default. An all-unexecuted feature opens, but its unexecuted rows stay
collapsed and show no outcome, so the page is not flooded with blank rows.

### Count surfaces

Model scenario counts increment only for executed rows. All five surfaces
filter on `executed` rather than casting `status`:

- Header: percentage, `passed / total` text, status bar, status pills and the
  scenario total use executed counts. The text format becomes `<passed> / <total>`
  so the empty run is literally `0 / 0`.
- Feature row: passed/total and segments use executed scenarios; an
  all-unexecuted feature states `0 of 0 passed` and renders no bar.
- Triage: only executed non-passed scenarios create rows/links, and the lead
  total is the executed total. No executed non-passed scenario means no index.
- Source strip: card scenario counts, status and bar use executed scenarios; a
  source with only unexecuted features shows `0 scenarios`, `unknown`, no bar.
- Matrix: row total and cells use executed scenarios; status columns come from
  executed counts. All-unexecuted rows show total 0 and muted zero cells.

Unexecuted rows remain in the feature list, are searchable by name/source/tag
and keep their anchors. They do not affect the status filters' counts.

### Summary version 2

Add `executed: boolean` to `SummaryScenario`; bump `SUMMARY_SCHEMA_VERSION` to
2. Unexecuted scenarios remain in `scenarios` with `status: "unknown"` and
`executed: false`, but do not increment `counts.scenarios`. The overall
`status` is the worst executed scenario status, or `failed` when a test-run hook
failed, or `unknown` when nothing executed. `counts.steps` and step entries keep
their meaning (hooks remain `keyword: "Hook"`). `counts.features` keeps counting
distinct Gherkin documents, including features that only contain unexecuted
scenarios, matching the HTML feature list. Attachment counts are unchanged.
Never-started pickles stay out of `scenarios` and all counts.

### Legacy and JUnit

Use the same executed detection on normalized results. Legacy JSON with no
steps and no hooks normalizes to a started/finished test case with zero results:
it becomes unexecuted and leaves the counts, whereas version 1 counted it as
`unknown`. A legacy step without a result still emits an unknown result, so it
stays executed. JUnit test cases emit a result, so they stay executed. No new
outcome is invented and no new path or network surface is introduced.

### Empty run UI

The header uses executed counts and shows `0 / 0` at `0 %` when nothing
executed. The triage index is omitted. The feature and blank scenario stay
visible; the scenario renders without a status label or step outcome. If there
are no scenario rows at all, the existing “No scenarios in this report.” empty
state remains.

## Migration Plan

Summary consumers must accept `schemaVersion: 2` and `executed`; scenario counts
no longer include unexecuted scenarios. Explicit contract:

- `counts.scenarios.total` can be smaller than `scenarios.length`.
- An unexecuted entry keeps `status: "unknown"` and adds `executed: false`.
- Agents must filter on `executed` or use `counts` to decide outcomes; an
  unexecuted `unknown` is not a failure signal.

Update the version-1 assertions and statements:

- `test/cli.test.ts` — `schemaVersion` assertion and any summary totals.
- `test/compat.test.ts` — `schemaVersion` in the compatibility shim summary.
- `test/render.test.ts` — `schemaVersion`, header `X / Y` strings, empty-run
  counts, and count-surface parity assertions.
- `test/summary.test.ts` — four `schemaVersion` assertions, empty/started rows,
  overall status and count-sum checks.
- `test/model.test.ts` — `empty.ndjson` expectation changes from one `unknown`
  to zero counted scenarios with one unexecuted row; add executed/retry cases.
- `docs/ARCHITECTURE.md` — “Schema version 1” summary statement and
  executed-only count surfaces.
- `docs/CUCUMBER-COMPATIBILITY.md` — auto-expansion of `unknown`, version-1
  summary shape and the unexecuted-row behaviour.
- `docs/AGENT-INTERFACE.md` — version-2 example and field contract, plus this
  migration section.
- `docs/CHANGELOG.md` and `GLOSSARY.md` — breaking summary bump and the
  executed/unexecuted vocabulary.

Rollback is a revert; no stored data or migration script is involved.

## Risks / Trade-offs

- **Schema bump** — documented breaking change; update examples, tests and
  agents’ filtering guidance.
- **Legacy zero-step totals drop** — an existing input yields lower scenario
  counts; this is the intended correctness fix and is tested.
- **Blank rows stay visible** — excluded from counts but present in search and
  anchors; test mixed runs and no-JS.
- **Header format** — `passed / total` replaces `passed of total passed` at
  every size; update UI assertions and keep the accessibility text clear.
- **Feature status** — all-unexecuted must be `unknown`, not `passed`; a mixed
  passed/unexecuted feature must stay `passed`.
- **Retry selection** — choosing the latest started attempt can switch a row
  from executed to unexecuted; test with an earlier result and a later start.
- **Started-but-unfinished** — row creation must not drop it; test hook-only and
  zero-result variants.

## Open Questions

None.
