# Spec Delta

## ADDED Requirements

### Requirement: Accept ISO 8601-shaped history timestamps

The history reader SHALL accept a timestamp with a zone (`Z` or `±HH:MM`),
optional seconds and optional fractional seconds, and a finite `Date.parse`.
It SHALL keep the original string. It SHALL reject a zone-less or free-text
value with the existing malformed-entry error. The CLI's newly recorded
`recordedAt` SHALL keep the existing `YYYY-MM-DDTHH:mm:ss.sssZ` form. A read
SHALL NOT rewrite the file.

#### Scenario: Writer form is accepted

- **WHEN** a sidecar contains `2026-11-19T08:00:00.000Z`
- **THEN** the reader accepts the run
- **AND** the stored string is unchanged

#### Scenario: Z without milliseconds

- **WHEN** a sidecar contains `2026-11-19T08:00:00Z`
- **THEN** the reader accepts the run
- **AND** the stored string keeps its original form

#### Scenario: Positive offset

- **WHEN** a sidecar contains `2026-11-19T08:00:00+02:00`
- **THEN** the reader accepts the run
- **AND** `recordedAt` keeps the offset rather than being converted to `Z`

#### Scenario: Negative offset and optional seconds

- **WHEN** a sidecar contains `2026-11-19T08:00-05:30` or a fraction such as
  `2026-11-19T08:00:00.123456789Z`
- **THEN** the reader accepts the run into the same validation path

#### Scenario: Zone-less value is rejected

- **WHEN** a sidecar contains `2026-11-19T08:00:00`
- **THEN** the CLI exits 1 with the existing malformed-entry error naming the
  file
- **AND** the file is not rewritten

#### Scenario: Free text is rejected

- **WHEN** a sidecar contains `yesterday` or another non-ISO value
- **THEN** the reader rejects it with the existing malformed-entry error
- **AND** the file is not rewritten

#### Scenario: Read is byte-identical

- **WHEN** a valid sidecar with any accepted ISO form is read
- **THEN** its bytes and modification time are unchanged
