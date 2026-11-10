# Pre-implementation review: `parity-outlines`

Date: 2026-11-10. Scope: independent review of the OpenSpec change
`openspec/changes/parity-outlines/` before implementation. Read-only for
production code, tests, CI and the change artifacts. This note is the only file
written.

## Verdict

The architecture is sound. Grouping the existing flat `ReportScenario` rows at
render time, with optional outline/examples metadata on each row, is the right
minimal change for Tolkira's model and keeps counts, the matrix, the JSON
summary and legacy input stable.

The plan is **sufficient for outline parity after the blockers and majors
below are fixed**. It is **not sufficient for full formatter parity**, and it
does not claim to be. The 0.3 roadmap covers the research note's "required for
credible drop-in parity" set only if G6 (auto-expand non-passed) is included
with G4/G5 and G7 is specified more precisely. G8 (Markdown), G10
(tag-expression search/URL state), G11 (`meta.ci`), G12 (attachment polish),
G14 (stream adapter) and G15 (parameter highlighting) remain after the five
groups. Retries already match in outcome; themes, external attachments and lazy
rendering are deliberate differences.

The blockers are contract and test-data problems, not a reason to redesign the
slice.

## Evidence and method

Official behavior was checked against:

- `@cucumber/html-formatter@24.2.0` (published 2026-09-28);
- `@cucumber/react-components@24.5.0` (`Scenario`, `Examples`,
  `TestCaseOutcome`, `useTestCaseStarted`, `Description`, `Tags`, `Title`);
- `@cucumber/query@16.1.1` (`Query.findAllTestCaseStarted`,
  `findLineageBy`, `Lineage`);
- `@cucumber/compatibility-kit@31.0.0`.

