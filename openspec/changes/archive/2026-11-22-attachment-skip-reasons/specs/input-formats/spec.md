# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Count Playwright path attachments skipped outside the roots

The Playwright adapter SHALL count each path attachment it skips on the final
attempt for one of the recorded reasons: outside every allowed root, missing,
unreadable, not a regular file, or non-local. It SHALL count once per
attachment and SHALL NOT count inline bodies, trace zips, earlier attempts, or a
relative path that resolves inside a root through the working-directory
fallback. The adapter SHALL expose the count and the bounded entries for its
input; `generateReport` SHALL sum the counts across inputs.

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
