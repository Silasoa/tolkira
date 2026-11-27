# Glossary

**Tolkira** — the project and CLI. Coined from Scandinavian *tolk*
(interpreter).

**Report** — one self-contained HTML file generated from one or more test
result inputs.

**Static report** — the opt-in `--static` / `static: true` form of the report.
It contains no `<script>`, client-message block, tab bar or lightbox, opens
every `<details>`, stacks Report, Details and Trends as visible sections and
omits the search/status/tag filters and copy controls. It keeps the
`report-view`, `analysis-view` and `trends-view` IDs and exactly one `<main>`;
the default report without a Trends section gains no static or Trends markup,
and the release-wide 170 B measured scroll-offset script is separate; a default
report with two or more history runs gains the Trends shell CSS. Bookmarked
`?query=`/`?hide=`/`?tag=` URLs show the full report because no script restores
them, and it does not repair CSS or `data:` images blocked by a host CSP.

**Early input warning** — the advisory CLI stderr line written before parsing
when the resolved input files total at least 50 MiB (52,428,800 bytes). It
counts each resolved path once; identical content under two paths counts twice.
It reads no content, names no path and changes no output or exit code. The
post-render `--max-size` warning measures the finished report and the loader's
content-deduped input instead, so the two totals can differ.

**Locale catalog** — the flat, sorted ICU message file for one report language
under `src/i18n/locales/`; English carries descriptions and is the fallback.
The generated `src/i18n/catalogs.ts` is what the renderer imports. See
[`docs/I18N.md`](docs/I18N.md).

**Report locale** — the requested language tag (`en` or `de`, optionally
regional such as `de-AT`) resolved once per report. It sets `<html lang>` and
`dir`; `de-AT` uses the `de` catalog. It never affects test data, the JSON
summary or CI text.

**Client messages** — the `client.*` subset of the active catalog, embedded as
an inert JSON block in every report so search, filters and copy labels are
localized without shipping a non-English catalog in the browser bundle. The
block is the client's only message source: a missing block or key shows the key,
and the old English fallback map is gone.

**German report terms** — the approved sheet for the `de` catalog:

| English | German |
| --- | --- |
| Report | Bericht |
| Details | Details |
| Trends | Trends |
| Scenario | Szenario |
| Step | Schritt |
| Attachment | Anhang |
| Run | Lauf |
| Passed | Bestanden |
| Failed | Fehlgeschlagen |
| Skipped | Übersprungen |
| Pending | Ausstehend |
| Pass rate | Erfolgsquote |
| Test time | Testzeit |
| Feature | Feature |
| Hook | Hook |
| Flaky | flaky |
| Flaky share | Flaky-Anteil |
| Rule | Rule |
| URI | URI |
| Baseline | Baseline |
| New failure | Neuer Fehler |
| Fixed | Behoben |
| Still failing | Weiterhin fehlgeschlagen |
| Not in this run | Nicht in diesem Lauf |
| Ambiguous group | Mehrdeutige Gruppe |
| Incident | Zwischenfall |
| What happened | Was passiert ist |
| Shown above | Oben angezeigt |
| Run failed | Lauf fehlgeschlagen |
| Needs attention | Aufmerksamkeit nötig |

The address form is impersonal; avoid `du` and `Sie`. The full
`Fehlgeschlagen` chip is used and wraps; there is no short form. `de` is the
generic catalog and `de-AT` uses it. Final copy also uses `Laufzeit` for
runtime, `Lauf-Hooks` for run-level hooks in the test-time notes,
`Aufgezeichnet am` for the recorded-at column, `Basisverzeichnisse` for the
allowed roots and `Fehlerdetails kopieren` for the copy-failure action.

**Legacy JSON** — the older Cucumber JSON output format. Implementation-specific
and lossy, but still widely used.

**Messages / Envelopes** — Cucumber Messages, the modern NDJSON envelope stream
used by official Cucumber implementations.

**Attachment** — a binary or text artefact attached to a test step, scenario or
hook. Screenshots are attachments.

**Attachment fallback name** — the deterministic `attachment.<ext>` name used
when an attachment has no Cucumber `fileName`. Known parameterised media types
keep their extension; unknown types normalise to `application/octet-stream` and
`attachment.bin`.

**Allowed root** — one of the places Tolkira may read a Playwright path
attachment from: the input file's folder and the process working directory.
Both are resolved to real paths; a target outside every allowed root is not
read.

