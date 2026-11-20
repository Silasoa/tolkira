# Spec Delta

## ADDED Requirements

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
