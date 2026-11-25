# input-formats Specification

## Purpose
Defines how Tolkira reads, detects, validates and merges Cucumber test-result
inputs without losing screenshots or attachments.

## Requirements

### Requirement: Accept legacy Cucumber JSON and Cucumber Messages

Tolkira SHALL accept both legacy Cucumber JSON reports and Cucumber Messages
NDJSON as input. It SHALL detect the format from the input content and
extension, and SHALL reject unsupported input with a clear error.

#### Scenario: Legacy JSON is recognised
- **WHEN** the user passes a Cucumber legacy JSON report
- **THEN** Tolkira treats it as a legacy JSON report and proceeds to normalise it

#### Scenario: Messages NDJSON is recognised
- **WHEN** the user passes an NDJSON file containing Cucumber Messages envelopes
- **THEN** Tolkira treats it as a Messages report and proceeds to render it

#### Scenario: Unsupported input is rejected
- **WHEN** the user passes a file that is neither legacy JSON nor Messages
- **THEN** Tolkira exits with a clear error and writes no report

### Requirement: Merge multiple inputs deterministically

Tolkira SHALL accept more than one input file or directory and SHALL merge the
results into one report. The order of features and scenarios SHALL be stable
for the same inputs. Deterministic order SHALL NOT depend on the host or process
locale. Every deterministic sort — summary scenarios, resolved input files,
baseline not-in-this-run rows and report tag order — SHALL use one shared
comparator that orders strings by UTF-16 code units. The same inputs SHALL
produce byte-identical `--json`, CI Markdown and report order under different
host locales. The visible order for non-ASCII names changes and SHALL be
documented. No runtime dependency SHALL be added.

#### Scenario: Two reports become one

- **WHEN** the user passes two reports containing different features
- **THEN** the generated report contains both features

#### Scenario: Directory input is expanded

- **WHEN** the user passes a directory containing supported report files
- **THEN** Tolkira reads every supported file in a stable order

#### Scenario: Host locale does not change the output

- **WHEN** the same input with the names `apple`, `Zebra` and `Äpfel` is
  processed under a `sv_SE` locale and a `de_DE` locale
- **THEN** the `--json` bytes are identical
- **AND** the Markdown CI bytes are identical
- **AND** the scenario order is the fixed UTF-16 code-unit order

#### Scenario: Report feature and tag order

- **WHEN** a directory input and a run with tags are rendered under two fixed
  locales
- **THEN** the report feature order follows the fixed resolved-input order
- **AND** the tag order is identical

#### Scenario: Non-ASCII order is documented

- **WHEN** the change is released
- **THEN** the changelog states that the visible order for non-ASCII names
  changed
- **AND** no runtime dependency was added

### Requirement: Preserve legacy embeddings as attachments

When normalising legacy JSON, Tolkira SHALL convert `embeddings` entries into
Cucumber Messages attachments, including their media type and base64 data.
Screenshots SHALL remain viewable in the generated report.

#### Scenario: Screenshot survives normalisation
- **WHEN** a legacy JSON step contains a base64 PNG embedding
- **THEN** the generated report contains an image attachment for that step

#### Scenario: Text attachment survives normalisation
- **WHEN** a legacy JSON step contains a text embedding
- **THEN** the generated report contains a readable text attachment for that step

### Requirement: Preserve legacy test detail

Tolkira SHALL preserve statuses, durations, tags, hooks, background steps,
expanded scenario-outline rows, data tables, doc strings and error messages when
normalising legacy JSON.

#### Scenario: Failed step keeps its error
- **WHEN** a legacy JSON step has a failed status and an error message
- **THEN** the generated report shows the failure and the error message

#### Scenario: Scenario outline rows are preserved
- **WHEN** a legacy JSON report contains two example rows of a scenario outline
- **THEN** both rows appear as separate scenarios with their statuses

Reconstructing the original outline `examples` table is a documented limitation
of the legacy format and is not required for v0.1.

### Requirement: Reject malformed input without partial output

Tolkira SHALL stop on malformed or unparseable input, return a non-zero exit
code and SHALL NOT leave a partially written report file.

#### Scenario: Invalid JSON
- **WHEN** the input is not valid JSON or NDJSON
- **THEN** Tolkira reports the parse error and writes no report file

### Requirement: Accept JUnit XML as a basic input

Tolkira SHALL accept JUnit XML files and map suites and test cases into the
existing report model. This is a basic mode: no Gherkin steps and no
screenshots are claimed.

#### Scenario: A passing and a failing test case

