# cli-api Specification

## Purpose
Defines the command-line and programmatic entry points for generating a Tolkira
report and their error and exit-code behaviour.

## Requirements

### Requirement: Generate a report from the CLI

The CLI SHALL accept one or more input files or directories and either an
output path or `--json`, and SHALL produce one HTML report and/or one summary.

#### Scenario: Single input
- **WHEN** the user runs the CLI with one supported input and an output path
- **THEN** the CLI writes the HTML report to that path

#### Scenario: Multiple inputs
- **WHEN** the user runs the CLI with multiple supported inputs
- **THEN** the CLI writes one report containing all results

#### Scenario: Directory input
- **WHEN** the user runs the CLI with a directory
- **THEN** the CLI includes every supported report file in that directory

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
same summary without writing HTML.

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

### Requirement: Support title, metadata and output options

The CLI SHALL support a report title, repeated metadata entries, a logo, an
accent colour, a size warning threshold, help and version output. The API SHALL
support title, metadata, logo and accent. The CLI SHALL require at least one of
`--out` or `--json`.

#### Scenario: Title and metadata
- **WHEN** the user supplies a title and metadata entries
- **THEN** the generated report contains the escaped title and metadata

#### Scenario: Help
- **WHEN** the user requests help
- **THEN** the CLI prints usage and exits successfully

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

The CLI SHALL accept `--history <file>` (requires `--out`) and keep an
aggregate run history in that sidecar. It SHALL read, append and write the file
atomically, keep the last 30 runs, and reject corrupt, oversized or unsupported
files before writing. A missing file starts empty. An identical last run SHALL
NOT be duplicated, where identity ignores the recorded time. Without the flag no
history is read or written and no history data enters the report.

#### Scenario: First run creates the sidecar

- **WHEN** `--history` points to a missing file and `--out` is set
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

- **WHEN** the file already has 30 entries, or more from an older version
- **THEN** the oldest entries are dropped and the newest kept
- **AND** the file never grows past 30 entries

#### Scenario: Missing and invalid files

- **WHEN** the file is missing
- **THEN** generation succeeds with an empty history
- **WHEN** the file is not valid JSON, has a wrong schema version, exceeds the
  sidecar size cap, or has a malformed entry (bad ISO time, non-finite or
  negative count)
- **THEN** the CLI exits with code 1 and a message naming the file
- **AND** the file is not overwritten

#### Scenario: History requires HTML

- **WHEN** `--history` is used without `--out`
- **THEN** the CLI exits with a usage error naming both options
- **AND** nothing is written

#### Scenario: Path safety

- **WHEN** `--history` resolves to an input, the logo, `--out`, `--ci-out`, or
  a path inside an input directory (even when the file does not exist yet)
- **THEN** the CLI exits with a usage error
- **AND** nothing is written

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

The sidecar SHALL use `schemaVersion: 1` and entries with `id`, `recordedAt`
(ISO), `title` (the resolved report title), `status`, `counts` (features,
scenarios, steps), `durationMs`, `attachments` (total, bytes) and an optional
`flaky` count. It SHALL NOT contain scenario names, step text, paths, tags or
attachment content. Unknown fields SHALL be ignored within schema version 1.

#### Scenario: Aggregate-only entry

- **WHEN** a run is recorded
- **THEN** the entry contains only the documented aggregate fields
- **AND** old entries may omit `flaky`
- **AND** the documentation shows the schema, the retention and dedupe rules,
  and that a shared report embeds the prior-run aggregates it was generated with

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
