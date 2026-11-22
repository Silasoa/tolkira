# Spec Delta

## ADDED Requirements

### Requirement: Show report-size contributors

The Details Run panel SHALL show the unique processed report file count and
bytes, the attachment count and decoded bytes, the final report HTML bytes and
the three largest attachments by decoded bytes. Values SHALL use the active
locale; the summary schema SHALL stay unchanged.

#### Scenario: Contributors are visible

- **WHEN** a report has inputs, attachments and a rendered HTML file
- **THEN** Details shows the report-file, attachment and report byte totals
- **AND** it lists the three largest attachments in descending byte order

#### Scenario: Step-level attachment appears once

- **WHEN** a step or hook attachment is also part of its scenario's attachment
  list
- **THEN** the largest-attachments list contains that attachment once
- **AND** the count matches the run's attachment count

### Requirement: Explain and omit size rows

The panel SHALL mark the rows as contributors, not an additive sum: inline media
inside a report file counts toward that file's bytes, while external path
attachments count only in the decoded attachment row. It SHALL omit the input
row without input bytes and the largest row without attachments.

#### Scenario: Contributor note

- **WHEN** the panel shows the size rows
- **THEN** it states that attachment bytes are decoded payloads from inline or
  external files and the rows are not additive

#### Scenario: No input bytes

- **WHEN** the stream or direct `renderHtml` path provides no input byte count
- **THEN** the input row is omitted
- **AND** the attachment and report rows still render

#### Scenario: No attachments

- **WHEN** the run has no attachments
- **THEN** the attachment row shows zero and the largest-attachments row is
  omitted

### Requirement: Show the exact report HTML size

The report-size row SHALL equal the UTF-8 byte length of the final HTML file.
The calculation SHALL use one full-document byte measurement and a marker
pinned to an empty element, so text content cannot collide with it. It SHALL NOT
alter the CSP, the script hashes or offline behaviour.

#### Scenario: Size label is exact

- **WHEN** the final HTML is written
- **THEN** the displayed report size equals the file's UTF-8 byte length

#### Scenario: Marker token in escaped content

- **WHEN** an attachment or test name contains the marker token
- **THEN** the escaped content renders unchanged
- **AND** only the report-size element is replaced

### Requirement: Explain large-report warnings

The CLI `--max-size` warning SHALL name the final report HTML size, the report
file bytes and the decoded attachment bytes in one warning. It SHALL keep the
existing threshold and still write the report. The JSON summary, CI text and
email SHALL not gain size fields.

#### Scenario: Report above the threshold

- **WHEN** the report exceeds `--max-size`
- **THEN** the warning names the report, report-file and attachment sizes
- **AND** the report is still written

#### Scenario: Report below the threshold

- **WHEN** the report is below the threshold
- **THEN** no size warning is printed
