# Spec Delta

## ADDED Requirements

### Requirement: Show skipped attachment names and reasons

When a scenario has skipped path attachments, its detail SHALL show a localized
notice with the count and up to three entries of the form `name - reason`. Names
and reasons SHALL be escaped, included in print and readable without JavaScript.
When more than three entries exist, the notice SHALL state the remaining count.

#### Scenario: One skipped attachment

- **WHEN** a scenario skipped `checkout.png` because it was missing
- **THEN** the scenario notice shows the count and `checkout.png - missing`

#### Scenario: Mixed reasons

- **WHEN** a scenario skipped one outside-root and one unreadable attachment
- **THEN** its notice lists both names with their own reasons

#### Scenario: More than three

- **WHEN** a scenario skipped five attachments
- **THEN** its notice lists the first three
- **AND** states that two more were skipped

#### Scenario: Escaping and print

- **WHEN** a skipped attachment name contains HTML, OSC or bidi characters
- **THEN** the rendered name is escaped and sanitized
- **AND** the notice is included in the print stylesheet

## MODIFIED Requirements

### Requirement: Show a skipped-attachment notice

When the run skipped path attachments, the report SHALL render one static,
escaped notice in the shared shell, visible on both the Report and Details
tabs. The notice SHALL name the count and point to the affected scenarios. It
SHALL NOT contain an absolute local path or claim that every skip is outside the
roots. The footer SHALL say that attachments are embedded when available and
SHALL NOT claim that every screenshot is embedded.

#### Scenario: Singular notice

- **WHEN** exactly one path attachment was skipped
- **THEN** the notice says that one path attachment was skipped
- **AND** it points to the affected scenario
- **AND** it does not contain an absolute path

#### Scenario: Plural notice

- **WHEN** two or more path attachments were skipped
- **THEN** the notice names the count and uses the plural wording
- **AND** it points to the affected scenarios

#### Scenario: Both tabs

- **WHEN** the notice is rendered
- **THEN** it is visible on the Report tab and remains visible on Details
- **AND** it needs no JavaScript

#### Scenario: Alignment

- **WHEN** the notice is rendered at 1440 or 320 px
- **THEN** its left and right edges align with the run header

#### Scenario: Clean report

- **WHEN** no path attachment was skipped
- **THEN** no notice is rendered
- **AND** no warning markup appears in the body
- **AND** the footer keeps the neutral sentence
- **AND** only the shared stylesheet and the footer sentence differ from the
  previous report bytes

#### Scenario: Narrow viewport and text zoom

- **WHEN** the report is viewed at 320 px or at 200 % text zoom
- **THEN** the notice wraps without horizontal page overflow

### Requirement: Show skipped attachments on the scenario

When a scenario carries a positive skipped-attachment count, the scenario detail
SHALL show the localized notice with that count and up to three name/reason
entries. A failed-hook attachment SHALL remain rendered beside that hook. The
notice SHALL be plain text, escaped and included in print.

#### Scenario: Scenario notice

- **WHEN** a rendered scenario has a skipped count of one
- **THEN** its detail shows the notice once with the entry
- **AND** the run-level notice still appears

#### Scenario: Entry cap

- **WHEN** a rendered scenario has five skipped entries
- **THEN** its detail lists three and states that two more were skipped

#### Scenario: Failed hook attachment

- **WHEN** a failed hook carries an attachment
- **THEN** the hook renders its attachment beside the hook
- **AND** the attachment remains in the scenario attachment list
