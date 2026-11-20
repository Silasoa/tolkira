# Spec Delta

## ADDED Requirements

### Requirement: Generate an opt-in email summary

The CLI SHALL accept `--email <file>` and write one self-contained HTML email
summary. Without the flag no email file SHALL be created. The report and its
one-file default SHALL stay unchanged. The email SHALL use no SMTP, network
request, script or new dependency.

#### Scenario: Email next to a report

- **WHEN** `--email summary.html` is used with `--out report.html`
- **THEN** the report and the email are written
- **AND** the email names `report.html` as the full report

#### Scenario: Standalone summary

- **WHEN** `--email summary.html` is the only output
- **THEN** the email is written from the summary
- **AND** it states that no full report was generated

#### Scenario: No flag

- **WHEN** `--email` is absent
- **THEN** no email file is read or written
- **AND** the report and summary are unchanged

### Requirement: Summarize the run counts

The email SHALL show the report title, overall status, attempted pass rate,
feature and step counts, duration and attachment totals. It SHALL show every
non-zero scenario status plus the unexecuted count, and SHALL label the total as
executed scenarios with results.

#### Scenario: Counts add up

- **WHEN** a run has undefined, ambiguous or unexecuted scenarios
- **THEN** every non-zero status and the unexecuted count are shown
- **AND** the total is labelled as executed scenarios with results

#### Scenario: Failed run counts

- **WHEN** a run has failures
- **THEN** the email shows the failed count and the attempted pass rate
- **AND** the feature/step/duration/attachment totals

### Requirement: List the failed scenarios

The email SHALL list at most five failed scenarios with feature, scenario,
status and duration, and no step bodies, plus a count of further failures. The
test data SHALL be escaped and render verbatim. The no-failure copy SHALL key
off the overall status, so an undefined/pending/unknown run is not called
successful.

#### Scenario: Further failures

- **WHEN** more than five scenarios failed
- **THEN** the email lists five and summarizes the rest as a count

#### Scenario: Non-passing without failures

- **WHEN** a run has no failed scenarios but the status is undefined, pending or
  unknown
- **THEN** the email shows that status
- **AND** it does not call the run successful

#### Scenario: Empty run

- **WHEN** the run has no scenarios
- **THEN** the email shows the empty state and zero counts

#### Scenario: Hostile names

- **WHEN** a feature or scenario name contains markup
- **THEN** the email shows the literal text
- **AND** no markup or attribute is created

### Requirement: Name the full report without a server

With `--out`, the email SHALL name the report file (basename only) and state
that it is attached or shared separately. Without `--out`, the email SHALL say
that no full report was generated. The email SHALL NOT contain a remote URL,
tracking pixel, external font, stylesheet, script or image; the first slice
omits the logo and uses an optional validated accent colour. The standard
summary SHOULD stay under 100 KB.

#### Scenario: Report reference

- **WHEN** `--out reports/run.html` is used
- **THEN** the email names `run.html`
- **AND** no local directory path or remote URL is included

#### Scenario: No remote assets

- **WHEN** the email is opened offline
- **THEN** it renders with inline styles only
- **AND** it makes no request
- **AND** a standard summary stays under 100 KB

### Requirement: Write the email safely

The email path SHALL be required, SHALL be written atomically after the
report/summary, and SHALL NOT collide with an input, the logo, `--out`,
`--ci-out` or `--history`. On a write failure the CLI SHALL exit 1, name the
file and leave an already written report in place.

#### Scenario: Path collision

- **WHEN** `--email` points at an input, the logo, `--out`, `--ci-out` or the
  history file
- **THEN** the CLI exits 2
- **AND** nothing is written

#### Scenario: Write failure

- **WHEN** the email cannot be written after a successful report
- **THEN** the CLI exits 1 and names the file
- **AND** the report stays in place
- **AND** no partial email is left behind

### Requirement: Expose the email API

`renderEmail(summary, options)` SHALL be exported and return the email HTML from
a `ReportSummary`. The options SHALL include the resolved title, locale and
optional report name, a validated accent colour and a generated `Date`; the
first slice SHALL NOT accept a logo. The function SHALL NOT write files or send
mail. An invalid accent SHALL be ignored or throw a clear error; no unvalidated
style input SHALL reach the output.

#### Scenario: Library use

- **WHEN** a caller passes a summary and options with a pinned clock
- **THEN** it receives the same HTML the CLI writes
- **AND** the CLI and API produce identical output for the same inputs

#### Scenario: Hostile options

- **WHEN** a caller passes an invalid accent or a markup report name
- **THEN** the email ignores or rejects the accent
- **AND** the report name is escaped inertly