- **WHEN** a JUnit XML file contains one passing and one failing `<testcase>`
- **THEN** the report shows two scenarios, one passed and one failed
- **AND** the failure text is visible on the failed scenario

#### Scenario: Skipped test case

- **WHEN** a `<testcase>` contains `<skipped>`
- **THEN** the scenario status is skipped

#### Scenario: Duration

- **WHEN** a `<testcase>` has `time="1.234"`
- **THEN** the scenario duration is 1234 ms

#### Scenario: System output

- **WHEN** a `<testcase>` contains `<system-out>` or `<system-err>`
- **THEN** the text is available as a text attachment
- **AND** it is never executed as HTML

### Requirement: Detect JUnit XML in files and directories

The loader SHALL recognise `.xml` JUnit files by content and SHALL include them
when scanning a directory. A zero-test JUnit document — well-formed JUnit XML
with no `<testcase>` anywhere — SHALL be skipped when it is found in a directory
scan only if it is exactly one recognised `<testsuites>`, `<testsuite>` or
`<testcase>` root. A zero-test JUnit document that is named explicitly SHALL
fail with a clear file-specific error; a file that is also named explicitly is
treated as explicit even when a scanned directory contains it. Malformed XML, a
wrapper root, a multi-root document and a `<testcase>` under an unrecognised
element SHALL still fail, including in a directory.

#### Scenario: Directory scan

- **WHEN** a directory contains a JUnit `.xml` file
- **THEN** the report includes its suites and test cases

#### Scenario: Empty document in a directory

- **WHEN** a directory contains one JUnit document with test cases and one
  zero-test JUnit document
- **THEN** generation succeeds
- **AND** the report includes the test cases from the document with test cases
- **AND** the zero-test document contributes no scenario or feature

#### Scenario: Empty document named explicitly

- **WHEN** an explicit JUnit document has no `<testcase>`
- **THEN** generation fails with a clear file-specific error
- **AND** no report file is written

#### Scenario: File named explicitly inside a scanned directory

- **WHEN** a zero-test JUnit file is named explicitly and also lies inside a
  scanned directory
- **THEN** generation fails with the same clear file-specific error
- **AND** the directory scan does not downgrade it to a skipped file

#### Scenario: Only empty documents

- **WHEN** every JUnit document in a directory is zero-test and the directory
  has no other usable input
- **THEN** generation fails with a clear error
- **AND** no report file is written

#### Scenario: Mixed Cucumber and zero-test JUnit directory

- **WHEN** a directory contains Cucumber input with test cases and a zero-test
  JUnit document
- **THEN** generation succeeds
- **AND** the report includes the Cucumber results
- **AND** the zero-test document contributes no scenario or feature

#### Scenario: Malformed XML in a directory

- **WHEN** a directory contains a malformed JUnit document
- **THEN** generation fails with a clear file/line error
- **AND** the malformed document is not skipped as zero-test
- **AND** no partial report is written

#### Scenario: Malformed XML

- **WHEN** an explicit `.xml` file is not valid JUnit XML
- **THEN** generation fails with a clear file/line error
- **AND** no partial report is written

### Requirement: State the basic-mode limits

The report SHALL make clear that JUnit XML is a basic mode.

#### Scenario: No screenshots claimed

- **WHEN** a JUnit XML report is opened
- **THEN** no screenshot or Gherkin-step affordance is shown for that input
- **AND** the report still provides counts, durations, failures and filters

### Requirement: JUnit XML edge cases

The JUnit XML adapter SHALL handle common real-world suite shapes and SHALL fail
with a clear file-specific error for malformed XML.

#### Scenario: Nested suites and mixed statuses

- **WHEN** a JUnit document contains multiple or nested `testsuite` elements
- **THEN** every test case is summarised
- **AND** passed, failed, error and skipped cases have the expected status

#### Scenario: System output and entities

- **WHEN** a test case contains `system-out`, `system-err`, XML entities or
  CDATA
- **THEN** the readable text is preserved without breaking the report

#### Scenario: Failure without attributes

- **WHEN** a test case contains a text-only, CDATA-only or self-closing
  `<failure>` or `<error>` element
- **THEN** the test case is marked failed
- **AND** the text message is preserved when present

#### Scenario: Malformed XML

- **WHEN** a JUnit file is not well-formed XML
- **THEN** generation fails with an error that names the file

#### Scenario: Declarations in comments, CDATA and processing instructions

- **WHEN** `<!DOCTYPE>` or `<!ENTITY>` text appears inside a comment, CDATA
  section or processing instruction
