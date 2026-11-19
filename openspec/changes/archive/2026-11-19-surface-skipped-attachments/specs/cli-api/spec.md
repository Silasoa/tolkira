# Spec Delta

## ADDED Requirements

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
