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