- **THEN** it is treated as data and the document still parses
- **AND** declarations outside those constructs are still rejected

#### Scenario: DTD and entity declarations

- **WHEN** the document declares a `<!DOCTYPE>` or `<!ENTITY>` outside a
  comment, CDATA section or processing instruction, in any case
- **THEN** generation fails with an error that names the file and the rejected
  declaration
- **AND** processing instructions with ampersands are still accepted

#### Scenario: Mixed input

- **WHEN** a JUnit file is merged with legacy JSON or Messages
- **THEN** all scenarios appear in one report with stable ordering

### Requirement: Verify common JUnit producer shapes

The JUnit adapter SHALL remain covered by fixtures modelled on jest-junit,
pytest `junitxml` and Gradle XML, with documented provenance and shape.
Coverage SHALL include suites/test cases, `failure`, `error`, `skipped`,
durations and output fields where the producer writes them. This is
verification only; it adds no adapter behaviour.

#### Scenario: Jest style output

- **WHEN** a jest-junit shaped document contains passed, failed and skipped
  test cases and suite-level output
- **THEN** the report maps the statuses, failure text and durations
- **AND** the suite-level output is tolerated and not attached
- **AND** the fixture's provenance is recorded in the repository

#### Scenario: pytest style output

- **WHEN** a pytest shaped document contains `<properties>`, testcase-level
  `<system-out>`/`<system-err>` and a failing assertion
- **THEN** the report maps the suite and test cases without treating the
  properties as test cases
- **AND** the testcase output becomes an attachment
- **AND** the failing assertion text is visible

#### Scenario: Gradle style output

- **WHEN** a Gradle shaped document uses a root `<testsuite>` with
  `<properties>`, an `error` or `failure` and a skipped case
- **THEN** the report maps every test case
- **AND** suite-level output remains ignored as documented

#### Scenario: Provenance

- **WHEN** a fixture or its accompanying provenance file is inspected
- **THEN** it names the producer shape, version, date and synthetic/recorded
  status
- **AND** no real private path, token or personal data is included

### Requirement: Accept declaration-like text in JUnit data

The JUnit adapter SHALL reject `<!DOCTYPE>` and `<!ENTITY>` declarations only
when they appear as markup outside comments, CDATA sections and processing
instructions. Declaration-looking text inside those constructs SHALL be treated
as data.

#### Scenario: CDATA declaration text

- **WHEN** a failure or system-output CDATA section contains `<!DOCTYPE>` or
  `<!ENTITY>` text
- **THEN** the document parses and the text stays available as data
- **AND** the declaration content is still rejected outside CDATA

### Requirement: Report each Playwright error location once

The Playwright adapter SHALL include at most one `at <location>` line per error,
where the location is `<file>[:<line>[:<column>]]`. When the message or snippet
already contains that location as a complete token, the adapter SHALL NOT
append another location line. A longer line or column that merely starts with
the same digits SHALL NOT count as the same location.

#### Scenario: Message ends with the location

- **WHEN** an expected-failure message ends with the same
  `at <file>:<line>:<column>` that the error carries
- **THEN** the scenario description contains that location line exactly once

#### Scenario: Location inside a message

- **WHEN** the message or snippet contains the location inside another sentence
- **THEN** the adapter does not append a second location line

#### Scenario: Location prefix is not the location

- **WHEN** the location is `file:1` and the message only contains `file:12`
- **THEN** the adapter appends the `at file:1` line

#### Scenario: Message has no location

- **WHEN** the error carries a location and neither the message nor the snippet
  contains it
- **THEN** the adapter appends one location line

#### Scenario: Location without a column

- **WHEN** the error location has a file and line but no column
- **THEN** the appended location is `at <file>:<line>`

#### Scenario: Column in the text for a location without one

- **WHEN** the error location has a file and line but no column, and the
  message or snippet contains the same file and line followed by a column
- **THEN** the adapter does not append a second location line

### Requirement: Count Playwright path attachments skipped outside the roots

The Playwright adapter SHALL count each path attachment it skips on the final
attempt (outside roots, missing, unreadable, not a regular file, or non-local)
once. It SHALL NOT count inline bodies, trace zips, earlier attempts, or a
relative path that resolves inside a root through the working-directory
fallback. It SHALL expose the count; `generateReport` SHALL sum the counts
across inputs.

#### Scenario: Outside every root

- **WHEN** a final-attempt path attachment exists but its resolved target is
  outside an input file's folder and the working directory
- **THEN** the adapter counts it once
- **AND** it is not embedded

#### Scenario: Unavailable paths

