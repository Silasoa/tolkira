# Spec Delta

## ADDED Requirements

### Requirement: Expose earlier attempts for retried scenarios

The input index SHALL keep every `testCaseStarted` per pickle in input order.
For a scenario with more than one start, the internal report model SHALL expose
up to three executed earlier attempts with attempt number, status, duration and
the first failure message. Legacy JSON, which has no retry data, SHALL expose
none.

#### Scenario: Playwright retry

- **WHEN** a Playwright test has a failed attempt followed by a passed attempt
- **THEN** the report model has one earlier attempt with its failed status,
  duration and first failure message
- **AND** the final attempt remains the rendered scenario result

#### Scenario: Messages retry

- **WHEN** a Messages input has multiple test-case starts for one pickle
- **THEN** the earlier executed starts appear in the model in input order
- **AND** the display number comes from that order, not a repeated or missing
  `attempt` value
- **AND** a Messages earlier image is not embedded by this change

#### Scenario: Single attempt

- **WHEN** a scenario has one start
- **THEN** it has no earlier-attempt evidence
- **AND** the existing `Attempt: 1` metadata is unchanged or hidden as today

### Requirement: Bound earlier-attempt evidence per report

Earlier evidence SHALL include at most one image per report, from the first
failed displayed earlier attempt in the first eligible scenario. It SHALL be
included only for a single-input Playwright report, when the final attachments
leave at least 10 MB of the 100 MB cap, and when the image fits the 10 MB
retry-evidence budget. Multi-input Playwright reports SHALL show earlier
status/error/duration without an earlier image. Reading SHALL keep the existing
root, symlink, media-type and size checks; final attachments SHALL be planned
first across all scenarios so they always win the budget.

#### Scenario: Image within budget

- **WHEN** a single-input Playwright report has a first failed displayed earlier
  attempt with a readable screenshot below the budget
- **THEN** the report embeds that one image in the earlier-attempt block
- **AND** the summary attachment counts and bytes stay final-attempt-only

#### Scenario: Multi-input report

- **WHEN** two or more Playwright inputs are merged
- **THEN** earlier-attempt blocks show status, duration and error
- **AND** no earlier image is embedded

#### Scenario: Budget or cap reached

- **WHEN** the final attachments leave less than 10 MB or the earlier image
  would exceed the retry-evidence budget
- **THEN** it is omitted
- **AND** the run still succeeds when the final attachments are valid

#### Scenario: No image

- **WHEN** the first failed displayed earlier attempt has no image
- **THEN** the block shows status, duration and error only

### Requirement: Keep earlier probes out of final diagnostics

An earlier-attempt probe SHALL NOT change the summary attachment count or bytes
and SHALL NOT increase the run-level skipped count. Final-attempt skip
diagnostics SHALL stay authoritative.

#### Scenario: Earlier skip does not count

- **WHEN** an earlier-attempt probe finds a path outside the roots
- **THEN** it does not increase the run-level skipped count
- **AND** the final-attempt skip diagnostics stay authoritative

### Requirement: Keep retry evidence out of machine outputs

Earlier attempts SHALL remain out of the JSON summary, `--json`, CI text, email
and history sidecar. The summary schema SHALL stay version 2 and the history
schema version 1.

#### Scenario: Summary unchanged

- **WHEN** a retried Playwright scenario is summarized
- **THEN** its summary scenario is the final attempt
- **AND** no earlier-attempt field appears in the JSON
