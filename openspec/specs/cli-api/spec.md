# cli-api Specification

## Purpose
Defines the command-line and programmatic entry points for generating a Tolkira
report and their error and exit-code behaviour.

## Requirements

### Requirement: Generate a report from the CLI

The CLI SHALL accept one or more input files or directories and either an
output path or `--json`, and SHALL produce one HTML report and/or one summary.
With `--static`, the CLI SHALL require `--out` or `--pdf`; `--json` alone SHALL
NOT be a report surface.

#### Scenario: Single input

- **WHEN** the user runs the CLI with one supported input and an output path
- **THEN** the CLI writes the HTML report to that path

#### Scenario: Multiple inputs

- **WHEN** the user runs the CLI with multiple supported inputs
- **THEN** the CLI writes one report containing all results

#### Scenario: Directory input

- **WHEN** the user runs the CLI with a directory
- **THEN** the CLI includes every supported report file in that directory

#### Scenario: Static report surface

- **WHEN** `--static` is used with `--json` and without `--out` or `--pdf`
- **THEN** the CLI exits 2 and names `--out` or `--pdf`
- **AND** nothing is written

### Requirement: Use stable exit codes

The CLI SHALL return exit code 0 on success, 1 on parse or render failure and 2
on usage errors. Failing test results SHALL NOT fail report generation.

#### Scenario: Failing tests still generate a report
- **WHEN** the input contains failed test results but is otherwise valid
- **THEN** the CLI writes the report and exits with code 0

#### Scenario: Malformed input
- **WHEN** the input cannot be parsed
- **THEN** the CLI exits with code 1 and writes no partial report

#### Scenario: Missing arguments
- **WHEN** the user omits a required argument
- **THEN** the CLI exits with code 2 and prints usage

### Requirement: Expose a programmatic API

Tolkira SHALL expose a programmatic API that accepts the same inputs as the CLI
and returns the generated HTML or summary. The API SHALL NOT write files.

#### Scenario: API returns HTML
- **WHEN** a caller invokes the API with a supported input
- **THEN** the API returns the report HTML without requiring a file write

#### Scenario: API reports errors
- **WHEN** a caller invokes the API with malformed input
- **THEN** the API rejects with a clear error

### Requirement: Provide a machine-readable summary

The CLI SHALL support `--json` and print exactly one stable JSON document to
stdout. The summary SHALL contain the overall status, status counts, duration,
attachments and per-scenario results. The programmatic API SHALL expose the
same summary without writing HTML. With `--static`, the JSON summary SHALL still
print when `--out` or `--pdf` is present; `--static --json` without either SHALL
be a usage error (2).

#### Scenario: JSON summary without HTML

- **WHEN** the user runs the CLI with one or more supported inputs and `--json`
  without `--out`
- **THEN** the CLI prints the JSON summary and writes no HTML file

#### Scenario: JSON summary with HTML

- **WHEN** the user runs the CLI with `--out` and `--json`
- **THEN** the CLI writes the HTML report and prints only the JSON summary to
  stdout

#### Scenario: Failing tests in the summary

- **WHEN** the input contains failed scenarios
- **THEN** the summary reports `status: "failed"`, the failing scenario and its
  step messages, and the CLI still exits with code 0

#### Scenario: Stable schema

- **WHEN** the input is summarized more than once
- **THEN** scenarios are ordered deterministically and every status key is
  present with a numeric value, including zero counts

#### Scenario: Static JSON

- **WHEN** `--static --out report.html --json` is used
- **THEN** the JSON stdout is unchanged
- **AND** the report is the static form

#### Scenario: Static JSON without a report surface

- **WHEN** `--static --json` is used without `--out` or `--pdf`
- **THEN** the CLI exits 2 and names `--out` or `--pdf`
- **AND** nothing is written

### Requirement: Support title, metadata and output options

The CLI SHALL support a report title, repeated metadata entries, a logo, an
accent colour, a size warning threshold, help and version output. The API SHALL
support title, metadata, logo and accent. The CLI SHALL require at least one of
`--out` or `--json`. With `--static`, the CLI SHALL require `--out` or `--pdf`
instead of accepting `--json` alone.

#### Scenario: Title and metadata

- **WHEN** the user supplies a title and metadata entries
- **THEN** the generated report contains the escaped title and metadata

#### Scenario: Help

- **WHEN** the user requests help
- **THEN** the CLI prints usage and exits successfully

#### Scenario: Static output surface

- **WHEN** `--static` is used with only `--json`
- **THEN** the CLI exits 2 and names `--out` or `--pdf`

### Requirement: Do not leave partial output

On failure, the CLI SHALL remove or avoid a partial output file.

#### Scenario: Render failure
- **WHEN** rendering fails after the output path was opened
- **THEN** no partial report remains at the output path

### Requirement: Stream Cucumber Messages into a report

The package SHALL export `CucumberHtmlStream`, a Node `Transform` that accepts
Cucumber Messages `Envelope` objects in object mode. It SHALL collect the
envelopes, render one HTML document on flush and emit it as a string chunk. It
SHALL accept the same `RenderReportOptions` as `renderReport` and SHALL
produce the same HTML for the same envelopes and options. It SHALL NOT write
files.

#### Scenario: Stream output matches the file API

- **WHEN** a caller pipes the envelopes of one Messages input through
  `CucumberHtmlStream` with a title
- **THEN** the collected output equals `renderReport` for that input and title

#### Scenario: Stream options

- **WHEN** a caller passes title, metadata, logo or accent to the constructor
- **THEN** the rendered HTML contains the same escaped values as the file API
- **AND** missing options use the API defaults

#### Scenario: Streaming error

- **WHEN** rendering fails during flush
- **THEN** the stream emits that error
- **AND** no partial HTML is presented as a complete report

### Requirement: Warn on stderr about skipped attachments

When the CLI writes HTML and the run skipped path attachments, the CLI SHALL
write one warning line to stderr after the file write succeeds, next to the size
warning. It SHALL keep stdout content, the JSON document, the CI text and exit
codes unchanged. `generateReport` SHALL expose the count as
`skippedAttachments`.

#### Scenario: HTML with skipped attachments

- **WHEN** the CLI writes an HTML report and the run skipped path attachments
- **THEN** stderr contains one warning line with the count and a placement hint
- **AND** stdout keeps its normal report confirmation

#### Scenario: HTML with JSON

- **WHEN** the CLI writes HTML with `--out` and also prints `--json`
- **THEN** the warning goes to stderr
- **AND** stdout contains only the JSON summary

#### Scenario: JSON only

- **WHEN** the CLI runs with `--json` and no HTML
- **THEN** stdout contains only the JSON summary
- **AND** the summary shape is unchanged
- **AND** no warning is written

#### Scenario: No skipped attachments

- **WHEN** no path attachment was skipped
- **THEN** no warning is written

### Requirement: Emit GitHub Actions annotations

Tolkira SHALL format the stable report summary as GitHub Actions workflow
commands. Failed, undefined and ambiguous scenarios SHALL produce error
annotations; skipped, pending and unknown scenarios SHALL produce notice
annotations; unexecuted scenarios SHALL be counted separately. A final notice
SHALL report every non-zero status bucket and the unexecuted count. Values
SHALL be escaped for the workflow-command grammar.

#### Scenario: Failed scenario annotation

- **WHEN** the summary contains a failed scenario with a feature, name and URI
- **THEN** the output contains an error annotation with that identity
- **AND** the first failure message is included when present
- **AND** the annotation is not treated as HTML

#### Scenario: Skipped and empty runs

- **WHEN** the summary contains skipped scenarios or no scenarios
- **THEN** skipped scenarios produce notice annotations
- **AND** an empty run produces a single “No scenarios” notice

#### Scenario: Non-passing status coverage

- **WHEN** the summary contains undefined, ambiguous, pending or unexecuted
  scenarios
- **THEN** undefined and ambiguous are error annotations
- **AND** pending is a notice annotation
- **AND** unexecuted scenarios are counted in the final notice
- **AND** the final notice contains every non-zero status bucket

#### Scenario: Escaping

- **WHEN** a scenario name or failure message contains `%`, `:`, `,`, CR or LF
- **THEN** property values escape `%`, CR, LF, `:` and `,`
- **AND** message text escapes only `%`, CR and LF
- **AND** the output remains one workflow command per line

#### Scenario: Annotation injection is data

- **WHEN** a scenario name or message contains `\n::error title=x::`
- **THEN** it remains part of the original annotation
- **AND** it cannot create a second workflow command

#### Scenario: Annotation cap

- **WHEN** more than 50 error scenarios (failed, undefined or ambiguous) are
  present
