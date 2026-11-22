# Spec Delta

## MODIFIED Requirements

### Requirement: Show the exact report HTML size

The report-size row SHALL show the exact UTF-8 byte length of the final HTML
file and SHALL use the same units as the contributor rows above it. At 1 MiB and
above it SHALL lead with the exact locale-formatted byte count and add
one-decimal locale-formatted MB in parentheses; below 1 MiB it SHALL show the
exact byte count alone. The calculation SHALL use one full-document byte
measurement and a marker pinned to an empty element, so text content cannot
collide with it. It SHALL NOT alter the CSP, the script hashes or offline
behaviour.

#### Scenario: Size label is exact

- **WHEN** the final HTML is written
- **THEN** the leading byte count equals the file's UTF-8 byte length

#### Scenario: Size label matches the contributor units

- **WHEN** the final HTML is 1 MiB or larger
- **THEN** the row shows the exact byte count followed by one-decimal MB in
  parentheses
- **AND** the leading byte count equals the file's UTF-8 byte length

#### Scenario: Small report keeps exact bytes

- **WHEN** the final HTML is below 1 MiB
- **THEN** the row shows the exact byte count and no MB value

#### Scenario: Locale formatting

- **WHEN** the active locale is German and the report is 1 MiB or larger
- **THEN** the MB value and the byte count use German separators and the
  `format.megabytes` / `format.bytes` units

#### Scenario: Marker token in escaped content

- **WHEN** an attachment or test name contains the marker token
- **THEN** the escaped content renders unchanged
- **AND** only the report-size element is replaced