The official HTML was rendered through `NdjsonToMessageStream` into
`CucumberHtmlStream` (the same path as the formatter's acceptance test) and
inspected in Chromium. The fixtures were:

- `features/examples-tables/examples-tables.ndjson`;
- `features/examples-tables-attachment/examples-tables-attachment.ndjson`;
- synthetic Messages fixtures for partial execution, empty examples blocks,
  metadata order, retries and no-example outlines;
- `features/empty/empty.ndjson`, `features/retry/retry.ndjson`,
  `features/hooks/hooks.ndjson`, `features/undefined/undefined.ndjson`,
  `features/ambiguous/ambiguous.ndjson`, `features/markdown/markdown.ndjson`.

Tolkira behavior was checked against the current `0.2.0` `dist/cli.js` and the
source in `src/report/model.ts`, `src/render/html.ts`, `src/render/report.css`
and `src/summary.ts`.

Peer checks: `multiple-cucumber-html-reporter@4.6.0` source was inspected; its
Messages adapter (`dist/messages-ndjson.js`, `toScenario`) flattens each pickle
to a legacy `scenario` with `type: "scenario"`, `name: pickle.name`,
`description: ""` and no examples metadata. It does not group outlines. The
legacy reporter reads already-expanded legacy JSON; `test/fixtures/legacy/happy.json`
shows outline examples as ordinary `Scenario` elements with substituted names
and no examples table. Allure and Playwright were not re-run in this review;
their comparison is taken from the research note and public docs and is not
load-bearing for the outline plan.

## Q1. Does the plan match the official outline/examples behavior?

Mostly yes, at the level of information and structure. The differences are in
contract wording, tests and a few presentation details.

| Aspect | Official 24.2.0 | `parity-outlines` | Verdict |
| --- | --- | --- | --- |
| Outline sections | One `section` per Gherkin outline; the outline is rendered once, not once per example | One outline section per outline, grouping the flat rows | Match in design; task 2.1 says "one outline section" for a fixture that has **two** outlines. Task bug. |
| Outline heading | `h2`, `Scenario Outline: <unsubstituted name>`, outline tags above, description below | `h3`, keyword/name, tags and description | Content matches. Tag order and heading level differ; no test for the unsubstituted name. |
| Examples headings | `h2` per examples block, tags above, keyword/name, description below; empty name renders `Examples:` | `h4` per examples block, tags and description | Content matches, except the spec and tasks omit the examples **description**. Empty examples name is in the fixture but not asserted. |
| Numbering | `#<examplesIndex+1>.<exampleIndex+1>` from the AST lineage; resets for each outline; preserves AST indices when rows/blocks are unexecuted | Same zero-based indices from the AST table-row map, rendered +1 | Match if implemented from AST indices. Needs tests for two outlines, empty blocks and partial execution. |
| Visible row label | `#1.1` only; no substituted scenario name in the row heading | `#1.1` only, plus an SR label with the outline and substituted name | Match; the SR label exceeds official. |
| Substituted name | Not shown in the row; official search does not index pickle names or examples values | Kept in `ReportScenario.name`, search text and SR label | Exceeds official. Triage and copy-failure handling are missing (see Q2). |
| Per-example outcome | Steps, status icons, errors, attachments; no scenario-level aggregate status | Existing scenario row: status, steps, errors, attachments, duration, attempt, startedAt | Match/exceeds. Attachment fixture not used; duration exceeds official. |
| Retries | Final attempt only (`willBeRetried` filtered by `Query.findAllTestCaseStarted`); no attempt number | Latest attempt per pickle; `Attempt: N` shown | Match in outcome; Tolkira exceeds in display. No outline retry regression test. |
| Unexecuted examples | `Example` returns `null` without a `testCaseStarted`; `pruneGherkinDocuments` removes unexecuted rows and blocks; only blocks with an executed row are shown | Model creates rows only for pickles with a test case; grouping from flat rows omits unexecuted rows and blocks | Match in behavior, but the spec says "every pickle" / "one row per example" / "one subsection per examples block". Contract over-promises. |
| Examples block without a table header | No pickles; the block is pruned. If an empty block sits before an executed block, the executed block keeps its AST `examplesIndex` (`#2.1`) | Derived from flat rows; empty block omitted; AST indices preserved | Match if AST indices are used. No test. |
| Empty outlines | No test case: pruned. An executed no-examples outline is rendered as an outline section with the outcome and no examples | Unlinked pickle falls back to a normal flat row | Deliberate fallback; minor difference for the executed no-examples edge case. Document it. |
| Escaping | React text escaping; Markdown sanitised with `rehype-sanitize` | `escapeHtml` on names/descriptions/tags | Match, but the spec omits the outline/examples **keyword** and there is no Messages XSS fixture. |
| No-JS | React app; blank without JavaScript | Static outline/examples sections; rows and feature remain native `<details>` | Exceeds; do not regress. |
| Search | ORAMA over feature/scenario/rule/background names and descriptions, step keyword/text/doc string/data table; tag expressions; 500 ms debounce; `?query=`/`?hide=`; no examples names/values, pickle names, error messages or attachments | Substring over scenario/feature/URI/keyword/description/tags/steps/errors; plan adds outline/examples names and tags; tag dropdown; no URL state | Plan exceeds official for example names/substituted names; tag expressions and URL state remain G10. |
| Filters | Status checkboxes prune documents and rows; tag expression filters pickles | Status/tag filters hide rows; plan hides empty examples/outline wrappers | Match for rows/blocks; tag expressions later. |
| Anchors | Anchor on feature, background, scenario/rule, examples and example; example anchor id is the table-row AST id; step headings are not anchored | Row anchor `scenario-<feature>-<index>`; hash handler opens details ancestors; triage links to rows | Match functionally. Heading anchors are absent (minor); triage link id/index needs a test. |
| Aggregate status on outline | None | None | Match; do not add one for parity. |
| Examples table values | Not rendered as a table; substituted values appear in steps | Not rendered; design non-goal | Match. Do not add. |
| Row tags | Not visible per row; examples tags are on the examples heading; tag expression still sees pickle tags | Not visible per row; heading tags; `data-tags` remains from `pickle.tags` | Match if `ReportScenario.tags` stays the pickle tags. Make that explicit. |
| Outline/examples descriptions | Rendered as GFM Markdown | Rendered as escaped plain text (G8 deferred) | Deliberate/deferred for this slice; not a structural blocker. |
| Multiple outlines | Two sections in the CCK fixture; second outline's numbering starts at `#1.1`; second examples name is empty | Design supports it; task 2.1 tests only the first outline | Task bug; add the second outline assertions. |
| Outline in a Rule | Official renders the rule section and the outline | Design walker should handle `rule.children`; no test | Add a test or explicitly scope it out. |
| Legacy JSON | N/A (Messages only) | Flat fallback | Correct; legacy JSON has no outline structure. |

### The two-outline fixture is the central acceptance case

`examples-tables.ndjson` contains **two** outlines and **seven** examples:

- `Eating cucumbers`, with examples `These are passing` (`#1.1`, `#1.2`,
  `@passing`) and `These are failing` (`#2.1`, `#2.2`, `@failing`);
- `Eating cucumbers with <friends> friends`, with one unnamed examples block
  (`#1.1`–`#1.3`).

The official render shows both outline sections. The plan's task 2.1 says:

> one outline section, two examples headings and rows labelled `#1.1`, `#1.2`,
> `#2.1`, `#2.2`

That is only the first outline. It misses the second section, the numbering
reset, the parameterized outline name and the empty examples name. This is a
blocker because the task's acceptance test contradicts its own fixture.

The official row labels for the second outline are `#1.1`, `#1.2`, `#1.3`, not
`#2.1`–`#2.3`; `examplesIndex` resets per scenario. The plan's AST-derived
indices produce the same result if implemented correctly.

### Unexecuted examples: the plan's behavior is right, its spec is wrong

Rendered evidence from synthetic fixtures:

- execute only the second examples block of a two-block outline: official shows
  only `Examples: <executed block>` with `#2.1`; the unexecuted block and its
  heading are gone;
- execute only the second row of a one-block outline: official shows only
  `#1.2`, not `#1.1`;
- execute only the first row: official shows only `#1.1`.

This matches the plan's "group from flat rows" design, because the model only
creates rows for pickles with a test case. The spec's phrases "every pickle",
"one numbered row per example" and "one subsection per examples block" do not.
They imply that unexecuted examples are rendered, which would diverge from the
official formatter and add rows the model does not have. The spec must say
"executed example" and add an explicit scenario for unexecuted rows/blocks.

One edge case remains different: a test case that **started** but has no
`testStepFinished` is shown by the official formatter (the document is kept by
the lineage constraint; `TestCaseOutcome` renders an empty step list), while
Tolkira's `buildReportModel` drops the row because it only selects a
`TestCaseStarted` with results. This is an interrupted-run case, not a normal
outline case, and belongs to G7 rather than this slice. Note it so G7 does not
inherit a silent drop.

### Empty outlines and blocks without a header

Rendered evidence:

- `Scenario Outline` with no examples: the Gherkin compiler emits a pickle with
  only the scenario id. Without a test case, official prunes it. With a test
  case, official would render it as an outline section with the outcome and no
  examples. The plan's "unlinked pickle falls back to a normal scenario row"
  would render it flat. This is a deliberate fallback; document it in the spec
  and changelog.
- `Examples:` with no table, or a header-only table: no pickles, so official
  prunes the block; the plan omits it. Match.
- An empty block before an executed block: official keeps the executed block's
  AST index (`#2.1`); the plan's AST indices do the same. Add a test so a later
  "renumber from rendered groups" optimization does not break it.

### Escaping

The plan escapes names, descriptions and tags with `escapeHtml`. That is the
right mechanism. The spec's XSS scenario omits:

- the outline and examples **keyword** (from the Gherkin dialect; still escape
  it);
- the examples **description** (the spec says "description" once);
- a Messages fixture with HTML in outline/examples names, descriptions and
  tags. The CCK fixture has none.

`src/input/sanitize.ts` already strips remote Markdown images from scenario and
examples descriptions. The XSS test should cover the new heading fields, not
just the existing scenario names.

### No-JS, search, filters and anchors

No-JS is preserved: the outline/examples wrappers are static, the row remains
the only collapsible element, and the feature is a native `<details>`. The
plan correctly rejects browser-side grouping.

Search and filters are row-based, which is the right choice. The plan adds
outline/examples names and tags to `data-search`; that exceeds official (which
does not index examples names or values). Keep it, but do not call it a parity
requirement.

Two details need tests:

- the 20-match auto-open cap and wrapper hiding must not leave an empty
  examples/outline heading;
- the triage link and the rendered row must use the **same** index source. The
  design says row ids use "the flat ordered list rather than the grouped render
  order"; the triage currently computes `scenarios.indexOf(scenario) + 1` on the
  severity-ordered array. The implementation must use that same array for both,
  or the links break. Add a browser test that clicks the triage link for a
  failed example.

The official formatter also anchors the outline and examples headings. The plan
only anchors rows. This is not required for triage; add heading ids only if
cheap. The official search highlights the outline/examples headings; the
current `highlightSearch` only walks scenario rows. A search for the outline
name will show the heading but not highlight it. Minor.

## Q2. What the plan misses, over-scopes or gets wrong

### 1. Triage must identify the example (`#1.1` context) — major

This is the most important Tolkira-specific gap. The CCK fixture's first
outline has four examples, all named `Eating cucumbers`; two fail. The current
0.2.0 triage renders two visually identical labels (the hrefs differ, but the
user cannot tell which example is which):

```
Failed  Eating cucumbers
Failed  Eating cucumbers
```

The plan keeps the triage index reading the flat list and does not add example
context. The design's goal even says grouping should happen "without changing
counts, triage, search or the summary". The triage **membership** and counts
should not change, but the triage **label** must. Otherwise the "Needs
attention" index cannot distinguish the two failures, and the plan's own goal
("failed examples remain visible and linkable") is not met.

Concrete fix: add a small `scenarioLabel(scenario)` helper that appends
`#<examplesIndex>.<exampleIndex>` and, when present, the examples block name.
Use it in `renderTriageRow` and in the row's visible or screen-reader heading.
For example: `#2.1 Eating cucumbers` or `These are failing #2.1 — Eating
cucumbers`. Add a browser test that the two failed examples are distinguishable
and that each triage link opens the correct row.

The JSON summary has the same duplicate-name problem (`SummaryScenario.name` is
`pickle.name`). That is not an official parity gap (official has no JSON
summary), but it weakens Tolkira's agent promise. Decide explicitly: either
document the limitation in `docs/AGENT-INTERFACE.md` or add an optional
`example` field in a later slice. Do not leave it implicit.

### 2. Examples table values — do not add them

The official formatter does not render the examples table. It renders the
numbered outcome and the substituted steps. The plan's non-goal is correct.
Adding the table would be over-scope and would diverge from the official
formatter. The spec should state explicitly: "The examples table values are not
rendered as a table; only values substituted into steps are visible." That
prevents a future implementer from "fixing" the missing table.

### 3. Row tags — keep them filterable, not visible

The official formatter shows examples tags on the examples heading, not on each
row. The plan matches. Keep `ReportScenario.tags` as `pickle.tags` (feature +
outline + examples tags) so the tag dropdown, `data-tags` and the tag filter
continue to work. Use `outline.tags` and `outline.examplesTags` only for the
heading display. The design should say this explicitly; otherwise an
implementer may replace `scenario.tags` with only the outline tags and lose
examples tags from the filter.

Add a browser test: selecting `@failing` hides the passing examples block, keeps
the failing block, and keeps the outline heading; selecting `@passing` does the
reverse. Task 3.3 is close, but it should name the examples tags from the
fixture.

### 4. Aggregate status on the outline heading — not needed for parity

The official outline heading has no aggregate status. The feature heading
carries the status and the failed row is open. Adding an outline status badge
would be a Tolkira product choice, not a parity requirement. Do not add one in
this slice. If Tolkira later wants an outline count (`3 of 4 passed`), make it a
separate, explicit product decision.

### 5. The heading hierarchy is invalid as designed — major

The design proposes outline `h3`, examples `h4`, example row `h5`. The existing
scenario detail uses `<h4>Steps</h4>` and `<h4>Attachments</h4>`. For a grouped
row at `h5`, those inner `h4`s are higher than the row heading and break the
outline. The design's risk note mentions the deeper hierarchy but does not
resolve this conflict.

Pick one:

- keep the row heading at `h3` and make the outline/examples headings `h3`/`h4`
  or `h2`/`h3` in a way that never puts a child above its parent; or
- keep `h5` for the grouped row and change the inner "Steps"/"Attachments"
  labels to a non-heading element (for example `<p class="detailLabel">`) or
  `h6` for grouped rows.

The simplest change is to make the inner labels non-headings for all rows; they
are section labels inside a scenario, not document sections. Then the outline
`h3` → examples `h4` → row `h5` is valid. Add an accessibility assertion that
checks heading order, not just that the headings exist.

### 6. Copy failure loses the scenario name — major

`failureText()` reads `.scenarioName` and writes `Scenario: <text>`. If the
visible row heading becomes `#1.1`, the copied failure text becomes
`Scenario: #1.1` and loses the substituted scenario name. The design says the
row has an SR label with the outline and substituted name, but not where it
lives.

Fix: keep the substituted name inside the `.scenarioName` element (visible or
`sr`), or add `data-scenario-name` / `data-example` attributes and update
`failureText()` to use them. Add a browser test that clicks "Copy failure" on a
grouped failed example and asserts the copied text contains the substituted
name and the example number. The triage label fix should use the same helper.

### 7. Examples description is missing from the spec and tasks — major

The design includes `examples.description` in the metadata and says each
examples block renders a description. The spec's "Outline metadata appears once"
only mentions examples tags. The tasks' task 2.3 only mentions examples tags.
The CCK fixture's examples blocks have no descriptions, so no test would
exercise it.

Add:

- a spec scenario: examples block description renders once under the examples
  heading, not on every row;
- a synthetic fixture with an examples description;
- a render assertion.

The same applies to outline tags and outline descriptions: the CCK fixture has
neither. The spec's "Outline metadata appears once" cannot be exercised by the
planned fixture. Add a synthetic Messages fixture with `@outline-tag`, an
outline description, `@examples-tag` and an examples description. This is also
the fixture for the XSS test.

### 8. `astNodeIds[1]` is less producer-independent than the official lineage — major

The design says the compiler emits `[scenarioId, tableRowId]`, looks up
`astNodeIds[1]`, and verifies the row belongs to `astNodeIds[0]`. The official
formatter uses `pickle.astNodeIds.at(-1)` for the deepest lineage and
`findLineageBy` to recover the examples and indices. The plan's `[1]` assumption
works for the official compiler but weakens the "producer-independent" claim
for producers that include extra AST ids or a different order.

Use `.at(-1)` for the table row and the map's stored scenario for grouping;
verify membership with `astNodeIds.includes(scenario.id)` or by checking the map
entry, not by assuming index 0. Keep the flat fallback when the map lookup
fails. Add a synthetic test with an extra AST id to prove the fallback is not
triggered unnecessarily.

### 9. Two outlines, empty examples name and numbering reset are untested — blocker

This overlaps Q1. Task 2.1 must assert:

- two outline sections;
- the first outline's two examples headings and `#1.1`, `#1.2`, `#2.1`,
  `#2.2`;
- the second outline's one examples heading with an empty name (`Examples:`)
  and `#1.1`, `#1.2`, `#1.3`;
- the second outline's heading uses the unsubstituted
  `Eating cucumbers with <friends> friends`, not a substituted name.

The task currently says "one outline section", which is wrong for the fixture.

### 10. Group ordering and anchor ids need a precise source — major

The design says "Outline groups are ordered by the worst row status" and that
row ids take the index "from the flat ordered list rather than the grouped
render order". There are two arrays in play:

- `ReportFeature.scenarios`: input order;
- `OrderedFeature.scenarios`: severity order from `orderFeatures`.

The triage uses the severity-ordered array. `renderFeature` receives the
severity-ordered array. The design's "feature still owns one flat `scenarios`
array" is the input-order array. Specify:

- group the **input-order** `feature.scenarios` array to preserve Gherkin
  order;
- compute each group's worst status, sort groups by severity and then by the
  first row's input index (or outline location);
- within a group, sort by `examplesIndex`, then `exampleIndex`;
- assign row ids from the **severity-ordered** array that the triage uses;
- keep standalone scenarios in the existing severity order.

Without this, an implementer can easily assign ids from the grouped render
order and break the triage links, or sort groups by the first row's severity
and make the order unstable.

### 11. Outline inside a Rule is untested — minor/major

The current `featureTree` walks `rule.children` and records `ruleName`. The new
examples-row walker must do the same, or an outline inside a Rule stays flat
while the same outline outside a Rule groups. G9 will later add rule sections,
but this slice should not create a rule-specific regression. Add a small
synthetic Messages fixture with an outline inside a Rule and assert grouping
(and that `Rule: <name>` still appears in the detail meta). If rules are
explicitly out of scope for grouping, say so; the spec currently says "every
pickle generated from the same scenario outline", with no rule exception.

### 12. Attachment fixture is not used — major

The spec says each example keeps its own attachments. The planned
`examples-tables.ndjson` fixture has no attachments. The CCK already has
`examples-tables-attachment.ndjson` with a JPEG and PNG example. Add it (or a
synthetic two-example attachment fixture) and assert:

- each example row shows its own image;
- the images do not leak between rows;
- the lightbox still works;
- the attachment count on each row is correct.

Task 1.1 currently only adds `examples-tables.ndjson`; task 2.x should add the
attachment case. This is an acceptance criterion without a test.

### 13. Retry regression is not tested — minor

The model already selects the latest attempt per pickle. Grouping must not
create duplicate rows when an example is retried. Add a synthetic outline with
one retried example and assert one row, latest attempt, `Attempt: N`, and no
duplicate `#1.1` headings. The official formatter's `willBeRetried` filter is
the comparison point. The edge case (last attempt marked `willBeRetried` with
no successor) remains; do not fix it in this slice.

### 14. JSON summary and model statements are inaccurate — minor

The proposal says the flat scenario list is the source for "the JSON summary".
It is not: `renderHtml` computes `summary = options.summary ??
summarizeEnvelopes(safeEnvelopes)`, and `summarizeEnvelopes` reads envelopes.
Grouping does not change the summary, which is good, but the statement should
say "the JSON summary is unchanged because it is computed from envelopes, not
the render model."

The design says "Triage, counts, the status matrix, search and the JSON summary
all read the flat scenario list." The first four do; the JSON summary does not.
Correct the sentence.

### 15. Proposal labels G4 but ambiguous is G5 and auto-expand is G6 — minor

The proposal's out-of-scope list says "undefined/ambiguous diagnostics (G4)".
In the research note, G4 is undefined suggestions, G5 is ambiguous definitions,
and G6 is auto-expanding non-passed scenarios. The proposal should say
G4/G5/G6 (or "G4–G6"). The roadmap should not lose G6; it is part of the
official behavior and of the research note's "required" list.

## Q3. Does the 0.3 roadmap reach parity?

### What the five groups cover

The five groups are the right **set**, and they cover the research note's
"required for credible drop-in parity" list. The order is a product choice: the
research note puts G7 before G9, while the user's list puts G9 before G7. Both
are defensible; the hard dependency is G1 first because it changes the core
grouping.

1. **G1 outlines** — this slice.
2. **G2 + G3 hooks** — test-run hooks, hook names, passed-hook collapsing.
3. **G4 + G5 + G6 diagnostics** — undefined suggestions, ambiguous
   definitions, auto-expand non-passed scenarios and features.
4. **G9 rules/backgrounds/tags** — rule nodes, background headings, feature
   and rule tags.
5. **G7 empty-run semantics** — not executed, counts, triage, feature status.

Two corrections:

- **G6 is not optional.** The user's shorthand "G4 undefined/ambiguous" should
  include G5 (ambiguous) and G6 (auto-expand). Without G6, the diagnostics are
  rendered but the pending/undefined/ambiguous scenario (and its feature) can
  still start collapsed. The official formatter pre-expands non-passed
  documents. Add G6 to the group.
- **G7 needs a more precise contract than the research note's one-liner.**
  The empty fixture's finished test case already produces a row in
  `buildReportModel`; the model only drops a **started-but-unfinished** test
  case because it selects a `TestCaseStarted` with results. The official
  formatter keeps that interrupted row too and shows it with no outcome. G7
  must:
  - keep the finished empty row and create the started-but-unfinished row, both
    with an `executed: false` marker;
  - exclude it from scenario counts and triage;
  - set the feature status to `unknown`/not executed when every scenario is
    unexecuted, not `passed`;
  - open non-passed/unknown features (G6) so the blank scenario is visible;
  - decide the JSON summary contract: a new `executed` field or documented
    count semantics, and whether `schemaVersion` changes;
  - show `0 / 0` and no "Needs attention" for the empty run.

The research note's G7 cost "S" is optimistic if the summary contract and the
started-but-unfinished row are included. Treat it as a small spec decision, not
a one-line flag.

### What remains after the five

| Gap | Category | Why |
| --- | --- | --- |
| G8 Markdown descriptions | Second-tier for triage; must-have for full content parity | Official renders GFM; Tolkira prints escaped plain text. Outline/examples descriptions are part of this gap. A dependency needs a written reason. |
| G10 tag-expression search and URL state | Second-tier; must-have for full search parity | Official uses `@cucumber/tag-expressions` and `?query=`/`?hide=`. Tolkira's substring search and tag dropdown are a valid shortcut. |
| G11 `meta.ci` | Second-tier; must-have for full metadata parity | Small, high-signal CI job/commit/branch/tag. The CCK fixture already carries `meta.ci`, so the CMP comparison will show it. |
| G12 attachment polish | Second-tier; must-have for full attachment parity | `attachment.<ext>` naming, JSON prettifying, `text/uri-list` links. The official also renders `text/x.cucumber.log+plain` with ANSI colours and a copy button; the research note's G12 omits ANSI logs. Add it if "full" attachment parity is the goal. |
| G14 stream adapter | Second-tier/optional; must-have only for drop-in formatter embedding | A `CucumberHtmlStream`-shaped Transform would let teams swap the official formatter inside a Cucumber implementation. Not needed for the standalone CLI/API report. |
| G15 parameter highlighting | Second-tier/cosmetic | Official highlights matched step parameters with `stepMatchArgumentsLists` and `parameterType` names. Not needed for triage; do not copy for parity's sake. |
| Retries | Match; no work | Official shows the final attempt; Tolkira shows the latest attempt plus `Attempt: N`. Neither offers attempt history. Do not copy Allure's history model. |
| Empty runs | Must-have; G7 | See the G7 contract above. |
| Themes | Deliberate difference; not worth copying | Official CSS variables/custom CSS/JS and the legacy Bootstrap themes are visual choices; Tolkira's shell is its own. |
| External attachments / split assets | Deliberate difference | Conflicts with one-file/offline and CSP. Keep rejecting remote URLs; a split-assets mode is a separate product decision. |
| Lazy rendering of closed documents | Deliberate difference; not worth copying | Would weaken the no-JS baseline. Measure first; the static report is much smaller. |
| React runtime / ~900 KB bundle / client-side ORAMA index | Not worth copying | Contradicts the one-small-file promise. |
| CLI, JSON summary, multi-format input | Tolkira exceeds | Not parity gaps. |

**Bottom line:** after G1, G2+G3, G4+G5+G6, G9 and a precise G7, Tolkira
reaches **credible Messages report parity** with the official formatter. It
does **not** reach **full formatter parity**; G8, G10, G11 and G12 are the
remaining content gaps, G15 is cosmetic, and G14 is the remaining embedding
gap. That is a reasonable 0.3/0.4 split, provided the docs say "credible
parity" and not "full parity".

## Q4. Stale or wrong claims in `docs/research/cucumber-html-parity.md`

Flagged only; the research file is not rewritten.

1. **Wrong: "one `Scenario Outline: Eating cucumbers` section".** The CCK
   fixture has two outlines. The official render shows
   `Eating cucumbers` (two examples blocks, `#1.1`–`#2.2`) and
   `Eating cucumbers with <friends> friends` (one examples block,
   `#1.1`–`#1.3`). The research note's outline section only describes the
   first. This is the same error that produced task 2.1's "one outline
   section".
2. **Wrong: "seven flat rows named `Eating cucumbers`, `Eating cucumbers with
   11 friends`, etc."** The first outline's four rows are all named
   `Eating cucumbers`; only the second outline's three rows have substituted
   names. This is exactly why the triage index shows duplicate names.
3. **Stale label: "Tolkira 0.1.2."** The current repo is 0.2.0. The matrix and
   method say 0.1.2, but the "Empty runs and scenarios without steps" section
   describes 0.2.0's "Needs attention" index and feature/scenario triage. Say
   which claims are 0.1.2 and which are 0.2.0, or update the note to 0.2.0.
4. **Incomplete: the official search index.** The note says "full-text Gherkin
   index" but does not say it excludes examples block names, examples table
   values, substituted pickle names, error messages and attachments. The plan's
   addition of outline/examples names is therefore an **exceed**, not a parity
   requirement. Clarify.
5. **Incomplete: MCHR outline behavior.** The note compares MCHR but does not
   say that MCHR 4.6.0's Messages adapter flattens each pickle to a legacy
   `scenario` and does not group outlines. That makes the official formatter
   the only structural peer for G1. Add it to the peer section.
6. **Incomplete: G7's model shape.** The note says a scenario with no
   `testStepFinished` is displayed as not executed. The empty fixture's
   finished test case already produces a row, so the row-display part is mostly
   there; the model only drops a **started-but-unfinished** test case. G7 still
   needs the feature status rule (`unknown`, not `passed`), feature expansion
   and a summary contract. The note's "S" estimate and one-line shape understate
   those decisions.
7. **Incomplete: G6 feature expansion.** The note says "open any scenario whose
   status is not `passed`", but the feature `<details>` also opens only for
   `failed` in `renderFeature`. The official formatter pre-expands non-passed
   documents. G6 should cover the feature, not only the scenario row.
8. **Incomplete: G12 ANSI logs.** The note's G12 lists naming, JSON prettifying
   and URI-list links, but the official also renders
   `text/x.cucumber.log+plain` with ANSI colours and a copy button. If G12 is
   "attachment polish", include it or mark it deliberate.
9. **Correct claims worth keeping:** version/date of 24.2.0, no CLI since v19,
   ~920 KB base HTML, final-attempt-only retries, 500 ms search debounce and URL
   state, no search over errors/attachments, official `0 / 0` empty-run
   behavior, hook collapsing/test-run hooks, Markdown sanitisation, no CSP in
   the default template, and external attachment URLs.

The research note's measured sizes are still close to 0.2.0 (empty 48 KB,
examples 60 KB in binary units; 49/62 KB decimal in this review), so the size
claims are not materially stale. The version label and the outline description
are.

## Q5. Blockers, majors and minors, with concrete edits

### Blockers (fix before implementation)

**B1. Task 2.1's "one outline section" contradicts the fixture.**
The fixture has two outlines. Rewrite task 2.1 to assert two outline sections,
the first outline's two examples headings and `#1.1`–`#2.2`, the second
outline's one examples heading with an empty name and `#1.1`–`#1.3`, and the
second outline's unsubstituted heading text. Update the spec's "Outline with two
examples blocks" scenario and add a "Two outlines" scenario.

**B2. The spec over-promises unexecuted examples.**
Change "every pickle", "one subsection per examples block" and "one numbered row
per example" to "every **executed** pickle/example" and "each examples block
that has at least one executed example". Add a spec scenario: unexecuted rows
and blocks are omitted, matching the official formatter; a block with no
executed row does not render a heading. Keep the flat fallback for a Messages
pickle with no test case.

**B3. The metadata/XSS acceptance criteria have no test data.**
The CCK fixture has no outline tags, outline description, examples description
or HTML. Add a synthetic Messages fixture with:
`@outline-tag`, an outline description, `@examples-tag`, an examples
description, and HTML/script text in the outline/examples names, descriptions
and tags. Use it for task 1.2 (model metadata), task 2.3 (render once +
escaping) and the SEC review. Without it, the spec's "Outline metadata appears
once" and "Untrusted outline text is escaped" are untestable.

### Majors (fix in this slice; they affect the user-facing result)

**M1. Triage duplicate names.**
Add `#<examplesIndex>.<exampleIndex>` and the examples block name to
`renderTriageRow` labels; use the same helper for the row's SR label and
copy-failure text. Add a browser test with the CCK fixture's two failed
`Eating cucumbers` examples. Decide the JSON summary duplicate-name limitation
(document it or add an optional `example` field later).

**M2. Heading hierarchy.**
Resolve the row `h5` vs inner `h4` Steps/Attachments conflict. Prefer
non-heading labels for the inner sections, or a hierarchy that never puts a
child above its parent. Add an accessibility assertion for heading order.

**M3. Copy failure.**
Keep the substituted scenario name in `.scenarioName` (visible or `sr`) or add
`data-scenario-name`/`data-example` and update `failureText()`. Add a browser
test on a grouped failed example.

**M4. Examples description.**
Add it to the spec, the synthetic fixture, the render test and the task 2.3
checklist. It is in the design but not in the contract or tests.

**M5. AST lookup.**
Use `pickle.astNodeIds.at(-1)` for the table row and the map's scenario for
grouping; do not assume `astNodeIds[1]`/`[0]`. Add a synthetic extra-AST-id
test. Keep the flat fallback.

**M6. Group order and id source.**
Specify the input-order array for grouping, the severity-order array for ids
and triage, and the tie-breaker for groups. Add a test where a standalone
failed scenario and a failed outline group compete for position, and a test
that the triage link opens the correct grouped row.

**M7. Attachment fixture.**
Add `examples-tables-attachment.ndjson` (or a synthetic equivalent) and assert
per-example images, no leakage, lightbox and attachment counts. The spec's
"each example keeps its own attachments" currently has no test.

**M8. Outline in a Rule.**
Add a synthetic test or explicitly scope it out. The walker must visit
`rule.children`; the current `featureTree` already does, so the new examples-row
walker should too.

### Minors (fix if cheap; do not block)

- Render outline/examples tags **before** the heading and descriptions after,
  matching official order. The design currently says heading, tags, description.
- Escape the outline/examples keyword as well as names/descriptions/tags.
- Keep `ReportScenario.tags` as `pickle.tags` and `data-tags` on the row; use
  the AST tags only for heading display. Add a test that filtering by an
  examples tag still works.
- Add heading ids/anchors for outline/examples if cheap; not required for
  triage.
- Include outline/examples headings in the search highlight pass; currently
  only scenario rows are highlighted.
- Add the outline fixture to the responsive and visual test sets.
- Add an outline-heavy 1000/5000 stress case; the existing stress fixtures may
  not include outlines.
- Name the documentation files in task 4.1:
  `docs/CHANGELOG.md`, `docs/CUCUMBER-COMPATIBILITY.md` (Messages outlines and
  legacy flat fallback), `docs/COMPATIBILITY.md` (legacy shim stays flat),
  `docs/AGENT-INTERFACE.md` (duplicate summary names, if kept) and
  `GLOSSARY.md` (outline, examples block, example row, example number).
- Correct the proposal's "G4" to "G4/G5/G6" and add G6 to the out-of-scope list
  or the roadmap.
- Correct the proposal/design statements that the JSON summary reads the flat
  model; it is computed from envelopes.
- Change "Open Questions: None" in the design. At minimum list: triage label
  format, JSON summary duplicate names, unexecuted examples contract, examples
  description, and outline-in-rule scope.
- Note in the spec that an executed no-examples outline falls back to a flat
  row (deliberate difference from official) or implement the outline section
  for it.
- Add a retry regression test (one row, latest attempt, no duplicate `#1.1`).
- Add a CMP note that the `meta.ci` header (G11) and Markdown descriptions
  (G8) will differ on the CCK fixture and are out of scope; the CMP reviewer
  should not call them blockers for this slice.
- Task 4.3 should run the full reviewer set required by
  `docs/agents/review.md` (SCR, CR, DAR, plus SEC, UXR, PCA, CMP), not only
  CMP. The CMP protocol requires official first, then MCHR, Allure and
  Playwright on the same fixture.

### Concrete edits by artifact

**`proposal.md`**

- Change "undefined/ambiguous diagnostics (G4)" to "G4/G5/G6" and add G6 to the
  out-of-scope/roadmap language.
- Add the synthetic metadata/XSS fixture and the attachment fixture to the
  "Tests and fixtures" impact line.
- Say "credible Messages report parity" rather than implying full formatter
  parity; list G8/G10/G11/G12 as later.
- Correct "the JSON summary" as a consumer of the flat scenario list.

**`specs/report-rendering/spec.md`**

- Scope the grouping to **executed** examples and examples blocks with at least
  one executed example; add an unexecuted-examples scenario.
- Add a two-outlines scenario (numbering resets, empty examples name,
  unsubstituted outline name).
- Add examples description to "Outline metadata appears once".
- Add keyword and examples description to the escaping scenario.
- Add the triage `#1.1` context scenario.
- Add the attachment fixture/assertion to "Preserve example outcomes".
- Add the JSON summary count assertion.
- Add the search-by-unsubstituted-outline-name and search-by-examples-name
  cases; clarify that examples table values are not searchable/rendered.
- Add the triage-link anchor case.
- State that an executed no-examples outline falls back flat (or implement the
  outline section).
- State that row tags are not visible but remain filterable.

**`design.md`**

- Reword "without changing counts, triage, search or the summary" to
  "without changing counts, triage membership, search semantics or the summary
  schema; triage labels gain example context".
- Correct the JSON summary sentence.
- Replace `astNodeIds[1]`/`[0]` with `.at(-1)`/the map's scenario.
- Specify the grouping array, group sort, row sort, id source and tie-breaker.
- Resolve the heading hierarchy and the inner Steps/Attachments labels.
- Specify where the substituted name lives for the SR label and copy failure.
- Add examples description, outline tags/description and the synthetic fixture.
- Add the attachment and outline-in-rule tests.
- Add the open questions instead of "None".
- Note the tag order (tags before heading, description after) and keyword
  escaping.

**`tasks.md`**

- 1.1: add the synthetic metadata/XSS fixture and
  `examples-tables-attachment.ndjson`; verify 7 scenarios / 2 outlines /
  5 passed / 2 failed; verify the second outline's empty examples name and
  parameterized name.
- 1.2: add outline tags/description, examples description, two outlines,
  empty examples block, partial execution, extra AST id and retry cases.
- 1.3: keep `ReportScenario.tags` as `pickle.tags`; add the outline metadata;
  confirm the summary is unchanged.
- 1.4: add the executed no-examples outline fallback and the outline-in-rule
  fallback/grouping case.
- 2.1: fix "one outline section" to "two outline sections"; assert both
  outlines and the second outline's `#1.1`–`#1.3`.
- 2.2: implement the input-order grouping and severity-order ids; add the
  standalone-vs-group order test.
- 2.3: add examples description, tags-before-heading order, keyword escaping,
  XSS fixture, and the "appears once" assertion for outline and examples
  descriptions.
- 2.4: resolve the inner heading conflict; add the copy-failure test and the
  triage label test; add a heading-order assertion.
- 2.5: add the outline fixture to the responsive/visual checks.
- 3.1: search by the unsubstituted second-outline name, examples name and
  examples tag; assert no empty headings.
- 3.2: click the triage link, not only a hand-written `#scenario-...` id;
  cover a passed example in a passed feature.
- 3.3: assert examples-tag filtering keeps the outline heading when one block
  remains, and numbering is stable after filtering.
- 4.1: name the docs files; add `GLOSSARY.md` and `AGENT-INTERFACE.md` notes.
- 4.2: add an outline-heavy stress run and the visual snapshot; run the full
  reviewer set.
- 4.3: CMP against official, MCHR, Allure and Playwright; classify G8/G11 as
  known out-of-scope differences.

## What not to copy

- The React runtime, the ~900 KB base bundle, the client-side ORAMA index.
- The examples table as a table. Official does not show it; neither should
  Tolkira.
- An aggregate status badge on the outline heading. Official does not have one.
- Attempt history. Official does not offer it; Allure's history is a different
  product. Tolkira's latest-attempt + `Attempt: N` is enough.
- External attachment URLs, CDN assets, custom JavaScript as defaults, theme
  clones, the legacy `output + '.json'` side effect, browser launch, LambdaTest
  rerun metadata, telemetry.
- Lazy rendering that would weaken the no-JS baseline.

## Post-implementation review (2026-11-10)

The blind reviewer set ran on the implementation: SCR/DAR, CR/PCA, SEC/UXR and
CMP. The first pass found no architecture problems and no security issues, but
it did find test-contract gaps and one producer edge case.

Fixed before handover:

- omitted `examples`, `tableBody`, `scenario.tags`, `examples.tags`,
  `feature.tags` and `pickle.tags` no longer crash the model;
- outline/examples descriptions are searchable through wrapper-level
  `data-search` without repeating them on every row;
- URI-less Gherkin documents still group; row ids are checked against the
  pickle URI when both exist;
- grouped passed rows with screenshots stay collapsed, failed rows stay open;
- exact two-outline numbering, single-row and whole-block partial execution,
  Rule nesting, extra AST ids, table-value exclusion, no-examples fallback,
  status/tag filters, the grouped 20-match cap and heading order are covered;
- `#1.1` is searchable, the Steps list has an accessible name, the example
  number is hidden from the screen-reader label, and the narrow thumbnail is
  hidden at the smallest container size;
- docs distinguish the legacy flat rendering from the deliberate Messages
  no-examples fallback.

Final gate: 179 unit tests, 84 browser tests, `npm run check` and
`npm run test:e2e` green. Stress: 1,000 outline examples 118 ms / 1.47 MB;
5,000 273 ms / 7.22 MB.

## Evidence limits

- The official DOM was inspected in Chromium from the rendered 24.2.0 report.
  The React bundle is minified; component behavior was confirmed from the
  package's source maps and `@cucumber/query` source.
- MCHR 4.6.0 was inspected from source; it was not rendered against the CCK
  fixture. The conclusion that it flattens outlines follows directly from
  `toScenario` (`type: "scenario"`, `name: pickle.name`, no examples metadata).
- The legacy reporter was not re-run. Its flat behavior follows from the legacy
  JSON shape in `test/fixtures/legacy/happy.json` and the research note.
- Allure and Playwright were not re-tested. Their comparison is from the
  research note and public docs and is not load-bearing for the outline plan.
- The exact visual spacing of the official tags/headings is not a parity
  requirement; only the information and order are asserted here.
