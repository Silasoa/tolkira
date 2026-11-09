# Design

## Context

See `proposal.md` for motivation. The current pipeline is:

`loadEnvelopes` → format detection and normalisation → `sanitizeEnvelopes` →
`buildReportModel` → `renderHtml` → one self-contained HTML file.

`buildReportModel` already receives the Gherkin document and pickles from
Messages. It builds one flat `ReportScenario` per pickle, maps
`pickle.astNodeIds[0]` to the scenario AST node and uses `pickle.tags` for the
tag filter. `renderFeature` orders scenarios failed-first and renders each one
as a `<details data-scenario>` row. Triage, counts, the status matrix, search
and the JSON summary all read the flat scenario list.

ADR 0004 makes Messages the normal form for legacy JSON, but legacy input
arrives with examples already expanded. ADR 0005 keeps the report shell
server-rendered; grouping must therefore be in the generated HTML, not a
client-side reconstruction.

## Goals / Non-Goals

**Goals:**

- Recover outline and examples structure from the Gherkin AST and render it
  without changing counts, triage, search or the summary.
- Keep one flat scenario list as the source of truth so later changes (hooks,
  rules, empty runs) do not have to unwind a second model.
- Preserve per-example outcomes, attachments, anchors and filters.
- Keep legacy and JUnit output unchanged.

**Non-Goals:**

- Reconstructing outlines from legacy JSON.
- Rendering the examples table values as a table. The official formatter shows
  the numbered outcome, not the table; substituted values already appear in the
  steps.
- Rules, backgrounds, feature tags, hooks, undefined/ambiguous diagnostics and
  empty-run semantics.

## Decisions

### Group at render time from flat rows

Add an optional `outline` object to `ReportScenario`:

- outline id, keyword, name, description and tags;
- examples id, keyword, name, description and tags;
- zero-based `examplesIndex` and `exampleIndex`.

The feature still owns one flat `scenarios` array. `renderFeature` partitions
that array into outline groups and standalone scenarios, then renders groups.
Counts, triage, the matrix, the tag list and the JSON summary keep reading the
flat array.

Alternatives considered:

- **Nested `ReportOutline`/`ReportExample` on `ReportFeature`.** Cleaner
  shape, but duplicates every scenario in two structures and forces every
  existing consumer to choose a view. Rejected as unnecessary churn.
- **Grouping in the browser.** Contradicts ADR 0005 and breaks the no-JS
  report. Rejected.

### Derive metadata from `pickle.astNodeIds`

The Gherkin pickle compiler emits `astNodeIds: [scenarioId, tableRowId]` for an
outline example and `[scenarioId]` for an ordinary scenario. While walking the
feature tree, build a map from examples table-row id to
`{ scenario, examples, examplesIndex, exampleIndex }`. When building a
`ReportScenario`, look up `astNodeIds[1]`, verify that the row belongs to the
scenario in `astNodeIds[0]`, and attach the outline metadata. If the lookup
fails, leave the row flat.

This is producer-independent because it relies only on the Messages contract,
not on a particular Cucumber implementation.

### Order outlines failed-first, examples in Gherkin order

Outline groups are ordered by the worst row status, matching the current
failed-first feature body. Inside a group, examples blocks and rows keep their
Gherkin order and numbering. A failed row is open by default even when it is
not first. This keeps `#1.1`, `#1.2`, `#2.1` meaningful while the triage index
still surfaces failures.

Alternative rejected: sorting rows by status. It would produce `#1.2` before
`#1.1` and make the numbering untrustworthy.

### Render static outline sections around the existing row component

An outline renders as a `<section data-outline>` with an `h3`, tags and
description. Each examples block is a `<section data-examples>` with an `h4`,
tags and description. Example rows reuse the existing scenario `<details>`
markup with `#<examplesIndex>.<exampleIndex>` as the visible heading and an
screen-reader label containing the outline and substituted scenario name.
Standalone scenarios keep the current row.

The wrappers are static so they work without JavaScript. The row remains the
only collapsible element; there is no second expansion state to manage.

### Keep search and filters row-based

`data-scenario`, `data-tags` and `data-search` stay on the row. Outline and
examples names and tags are added to the row's search text so a search for the
outline still finds its examples. After filtering, a small client-side pass
hides `[data-examples]` and `[data-outline]` wrappers that contain no visible
row. The 20-match auto-open cap and the existing empty-state logic stay
unchanged.

### Keep anchors per example row

Row ids keep the existing `scenario-<feature>-<index>` shape, with the index
taken from the flat ordered list rather than the grouped render order. The
existing anchor handler already opens `details` ancestors and focuses the
summary; static sections need no extra handling.

## Risks / Trade-offs

- **AST mapping differs across producers** → validate that the table row
  belongs to the scenario before grouping; fall back to a flat row otherwise,
  and cover the fallback with a synthetic Messages test.
- **Failed-first ordering conflicts with example numbering** → order groups,
  not rows, by severity; keep failed rows open and covered by a browser test.
- **Search leaves empty headings** → hide empty examples and outline wrappers
  after every filter pass; test search, status and tag filters together.
- **Heading hierarchy becomes deeper** → outline `h3`, examples `h4`, example
  row `h5`; standalone rows keep `h3`. Cover with an accessibility assertion.
- **Large outlines add DOM wrappers** → two static elements per examples block
  and no extra details; re-run the 1000/5000-scenario stress check to confirm
  the change stays within noise.
- **Legacy users see no change** → intentional; document it in the changelog
  and compatibility notes so the difference is not mistaken for a bug.

## Migration Plan

No schema, CLI or API change. The report output changes only for Messages
outlines. Rollback is a revert of the slice; no stored data or generated
artifacts need migration.

## Open Questions

None. The examples-table presentation follows the official formatter: numbered
outcome rows, not a re-rendered table.
