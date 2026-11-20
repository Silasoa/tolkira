# Spec Delta

## ADDED Requirements

### Requirement: Localize the PDF through the report

The PDF SHALL use the report's resolved locale for text, numbers, percentages,
durations and dates; it SHALL NOT add a PDF-specific catalog key. The default
title and test data SHALL render verbatim; the CLI, JSON and CI text SHALL stay
English.

#### Scenario: German PDF

- **WHEN** `--pdf run.pdf --locale de` is used
- **THEN** the PDF labels, counts, pass rate, duration and dates are German
- **AND** the report title and test data are unchanged

#### Scenario: English PDF

- **WHEN** no locale is given
- **THEN** the PDF is English
- **AND** no catalog key is added for the PDF