- **THEN** at most 50 error annotations are emitted
- **AND** a notice states how many more were omitted
- **AND** the final count notice keeps the exact failure count

### Requirement: Emit a Markdown CI summary

Tolkira SHALL format the summary as deterministic Markdown with counts, a
failed-scenario list, skipped counts and an empty-run message. Dynamic text
SHALL render as inert code spans or fenced blocks, never active links, images
or raw HTML. Failure messages SHALL remain verbatim and unredacted; docs SHALL
state that secrets must be handled by the CI provider.

#### Scenario: Failed and skipped counts

- **WHEN** the summary has passed, failed and skipped scenarios
- **THEN** the Markdown contains the scenario counts and the failed scenarios
- **AND** dynamic names, URIs and messages are inert code, not active markup
- **AND** `--title` controls the heading

#### Scenario: Empty run

- **WHEN** the summary has no scenarios
- **THEN** the Markdown says that no scenarios were reported
- **AND** it still contains zero counts

#### Scenario: Bounded output

- **WHEN** many scenarios fail or a message is very long
- **THEN** the Markdown failed list is capped at 50 scenarios and 500 raw
  characters per message, with the omission stated
- **AND** the GitHub mode caps at 50 error and 20 notice annotations with a
  notice for the remainder
- **AND** the counts remain complete
- **AND** truncation happens on raw text before escaping

### Requirement: Add a CI CLI mode

The CLI SHALL accept `--ci github|azure|markdown` and optional
`--ci-out <file>`. `--ci-out` SHALL be valid only with `--ci markdown`.
`--ci` SHALL not require `--out`; without `--ci-out`, CI text goes to stdout.
Exit codes SHALL remain unchanged by annotation content.

#### Scenario: CI without HTML

- **WHEN** the user passes `--ci github` or `--ci azure` without `--out`
- **THEN** the CLI summarises the inputs and writes annotations to stdout
- **AND** no HTML file is written

#### Scenario: CI with HTML

- **WHEN** the user passes `--out report.html --ci markdown`
- **THEN** the HTML report is written
- **AND** the Markdown summary is written to stdout or `--ci-out`

#### Scenario: Output-file safety

- **WHEN** `--ci-out` is used
- **THEN** the CI text is written atomically to a standalone file
- **AND** the path must not overwrite an input, the logo or the `--out` file
- **AND** the collision is rejected even when neither file exists yet

#### Scenario: CI text is not mixed with human output

- **WHEN** `--ci` is used without `--json` and without `--ci-out`
- **THEN** stdout contains only the CI text
- **AND** the human “Report written to …” line is not printed

#### Scenario: Ambiguous stdout is rejected

- **WHEN** `--json` and `--ci` are combined without `--ci-out`
- **THEN** the CLI exits with a usage error
- **AND** for `azure` or `github` the error does not suggest `--ci-out`
- **AND** no partial output or report is written

#### Scenario: Invalid combination

- **WHEN** `--ci` has an unknown value, the value is case-mismatched,
  `--ci-out` is used without `--ci markdown`, or `--ci github`/`--ci azure` is
  combined with `--ci-out`
- **THEN** the CLI exits with a usage error
- **AND** the error names the invalid option
- **AND** validation happens before any HTML or CI file is written

### Requirement: Keep CI formatting offline and deterministic

The formatter SHALL make no network request, read no remote asset and emit the
same text for the same summary and options. It SHALL not change the report
summary schema or the HTML report.

#### Scenario: Repeatable output

- **WHEN** the same inputs and `--ci` mode run twice
- **THEN** the CI text is byte-identical

#### Scenario: No network

- **WHEN** `--ci` runs
- **THEN** it uses only the in-memory summary
- **AND** it makes no HTTP, Git or telemetry request

### Requirement: Document CI usage

The repository SHALL document GitHub Actions and GitLab examples, including
stdout annotations and `$GITHUB_STEP_SUMMARY`/`--ci-out` usage.

#### Scenario: Copyable examples

- **WHEN** a CI engineer opens `docs/CI.md`
- **THEN** the GitHub and GitLab commands are copyable
- **AND** the exit-code and no-network behavior is stated

### Requirement: Keep an opt-in run history

The CLI SHALL accept `--history <file>` and `--history-limit <n>` and keep an
aggregate run history in that sidecar. It SHALL read, append and write
atomically, keep the newest configured number of runs (default 30, range 1 to
365), and reject corrupt, oversized or unsupported files before writing. The
reader SHALL accept schema version 1 and 2; the writer SHALL write schema 1 for a
default run on a schema-1 file and schema 2 when the limit is above 30 or the
file already uses schema 2. A missing file starts empty. An identical last run
SHALL NOT be duplicated. Without the flag no history is read or written and no
history data enters the report.

#### Scenario: First run creates the sidecar

- **WHEN** `--history` points to a missing file, `--out` is set and the limit is
  the default 30
- **THEN** the file is created with schema version 1 and one run entry
- **AND** the report is written normally
- **AND** the first run has no Trends tab

#### Scenario: Second run appends

- **WHEN** the sidecar already has entries and another report is generated with
  the same flag
- **THEN** the new run is appended
- **AND** the Trends view receives both entries

#### Scenario: Identical last run is not duplicated

- **WHEN** the last entry has the same aggregate id as the current run, even
  with a different recorded time
- **THEN** the file keeps one copy with the old timestamp
- **AND** the report still renders

#### Scenario: Retention

- **WHEN** the file already has more entries than the configured window, or 30
  entries with the default
- **THEN** the newest configured number of runs is read
- **AND** the current run is appended unless it dedupes
- **AND** the newest configured number of runs is kept, so 31 entries with a
  limit of 40 store 32 and 40 entries with a limit of 40 store 40
- **AND** the file never grows past the configured window

#### Scenario: Configured window

- **WHEN** `--history-limit 5` is used with seven existing entries
- **THEN** the newest five are read
- **AND** the current run is appended unless it dedupes
- **AND** the report renders five Trends rows and the file stores five

#### Scenario: Missing and invalid files

- **WHEN** the file is missing
- **THEN** generation succeeds with an empty history
- **WHEN** the file is not valid JSON, has a schema version other than 1 or 2,
  exceeds the sidecar size cap, or has a malformed entry (bad ISO time,
  non-finite or negative count)
- **THEN** the CLI exits with code 1 and a message naming the file
- **AND** the file is not overwritten

#### Scenario: History requires HTML

- **WHEN** `--history` is used without `--out`
- **THEN** the CLI exits with a usage error naming both options
- **AND** nothing is written

#### Scenario: Path safety

- **WHEN** `--history` resolves to an input, the logo, `--out`, `--pdf`,
  `--email`, `--ci-out`, `--baseline`, or a path inside an input directory
  (even when the file does not exist yet)
- **THEN** the CLI exits with a usage error
- **AND** nothing is written

`--baseline` is owned by the `0.6-baseline-comparison` change. Until that flag
lands the CLI cannot receive it; the row names the final 0.6.0 state, and the
same note is kept in both changes' tasks.

#### Scenario: History write failure

- **WHEN** the sidecar cannot be written after a successful report
- **THEN** the CLI exits with code 1 and a message naming the file
- **AND** the already written HTML file stays in place
- **AND** no partial sidecar is left behind

#### Scenario: No history flag

- **WHEN** `--history` is absent
- **THEN** no history file is read or written
- **AND** no history data or Trends tab enters the report
- **AND** the Report and Details views are unchanged (only the shared client
  bundle and stylesheet may differ)

### Requirement: Document the history schema

The sidecar SHALL use `schemaVersion: 1` for a default write on a schema-1 or
missing file and `schemaVersion: 2` when the limit is above 30 or the target file
already uses version 2. Readers SHALL accept version 1 and 2 and reject any other
version. Entries SHALL use `id`, `recordedAt` (ISO), `title` (the resolved report
title, capped at 200 code points), `status`, `counts` (features, scenarios,
steps), `durationMs`, `attachments` (total, bytes) and an optional `flaky`
count. It SHALL NOT contain scenario names, step text, paths, tags or attachment
content. Unknown fields SHALL be ignored within a supported version. The writer
SHALL validate every stored run with the reader's field rules, SHALL reject an
`id` longer than 128 UTF-16 code units (the reader keeps accepting longer ids
from older files) and SHALL never write a file above 1,048,576 bytes. A 0.5
reader SHALL reject version 2 with its visible unsupported-version error and
leave the file untouched.

#### Scenario: Aggregate-only entry

- **WHEN** a run is recorded
- **THEN** the entry contains only the documented aggregate fields
- **AND** old entries may omit `flaky`
- **AND** the documentation shows the schema, the retention and dedupe rules,
  and that a shared report embeds the prior-run aggregates it was generated with