- **WHEN** a final-attempt path is missing, a symlink, a non-regular file, a URL
  scheme, a UNC/device path or unreadable
- **THEN** it is skipped and counted once with its reason
- **AND** it is not embedded

#### Scenario: Working-directory fallback

- **WHEN** a relative path misses the input file's folder but exists inside the
  working directory
- **THEN** it is embedded
- **AND** it is not counted

#### Scenario: Inline body wins

- **WHEN** an attachment has a non-empty body and a path outside the roots
- **THEN** the body is embedded
- **AND** the path is not counted

#### Scenario: Trace and earlier attempts

- **WHEN** an attachment is a Playwright trace zip or belongs to an earlier
  attempt
- **THEN** it is not counted

#### Scenario: Multiple inputs

- **WHEN** two Playwright inputs each skip attachments
- **THEN** `generateReport` sums their counts into one notice
- **AND** an input included twice is counted once

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
projects SHALL produce one scenario per project. When a spec omits `file`, the
scenario URI and rule name SHALL use the enclosing suite's file. The feature
name SHALL use that file only when no project is present; with a project, the
project stays the feature grouping. An explicit spec `file` SHALL win.

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

#### Scenario: Scenario order is deterministic

- **WHEN** tests with and without path attachments share a suite
- **THEN** model and generated ids follow the source order
- **AND** attachment I/O cannot reorder scenarios
- **AND** rendering the same input twice yields identical HTML

#### Scenario: Tags and annotations survive

- **WHEN** a spec has Playwright tags or test annotations
- **THEN** the tags are normalised to `@tag` and available to search and filters
- **AND** annotation type and description are visible in the scenario description

#### Scenario: Spec without a file inherits the suite file

- **WHEN** a suite carries `file: "a.spec.ts"`, no project is present and one of
  its specs omits `file`
- **THEN** the scenario URI is `a.spec.ts`
- **AND** the rule name contains `a.spec.ts`
- **AND** the feature name is `a.spec.ts`
- **AND** `playwright.spec.ts` does not appear

#### Scenario: Project stays the feature grouping

- **WHEN** a spec without `file` runs in project `chromium` under a suite with
  `file: "a.spec.ts"`
- **THEN** the feature name remains `chromium`
- **AND** the scenario URI and rule name use `a.spec.ts`

### Requirement: Preserve retries and final status

The adapter SHALL use the last Playwright result as the rendered attempt and
SHALL expose the retry index. A flaky test that passed on retry SHALL render as
passed with a retry attempt; a test that never passed SHALL render as failed.
When `retry` values are missing or equal, the last result in array order SHALL
win; with distinct retry values the highest retry SHALL win. A test SHALL be
skipped only when its final result is skipped, or when it is marked skipped and
has no result. A failed or passed final result SHALL win over a skip marker: an
expected skip with a failed result SHALL render failed, and an expected skip
with a passed result SHALL render as an unexpected pass (failed). An expected
skip SHALL NOT take the expected-failure branch.

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

#### Scenario: Skipped test without results

- **WHEN** a test is marked skipped and has no results
- **THEN** the scenario remains visible as skipped
- **AND** it is not treated as an unknown unexecuted test

#### Scenario: Expected failure

- **WHEN** a test is marked as an expected failure and its final result
  failed, timed out or was interrupted
- **THEN** the scenario is not counted as a regression
- **AND** it is marked as an expected failure

#### Scenario: Unexpected pass

- **WHEN** a test is expected to fail but its final result passed
- **THEN** the scenario is failed
- **AND** the unexpected pass is marked in the report

#### Scenario: No results

- **WHEN** a non-skipped test has no results
- **THEN** the scenario remains visible as unexecuted
- **AND** it is not rendered as passed or skipped

#### Scenario: Missing retry values

- **WHEN** the first result failed and the second result passed, and neither
  result carries a `retry` value
- **THEN** the scenario is passed
- **AND** the rendered result is the second array element
- **AND** the first failure is not the final status

#### Scenario: Equal retry values

- **WHEN** the first result failed and the second result passed with the same
  `retry` value
- **THEN** the scenario is passed
- **AND** the rendered result is the second array element
- **AND** the first failure is not the final status

#### Scenario: Expected skip with a failed result

- **WHEN** `expectedStatus` is `skipped` and the final result failed
- **THEN** the scenario is failed
- **AND** the failure and its error are visible
- **AND** the scenario is not counted as skipped

#### Scenario: Expected skip with a passed result

