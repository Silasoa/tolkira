# Spec Delta

## MODIFIED Requirements

### Requirement: Document the history schema

The sidecar SHALL use `schemaVersion: 1` and entries with `id`, `recordedAt`
(ISO), `title` (the resolved report title), `status`, `counts` (features,
scenarios, steps), `durationMs`, `attachments` (total, bytes) and an optional
`flaky` count. It SHALL NOT contain scenario names, step text, paths, tags or
attachment content. Unknown fields SHALL be ignored within schema version 1.

#### Scenario: Aggregate-only entry

- **WHEN** a run is recorded
- **THEN** the entry contains only the documented aggregate fields
- **AND** old entries may omit `flaky`
- **AND** the documentation shows the schema, the retention and dedupe rules,
  and that a shared report embeds the prior-run aggregates it was generated with