#### Scenario: Writer matches the reader

- **WHEN** `writeHistory` receives a run with a field the reader rejects, an id
  longer than 128 UTF-16 code units, or a serialized result above 1,048,576
  bytes
- **THEN** it throws `Cannot write history file <file>: ...` and writes nothing
- **AND** the target file, if any, keeps its bytes

#### Scenario: Schema 2 is readable by 0.6 and rejected by 0.5

- **WHEN** a schema-2 sidecar is read by 0.6
- **THEN** it is accepted and the run fields are unchanged
- **WHEN** a 0.5 reader opens the same file
- **THEN** it exits 1 with `unsupported schema version "2"` and the file is not
  rewritten

### Requirement: Add a report locale option

The CLI SHALL accept `--locale <tag>` for the HTML report. It SHALL require
`--out`, default to `en`, and apply to the report only. `--json`, `--ci` and
their outputs SHALL stay English and byte-identical. An empty or unsupported tag
SHALL be a usage error naming the supported locales.

#### Scenario: Locale with HTML

- **WHEN** `--locale de --out report.html` is used
- **THEN** the report is German
- **AND** the process exits 0

#### Scenario: Locale without HTML

- **WHEN** `--locale de` is used with `--json` or `--ci` and no `--out`
- **THEN** the CLI exits 2 and says the option needs `--out`
- **AND** stdout and files are unchanged

#### Scenario: Unsupported tag

- **WHEN** `--locale fr` is used
- **THEN** the CLI exits 2 with the supported list
- **AND** no report or history file is written

### Requirement: Expose the locale on the render API

`RenderReportOptions` and `RenderOptions` SHALL accept an optional `locale`.
`renderReport` and `CucumberHtmlStream` SHALL render the given locale and
`generateReport` SHALL pass it through. The default SHALL be `en`. The summary,
JSON keys and CI text SHALL not change.

#### Scenario: API parity

- **WHEN** `renderReport` and `CucumberHtmlStream` receive the same model and
  `locale: 'de'`
- **THEN** both produce German report HTML
- **AND** neither changes the summary or CI output

#### Scenario: Default

- **WHEN** the option is omitted
- **THEN** the HTML is English
- **AND** the existing English goldens stay valid apart from `dir="ltr"`, the
  documented client-message block, the generated script and its CSP hash

#### Scenario: Unsupported API locale

- **WHEN** `renderReport` or `CucumberHtmlStream` receives an unknown locale
- **THEN** it throws an error naming the supported locales
- **AND** no partial HTML is returned

### Requirement: Add the email output option

The CLI SHALL accept `--email <file>` and count it as an output. It SHALL
require a non-empty path and at least one input. Without `--out` it SHALL still
write the summary-only email. `--json`, `--ci` and their text SHALL stay
English and unchanged; `--ci-out` SHALL still require `--ci markdown`.

#### Scenario: Email alone

- **WHEN** `--email summary.html` is used without `--out`, `--json` or `--ci`
- **THEN** the email is written from the summary
- **AND** no report is generated
- **AND** the process exits 0

#### Scenario: Email with JSON or CI

- **WHEN** `--email summary.html --json` is used without `--out`
- **THEN** the JSON summary is printed as today
- **AND** the email is written in addition
- **AND** the JSON bytes do not change

#### Scenario: Empty path

- **WHEN** `--email ''` is used
- **THEN** the CLI exits 2 and names the missing path
- **AND** nothing is written

### Requirement: Extend the locale scope to email

`--locale` SHALL apply to the email as well as the report and SHALL be accepted
with `--email` even without `--out`. With only `--json` or `--ci`, `--locale`
SHALL stay a usage error. The CLI, JSON and CI text SHALL stay English.

#### Scenario: Localized email

- **WHEN** `--email summary.html --locale de` is used without `--out`
- **THEN** the email labels and number/date formatting are German
- **AND** no report is generated

#### Scenario: JSON-only locale

- **WHEN** `--locale de --json` is used without `--out` or `--email`
- **THEN** the CLI exits 2
- **AND** stdout is unchanged

### Requirement: Validate email paths and writes

The email path SHALL NOT equal an input, the logo, `--out`, `--ci-out` or
`--history`, or be inside an input directory even when the target does not exist.
The CLI SHALL write in the order report, email, history, `--ci-out`, stdout. On
an email write failure it SHALL exit 1 with the email path (not the temporary
name), keep an already written report, and SHALL NOT write the history/`--ci-out`
or print the JSON/CI stdout. No partial email SHALL remain.

#### Scenario: Collision

- **WHEN** `--email` resolves to an input, the logo, `--out`, `--ci-out`, the
  history file or a path inside an input directory
- **THEN** the CLI exits 2
- **AND** nothing is written

#### Scenario: Email write failure

- **WHEN** the email cannot be written after the report or summary
- **THEN** the CLI exits 1 and names the email path
- **AND** the report stays
- **AND** the history and `--ci-out` are not written and the JSON/CI stdout is
  not printed
- **AND** no partial email remains

### Requirement: Apply the email appearance options

`--title` SHALL set the email heading and suggested subject. A validated
`--accent` SHALL set the top border even without `--out`; an invalid value SHALL
be ignored.

#### Scenario: Appearance options

- **WHEN** `--email summary.html --title "Nightly" --accent #1b5e20` is used
  without `--out`
- **THEN** the email heading and suggested subject use `Nightly`
- **AND** the validated accent is the top border
- **AND** no report is generated

### Requirement: Confirm the email output

When stdout is free (the email alone or with `--out`), the CLI SHALL print
`Email written to <path>` alongside the report confirmation. When `--json` or
`--ci` uses stdout, the machine output SHALL stay unchanged and no extra email
line SHALL be added.

#### Scenario: Email alone

- **WHEN** `--email summary.html` is the only output
- **THEN** stdout says the email was written
- **AND** exits 0

#### Scenario: Machine stdout

- **WHEN** `--email summary.html --json` is used
- **THEN** stdout contains only the JSON summary
- **AND** the email is written

### Requirement: Expose renderEmail

The package SHALL export `renderEmail(summary, options)`, returning the email
HTML for a `ReportSummary`. The options SHALL include the resolved title, locale
and optional report name, a validated accent colour and the generated `Date`;
the first slice SHALL NOT accept a logo. It SHALL NOT write files, send mail or
make requests.

#### Scenario: API and CLI parity

- **WHEN** the CLI writes an email and `renderEmail` is called with the same
  summary and options and a pinned clock
- **THEN** the HTML is identical

### Requirement: Add the PDF output option

The CLI SHALL accept `--pdf <file>` as an output. It SHALL require a non-empty
path and at least one input. The PDF SHALL compose with `--out`, `--email`,
`--json`, `--ci` and `--history`, and SHALL follow the order report → PDF → email
→ history → `--ci-out` → stdout (the PDF is written before the email that names
it). A missing optional engine SHALL exit 1 with install instructions; the report
remains and the email/later outputs are skipped.

#### Scenario: PDF alone

- **WHEN** `--pdf run.pdf` is the only output
- **THEN** the report HTML is rendered in memory for the PDF without being written
- **AND** the PDF is written and the process exits 0
- **AND** stdout says the PDF was written

#### Scenario: Composition

- **WHEN** `--out report.html --email summary.html --pdf run.pdf` is used
- **THEN** the report, PDF and email are written in that order
- **AND** a PDF failure keeps the report and skips email/history/CI/stdout

#### Scenario: Missing engine

- **WHEN** the optional Playwright/Chromium engine is absent
- **THEN** the CLI exits 1 with the install instructions
- **AND** the report (if already written) stays
- **AND** no email/PDF is left partial

### Requirement: Override the PDF render deadline

The CLI SHALL accept `--pdf-timeout <ms>` only together with `--pdf`. The value
SHALL be a positive decimal integer of at most 2,147,483,647; `0`, negative
values, fractions, leading-zero forms and non-numeric values SHALL exit 2 with a
message naming `--pdf-timeout`. The value SHALL be passed to `renderPdf` as
`timeoutMs` and SHALL replace the five-minute default. `--help` and the usage
text SHALL list the option.

#### Scenario: Timeout override

- **WHEN** `--pdf run.pdf --pdf-timeout 120000` is used
- **THEN** `renderPdf` receives `{ timeoutMs: 120000 }`
- **AND** the PDF is written normally

#### Scenario: Invalid timeout

- **WHEN** `--pdf-timeout` is `0`, negative, fractional, non-numeric or above
  2,147,483,647
- **THEN** the CLI exits 2
- **AND** no PDF is written

