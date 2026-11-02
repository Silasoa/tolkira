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

**Renderer** — the official Cucumber React components / HTML formatter that draw
Gherkin, steps, errors and attachments.

**Shell** — Tolkira's own wrapper around the renderer: title, metadata, summary,
theme, logo.

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