- **WHEN** `expectedStatus` is `skipped` and the final result passed
- **THEN** the scenario is failed as an unexpected pass
- **AND** the unexpected pass is marked in the report
- **AND** it is not counted as passed or skipped

### Requirement: Preserve Playwright steps and errors

The adapter SHALL preserve Playwright step titles, durations, nesting and
errors. It SHALL expose the error message, snippet and source location without
executing or rendering untrusted HTML.

#### Scenario: Nested steps

- **WHEN** a result contains nested steps
- **THEN** every step is visible in order
- **AND** its duration is preserved
- **AND** only the step carrying the error is failed

#### Scenario: Step durations do not double-count

- **WHEN** a parent step's duration includes its child steps
- **THEN** the parent's visible duration excludes the children
- **AND** any remaining time up to the result duration is one explicit
  `Playwright overhead` step
- **AND** the visible step sum equals the result duration when it does not
  already exceed it

#### Scenario: Failure detail

- **WHEN** a result has an error but no step carries it
- **THEN** the scenario is failed
- **AND** a synthetic failed error step shows the message
- **AND** all other steps keep their own status

#### Scenario: Duplicate error is shown once

- **WHEN** a result repeats the same failure in `error` and `errors`
- **THEN** the failure detail appears once

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

#### Scenario: Trace zips are skipped

- **WHEN** an attachment is a Playwright trace (`name: trace`,
  `contentType: application/zip`)
- **THEN** its body or path is not embedded
- **AND** it does not count towards the attachment budget
- **AND** an ordinary zip attachment is still handled normally

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
- **THEN** no trace viewer or HTML-report replay is claimed
- **AND** an embedded video attachment uses only the existing inline video
  element
- **AND** the docs state that outside-tree path attachments are skipped

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

### Requirement: Keep the skipped attachment count on the Playwright attempt

The Playwright parser SHALL count path attachments skipped for any recorded
reason on the final attempt and SHALL carry the count and up to three
sanitized attachment name/reason entries on the attempt. The run-level skipped
count SHALL remain.
The report model SHALL copy the final attempt's count and entries to the
internal `ReportScenario`. No JSON, CI or email schema changes.

#### Scenario: One scenario outside the roots

- **WHEN** a final Playwright attempt has two path attachments that are skipped
- **THEN** the attempt and its scenario carry a skipped count of two
- **AND** the run-level count still counts both
- **AND** the scenario carries up to two entries

#### Scenario: Inside the roots

- **WHEN** a path attachment resolves inside the allowed roots
- **THEN** the scenario's skipped count is zero
- **AND** the attachment renders normally

#### Scenario: Non-final attempt

- **WHEN** an earlier attempt skips a path attachment but the final attempt does
  not
- **THEN** the scenario's skipped count comes from the final attempt only

### Requirement: Split nested JUnit suites

When a JUnit `<testsuite>` has a nested-class shape (at least two distinct
non-empty `classname` values plus either a classname containing `$` or one
classname being a dotted outer prefix of another), the report SHALL split the
suite into one feature per classname, using the classname as the feature name
with no suite prefix. It SHALL preserve every testcase, status, duration and the
source file. Testcases without a classname SHALL stay in a suite-named feature.

#### Scenario: Nested Surefire classes

- **WHEN** one testsuite has `classname="Outer"` and `classname="Outer$Nested"`
- **THEN** the report shows two features named exactly `Outer` and `Outer$Nested`
- **AND** all testcases and statuses are preserved
- **AND** the source file is unchanged

#### Scenario: Mixed class and unclassed cases

- **WHEN** a nested-class suite also has testcases without a classname
- **THEN** the classes become their own features and the unclassed testcases
  stay in a suite-named feature

### Requirement: Keep non-nested JUnit suites

One-class suites and any other multi-classname suite, including a producer
template such as `"{classname} {title}"`, SHALL keep the current suite feature.

#### Scenario: Classname template

- **WHEN** a jest-junit suite has distinct classnames such as
  `checkout.guest guest checkout` and `checkout.guest expired coupon`
- **THEN** the suite remains one feature
- **AND** each testcase remains a scenario, not a feature

#### Scenario: One class

- **WHEN** every testcase in a suite shares one classname
- **THEN** the suite remains one feature with its current name

### Requirement: Keep legacy hook output

A legacy JSON `before`/`after` hook with a non-null string or string-array
`output` SHALL produce a `text/plain` attachment on that hook, with a stable
readable name and the output joined by newlines. Inline hook steps in `steps`
follow the same rule. The existing hook renderer SHALL show it beside the hook;
the attachment count follows existing semantics. No schema or dependency changes.