#### Scenario: Timeout without a PDF

- **WHEN** `--pdf-timeout 1000` is used without `--pdf`
- **THEN** the CLI exits 2 and names the missing `--pdf`
- **AND** nothing is written

### Requirement: State the PDF-only scope limits

Without `--out`, the PDF-only route SHALL still export the complete archive, but
`--logo` and `--history` SHALL remain usage errors (they require a report file)
and no report HTML file SHALL be written. The email with `--pdf` and no `--out`
SHALL name the PDF as the full artifact; the PDF is written before the email.

#### Scenario: PDF-only logo or history

- **WHEN** `--pdf run.pdf --logo favicon.svg` or `--history runs.json` is used
  without `--out`
- **THEN** the CLI exits 2 and names the missing `--out`
- **AND** nothing is written

#### Scenario: Email names the PDF

- **WHEN** `--email summary.html --pdf run.pdf` is used without `--out`
- **THEN** the PDF is written before the email
- **AND** the email names `run.pdf`
- **AND** no report HTML is written

### Requirement: Extend the locale scope to the PDF

`--locale` SHALL be accepted with `--pdf` even without `--out` or `--email`.
The PDF SHALL use the report locale for text, numbers and dates; the CLI, JSON
and CI text SHALL stay English. No new catalog keys SHALL be added for the PDF.

#### Scenario: German PDF

- **WHEN** `--pdf run.pdf --locale de` is used without `--out`
- **THEN** the PDF is German
- **AND** no report file is written

#### Scenario: JSON-only locale

- **WHEN** `--locale de --json` is used without `--out`, `--email` or `--pdf`
- **THEN** the CLI exits 2
- **AND** stdout is unchanged

### Requirement: Validate PDF paths and writes

The PDF path SHALL NOT equal an input, the logo, `--out`, `--ci-out`, `--history`
or `--email`, or lie inside an input directory (canonicalized/case-aware). It
SHALL be written atomically after the report and before the email. A write or
render failure SHALL exit 1 with the PDF path, keep the report, skip the email
and later outputs, and leave no partial PDF.

#### Scenario: Collision

- **WHEN** `--pdf` resolves to an input, the logo, `--out`, `--ci-out`,
  `--history`, `--email` or a path inside an input directory
- **THEN** the CLI exits 2
- **AND** nothing is written

#### Scenario: Write or render failure

- **WHEN** the PDF cannot be written or rendered
- **THEN** the CLI exits 1 and names the PDF path
- **AND** the report stays
- **AND** the email/history/`--ci-out`/stdout outputs are skipped
- **AND** no partial PDF remains

### Requirement: Expose renderPdf

The package SHALL export `renderPdf(html, options)`, returning the PDF bytes for
the report HTML. It SHALL NOT write an output file or launch a server, SHALL use
the same optional engine and SHALL accept the same print state (all
views/details, screenshots, A4, no header/footer) plus an optional print timeout.

#### Scenario: API and CLI parity

- **WHEN** the CLI writes a PDF and `renderPdf` is called with the same HTML
- **THEN** the PDFs are equivalent for the same engine
- **AND** no file is written by the API

### Requirement: Emit Azure DevOps annotations

The CLI SHALL accept `--ci azure` and emit Azure DevOps logging commands to
stdout: `##vso[task.logissue type=error]` for executed failed, undefined and
ambiguous scenarios, `##vso[task.logissue type=warning]` for executed skipped,
pending and unknown scenarios, and a final `##[section]Tolkira: ...` line with
the exact scenario counts. It SHALL keep exit 0 and SHALL NOT emit
`##vso[task.complete]`; `type=error` commands may still fail the Azure step.
Unexecuted scenarios SHALL be counted only.

#### Scenario: Failure annotation

- **WHEN** an executed scenario fails
- **THEN** the output contains an Azure error logging command with the feature,
  scenario and first failure message

#### Scenario: Warning and final counts

- **WHEN** an executed scenario is skipped, pending or unknown
- **THEN** the output contains an Azure warning logging command with the actual
  status
- **AND** the final section line states the exact counts and unexecuted total

#### Scenario: Unexecuted run

- **WHEN** every scenario is unexecuted
- **THEN** no scenario-level warning is emitted
- **AND** the final section counts them as unexecuted

#### Scenario: Run failed without a scenario error

- **WHEN** the run status is failed but no scenario-level error was emitted
- **THEN** one Azure error command names the run failure
- **AND** the final section is marked run failed

#### Scenario: Empty run

- **WHEN** the run has no scenarios
- **THEN** the final section says no scenarios were reported

### Requirement: Keep Azure annotations bounded and inert

Azure mode SHALL cap error annotations at 50 and warning annotations at 20,
adding one omitted warning line when a cap is reached. Every dynamic annotation
message SHALL have ANSI sequences stripped and be truncated to 4000 code points
before escaping. `%`, `]`, CR, LF and Unicode line separators SHALL be escaped
so every command stays one inert line. `--ci-out` SHALL remain Markdown-only.

#### Scenario: Annotation cap

- **WHEN** more than 50 failed scenarios exist
- **THEN** at most 50 error commands are emitted
- **AND** one omitted warning line states the remainder

#### Scenario: Newline or bracket in data

- **WHEN** a scenario name or failure message contains a newline, `%` or `]`
- **THEN** the annotation remains one command line
- **AND** the text is still visible as escaped data after the agent unescapes it

#### Scenario: Long identity

- **WHEN** a feature or scenario identity is longer than 4000 code points
- **THEN** the complete dynamic annotation message is truncated before escaping

#### Scenario: ci-out rejection

- **WHEN** `--ci azure --ci-out summary.md` is requested
- **THEN** the CLI exits 2 with a usage message

#### Scenario: JSON remediation

- **WHEN** `--json --ci azure` is requested without `--ci-out`
- **THEN** the usage error says to drop one, or to use `--ci markdown` with
  `--ci-out`; it SHALL NOT suggest `--ci-out` for azure

### Requirement: Document CI packaging recipes

The CI documentation SHALL include Azure DevOps, Jenkins HTML Publisher and
sharded-report recipes. The Jenkins recipe SHALL state the stock CSP behavior
(inline CSS and `data:` images are blocked), the download-the-artifact default
and the current no-JS limit. The shard recipe SHALL show downloading shard
artifacts into separate producer directories and one Tolkira run; it SHALL warn
against mixing Cucumber and Playwright files in one directory.

#### Scenario: Jenkins recipe

- **WHEN** a reader opens the CI documentation
- **THEN** it shows a `post { always { ... } }` HTML Publisher step with
  `allowMissing`, a workspace-safe `reportDir`, the stock-CSP limitation and the
  download alternative
- **AND** it does not call a live Jenkins run tested

#### Scenario: Sharded reports

- **WHEN** a reader runs Cucumber or Playwright shards
- **THEN** the documentation shows downloading their artifacts into separate
  producer directories and one Tolkira run over them
- **AND** it distinguishes native Playwright JSON from blob `merge-reports`

### Requirement: Warn before parsing about large inputs

The CLI SHALL, after option and path validation and before parsing or rendering,
resolve the input file list once, stat the resolved files, and write one stderr
warning when their total is at least 50 MiB (52,428,800 bytes). The same
resolved list SHALL go to the scan and the loader. The warning SHALL name the
total at one decimal and the 50 MB threshold, name no path, and change no exit
code or output byte.

#### Scenario: At the threshold

- **WHEN** a valid run resolves 50 MiB of input
- **THEN** stderr contains exactly one line
  `tolkira: warning: input files total 50.0 MB, at or above the 50 MB early-warning threshold; parsing and rendering may take a while.`
- **AND** the report or summary is produced normally
- **AND** the process exits 0

#### Scenario: Below the threshold

- **WHEN** the resolved inputs total 50 MiB minus one byte
- **THEN** no early-warning line is written

#### Scenario: Directory total

- **WHEN** a directory resolves several files whose sizes sum to at least
  50 MiB
- **THEN** the warning names the summed total at one decimal
- **AND** the scan and the loader receive the same resolved file list

#### Scenario: Malformed large input

- **WHEN** a 50 MiB input cannot be parsed
- **THEN** the early input warning is written before the parse error
- **AND** the CLI exits 1 with the parse error
- **AND** no partial output remains

#### Scenario: JSON-only run

- **WHEN** `--json` is used with a large input and no report
- **THEN** stdout contains only the JSON summary
- **AND** the warning is on stderr

#### Scenario: Usage error

- **WHEN** an invalid option or a path rejected by option/path validation
  (for example an invalid `--max-size` or an output that would overwrite an
  input)
