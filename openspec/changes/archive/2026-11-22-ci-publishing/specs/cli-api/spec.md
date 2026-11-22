# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
