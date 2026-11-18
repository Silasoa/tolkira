# Spec Delta

## ADDED Requirements

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