- **THEN** no early-warning line is written
- **AND** the CLI exits 2 with its usage error

A missing input is not a usage error: the loader reports it with its existing
ENOENT message and exit 1.

### Requirement: Keep the scan cheap and the limits unchanged

The scan SHALL read no file content, SHALL use the one resolved file list that
the loader also receives, and SHALL count each resolved path once. It SHALL add
no option, dependency or network request. The per-file 100 MB guard SHALL run
before the read. The total 100 MB cap SHALL apply to unique loaded content
after content dedupe and skip decisions, and its error SHALL read
`Inputs exceed 100 MB in total. Split the run into smaller inputs or reduce the attachment payload.`
The post-render report-size warning SHALL stay, and both the early warning and
the report-size warning MAY appear in one run. The early total and the
report-size warning's `input` value measure different sets (resolved file sizes
versus content-deduped loader bytes) and MAY differ.

#### Scenario: Stat-only scan

- **WHEN** the scan reads a large file whose content cannot be read
- **THEN** it reports the file size without a content read
- **AND** no parse or render is started by the scan

#### Scenario: Repeated path

- **WHEN** the same input path is passed twice
- **THEN** the scan counts it once
- **AND** the loader still reads it once

#### Scenario: Hard cap

- **WHEN** the unique loaded content exceeds 100 MB
- **THEN** the input-cap error exits 1 with
  `Inputs exceed 100 MB in total. Split the run into smaller inputs or reduce the attachment payload.`
- **AND** the early input warning does not replace that message

#### Scenario: Two identical large files

- **WHEN** two resolved files contain identical 51 MiB content and the unique
  content is below 100 MB
- **THEN** generation succeeds
- **AND** the content is loaded once
- **AND** the loader counts one input file and one copy of the bytes

#### Scenario: Skipped files do not count toward the cap

- **WHEN** a directory contains a valid report and two different 51 MiB files
  that the loader skips
- **THEN** generation succeeds
- **AND** neither skipped file counts toward the cap, `inputFiles` or
  `inputBytes`

#### Scenario: Single file over the cap before read

- **WHEN** one resolved file is larger than 100 MB, even when its content is
  malformed
- **THEN** generation fails with the input-cap error before the content is
  parsed
- **AND** no report is written

#### Scenario: Both warnings

- **WHEN** a large input also produces a report above `--max-size`
- **THEN** the early input warning and the report-size warning both appear
- **AND** the two totals may differ because they measure different sets
- **AND** the report is still written

#### Scenario: No new surface

- **WHEN** the change is complete
- **THEN** no new CLI option or dependency exists
- **AND** the scan changes no report, JSON, CI, email or history byte

### Requirement: Document the early input warning

The documentation SHALL state the 50 MiB threshold, the exact warning line and
its MB unit, that the warning is advisory, that it names no path, and that it
does not change the exit code or any output byte. It SHALL also state that the
early total and the report-size warning's `input` value can differ.

#### Scenario: Agent guide

- **WHEN** a reader opens the CLI or limits documentation
- **THEN** the early input warning, its threshold, its exact line and its
  advisory nature are stated
- **AND** the two-number difference from the report-size warning is stated
- **AND** the existing 100 MB input cap and report-size warning are still
  documented separately

### Requirement: Make the history window configurable

The CLI SHALL accept `--history-limit <n>` only with `--history`. `n` SHALL be a
decimal integer from 1 to 365; the default SHALL be 30. The limit SHALL bound
the runs read, appended, written and rendered in Trends. An invalid value SHALL
exit 2 naming the range; without `--history` it SHALL exit 2 naming both
options. Without the flag the 30-run behaviour SHALL be unchanged.

#### Scenario: Smaller window

- **WHEN** `--history-limit 5` is used with a sidecar that holds seven runs
- **THEN** the newest five runs are read, written and rendered in Trends
- **AND** the report is generated normally
- **AND** the process exits 0

#### Scenario: Larger window

- **WHEN** `--history-limit 40` is used with a sidecar that holds 40 runs and a
  new current run
- **THEN** the current run is appended and the newest 40 of the 41 runs are kept
- **AND** all 40 kept runs are rendered in Trends
- **AND** the file does not grow past 40 runs

#### Scenario: One run

- **WHEN** `--history-limit 1` is used
- **THEN** the sidecar keeps one run
- **AND** no Trends tab is rendered

#### Scenario: Default

- **WHEN** `--history` is used without `--history-limit`
- **THEN** the window is 30
- **AND** the CI bytes match the previous release
- **AND** the report differs from the previous release only by the 170 B
  measured scroll-offset script and, with two or more history runs, the
  documented Trends shell CSS
- **AND** the email matches except its generated timestamp
- **AND** the JSON matches apart from the additive outline `example` field,
  which is owned by the baseline change

#### Scenario: Invalid value

- **WHEN** `--history-limit` is `0`, `366`, `1.5`, `abc`, `05` or empty
- **THEN** the CLI exits 2 and names the range 1 to 365
- **AND** no report or sidecar is written

#### Scenario: Missing history option

- **WHEN** `--history-limit 10` is used without `--history`
- **THEN** the CLI exits 2 and names both options
- **AND** nothing is written

#### Scenario: Missing HTML

- **WHEN** `--history --history-limit 10` is used without `--out`
- **THEN** the existing `--history` requires `--out` error exits 2
- **AND** nothing is written

#### Scenario: Help lists the option

- **WHEN** `--help` is requested
- **THEN** the usage text lists `--history-limit <n>`

### Requirement: Keep the sidecar schema and cap

The reader SHALL accept schema version 1 and 2. The writer SHALL write schema 1
unless the limit is above 30 or the file is already schema 2, then schema 2. The
writer SHALL prune the oldest entries until the serialized file is at or below
1,048,576 bytes and SHALL never write a file the reader would reject. A file
above 1 MiB or with an invalid entry SHALL be rejected without a rewrite.

#### Scenario: Default schema

- **WHEN** a schema-1 file is written with the default limit
- **THEN** the file stays schema version 1

#### Scenario: Extended schema

- **WHEN** a file is written with `--history-limit 40`, or the read file was
  already schema 2
- **THEN** the file is schema version 2
- **AND** no run field changes

#### Scenario: Writer stays under the cap

- **WHEN** a schema-2 file's serialized form would exceed 1,048,576 bytes
- **THEN** the writer drops the oldest entries until the bytes are at or below
  the cap
- **AND** the newest entry remains
- **AND** the written file re-reads successfully

#### Scenario: Oversized or invalid file

- **WHEN** the sidecar is above 1 MiB or has an invalid entry
- **THEN** the CLI exits 1 and names the file
- **AND** the file is not rewritten

### Requirement: Prune to the configured window

A lower limit SHALL prune on the next successful write; a higher limit SHALL NOT
recover dropped runs. A 0.5 reader SHALL reject a schema-2 file with its visible
unsupported-version error and leave it untouched.

#### Scenario: Prune on write

- **WHEN** a 31-entry sidecar is read with `--history-limit 10` and a new current
  run is generated
- **THEN** the newest 10 runs are read and the report shows 10
- **AND** the current run is appended unless it dedupes
- **AND** the next successful write stores the newest 10 runs
- **AND** the 21 runs older than the read window are gone

#### Scenario: Raise within the file

- **WHEN** a 31-entry sidecar is read with `--history-limit 40` and a new current
  run is generated
- **THEN** all 31 runs are read
- **AND** the current run is appended unless it dedupes
- **AND** the next write stores 32 runs, not 40

#### Scenario: Dedupe

- **WHEN** the last run is identical to the current run
- **THEN** it is not appended
- **AND** the old timestamp stays
- **AND** the window still bounds the list

#### Scenario: Dropped runs stay dropped

- **WHEN** a window was lowered and the file was written
- **THEN** raising the limit later does not restore the dropped runs
- **AND** the report renders the runs that remain

#### Scenario: Older reader

- **WHEN** a 0.5 reader opens a schema-2 sidecar
- **THEN** it exits 1 with its unsupported-version error
- **AND** the file is not rewritten or truncated

### Requirement: Expose the limit on the API

`readHistory`, `appendHistory` and `writeHistory` SHALL accept an optional
limit and SHALL default an omitted limit to 30; `generateReport` SHALL accept
`historyLimit` with the same default; an invalid limit SHALL throw a clear error.
`renderReport` and `CucumberHtmlStream` SHALL render the list they are given and
SHALL NOT prune it.

#### Scenario: History functions

- **WHEN** `readHistory`, `appendHistory` or `writeHistory` receives a limit of
  5
- **THEN** it keeps the newest five runs
- **AND** the same validation range applies

#### Scenario: Default limit

