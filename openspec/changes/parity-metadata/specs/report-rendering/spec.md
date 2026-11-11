# Spec Delta

## ADDED Requirements

### Requirement: Show CI metadata from Messages

When the Messages `meta.ci` envelope is present, the report SHALL show the CI
name/link and the git revision, branch and tag when available. Missing fields
SHALL be omitted.

#### Scenario: CI job and git revision

- **WHEN** `meta.ci` has a name, URL and git revision
- **THEN** the header and Details show the CI name as a link
- **AND** the short revision is visible
- **AND** branch and tag are shown when present

#### Scenario: Partial metadata

- **WHEN** `meta.ci` has no URL or no git fields
- **THEN** only the available fields render
- **AND** no empty link or placeholder is rendered

#### Scenario: Legacy/JUnit

- **WHEN** the input is legacy JSON or JUnit
- **THEN** no CI metadata is invented

### Requirement: Improve attachment naming

Attachment names SHALL use the Cucumber file name when present, otherwise a
deterministic `attachment.<extension>` fallback for the media type.

#### Scenario: Named attachment

- **WHEN** an attachment has a file name
- **THEN** that name is used unchanged and escaped

#### Scenario: Unnamed attachment

- **WHEN** an attachment has no file name and a known media type
- **THEN** the name is `attachment.<extension>`
- **AND** the same input produces the same name

#### Scenario: Path-like name

- **WHEN** a file name contains path separators or traversal text
- **THEN** it is shown as text, not used as a filesystem path

### Requirement: Render JSON and URI-list attachments

JSON attachments SHALL be pretty-printed and escaped. `text/uri-list`
attachments SHALL render as links without making a network request when the
report is opened.

#### Scenario: JSON attachment

- **WHEN** an attachment is `application/json`
- **THEN** the body is pretty-printed in a code block
- **AND** HTML inside the JSON is escaped

#### Scenario: URI list

- **WHEN** an attachment is `text/uri-list`
- **THEN** each URI is rendered as a link
- **AND** only safe http(s) links are clickable
- **AND** the report itself makes no request

### Requirement: Render Cucumber ANSI logs safely

`text/x.cucumber.log+plain` attachments SHALL render ANSI colours with a copy
action, and SHALL NOT execute terminal control sequences.

#### Scenario: ANSI log

- **WHEN** a log attachment contains SGR colour codes
- **THEN** the text renders with colours
- **AND** the raw escape sequences are not shown as markup
- **AND** a copy action copies the readable text

#### Scenario: Malicious control sequence

- **WHEN** a log contains non-SGR control sequences or HTML
- **THEN** they are stripped or escaped
- **AND** no script runs

### Requirement: Keep the offline and count contracts

CI metadata and attachment polish SHALL NOT change scenario, step or
attachment counts, the JSON summary schema, or the no-network baseline.

#### Scenario: Counts unchanged

- **WHEN** a report with CI metadata and polished attachments is rendered
- **THEN** its counts match the summary
- **AND** the summary schema version is unchanged

#### Scenario: Offline

- **WHEN** the report is opened offline
- **THEN** CI metadata, JSON, URI lists and ANSI logs render without an
  external request
