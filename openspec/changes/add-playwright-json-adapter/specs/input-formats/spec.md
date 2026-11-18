# Spec Delta

## ADDED Requirements

### Requirement: Accept Playwright JSON reports

Tolkira SHALL accept a Playwright JSON reporter file as an input. It SHALL
recognise it from the parsed shape and SHALL treat it as a supported producer,
not as malformed Cucumber JSON.

#### Scenario: Native Playwright JSON is accepted

- **WHEN** the user passes a JSON object with Playwright `config`, `suites` and
  `stats` fields
- **THEN** Tolkira normalises it and renders the report
- **AND** the report identifies Playwright as the producer

#### Scenario: Explicit and directory inputs

- **WHEN** the user passes a Playwright JSON file explicitly or through a
  directory scan
- **THEN** the file is included exactly once, in stable order

#### Scenario: Other JSON is not misclassified

- **WHEN** the input is Cucumber legacy JSON, Cucumber Messages or JUnit XML
- **THEN** the existing adapter still handles it
- **AND** an arbitrary JSON object remains an unsupported input

#### Scenario: Empty run

- **WHEN** a Playwright report has no suites and no run-level errors
- **THEN** Tolkira accepts it as an empty run
- **AND** the report shows zero scenarios rather than an unsupported-input error

### Requirement: Map Playwright hierarchy and projects

The adapter SHALL preserve the Playwright project, file and describe context.
A project SHALL become the feature grouping; the file and describe path SHALL
become the rule; a spec SHALL become a scenario. A spec run in several
projects SHALL produce one scenario per project.

#### Scenario: Projects are distinct

- **WHEN** one spec ran in projects `chromium` and `firefox`
- **THEN** the report contains a scenario for each project
- **AND** the project names are visible in the feature grouping

#### Scenario: One project with several files

- **WHEN** two files run in the same project
- **THEN** they share the project feature
- **AND** their rules keep the file path

#### Scenario: Nested describes are preserved

- **WHEN** a spec is nested under several `test.describe` suites
- **THEN** the describe titles appear in the rule path
- **AND** trailing `@tag` tokens are removed from the scenario and rule names

#### Scenario: Tags and annotations survive

- **WHEN** a spec has Playwright tags or test annotations
- **THEN** the tags are normalised to `@tag` and available to search and filters
- **AND** annotation type and description are visible in the scenario description

### Requirement: Preserve retries and final status

The adapter SHALL use the last Playwright result as the rendered attempt and
SHALL expose the retry index. A flaky test that passed on retry SHALL render as
passed with a retry attempt; a test that never passed SHALL render as failed.

#### Scenario: Flaky test passed on retry

- **WHEN** the first result failed and the second result passed
- **THEN** the scenario is passed
- **AND** its attempt is the second attempt
- **AND** it is marked as flaky

#### Scenario: Failed after retries

- **WHEN** every result failed, timed out or was interrupted
- **THEN** the scenario is failed
- **AND** the last error is visible

#### Scenario: Skipped test

- **WHEN** a test has skipped status and no executed steps
- **THEN** the scenario is skipped
- **AND** it does not count as passed

#### Scenario: Expected failure

- **WHEN** a test is marked as an expected failure and its final result failed
- **THEN** the scenario is not counted as a regression
- **AND** it is marked as an expected failure

#### Scenario: Unexpected pass

- **WHEN** a test is expected to fail but its final result passed
- **THEN** the scenario is failed
- **AND** the unexpected pass is marked in the report

#### Scenario: No results

- **WHEN** a test has no results
- **THEN** the scenario remains visible as unexecuted
- **AND** it is not rendered as passed or skipped

### Requirement: Preserve Playwright steps and errors

The adapter SHALL preserve Playwright step titles, durations, nesting and
errors. It SHALL expose the error message, snippet and source location without
executing or rendering untrusted HTML.

#### Scenario: Nested steps

- **WHEN** a result contains nested steps
- **THEN** every step is visible in order
- **AND** its duration is preserved
- **AND** only the step carrying the error is failed

#### Scenario: Failure detail

- **WHEN** a result has an error but no step carries it
- **THEN** the scenario is failed
- **AND** a synthetic failed error step shows the message
- **AND** all other steps keep their own status

#### Scenario: Timed out or interrupted

- **WHEN** a result status is `timedOut` or `interrupted`
- **THEN** the scenario is failed
- **AND** the status is not silently treated as passed

#### Scenario: Source paths are relative

- **WHEN** an error location contains an absolute path
- **THEN** the report shows a path relative to the input root or its basename
- **AND** no absolute local path is embedded in the report

#### Scenario: Control codes are stripped

- **WHEN** an error message or snippet contains ANSI or C0/C1 control codes
- **THEN** the report text contains no control codes
- **AND** the readable message is preserved

### Requirement: Preserve attachments safely

The adapter SHALL preserve inline Playwright attachments and SHALL embed path
attachments only when the resolved regular file stays inside the input file's
directory or the process working directory. It SHALL reject remote URLs and
SHALL apply the existing attachment size, media-type and total-byte limits.

#### Scenario: Inline body attachment

- **WHEN** a result has an attachment with a base64 `body`
- **THEN** the report contains a data attachment with its declared content type

#### Scenario: Safe path attachment

- **WHEN** an attachment path resolves to a regular file inside the input
  file's directory or the process working directory
- **THEN** the file is embedded in the report

#### Scenario: Unsafe or missing path

- **WHEN** an attachment path is outside both roots, a symlink, missing or not
  a regular file
- **THEN** it is skipped
- **AND** the report still renders without reading that path

#### Scenario: Standard output

- **WHEN** a result has `stdout` or `stderr` entries
- **THEN** their text is preserved as text attachments
- **AND** buffer entries are decoded, not rendered as HTML

#### Scenario: Markdown error context

- **WHEN** an attachment has `text/markdown`
- **THEN** the report renders it as escaped readable text
- **AND** it is not offered only as a binary download

#### Scenario: Attachment limits

- **WHEN** an attachment exceeds the per-file or total limit
- **THEN** generation fails with a clear error
- **AND** no partial report is written

### Requirement: Report Playwright run-level errors

When Playwright reports configuration or runner errors outside a test, Tolkira
SHALL surface them instead of rendering an apparently empty run.

#### Scenario: Global error without suites

- **WHEN** a Playwright report has no suites but a non-empty `errors` array
- **THEN** the report contains a failed Playwright error scenario
- **AND** the error message and location are visible as text

### Requirement: Reject malformed Playwright input clearly

The adapter SHALL validate the Playwright report shape and SHALL fail with a
file-specific error when required fields are missing or malformed. It SHALL NOT
write a partial report.

#### Scenario: Malformed suites

- **WHEN** `suites` is not an array or a suite has an invalid shape
- **THEN** generation fails with a clear Playwright error naming the file
- **AND** no partial report is written

#### Scenario: Merged inputs stay deterministic

- **WHEN** several Playwright or Cucumber inputs are merged
- **THEN** feature and scenario order is stable
- **AND** generated IDs do not collide

### Requirement: State Playwright basic-mode limits

The report and docs SHALL make clear what the Playwright adapter does not
support.

#### Scenario: Unsupported artifacts

- **WHEN** a Playwright report is opened
- **THEN** no trace viewer, video player or HTML-report replay is claimed
- **AND** the docs state that outside-tree path attachments are skipped