**Skipped attachment** — a Playwright final-attempt path attachment that is not
embedded because it is non-local (URL, UNC or device path), missing, unreadable,
not a regular file, or resolves outside every allowed root. It is not embedded,
counts once in `generateReport().skippedAttachments`, and drives the report
run-level count notice, up to three sanitized attachment name/reason entries per
scenario and the CLI stderr warning. Trace zips, earlier attempts and inline
bodies that win over their path are skipped without being counted.

**Flaky / @flaky** — a scenario tagged `@flaky`, either by the Playwright
adapter when a retry passes or by a user on a scenario, feature, rule or outline.
The report shows a decorative badge and a run-metadata `N tagged @flaky` count;
the history sidecar adds an optional per-run `flaky` count and Trends shows
`Flaky` and `Flaky share`. Both are display-only, never a computed flake
probability or status, and the scenario keeps its existing status in the JSON
summary, CI and email.

**Flaky share** — the Trends percentage `flaky / attempted`, where attempted is
total minus skipped; it shows `—` when nothing was attempted or the run predates
the field, and a positive share below 0.1% shows a less-than boundary rather
than 0%. The count is executed, non-skipped scenarios tagged `@flaky` (any final
status) or passed after at least one retry, so it can differ in either direction
from the run-metadata tag-only count. It is a flagged share, not a flake
probability; legacy JSON has no attempts and is tag-only.

**CI metadata** — the optional Messages `meta.ci` block: CI name and URL plus
git remote, revision, branch and tag. It renders in the HTML header and Details
and never in the JSON summary.

**ANSI log** — a `text/x.cucumber.log+plain` attachment. Tolkira renders its SGR
colours, including 256-colour and truecolour, strips other control sequences and
offers a copy action.

**Embedding** — the legacy JSON representation of an attachment (`embeddings[]`).

**Adapter** — code that turns an input format into Cucumber Messages.

**Stream adapter** — `CucumberHtmlStream`, a shape-compatible Node `Transform`
that accepts Messages envelopes and renders one HTML document on flush with
`RenderReportOptions`. It buffers the run; it is not an incremental renderer.

**Zero-test JUnit document** — a well-formed JUnit XML document with no
`<testcase>` element anywhere, for example a Surefire suite skipped because a
service such as Docker is missing. It is not a zero-byte file, which still fails
as invalid XML. A zero-test document is skipped when it comes from a directory
scan and rejected when it is named explicitly; the skip needs exactly one
recognised root and no `<testcase>`, so a wrapper root or a multi-root document
still fails.

**Parameter highlighting** — wrapping the fragments matched by a single
`stepMatchArgumentsLists` entry in `span.param`, labelled with the Cucumber
parameter type. It is cosmetic and does not change step text or the summary.

**Normalisation** — converting legacy JSON into Messages so one renderer can
handle both.

**Renderer** — Tolkira's server-side report renderer: it turns the report model
into HTML, CSS and a small script. It is part of Tolkira, not an upstream React
component tree.

**Shell** — Tolkira's own wrapper around the renderer: title, metadata, summary,
theme, logo.

**Triage index** — the "Needs attention" block above the feature list. It shows
non-passing features with counts and up to three scenario links; five rows are
visible and up to fifteen more sit behind a disclosure. Its first incident link
points at the incident panel; the rest point at their scenario rows.

**Incident panel** — the tinted, full-border block below the toolbar and above
the baseline and triage for the first executed scenario in the ordered list
whose final status is `failed`, `undefined`, `ambiguous` or `pending`. It names
the feature, scenario, status, first failing step or diagnostic lead, the first
error line, tags, source, attempt, start and baseline badge, then reuses the
existing scenario detail. It is server-rendered, stays visible under every
toolbar filter and has no call to action into the filtered index. `skipped` and
`unknown` alone do not trigger it.

**Incident row link** — the index row of the scenario resolved by the incident
panel. It keeps its status, name, tags, thumbnail, duration and `scenarioId`
anchor but replaces the disclosure with a localized `Shown above` link to the
panel, so the detail is rendered once. Other non-passing rows keep their native
disclosure.

**Source strip** — per-input cards above the feature list for multi-file runs
with real provenance. Each card shows the input's worst status, counts and a
proportion bar.

**Feature matrix** — the Details table with one row per feature and one count
column per status present in the run, plus total and Scenario time.

**Scenario outline** — a Gherkin scenario template with an Examples table.
Tolkira renders one outline section per executed outline with examples in
Messages input.

