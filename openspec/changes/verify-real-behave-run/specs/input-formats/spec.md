# Spec Delta

## ADDED Requirements

### Requirement: Keep a verified real Behave producer run

The repository SHALL contain a legacy JSON fixture produced by a real Behave
1.3.3 run, not a hand-written approximation. The run SHALL cover a multiline
doc string, a data table, an inline PNG attachment, a failed assertion with a
multiline error message and a step with an `error` result. The fixture SHALL be
accompanied by the producer feature, its step definitions, the attached image
and a provenance record.

#### Scenario: Producer source is reproducible

- **WHEN** the provenance record is inspected
- **THEN** it names Behave 1.3.3, the exact Python version, the container image,
  the run date and the command that writes the JSON
- **AND** the feature, step definitions and image needed to repeat the run are
  in the repository

#### Scenario: Recorded output is intact

- **WHEN** the raw recorded JSON is inspected
- **THEN** the doc string `text` is an array of lines
- **AND** the failed assertion's `error_message` is an array of lines
- **AND** the step that raises a non-assertion exception has `status: "error"`
- **AND** the image embedding has `mime_type: "image/png"` and a base64 body

#### Scenario: Fixture is public-safe

- **WHEN** the recorded JSON, feature, step definitions, image and provenance
  are scanned
- **THEN** they contain no absolute host path, token, credential, personal data
  or private URL
- **AND** the recorded JSON contains only relative source paths
- **AND** the provenance records the scan result and keeps any public link
  only to the tracking issue

### Requirement: Accept Behave line-array step text and error messages

When a legacy Behave step carries `text` or `result.error_message` as an array
of lines, Tolkira SHALL normalise it to one text value before the report model
reads it. A string value SHALL keep its current meaning. Any other value shape
SHALL be rejected with a clear legacy-JSON error that names the file and field,
before rendering starts.

#### Scenario: Line-array doc string renders

- **WHEN** a real Behave step has `text` with two lines
- **THEN** the adapter emits a doc string whose content contains both lines
  separated by a newline
- **AND** the report shows both lines instead of failing to render

#### Scenario: String doc string is unchanged

- **WHEN** a legacy step has a string-valued `text` with two newline-separated
  lines
- **THEN** the adapter emits the same content as before
- **AND** no extra newline is added

#### Scenario: Line-array error message renders

- **WHEN** a real Behave failed step has `error_message` with two lines
- **THEN** the adapter emits one message containing both lines separated by a
  newline
- **AND** the report shows the message on the failed step

#### Scenario: Invalid value shapes are rejected clearly

- **WHEN** `text` or `result.error_message` is a number, an object or an array
  containing a non-string value
- **THEN** generation fails with a clear `Invalid legacy JSON` error naming the
  field
- **AND** no report file is written

#### Scenario: Doc strings and errors remain text

- **WHEN** a line-array doc string or error message contains HTML-like or
  script-like text
- **THEN** it is rendered as escaped text
- **AND** it is never executed as markup

### Requirement: Accept Behave error and hook-error result statuses

Behave 1.3.3 step results use `error` and `hook_error`; `cleanup_error` is
recorded on the scenario/feature during context cleanup. When a legacy step
result has the status `error`, `hook_error`, or `cleanup_error` (accepted
defensively if a producer writes it in a step result), Tolkira SHALL accept the
file and SHALL treat the step as failed. It SHALL NOT reject the report as
malformed and SHALL NOT count the step as passed.

#### Scenario: A real error status renders as failed

- **WHEN** a real Behave step raises a non-assertion exception and its result
  status is `error`
- **THEN** the report renders
- **AND** the step and its scenario are failed

#### Scenario: Hook and defensive cleanup errors render as failed

- **WHEN** a step result carries `hook_error` or a producer writes
  `cleanup_error` in a step result
- **THEN** the step is failed
- **AND** the scenario is not silently passed

#### Scenario: Error without producer text

- **WHEN** Behave writes no `error_message` for an `error` or `hook_error` step
  result, or a producer writes `cleanup_error` in a step result without text
- **THEN** the report still renders the failed scenario
- **AND** the documentation states that Behave omits that detail

#### Scenario: Existing statuses stay unchanged

- **WHEN** a legacy result status is passed, failed, skipped, pending,
  undefined, ambiguous or unknown
- **THEN** the existing mapping is unchanged

#### Scenario: Unsupported Behave modes are documented

- **WHEN** a Behave report uses a dry-run or WIP status that Tolkira does not
  map, such as `untested` or `pending_warn`
- **THEN** the dated limitations state that the mode is unsupported
- **AND** Tolkira does not present that report as fully verified

### Requirement: Verify the real Behave fixture end to end

The real Behave fixture SHALL be exercised through the legacy adapter, the API
summary and the HTML report. The verification SHALL assert the producer values,
not only that the parser accepts the file.

#### Scenario: Adapter values

- **WHEN** the fixture is parsed
- **THEN** the doc string content, data-table headings and rows, attachment
  media type and attachment body match the recorded producer output
- **AND** the decoded attachment bytes equal the fixture image bytes
- **AND** the seconds-based durations yield non-zero milliseconds

#### Scenario: Summary values

- **WHEN** the fixture is summarised
- **THEN** the summary reports one passed and two failed scenarios
- **AND** it counts the attachment and its bytes
- **AND** the run status is failed

#### Scenario: Report values

- **WHEN** the fixture is rendered
- **THEN** the report shows both doc-string lines, the table values, the
  multiline error message and the image attachment
- **AND** the error scenario is visible as failed
