# Design

## Context

See `proposal.md` for motivation. The current pipeline is:

`loadEnvelopes` → format detection and normalisation → `sanitizeEnvelopes` →
`buildReportModel` → `renderHtml` → one self-contained HTML file.

`buildReportModel` receives the Gherkin document and pickles from Messages. It
builds one flat `ReportScenario` per pickle that has a test case with results,
maps `pickle.astNodeIds[0]` to the scenario AST node and uses `pickle.tags` for
the tag filter. `renderFeature` orders scenarios failed-first and renders each
one as a `<details data-scenario>` row. Triage, counts and the status matrix
read the flat scenario list. The JSON summary is computed separately from the
envelopes by `summarizeEnvelopes`; grouping must not change it.

ADR 0004 makes Messages the normal form for legacy JSON, but legacy input
arrives with examples already expanded. ADR 0005 keeps the report shell
server-rendered; grouping must therefore be in the generated HTML, not a
client-side reconstruction.

## Goals / Non-Goals

**Goals:**

- Recover outline and examples structure from the Gherkin AST and render it
  without changing counts, triage membership, search semantics or the summary
  schema.
- Keep one flat scenario list as the source of truth so later changes (hooks,
  rules, empty runs) do not have to unwind a second model.
- Preserve per-example outcomes, attachments, anchors and filters.
- Give triage and copy-failure output enough context to distinguish examples
  that share a pickle name.
- Keep legacy, JUnit and non-outline output unchanged.

**Non-Goals:**

- Reconstructing outlines from legacy JSON.
- Rendering the examples table values as a table. The official formatter shows
  the numbered outcome, not the table; substituted values already appear in the
  steps.
- Markdown descriptions (G8), tag-expression search/URL state (G10), `meta.ci`
  (G11), attachment polish (G12), the stream adapter (G14), parameter
  highlighting (G15), rules/backgrounds/tags (G9), hooks (G2/G3), diagnostics
  and auto-expansion (G4/G5/G6) and empty-run semantics (G7).

## Decisions

### Group at render time from flat rows

Add an optional `outline` object to `ReportScenario`:

- outline id, keyword, name, description and tags;
- examples id, keyword, name, description and tags;
- zero-based `examplesIndex` and `exampleIndex`.

The feature still owns one flat `scenarios` array. `renderFeature` partitions
that array into outline groups and standalone scenarios, then renders groups.
Counts, triage membership, the matrix, the tag list and the JSON summary keep
their current sources.

Alternatives considered:

- **Nested `ReportOutline`/`ReportExample` on `ReportFeature`.** Cleaner
  shape, but duplicates every scenario in two structures and forces every
  existing consumer to choose a view. Rejected as unnecessary churn.
- **Grouping in the browser.** Contradicts ADR 0005 and breaks the no-JS
  report. Rejected.

### Derive metadata from the deepest AST node

The Gherkin pickle compiler emits `astNodeIds: [scenarioId, tableRowId]` for an
outline example and `[scenarioId]` for an ordinary scenario. The official
formatter uses the deepest lineage, so Tolkira uses `pickle.astNodeIds.at(-1)`
as the table-row key and the row map's stored scenario for grouping. Do not
assume index 0 or 1; producers may add AST ids. Verify the map entry exists and
that the pickle includes the scenario id; otherwise leave the row flat.

While walking the feature tree, including `rule.children`, build a map from
examples table-row id to
`{ scenario, ruleName, examples, examplesIndex, exampleIndex }`. Iterate all
examples blocks, including empty ones, so a block without a header still
advances the numbering. When building a `ReportScenario`, attach the metadata
only for executed rows; unexecuted rows and blocks have no row and therefore no
heading.

`ReportScenario.tags` stays `pickle.tags` (feature + rule + outline + examples
tags) so the tag dropdown, `data-tags` and the tag filter keep working. The AST
outline and examples tags are used only for heading display.

### Order outlines failed-first, examples in Gherkin order

Grouping uses the input-order `feature.scenarios` array. Render items are
either a standalone scenario or an outline group. Each item's severity is the
scenario status or the worst status in the group. Items are sorted by severity,
then by the first input index, so the result is stable. Within a group, rows are
sorted by `examplesIndex`, then `exampleIndex`; this preserves `#1.1`, `#1.2`,
`#2.1` and keeps numbering trustworthy.

