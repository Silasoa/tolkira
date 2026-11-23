# Spec Delta

## ADDED Requirements

### Requirement: Format byte counts from numeric parameters

The render paths that render a byte count through `format.bytes` SHALL pass the
numeric count, not a pre-formatted string, so a target catalog can add a plural
branch to that key and the formatter can select its category. The byte-count
text SHALL stay the same for the default English and German catalogs; the German
narrow layout change is separate.

#### Scenario: Plural byte branch

- **WHEN** a target catalog defines `format.bytes` with a plural branch and a
  report renders an English or German byte count
- **THEN** the formatter selects the branch from the numeric count
- **AND** the `one` and `other` categories are selected by the count
- **AND** a grouped German string is never parsed as a number

#### Scenario: Unchanged byte-count text

- **WHEN** the default English or German catalog renders a byte-count message
- **THEN** its text is the same as before this change