**Examples block** — one Examples table under a scenario outline, with its own
name, tags and description. An outline can have several.

**Example row** — one executed row of an examples block, labelled
`#<examples>.<example>` in the report. Each row keeps its own outcome,
attachments and anchor.

**Executed scenario** — a scenario whose selected test case reported at least
one raw step result, including a hook result. Adapters represent a reported skip
without steps as a synthetic skipped step, so the summary reports it as
executed. Executed scenarios appear in scenario counts, bars, triage and the
Details matrix.

**Skipped scenario** — an executed scenario whose final reported status is
`skipped`, for example a statically skipped test with no step results. It stays
in counts, status pills, filters and bars, but it is not a pass attempt.

**Attempted pass rate** — the pass percentage over attempted scenarios:
executed results whose status is not `skipped`. Counts and bars include skipped;
the Report and Details health, the feature pass text and the Trends table do not.
A run with results but no attempt states `No scenarios attempted`; Trends shows
`—` for that run.

**History file / sidecar** — the optional UTF-8 JSON file passed with
`--history <file>`. It keeps the newest configured history window (default 30)
in schema version 1 or 2 and is read, appended and written atomically by the
CLI. Without the flag no history is read or written.

**History window** — the newest n aggregate runs read, appended, written and
rendered in Trends. The history limit sets it: 1 to 365, default 30.
Lowering it is destructive on the next successful write; raising it later does
not restore dropped runs.

**History limit** — the `--history-limit <n>` value or `generateReport`
`historyLimit` option that sets the history window. It needs `--history` on the
CLI, accepts a decimal integer from 1 to 365 and defaults to 30; an invalid
value is a usage error and writes nothing.

**History schema 1 / 2** — the sidecar schema version. Both versions store the
same run fields; version 2 only marks a file that may hold more than 30 runs.
The writer keeps a schema-1 file at 1 for a default run, writes 2 when the
window is above 30 or the file already used 2, and never downgrades. Readers
accept both; a 0.5 reader rejects schema 2 with
`unsupported schema version "2"` and leaves the file untouched.

**History run** — one aggregate entry in the history file: id, recorded time,
resolved title, overall status, feature/scenario/step counts, duration,
attachment totals and the optional flaky count. It never carries scenario names,
step text, paths, tags or attachment content.

**Run manifest** — the opt-in `--manifest <file>` JSON document (schema 1) with
the run status, counts, attachments, skipped-attachment count, the files written
before it and the first 10 failures. It carries no timestamp or input path, is
written last and atomically with mode `0600`, and its artifact paths are
relative to the manifest file except the absolute cross-drive fallback.

**CLI plan / execute** — the internal CLI seam. `planCli(argv)` validates argv
and filesystem facts into a `CliPlan` (mode, paths, options, write order, stdout
ownership, exit policy) or a structured usage failure, and never writes or
prints; the `--help`/`--version`/`--capabilities` action arm has no plan.
`executePlan(plan, io)` owns all reads, writes, warnings and stdout, returns 0
or 1 and writes the fixed sequence that `plan.writes` mirrors; usage formatting
and the action bytes stay in `src/cli.ts`. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Capabilities document** — the input-free `tolkira --capabilities` JSON
document (schema 1) with the version, Node range, accepted inputs, file outputs
and JSON summary, CI formats, summary schema, locales, limits, defaults and exit
codes. It is
deterministic, under 4,096 bytes and sourced from the enforcing constants.

**Aggregate id** — the SHA-256 in a history run. It hashes the aggregates,
including the optional flaky count, and the title but not the recorded time, so
an identical rerun is not appended and keeps the old timestamp.

**Trends view** — the optional third tab, rendered when a report is generated
with two or more runs in the history window. It lists those runs newest first
with pass rate, flaky count and flaky share and adds a decorative pass-rate
sparkline oldest to newest; the table is the accessible source, and a note
states the tag-or-retry proxy limits.

**Baseline** - the read-only earlier schema-2 `--json` summary passed with
`--baseline <file>`. It is never rewritten and its path is never embedded; the
report and summary do embed its feature/scenario names and URIs. It is capped at
10 MiB (10,485,760 bytes). There is no title or timestamp field, so the two
artifacts are linked by the command. The CLI is the only reader; the API accepts
the validated `BaselineSummary` projection. One baseline belongs to one suite and
variant, and a sharded run compares the merged run. `renderHtml` and
`CucumberHtmlStream` do not take a baseline in 0.6.0.