#### Scenario: JVM hook output

- **WHEN** a `before` hook carries `output: ["Runs before @foo"]`
- **THEN** the hook shows a text attachment with that line
- **AND** the hook status/name and the report are unchanged

### Requirement: Handle legacy hook output edge cases

`output: null`, an empty string and an empty array SHALL count as absent, and
output on a non-hook step SHALL be ignored. This is an improvement over
cucumber-html-reporter
7.2.0, which ignores hook output; it is not a parity claim. The `\n` array join
is unit-tested with a synthetic two-line output; the real 8.1.0 host capture is
single-line.

#### Scenario: No output

- **WHEN** a hook has no `output`, `output: null`, an empty string or an empty
  array
- **THEN** no extra hook attachment is created

### Requirement: Record skipped path-attachment names and reasons

The Playwright adapter SHALL record, for each skipped path attachment on the
final attempt, a sanitized display name and exactly one reason: outside the
allowed roots, missing, unreadable, not a regular file, or non-local. The
existing count SHALL include every skipped attachment. Legacy JSON and Messages
attachments SHALL keep their current behaviour.

#### Scenario: Outside the roots

- **WHEN** a final-attempt attachment resolves only outside every allowed root
- **THEN** the count increases by one
- **AND** its entry is recorded with the reason "outside the roots"

#### Scenario: Missing file

- **WHEN** no candidate path for a final-attempt attachment exists
- **THEN** the count increases by one
- **AND** its entry is recorded with the reason "missing"

#### Scenario: Unreadable file

- **WHEN** a candidate exists inside a root but cannot be read
- **THEN** the count increases by one
- **AND** its entry is recorded with the reason "unreadable"

#### Scenario: Not a regular file

- **WHEN** a candidate is a directory, symlink or other non-regular file
- **THEN** the count increases by one
- **AND** its entry is recorded with the reason "not a regular file"

#### Scenario: Non-local path

- **WHEN** a path is a URL scheme, UNC or device path that Tolkira will not read
- **THEN** the count increases by one
- **AND** its entry is recorded with the reason "non-local"

#### Scenario: Caps still abort

- **WHEN** an attachment exceeds the per-file or total cap
- **THEN** the run still fails with the existing error
- **AND** the skip path is not used to hide the abort

### Requirement: Bound and sanitize skip entries

The report SHALL keep at most three entries per scenario, in attachment order,
and SHALL state how many further entries exist. Display names SHALL be sanitized
attachment names without directories, control or bidi characters, capped at 120
characters; no absolute path SHALL be retained. ANSI/OSC sequences SHALL be
removed before the attachment name is reduced to its last path segment.

#### Scenario: Entry cap

- **WHEN** one scenario skips more than three path attachments
- **THEN** the count states the full number
- **AND** only the first three entries are retained
- **AND** the report says how many more were skipped

#### Scenario: Path privacy

- **WHEN** an attachment name contains a directory, OSC-8 link, control, bidi or
  ANSI text
- **THEN** the recorded name is a sanitized attachment name
- **AND** no absolute path is persisted or rendered

### Requirement: Keep skipped attachments out of the summary

Skipped path attachments SHALL remain out of the JSON summary, CI text and
email. `GeneratedReport.skippedAttachments` SHALL stay the run-level count. The
HTML report MAY name skipped attachments; the CLI warning SHALL stay a
reason-neutral count. The summary schema SHALL stay version 2 and SHALL gain no
field.

#### Scenario: Summary unchanged

- **WHEN** a Playwright attachment is skipped
- **THEN** the summary attachment count and bytes only describe rendered
  attachments
- **AND** the skip names appear only in the HTML report
- **AND** the CLI warning carries the count

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

Earlier evidence SHALL embed at most one image per single-input Playwright
report, from the first failed displayed earlier attempt in the first eligible
scenario. It SHALL be read after all final attachments, under a 10 MB budget
and only when the final attachments leave at least 10 MB of the 100 MB cap.
Multi-input reports SHALL show status/error/duration without an earlier image.
Existing root, symlink, media-type and size checks SHALL apply.

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

### Requirement: Count only loaded report files

`inputFiles` and `inputBytes` SHALL count only files for which the loader
creates a group. A `skip` decision, a skipped empty Messages shard and duplicate
content SHALL NOT count. A supported file that creates a group, including a
validation-only group with no envelopes, SHALL count once with its size. The
per-file 100 MB guard SHALL run before the read; the total cap SHALL apply to
unique loaded content after dedupe and skip.