- **WHEN** an API function is called without a limit
- **THEN** it uses exactly 30
- **AND** `generateReport` returns at most 30 runs

#### Scenario: generateReport

- **WHEN** `generateReport` receives `historyLimit: 5`
- **THEN** the returned history has at most five runs
- **AND** the report's Trends view renders those five

#### Scenario: renderReport as given

- **WHEN** `renderReport` receives a 40-entry history list
- **THEN** it renders all 40 runs
- **AND** it does not prune the list

#### Scenario: Invalid API limit

- **WHEN** an API function receives `0`, `366`, `1.5` or a non-number
- **THEN** it throws an error naming the range 1 to 365
- **AND** it writes no file

### Requirement: Read an explicit baseline summary

The CLI SHALL accept `--baseline <file>` as a read-only schema-2 summary and
SHALL require `--out`, `--pdf`, `--json` or `--ci markdown`. A colliding path
SHALL exit 2; a missing, unreadable, non-regular, oversized, invalid or
wrong-schema baseline SHALL exit 1, writing nothing.

#### Scenario: Baseline with a report

- **WHEN** `--out report.html --baseline previous.json` is used with a valid
  schema-2 baseline
- **THEN** the report contains the comparison panel
- **AND** the baseline file's bytes and modification time are unchanged

#### Scenario: Static report with a baseline

- **WHEN** `--static --baseline previous.json --out report.html` is used with a
  valid schema-2 baseline
- **THEN** the process exits 0
- **AND** the report is the static form
- **AND** the baseline comparison panel is visible without JavaScript
- **AND** the document has one `<main>` and no `<script>`

#### Scenario: Missing baseline

- **WHEN** `--baseline missing.json` is used
- **THEN** the CLI exits 1 and names the file
- **AND** no report, JSON, CI text or email is written

#### Scenario: Wrong schema

- **WHEN** the baseline is a history sidecar (any schema version) or any version
  other than 2
- **THEN** the CLI exits 1 and names the supported version
- **AND** no output is written

#### Scenario: Baseline surface required

- **WHEN** `--baseline previous.json` is used with only `--email`, or with only
  `--ci github` or `--ci azure`
- **THEN** the CLI exits 2 and names the surfaces that show the comparison
- **AND** nothing is written

#### Scenario: Baseline path collision

- **WHEN** `--baseline` names an input, the logo, `--out`, `--pdf`, `--email`,
  `--history`, `--ci-out`, or a path inside an input directory, even when the
  baseline file does not exist
- **THEN** the CLI exits 2 and writes nothing

#### Scenario: Oversized or non-regular baseline

- **WHEN** the baseline is larger than 10,485,760 bytes, a directory, a symlink
  to a directory or another non-regular file
- **THEN** the CLI exits 1 and names the file and the limit
- **AND** a summary larger than 10 MiB cannot be a baseline
- **AND** no output is written

#### Scenario: BOM and `..` URI

- **WHEN** the baseline starts with a UTF-8 BOM or carries a `..` segment in a
  scenario URI
- **THEN** the BOM is stripped before parsing
- **AND** the `..` segment is passed through the display-URI rule, never
  resolved against the file system

#### Scenario: Help lists the option

- **WHEN** `--help` is requested
- **THEN** the usage text lists `--baseline <file>`

### Requirement: Reject hostile baseline shapes

The reader SHALL reject a non-object scenario entry, a missing required field, a
missing `executed`, a wrong field type, an unknown status, a value nested deeper
than 64 levels and a `__proto__`, `constructor` or `prototype` own key on the
document or a scenario entry with exit 1 and no write.

#### Scenario: Hostile invalid shapes

- **WHEN** the baseline has a non-object scenario entry, a missing required
  field, a missing `executed`, a wrong field type, an unknown status or a value
  nested deeper than 64 levels
- **THEN** the CLI exits 1 and names the file and the reason
- **AND** nothing is written

#### Scenario: Prototype keys

- **WHEN** the baseline has a `__proto__`, `constructor` or `prototype` own key
  on the document or a scenario entry
- **THEN** the CLI exits 1 and names the file
- **AND** nothing is written
- **AND** `Object.prototype` is unchanged

#### Scenario: Symlink to a regular file

- **WHEN** the baseline path is a symlink to a regular file
- **THEN** the reader reads the target file
- **AND** the comparison succeeds

### Requirement: Match baseline scenarios by stable identity

The comparison SHALL group by feature name + scenario name, match a unique base
key, then pair a repeated group in two passes: by the example coordinate when
every row on both sides carries it, then by display URI when exactly one
genuinely unmatched row on each side carries it. Any remaining unpaired row
SHALL make the whole group ambiguous and count it once. No pickle id, position,
line, tags, step text, status or order SHALL be used.

#### Scenario: Reordered run

- **WHEN** the current run has the same scenarios in a different order
- **THEN** every scenario matches its baseline row
- **AND** the new-failure, fixed and still-failing counts are all zero

#### Scenario: Renamed feature file

- **WHEN** a `*.feature` file is renamed but the feature and scenario names are
  unchanged and the base key is unique
- **THEN** its scenarios match their baseline rows
- **AND** none is reported as new or not in this run

#### Scenario: Renamed scenario

- **WHEN** a scenario name changes
- **THEN** the baseline row is reported as not in this run
- **AND** the current row is reported as a new failure or added
- **AND** no row is reported as modified

#### Scenario: Repeated name in a renamed file

- **WHEN** a repeated non-outline name appears in a renamed `*.feature` file
- **THEN** the URI no longer matches and the group is ambiguous
- **AND** no row in it is reported as new, fixed or not in this run

#### Scenario: Outline examples

- **WHEN** two outline rows share a feature and scenario name but carry
  different example coordinates
- **THEN** each current row matches its baseline row by coordinate
- **AND** no row is ambiguous

#### Scenario: 0.5 baseline with repeated names

- **WHEN** a 0.5 baseline without `example` has repeated names in different
  display URIs
- **THEN** each row pairs by URI
- **AND** repeated names in the same URI make the group ambiguous instead of
  pairing by order

#### Scenario: Ambiguous duplicate names

- **WHEN** a base-key group has repeated names without usable coordinates or
  unique URIs on both sides
- **THEN** the whole group is excluded from the tracked counts
- **AND** none of its baseline rows is listed as not in this run
- **AND** `ambiguous` counts the group once
- **AND** no row is paired by order or status

### Requirement: Classify matched pairs

The comparison SHALL classify each matched pair by the table, with F = failing
(`failed`, `undefined`, `ambiguous`), P = passing (`passed`), O = other
(`skipped`, `pending`, `unknown`) and U = unexecuted:

| Baseline | Current | Class |
| --- | --- | --- |
| F | F | still failing |
| F | P | fixed |
| F | O, U | `other` |
| P | F | new failure |
| P | P, O, U | `other` |
| O | F | new failure |
| O | P, O, U | `other` |
| U | F | new failure |
| U | P, O, U | `other` |

#### Scenario: Status classes

- **WHEN** a matched pair is classified
- **THEN** `failed`, `undefined` and `ambiguous` are failing
- **AND** `passed` is passing
- **AND** `skipped`, `pending` and `unknown` are other
- **AND** an unexecuted current row is unexecuted

#### Scenario: New failure

- **WHEN** a scenario passed, was unexecuted, or was another status in the
  baseline and fails now, or is absent from the baseline and fails now
- **THEN** it is counted once as a new failure
- **AND** it is not counted as added

#### Scenario: Fixed

- **WHEN** a scenario failed in the baseline and passes now
- **THEN** it is counted once as fixed

#### Scenario: Still failing

- **WHEN** a scenario failed in the baseline and still fails now
- **THEN** it is counted once as still failing

#### Scenario: No claim

- **WHEN** a scenario failed in the baseline and is skipped, pending, unknown or
  unexecuted now
- **THEN** it is counted once as `other`
- **AND** it is not counted as fixed, still failing or not in this run
- **AND** it has no per-scenario change

#### Scenario: Added

- **WHEN** an executed scenario is absent from the baseline and does not fail
- **THEN** it is counted as added
- **AND** it has no new-failure claim

#### Scenario: Not in this run

- **WHEN** a baseline scenario has no current match
- **THEN** it is counted as not in this run
- **AND** the report uses the wording "Not in this run"

#### Scenario: Unexecuted current row

- **WHEN** a baseline scenario has a current row that is present but unexecuted
- **THEN** it is not reported as not in this run
- **AND** it makes no status claim

### Requirement: Reconcile baseline counts

