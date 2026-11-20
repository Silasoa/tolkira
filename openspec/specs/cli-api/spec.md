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

The CLI SHALL accept `--ci github|markdown` and optional `--ci-out <file>`.
`--ci` SHALL not require `--out`; without `--ci-out`, CI text goes to stdout.
Exit codes SHALL remain unchanged by annotation content.

#### Scenario: CI without HTML

- **WHEN** the user passes `--ci github` without `--out`
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
- **AND** no partial output or report is written

#### Scenario: Invalid combination

- **WHEN** `--ci` has an unknown value, the value is case-mismatched,
  `--ci-out` is used without `--ci`, or `--ci github` is combined with
  `--ci-out`
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
scenarios, steps), `durationMs` and `attachments` (total, bytes). It SHALL NOT
contain scenario names, step text, paths, tags or attachment content. Unknown
fields SHALL be ignored within schema version 1.

#### Scenario: Aggregate-only entry

- **WHEN** a run is recorded
- **THEN** the entry contains only the documented aggregate fields
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
