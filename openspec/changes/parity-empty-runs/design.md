# Design

## Context

See `proposal.md`. `buildReportModel` creates a row only for a pickle with a
started/finished test case that has results; a scenario with no step results is
currently counted as `unknown`. `summarizeEnvelopes` derives status from test
step results and has no `executed` concept.

## Goals / Non-Goals

**Goals:**

- Mark executed vs unexecuted rows and exclude unexecuted rows from counts and
  triage.
- Keep empty features/runs visible with no outcome and `0 / 0`.
- Add `executed` and bump the summary schema to 2.
- Keep legacy/JUnit detection and the offline/escaped baseline.

**Non-Goals:**

- G8/G10/G11/G12/G14/G15, themes, history, attempt history.

## Decisions

### Executed means at least one step result

Set `executed` when the selected test case has at least one finished step
result. A scenario with a test case but no results is unexecuted. Include a
started-but-unfinished test case as an unexecuted row instead of dropping it.

`ReportScenario.status` stays `unknown` for an unexecuted row so existing type
consumers keep working, but the renderer treats `executed: false` as “no
outcome” and excludes it from counts/triage. The model's scenario counts only
increment for executed rows.

### Feature status

A feature is `unknown` when it has no executed scenarios and at least one
unexecuted scenario. Otherwise keep the current worst-status rule. Features
with all-unexecuted scenarios open by default; `renderScenario` opens only
executed non-passed rows.

### Summary version 2

Add `executed: boolean` to `SummaryScenario`; exclude unexecuted scenarios from
`counts.scenarios`; keep `counts.steps` and attachments unchanged; bump
`SUMMARY_SCHEMA_VERSION` to 2. Document the migration and update
`docs/AGENT-INTERFACE.md` examples/tests. The CLI/API shape stays otherwise
stable.

### Empty run UI

The header uses the existing counts (`0 / 0` when totals are zero). The triage
index is omitted when there are no non-passing executed scenarios. Unexecuted
rows render without a status label or step outcome and stay searchable.

### Legacy and JUnit

Use the same executed detection on normalized results. Legacy/JUnit rows with
no result are unexecuted and do not invent a status. No new path or network
surface.

## Risks / Trade-offs

- **Schema bump** → documented breaking change; update examples and tests.
- **Blank rows** → keep them visible but out of counts; test mixed runs.
- **Started-but-unfinished** → row creation must not drop it; test.
- **Feature status** → all-unexecuted must be unknown, not passed; test.
- **Legacy expectations** → unchanged detection; no invented outcome.

## Migration Plan

Summary consumers must accept `schemaVersion: 2` and `executed`; counts no
longer include unexecuted scenarios. Rollback is a revert; no stored data.

## Open Questions

None.
