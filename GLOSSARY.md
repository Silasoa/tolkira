# Glossary

**Tolkira** — the project and CLI. Coined from Scandinavian *tolk*
(interpreter).

**Report** — one self-contained HTML file generated from one or more test
result inputs.

**Legacy JSON** — the older Cucumber JSON output format. Implementation-specific
and lossy, but still widely used.

**Messages / Envelopes** — Cucumber Messages, the modern NDJSON envelope stream
used by official Cucumber implementations.

**Attachment** — a binary or text artefact attached to a test step, scenario or
hook. Screenshots are attachments.

**Embedding** — the legacy JSON representation of an attachment (`embeddings[]`).

**Adapter** — code that turns an input format into Cucumber Messages.

**Normalisation** — converting legacy JSON into Messages so one renderer can
handle both.

**Renderer** — Tolkira's server-side report renderer: it turns the report model
into HTML, CSS and a small script. It is part of Tolkira, not an upstream React
component tree.

**Shell** — Tolkira's own wrapper around the renderer: title, metadata, summary,
theme, logo.

**Triage index** — the "Needs attention" block above the feature list. It shows
non-passing features with counts and up to three scenario links; five rows are
visible and up to fifteen more sit behind a disclosure.

**Source strip** — per-input cards above the feature list for multi-file runs
with real provenance. Each card shows the input's worst status, counts and a
proportion bar.

**Feature matrix** — the Details table with one row per feature and one count
column per status present in the run, plus total and duration.

**Scenario outline** — a Gherkin scenario template with an Examples table.
Tolkira renders one outline section per executed outline with examples in
Messages input.

**Examples block** — one Examples table under a scenario outline, with its own
name, tags and description. An outline can have several.

**Example row** — one executed row of an examples block, labelled
`#<examples>.<example>` in the report. Each row keeps its own outcome,
attachments and anchor.

**Executed scenario** — a scenario whose selected test case reported at least
one raw step result, including a hook result. Only executed scenarios appear in
scenario counts, percentages, bars, triage and the Details matrix.

**Unexecuted scenario** — a scenario whose selected test case started but
reported no raw step result, including a started-but-unfinished case. It stays
visible without an outcome, keeps `status: "unknown"` and `executed: false` in
the summary, and leaves every count surface. A never-started pickle produces no
row at all.

**Rule** — a Gherkin grouping of scenarios and outlines under a named business
rule. The report renders a rule section with its keyword, name, description and
tags; scenarios stay inside their rule.

**Background** — shared setup steps for a feature or rule. Cucumber compiles
them into each pickle, so the report keeps the steps in the scenario step lists
and renders only the background heading and description once, when present.

**Own tag** — a tag written on the scenario itself; for an outline row, the
examples-block tags. A standalone scenario row shows its own tags. Outline
scenario tags appear on the outline heading and examples tags on the examples
heading; example rows show no tags.

**Inherited tag** — a feature or rule tag carried into a pickle. It stays
available to the tag filter and search but is not repeated on every row.

**Hook** — a Cucumber before/after function around a scenario or step. The
report shows per-scenario hooks separately from steps.

**Test-run hook** — a BeforeAll/AfterAll function around the whole run. It
appears in the report's Hooks section, not inside a scenario.

**Step diagnostic** — the block inside an undefined or ambiguous step. It
always shows the status lead and adds suggestion snippets or matching step
definitions when the Messages input provides them.

**Snippet** — the suggested step-definition code from a Messages `suggestion`
envelope, shown escaped inside an undefined step.

**Step definition match** — a `stepDefinition` pattern and its `uri:line`
source reference, shown inside an ambiguous step.

**Auto-expansion** — the report opens features and executed scenarios whose
status is not `passed` by default. Passed scenarios stay collapsed unless they
carry an image; unexecuted rows stay collapsed and show no outcome. A feature
whose scenarios are all unexecuted — or that contains an unexecuted row — opens
so the row stays visible without an outcome. Text search still opens at most 20
rows.

**Provenance** — the input file a feature came from. Tolkira only uses it when
the feature URI belongs to exactly one input; shared or missing provenance
renders a flat report.

**Summary** — the stable, renderer-independent JSON document emitted by
`--json` / `summarizeReport` for agents and CI. It is versioned and is not the
HTML report.

**Schema version** — the integer in `summary.schemaVersion`. A breaking change
increments it; consumers may reject versions they do not know.

**Fixture** — a small, real or realistic input file used by tests.

**Vertical slice** — a small end-to-end change: input → normalise → render →
output, with tests.

**Gate** — the required checks before merge: typecheck, lint, tests, build,
browser test.

**Blind review** — reviewers receive the spec and diff, not the implementer's
self-report.

**SCR** — Spec-Compliance Reviewer.

**CR** — Code Reviewer.

**DAR** — Documentation & Agent-Readability Reviewer.

**SEC** — Security Reviewer, triggered for input parsing, attachments, HTML
injection and file output.

**ISTQB edge cases** — test design using equivalence partitioning, boundary
values, decision tables and state transitions.