#### Scenario: Directory with unrelated JSON files

- **WHEN** a directory contains one supported report, `package.json` and
  `tsconfig.json`
- **THEN** the run succeeds
- **AND** `inputFiles` is 1
- **AND** `inputBytes` is the report file's size
- **AND** the Details input row names one file

#### Scenario: Duplicate content under two paths

- **WHEN** two resolved paths contain byte-identical report content
- **THEN** the run succeeds
- **AND** `inputFiles` is 1
- **AND** `inputBytes` counts the content once

#### Scenario: Skipped files do not count toward the cap

- **WHEN** a directory contains a valid report and large unrelated JSON files
  that the loader skips
- **THEN** the run succeeds
- **AND** the skipped files are absent from `inputFiles` and `inputBytes`
- **AND** their bytes do not count toward the 100 MB total cap

#### Scenario: Only skipped files

- **WHEN** a directory contains only files that the loader skips
- **THEN** generation fails with `No supported report files found.`
- **AND** no report is written

### Requirement: Skip an empty Messages shard in a directory scan

A directory scan SHALL skip a `.jsonl` or `.ndjson` file with zero non-empty
lines after an optional BOM and whitespace trimming, without a loader group,
input count or warning. An explicitly named empty file SHALL still fail with
`Input is empty: <file>`. A directory with only empty shards SHALL fail with
`No supported report files found.` A non-empty malformed shard SHALL still fail
with its existing parse error. No new option SHALL be added.

#### Scenario: Empty shard plus a valid report

- **WHEN** a directory contains one empty `.ndjson` shard and one valid report
- **THEN** generation succeeds
- **AND** the report includes the valid report
- **AND** the empty shard contributes no scenario, feature, input count or
  warning

#### Scenario: Explicit empty file

- **WHEN** an empty `.jsonl` or `.ndjson` file is named explicitly
- **THEN** generation fails with `Input is empty: <file>`
- **AND** no report is written

#### Scenario: Whitespace or BOM-only shard

- **WHEN** a scanned shard contains only whitespace, only a UTF-8 BOM or a BOM
  followed by whitespace
- **THEN** the shard is skipped without a group, count or warning

#### Scenario: Empty-only directory

- **WHEN** every Messages file in a directory is empty and the directory has no
  other usable input
- **THEN** generation fails with `No supported report files found.`
- **AND** no report is written

#### Scenario: Malformed non-empty shard

- **WHEN** a scanned shard contains a non-empty line that is not a valid
  Cucumber Messages envelope
- **THEN** generation fails with the existing line-specific Messages error
- **AND** the shard is not skipped as empty

### Requirement: Validate the Messages attempt

`testCaseStarted.attempt` SHALL be optional. When present, it SHALL be a
non-negative safe integer. A value that is not a number, not finite, not a safe
integer or negative SHALL be rejected with the existing Messages line-error
style naming the file, line and `testCaseStarted.attempt`. An absent attempt
SHALL be treated as 0. The summary and report model SHALL agree, and the JSON
summary SHALL never contain `null` for `attempt`.

#### Scenario: Non-finite attempt

- **WHEN** a `testCaseStarted` line carries `"attempt": 1e309`
- **THEN** generation fails with an error naming the file, line and
  `testCaseStarted.attempt`
- **AND** no report is written

#### Scenario: String attempt

- **WHEN** `attempt` is a string
- **THEN** generation fails with the same line-error style
- **AND** no report is written

#### Scenario: Negative attempt

- **WHEN** `attempt` is a negative number
- **THEN** generation fails with the same line-error style
- **AND** no report is written

#### Scenario: Fractional attempt

- **WHEN** `attempt` is not an integer
- **THEN** generation fails with the same line-error style
- **AND** no report is written

#### Scenario: Absent attempt

- **WHEN** `testCaseStarted` omits `attempt`
- **THEN** the summary and model use 0
- **AND** `--json` contains the number 0, never `null`

#### Scenario: Valid attempt

- **WHEN** `attempt` is 2
- **THEN** the summary and model use 2
- **AND** `--json` contains the number 2

### Requirement: Detect a one-line report without parsing it twice

Before parsing a candidate first line as a Messages envelope, the detector SHALL
check that the trimmed line starts with `{` and that its first key is a known
Messages envelope key. It SHALL parse and confirm the envelope only after that
check. A one-line Playwright report SHALL be classified as Playwright with one
parse of the file. Messages, legacy JSON, JUnit and malformed JSON SHALL keep
their existing classification.

#### Scenario: One-line Playwright report