The comparison SHALL have one count set: `newFailures`, `fixed`,
`stillFailing`, `other`, `notInThisRun`, `added` and `ambiguous`. Every baseline
row outside an ambiguous group SHALL fall into exactly one of new failure, fixed,
still failing, `other` or not in this run; `added` counts current rows and
`ambiguous` counts groups.

#### Scenario: Unmatched current row

- **WHEN** a current row has no baseline match because its feature + name group
  has no baseline row at all
- **THEN** an executed failing row is a new failure
- **AND** an executed non-failing row is added
- **AND** an unexecuted row makes no claim and is not a baseline row
- **AND** a row in a repeated group that gains an extra current row is not
  unmatched; the whole group is ambiguous instead

#### Scenario: Count reconciliation

- **WHEN** the baseline has 10 rows outside ambiguous groups, with two new
  failures, one fixed, three still failing and one not in this run
- **THEN** `other` is 3
- **AND** `2 + 1 + 3 + 3 + 1` equals 10
- **AND** `added` and `ambiguous` are not part of that sum

### Requirement: Add the comparison to the JSON summary

With `--baseline`, the summary SHALL add a `baseline` object after `attachments`
and before `scenarios`, and a `change` field to each classified scenario. The
block SHALL carry the baseline status, seven counts and a capped `notInThisRun`
list; the counts stay complete. The schema stays 2 and no summary `id` field is
added. Without the flag there SHALL be no `baseline` or `change` key.

#### Scenario: Baseline block

- **WHEN** a run with a baseline is summarized
- **THEN** `schemaVersion` is 2
- **AND** `baseline.status` is the baseline overall status
- **AND** `baseline.counts` carries `newFailures`, `fixed`, `stillFailing`,
  `other`, `notInThisRun`, `added` and `ambiguous`
- **AND** every `notInThisRun` entry carries `feature`, `name`, `uri`, `status`,
  `executed` and optional `example`
- **AND** every classified scenario carries `change` after `executed`, with the
  value `new-failure`, `fixed`, `still-failing` or `added`
- **AND** unchanged, unexecuted and ambiguous rows carry no `change`
- **AND** no scenario or baseline entry carries an `id` field

#### Scenario: No baseline

- **WHEN** the same run is summarized without `--baseline`
- **THEN** no `baseline` or `change` key appears
- **AND** the Markdown CI bytes are identical to before the change
- **AND** the HTML is byte-identical to before the change apart from the
  measured scroll-offset script
- **AND** the only JSON delta is the additive outline `example`

#### Scenario: Nested baseline block

- **WHEN** the baseline file contains its own `baseline` block
- **THEN** the run succeeds
- **AND** the nested block is ignored

### Requirement: Cap and sort the not-in-this-run list

The `notInThisRun` array SHALL be capped at 50 entries and sorted by feature,
then name, then the example coordinate (examples then example, numeric, rows
without `example` last), then URI. `counts.notInThisRun` SHALL stay complete.

#### Scenario: Not-in-this-run order

- **WHEN** the capped list contains `#1.2`, `#1.10`, a row without `example`,
  and rows from two features
- **THEN** rows are grouped by feature, then name
- **AND** within one feature and name, `#1.2` sorts before `#1.10`
- **AND** the row without `example` sorts after every row with an `example` in
  the same feature and name
- **AND** ties use URI

#### Scenario: Capped not-in-this-run list

- **WHEN** the baseline has 60 scenarios not in this run
- **THEN** `counts.notInThisRun` is 60
- **AND** the `notInThisRun` array has 50 entries
- **AND** the entries are sorted deterministically

### Requirement: Expose the outline example coordinate in the summary

Every summary row for a Messages scenario-outline example SHALL carry `example`
as `#<examples>.<example>` with 1-based numbers, matching the report label,
whether or not a baseline is supplied. A plain, legacy JSON or JUnit scenario
SHALL NOT carry it. The field is additive, stays schema 2 and appears after
`attempt`.

#### Scenario: Outline rows

- **WHEN** a Messages outline with two examples blocks is summarized
- **THEN** each example row carries its `example` coordinate
- **AND** the report and summary labels agree

#### Scenario: Non-outline row

- **WHEN** a plain scenario, a legacy JSON scenario or a JUnit scenario is
  summarized
- **THEN** it has no `example` key

#### Scenario: Old baseline

- **WHEN** a 0.5 baseline without `example` is compared
- **THEN** unique scenario names still match
- **AND** repeated names in different URIs pair by URI
- **AND** repeated names in the same URI become ambiguous instead of pairing by
  order

### Requirement: Expose the baseline comparison on the API

The package SHALL export the `BaselineSummary` type and a
`BaselineRenderOptions` type that extends `RenderReportOptions` with
`baseline?: BaselineSummary`. `generateReport`, `renderReport` and
`summarizeReport` SHALL accept `options.baseline` as that projection.
`renderHtml` and `CucumberHtmlStream` SHALL NOT accept a baseline in 0.6.0 and
SHALL keep `RenderReportOptions`/`RenderOptions`; the stream's
same-input-same-HTML contract is unchanged. The API SHALL accept the projection,
never a path.

#### Scenario: API projection

- **WHEN** `generateReport`, `renderReport` or `summarizeReport` receives a
  `BaselineSummary`
- **THEN** the output contains the comparison
- **AND** no file is read by the API

#### Scenario: Stream limit

- **WHEN** a caller passes a `baseline` to `CucumberHtmlStream` or the internal
  `renderHtml`
- **THEN** the option is not part of the accepted type
- **AND** the stream output stays the same for the same envelopes and options

#### Scenario: Type export

- **WHEN** a TypeScript caller imports from `tolkira`
- **THEN** `BaselineSummary` and `BaselineRenderOptions` are exported

### Requirement: Emit one Markdown baseline line

With `--baseline` and `--ci markdown`, the summary SHALL include one line after
the counts table's trailing blank line and before the empty-run and
zero-executed returns, followed by one blank line:
`Baseline: <n> new failure(s) · <n> fixed · <n> still failing · <n> not in this run`,
with all four counts including zeros, plus ` · <n> ambiguous group(s)` only when
positive. `added` SHALL NOT appear. Without the flag there SHALL be no line.

#### Scenario: Mixed counts

- **WHEN** the comparison has two new failures, one fixed, three still failing
  and one not in this run
- **THEN** the Markdown contains exactly
  `Baseline: 2 new failures · 1 fixed · 3 still failing · 1 not in this run`
- **AND** one blank line separates it from the next block

#### Scenario: Zero counts

- **WHEN** the comparison has no tracked changes
- **THEN** the line reads
  `Baseline: 0 new failures · 0 fixed · 0 still failing · 0 not in this run`

#### Scenario: Singular new failure

- **WHEN** the comparison has one new failure and no other tracked change
- **THEN** the line reads
  `Baseline: 1 new failure · 0 fixed · 0 still failing · 0 not in this run`

#### Scenario: Ambiguous groups

- **WHEN** the comparison has one ambiguous group
- **THEN** the line ends with ` · 1 ambiguous group`

#### Scenario: Empty or all-unexecuted run

- **WHEN** the current run is empty or has zero executed scenarios and a
  baseline is supplied
- **THEN** the baseline line appears before `No scenarios in this report.` or
  `0 executed scenarios; ...`

#### Scenario: No baseline

- **WHEN** `--ci markdown` runs without `--baseline`
- **THEN** no baseline line appears
- **AND** the Markdown bytes are unchanged

#### Scenario: Other CI formats

- **WHEN** `--ci github` or `--ci azure` runs with a baseline and another
  comparison surface
- **THEN** the annotation bytes are unchanged

### Requirement: Keep the baseline read-only and offline

The baseline SHALL be read once, never written, and SHALL add no network
request, telemetry or runtime dependency. The report and summary SHALL NOT embed
the baseline file path. The comparison SHALL be deterministic: the same inputs,
baseline and options SHALL produce byte-identical report, summary and CI text.

#### Scenario: Read-only

- **WHEN** a run reads a baseline
- **THEN** the file's bytes and modification time are unchanged
- **AND** no temporary or rewritten baseline file remains

#### Scenario: Offline and deterministic

- **WHEN** the same run is repeated
- **THEN** the report, JSON and CI text are byte-identical
- **AND** no network request is made
- **AND** no dependency is added

### Requirement: Accept a UTF-8 BOM before the history sidecar

Both `readHistory` and the schema peek used by `writeHistory` SHALL remove
exactly one leading U+FEFF from the bounded sidecar text before `JSON.parse`
and SHALL otherwise keep the existing validation and error text. The strip
SHALL live in the shared bounded read path. A read SHALL NOT rewrite the file.
`writeHistory` SHALL NOT emit a BOM, and its next successful write SHALL
replace a BOM-prefixed file with BOM-free bytes while keeping the runs the
append would otherwise keep.