**Baseline comparison** - the one result built from a baseline and the current
run: the summary block with seven counts and the capped `notInThisRun` list, and
a change map keyed by the report model's pickle id. It feeds the JSON block and
per-scenario `change`, the HTML panel and badges, and the Markdown CI line.

**Baseline identity** - feature name + scenario name, then the outline example
coordinate when every row on both sides carries it, then the display URI for the
genuinely unmatched remainder. A group that cannot be reduced to unique rows is
ambiguous and makes no claim; pickle id, order, line, tags, step text and status
are never identity.

**Change** - the per-scenario baseline classification: `new-failure`, `fixed`,
`still-failing` or `added`. Unchanged, no-claim, unexecuted and ambiguous rows
have no `change`. **New failure** means the row fails now and did not fail in the
baseline, including a scenario new to the suite; there is no separate regressed
class.

**Not in this run** - a baseline scenario with no current match in this summary.
It is counted in `notInThisRun`, listed in the panel (at most 10 entries) and in
the summary (at most 50, sorted by feature, name, example coordinate and URI).
The count stays complete. The class means absent here (deleted, never started,
filtered or another shard), not a claim of deletion.

**Ambiguous group** — a repeated feature + scenario name that cannot be paired
uniquely by example coordinate or display URI. No row in the group is paired,
classified, counted in the tracked counts or listed as not in this run, and the
group counts once in `ambiguous`.

**Unexecuted scenario** — a scenario whose selected test case started but
reported no raw step result, including a started-but-unfinished case. It stays
visible without an outcome unless the failed-only preset is active, keeps
`status: "unknown"` and `executed: false` in the summary, and leaves every count
surface. Any attachment emitted for it is dropped. A never-started pickle
produces no row at all.

**Failed-only preset** — the toolbar toggle that turns off every other present
status chip and adds the `unexecuted` sentinel, so only failed scenarios remain.
It is pressed only for the exact preset chip state, disappears when it could hide
nothing, and any manual chip change clears the sentinel. Header counts and the
`N unexecuted` label stay unchanged.

**`hide=unexecuted`** — the URL value for the failed-only preset's sentinel. It
is not a status and has no chip: it hides rows without an outcome and is restored
only together with the preset chip state. It is dropped unless it is the exact
preset state (failed with unexecuted rows and no other status).

**Rule** — a Gherkin grouping of scenarios and outlines under a named business
rule. The report renders a rule section with its keyword, name, description and
tags; scenarios stay inside their rule.

**Background** — shared setup steps for a feature or rule. Cucumber compiles
them into each pickle, so the report keeps the steps in the scenario step lists
and renders only the background heading and description once, when present.

**Description** — free-text Markdown under a feature, rule, background,
scenario, outline or examples block. The report renders a safe GFM subset in a
block container; images become alt text and raw HTML stays escaped.

**Tag expression** — the official Cucumber boolean tag query (`@a and not @b`,
`or`, `not`, parentheses, escaped tags). The search box uses it only when the
whole query is tag-shaped; mixed text and tags fall back to substring search.

**Tag overview** — the Details panel with one row per tag and its executed
scenario, failed and skipped counts. It counts inherited feature, rule and
examples tags once per executed row, sorts failing tags first, then by scenario
count and fixed code-unit order, and caps at 50 rows with the complete tag
count. It ignores the toolbar filter and adds no panel when no rendered row
carries a tag.

**URL state** — the shareable `?query=`, repeated lowercase `?hide=` and `?tag=`
parameters, including the `hide=unexecuted` pseudo-status. The report restores
them and updates them with `replaceState` without adding history entries.

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
status is not `passed` by default, except the incident row, whose detail lives
in the open incident panel. Passed scenarios stay collapsed unless they
carry an image; unexecuted rows stay collapsed and show no outcome. A feature
whose scenarios are all unexecuted opens; a mixed feature does not open just
because it contains an unexecuted row. The toolbar controls expand or collapse
scenario rows and leave the incident panel open. Text search and a valid tag
expression still open at most 20 rows.

**Provenance** — the input file a feature came from. Tolkira only uses it when
the feature URI belongs to exactly one input; shared or missing provenance
renders a flat report.

**Summary** — the stable, renderer-independent JSON document emitted by
`--json` / `summarizeReport` for agents and CI. It is versioned and is not the
HTML report. A Messages outline row carries an unconditional `example`
coordinate; with a baseline the document also gains the `baseline` block and
per-scenario `change`.

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