- **WHEN** the input is a Playwright JSON document whose first line is the whole
  file
- **THEN** it is classified as Playwright
- **AND** `JSON.parse` runs once over the file

#### Scenario: One-line Messages envelope

- **WHEN** the input is one Messages envelope on one line
- **THEN** it is classified as Messages
- **AND** `JSON.parse` runs once for that line

#### Scenario: Multi-line Playwright report

- **WHEN** a Playwright JSON document starts with a line containing only `{`
- **THEN** the first line is not parsed as a Messages candidate
- **AND** the document is parsed once by the Playwright sniffer

#### Scenario: Legacy and JUnit are unchanged

- **WHEN** the input is a legacy Cucumber JSON array or a JUnit XML document
- **THEN** the existing adapter still handles it
- **AND** the new first-key check does not change the decision

#### Scenario: Malformed and non-envelope JSON

- **WHEN** the first line starts with `{` but its first key is not an envelope
  key, or the line is malformed JSON whose first key is not an envelope key
- **THEN** the line is not parsed as a Messages candidate
- **AND** the existing unsupported or validation decision is unchanged

#### Scenario: Malformed line with an envelope first key

- **WHEN** the first line starts with `{"meta":` and is malformed JSON
- **THEN** it is parsed once as a Messages candidate to discover that it is not
  a valid envelope
- **AND** the Playwright sniffer parses it again
- **AND** the classification stays the existing JSON validation decision

#### Scenario: BOM and blank leading lines

- **WHEN** a Messages or Playwright document has a UTF-8 BOM or blank lines
  before its first key
- **THEN** the first key is read after the BOM and blank lines are removed
- **AND** the classification and parse count are unchanged

### Requirement: Do not invent a legacy run time

When normalising legacy JSON, `options.startedAt` SHALL be the only timestamp
source. Without it the adapter SHALL emit a zero timestamp and SHALL NOT read
the clock. The `0.6.1-quality-pass` zero-timestamp-is-unknown rule SHALL keep the
report date and scenario `1970` dates out of the output. An explicit non-zero
`options.startedAt` SHALL still pin the date. The summary SHALL keep no date
field and a real Messages run SHALL be unchanged.

#### Scenario: No explicit run time

- **WHEN** a legacy JSON report is normalised without `options.startedAt`
- **THEN** its run and scenario start timestamps are zero
- **AND** the report shows no run date
- **AND** no scenario shows a `1970` date

#### Scenario: Explicit run time pin

- **WHEN** a legacy JSON report is normalised with an explicit non-zero
  `options.startedAt`
- **THEN** the report shows that date
- **AND** the timestamp is not replaced by the generation time

#### Scenario: Real Messages run is unchanged

- **WHEN** a real Cucumber Messages run with a valid timestamp is rendered
- **THEN** its date display is unchanged

#### Scenario: JSON summary has no date

- **WHEN** a legacy JSON report without `options.startedAt` is summarised
- **THEN** the summary has no date field
- **AND** its shape is unchanged

#### Scenario: Legacy screenshots and attachments are unchanged

- **WHEN** a legacy JSON report without `options.startedAt` contains a screenshot
  and a text embedding
- **THEN** both still render and count as before
- **AND** the zero timestamp does not change their data

### Requirement: Accept only XML entities in JUnit data

The JUnit adapter SHALL accept only the five XML named entities (`amp`, `lt`,
`gt`, `quot`, `apos`) and numeric character references. Any other named entity
SHALL fail with the existing invalid-entity error naming the file. The
unreachable `htmlEntities: true` parser option SHALL be removed. `&nbsp;` SHALL
keep failing. The JUnit documentation SHALL state the accepted entities.

#### Scenario: XML entities are accepted

- **WHEN** a JUnit document contains `&amp;`, `&lt;`, `&gt;`, `&quot;` or
  `&apos;` in text or an attribute
- **THEN** the document parses
- **AND** the readable text is preserved

#### Scenario: Numeric references are accepted

- **WHEN** a JUnit document contains `&#160;` or `&#xA0;`
- **THEN** the document parses
- **AND** the character is preserved as data

#### Scenario: HTML entities are rejected

- **WHEN** a JUnit document contains `&nbsp;` or another non-XML named entity
- **THEN** generation fails with the existing invalid-entity error naming the
  file
- **AND** no partial report is written

#### Scenario: Documentation states the rule

- **WHEN** `docs/JUNIT-XML.md` is inspected
- **THEN** it states that only the five XML named entities and numeric
  references are accepted
- **AND** it names `&nbsp;` as rejected
