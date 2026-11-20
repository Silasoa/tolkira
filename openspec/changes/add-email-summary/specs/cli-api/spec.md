# Spec Delta

## ADDED Requirements

### Requirement: Add the email output option

The CLI SHALL accept `--email <file>` and count it as an output. It SHALL
require a non-empty path and at least one input. Without `--out` it SHALL still
write the summary-only email. `--json`, `--ci` and their text SHALL stay
English and unchanged.

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
`--history` (resolved and case-aware). The CLI SHALL write in the order report,
email, history, `--ci-out`, stdout. On an email write failure it SHALL exit 1
with the email path (not the temporary name), keep an already written report,
and SHALL NOT write the history/`--ci-out` or print the JSON/CI stdout. No
partial email SHALL remain.

#### Scenario: Collision

- **WHEN** `--email` resolves to an input, the logo, `--out`, `--ci-out` or the
  history file
- **THEN** the CLI exits 2
- **AND** nothing is written

#### Scenario: Email write failure

- **WHEN** the email cannot be written after the report or summary
- **THEN** the CLI exits 1 and names the email path
- **AND** the report stays
- **AND** the history and `--ci-out` are not written and the JSON/CI stdout is
  not printed
- **AND** no partial email remains

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