Row ids use the severity-ordered array that `orderFeatures` already gives the
triage index. Build an id map from that array and use it for both the rendered
row and the triage link. Do not derive ids from grouped render order.

Alternative rejected: sorting rows by status. It would produce `#1.2` before
`#1.1` and break the numbering.

### Render static outline sections around the existing row component

An outline renders as a `<section data-outline>` with tags above an `h3` and
the description below. Each examples block is a `<section data-examples>` with
tags above an `h4`, the keyword/name and the description below. An empty
examples name renders `Examples:`.

Example rows reuse the existing scenario `<details>` markup. The visible row
heading is `#<examplesIndex>.<exampleIndex>`. The substituted name is available
through a screen-reader label and `data-scenario-name`; the examples name is
available through `data-examples-name`. The row detail metadata can repeat the
substituted name for orientation.

Heading hierarchy is `h2` feature → `h3` outline → `h4` examples → `h5` example
row. The inner "Steps" and "Attachments" labels change from `h4` to a
non-heading `<p class="detailLabel">` for all rows, so a grouped row never has a
child heading above its parent. Standalone rows keep their current `h3`.

Tags render before the heading and descriptions after, matching the official
order. The examples table itself is not rendered.

### Give triage and copy failure the example context

Add a `scenarioLabel(scenario)` helper:

- no outline: `scenario.name`;
- outline: `#<n>.<m> · <substituted name>`, prefixed with the examples block
  name when it is non-empty.

Use it for triage labels and the row's screen-reader label. `failureText()`
uses `data-scenario-name`, `data-example` and `data-examples-name` so a copied
failure contains the substituted name, example number and examples block name.
The JSON summary keeps the pickle name; the duplicate-name limitation for
outline examples is documented in `docs/AGENT-INTERFACE.md` instead of changing
the schema in this slice.

### Keep search and filters row-based

`data-scenario`, `data-tags` and `data-search` stay on the row. Outline and
examples names and tags are added to the row's search text so a search for the
outline or examples block finds its examples. Examples table values are not
indexed separately; only values substituted into steps are searchable. After
filtering, a small client-side pass hides `[data-examples]` and `[data-outline]`
wrappers that contain no visible row. The 20-match auto-open cap and the
existing empty-state logic stay unchanged. The official formatter also
highlights headings; Tolkira's highlight pass stays row-based in this slice.

### Fall back to flat rendering

Legacy JSON, JUnit, ordinary scenarios and Messages pickles that cannot be
linked to an examples row keep the current flat row. An executed outline with
no examples also falls back to a flat row; this is a deliberate difference from
the official formatter and is documented in the changelog and compatibility
notes. A test case that started but has no finished step is still dropped by
the current model; that interrupted-run case belongs to G7 and must be handled
there, not silently inherited here.

## Risks / Trade-offs

- **AST mapping differs across producers** → use `.at(-1)` and the row map,
  verify membership, fall back flat, and cover extra-AST-id and unlinked cases.
- **Failed-first ordering conflicts with example numbering** → order groups,
  not rows, by severity; keep failed rows open; cover the tie-breaker and the
  triage link with tests.
- **Search leaves empty headings** → hide empty examples and outline wrappers
  after every filter pass; test search, status and tag filters together.
- **Heading hierarchy becomes deeper** → change inner section labels to
  non-headings and assert heading order.
- **Copy failure loses the scenario name** → use data attributes and test the
  copied text on a grouped failed example.
- **Large outlines add DOM wrappers** → two static elements per examples block
  and no extra details; add an outline-heavy stress run.
- **Legacy users see no change** → intentional; document it so the difference
  is not mistaken for a bug.
- **JSON summary names remain duplicated** → document the limitation; a schema
  field is a later, explicit decision.

## Migration Plan

No schema, CLI or API change. The report output changes only for Messages
outlines. Rollback is a revert of the slice; no stored data or generated
artifacts need migration.

## Open Questions

None for this slice. The review questions are resolved above: triage labels
include example context, the JSON summary keeps its schema, unexecuted examples
are omitted, examples descriptions are rendered, and outlines inside rules are
grouped.
