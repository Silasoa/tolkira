# Spec Delta

## ADDED Requirements

### Requirement: Keep the skipped attachment count on the Playwright attempt

The Playwright parser SHALL count path attachments skipped because every candidate
is outside the allowed roots on the final attempt and SHALL carry that count on
the attempt. The run-level skipped count SHALL remain. The report model SHALL copy
the final attempt's count to the internal `ReportScenario`. No JSON, CI or email
schema changes.

#### Scenario: One scenario outside the roots

- **WHEN** a final Playwright attempt has two path attachments outside the roots
- **THEN** the attempt and its scenario carry a skipped count of two
- **AND** the run-level count still counts both

#### Scenario: Inside the roots

- **WHEN** a path attachment resolves inside the allowed roots
- **THEN** the scenario's skipped count is zero
- **AND** the attachment renders normally

#### Scenario: Non-final attempt

- **WHEN** an earlier attempt skips a path attachment but the final attempt does
  not
- **THEN** the scenario's skipped count comes from the final attempt only