#### Scenario: BOM-prefixed valid sidecar

- **WHEN** a valid history sidecar starts with one UTF-8 BOM
- **THEN** `readHistory` returns the documented runs
- **AND** the result equals the same file read without the BOM
- **AND** the file bytes and modification time are unchanged

#### Scenario: BOM-only file

- **WHEN** the sidecar contains only a UTF-8 BOM
- **THEN** `readHistory` rejects with
  `Invalid history file <file>: not valid JSON`
- **AND** the file is not rewritten

#### Scenario: BOM followed by invalid JSON

- **WHEN** the sidecar starts with one UTF-8 BOM and the rest is not valid JSON
- **THEN** `readHistory` rejects with the same `not valid JSON` error
- **AND** the file is not rewritten

#### Scenario: Two leading BOMs

- **WHEN** the sidecar starts with two U+FEFF characters followed by valid JSON
- **THEN** exactly one is stripped and the remaining U+FEFF is not valid JSON
- **AND** `readHistory` rejects with the same `not valid JSON` error
- **AND** the file is not rewritten

#### Scenario: Append to a BOM-prefixed sidecar

- **WHEN** a valid BOM-prefixed sidecar holds existing runs and a new run is
  written through the history append path
- **THEN** the schema peek accepts the file and keeps its stored schema version
- **AND** `readHistory` returns the documented runs
- **AND** the append and write succeed
- **AND** the rewritten file starts with `{` and contains no BOM
- **AND** its bytes equal the same append against the same sidecar without the
  BOM, so no run is lost

#### Scenario: No-BOM regression

- **WHEN** a valid sidecar has no BOM
- **THEN** `readHistory` returns exactly the runs it returned before this change
- **AND** the existing schema, size, regular-file and entry validation is
  unchanged

#### Scenario: Writer output is unchanged

- **WHEN** `writeHistory` writes a schema-1 or schema-2 sidecar
- **THEN** the file starts with `{` and contains no BOM
- **AND** the schema, validation, pruning and bytes are unchanged

### Requirement: Reject a malformed history target before writing

`writeHistory` SHALL validate an existing target with the reader's full
document and run rules before writing. A target with a supported schema but a
malformed `runs` value or entry SHALL be rejected with the existing
`Cannot write history file <file>: ...` prefix, and the target SHALL remain
byte-identical. A missing target SHALL still be written. A valid target SHALL
still be appended to and SHALL keep its schema. No partial file SHALL remain
after a rejection.

#### Scenario: Runs is not an array

- **WHEN** a schema-1 target contains `"runs": "not-an-array"` and
  `writeHistory` is called with a valid run
- **THEN** the call rejects with `Cannot write history file <file>: ...`
- **AND** the target bytes and modification time are unchanged
- **AND** no temporary file remains

#### Scenario: One bad run entry

- **WHEN** a schema-2 target contains one valid run and one entry that fails
  the reader's run rules
- **THEN** the call rejects with the `Cannot write history file` prefix and a
  reason naming the entry
- **AND** the target bytes are unchanged
- **AND** no temporary file remains

#### Scenario: Valid target appends

- **WHEN** a valid schema-1 target holds existing runs and a new run is written
  through the read-then-append path
- **THEN** the write succeeds
- **AND** the file keeps schema 1
- **AND** the existing runs and the new run are present

#### Scenario: Missing target writes

- **WHEN** the target does not exist
- **THEN** the write succeeds with schema 1 and the supplied runs
- **AND** no validation error is raised for the absent file

#### Scenario: Rejected target stays byte-identical

- **WHEN** a malformed supported-schema target is rejected
- **THEN** its bytes, size and modification time are unchanged
- **AND** the file bytes equal the pre-call bytes

### Requirement: Keep CI identity text bounded

GitHub annotation titles and Markdown headings and code spans SHALL cap the
original feature name, scenario name, URI and `--title` heading at 200 Unicode
code points and SHALL append the existing `[truncated]` marker when the text is
cut. The cap SHALL apply before escaping or code-span wrapping and SHALL NOT
split a surrogate pair. Counts, the full report, the failure-message limits,
the 50/20 list limits and the Azure annotation limits SHALL stay unchanged.

#### Scenario: GitHub title

- **WHEN** a failed scenario has a feature and name longer than 200 code points
- **THEN** the GitHub error title is built from at most 200 code points of the
  identity followed by `[truncated]`
- **AND** the annotation stays one escaped workflow command
- **AND** the exact failure count is unchanged

#### Scenario: Markdown heading, name and URI

- **WHEN** a failed scenario has a feature, name and URI longer than 200 code
  points and `--title` is also longer than 200 code points
- **THEN** the Markdown heading and each identity code span are built from at
  most 200 original code points followed by `[truncated]`
- **AND** the counts and the failure message limits are unchanged

#### Scenario: Exactly 200 code points

- **WHEN** a feature name, scenario name, URI or title has exactly 200 Unicode
  code points
- **THEN** the CI output contains the complete text
- **AND** no `[truncated]` marker is added

#### Scenario: 201 code points

- **WHEN** an identity has 201 Unicode code points
- **THEN** the CI output contains the first 200 code points followed by
  `[truncated]`

#### Scenario: Surrogate pair at the boundary

- **WHEN** the 200th code point is a surrogate pair
- **THEN** the pair is kept whole
- **AND** no lone surrogate appears in the output

### Requirement: Name the requested output on a write failure

A failed `--out` write SHALL report
`Cannot write report to <target> (<code>)`. A failed `--ci-out` write SHALL
report `Cannot write CI output to <target> (<code>)`. The target SHALL be
one-lined, and the Node error code SHALL be included when present. No `.tmp`
name and no UUID SHALL appear. The exit code SHALL stay 1, and no partial file
SHALL remain.

#### Scenario: Directory target

- **WHEN** `--out` names an existing directory
- **THEN** the CLI exits 1 and reports `Cannot write report to <target>` with
  the error code
- **AND** the message contains no `.tmp` name and no UUID
- **AND** no partial report remains

#### Scenario: Permission failure

- **WHEN** `--ci-out` cannot be written because the target is not writable
- **THEN** the CLI exits 1 and reports `Cannot write CI output to <target>` with
  the error code
- **AND** the already written report stays
- **AND** no partial CI file remains

#### Scenario: No temporary path

- **WHEN** a report or CI write fails
- **THEN** the error names the requested target
- **AND** it neither names the atomic temporary file nor contains a UUID

#### Scenario: Exit code and partial output

- **WHEN** a report or CI write fails
- **THEN** the process exits 1
- **AND** no partial file is left at the requested target
- **AND** a failed report write writes no later output

### Requirement: Accept ISO 8601-shaped history timestamps

The history reader SHALL accept a timestamp with a zone (`Z` or `±HH:MM`),
optional seconds and optional fractional seconds, and a finite `Date.parse`.
It SHALL keep the original string. It SHALL reject a zone-less or free-text
value with the existing malformed-entry error. The CLI's newly recorded
`recordedAt` SHALL keep the existing `YYYY-MM-DDTHH:mm:ss.sssZ` form. A read
SHALL NOT rewrite the file.

#### Scenario: Writer form is accepted

- **WHEN** a sidecar contains `2026-11-19T08:00:00.000Z`
- **THEN** the reader accepts the run
- **AND** the stored string is unchanged

#### Scenario: Z without milliseconds

- **WHEN** a sidecar contains `2026-11-19T08:00:00Z`
- **THEN** the reader accepts the run
- **AND** the stored string keeps its original form

#### Scenario: Positive offset

- **WHEN** a sidecar contains `2026-11-19T08:00:00+02:00`
- **THEN** the reader accepts the run
- **AND** `recordedAt` keeps the offset rather than being converted to `Z`

#### Scenario: Negative offset and optional seconds

- **WHEN** a sidecar contains `2026-11-19T08:00-05:30` or a fraction such as
  `2026-11-19T08:00:00.123456789Z`
- **THEN** the reader accepts the run into the same validation path

#### Scenario: Zone-less value is rejected

- **WHEN** a sidecar contains `2026-11-19T08:00:00`
- **THEN** the CLI exits 1 with the existing malformed-entry error naming the
  file
- **AND** the file is not rewritten

#### Scenario: Free text is rejected

- **WHEN** a sidecar contains `yesterday` or another non-ISO value
- **THEN** the reader rejects it with the existing malformed-entry error
- **AND** the file is not rewritten

#### Scenario: Read is byte-identical

- **WHEN** a valid sidecar with any accepted ISO form is read
- **THEN** its bytes and modification time are unchanged
