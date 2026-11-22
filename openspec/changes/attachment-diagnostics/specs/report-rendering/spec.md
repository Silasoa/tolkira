# Spec Delta

## ADDED Requirements

### Requirement: Show skipped attachments on the scenario

When a scenario carries a positive skipped-attachment count, the scenario detail
SHALL show the existing localized path-attachment notice with that count in
addition to the run-level notice. A failed-hook attachment SHALL remain rendered
beside that hook. The notice SHALL be plain text, escaped and included in print.

#### Scenario: Scenario notice

- **WHEN** a rendered scenario has a skipped count of one
- **THEN** its detail shows the path-attachment notice once
- **AND** the run-level notice still appears

#### Scenario: Failed hook attachment

- **WHEN** a failed hook carries an attachment
- **THEN** the hook renders its attachment beside the hook
- **AND** the attachment remains in the scenario attachment list
