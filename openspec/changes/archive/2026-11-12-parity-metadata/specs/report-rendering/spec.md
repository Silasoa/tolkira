# Spec Delta

## ADDED Requirements

### Requirement: Show CI metadata from Messages

When `meta.ci` is present, the report SHALL show the CI name/link and git
revision, branch and tag when available. Missing fields are omitted; a URL
without a name uses the URL as label. Safe GitHub https/ssh/scp remotes link
the 7-character commit; other schemes stay plain text. Only http(s) CI URLs
become links.

#### Scenario: CI job and git revision

- **WHEN** `meta.ci` has a name, URL and git revision
- **THEN** the header and Details show the CI name as a link
- **AND** the short revision is visible
- **AND** branch and tag are shown when present

#### Scenario: Commit link

- **WHEN** `meta.ci.git.remote` is a safe GitHub https, ssh or scp-like remote
  and a revision exists
- **THEN** the 7-character revision links to the commit
- **AND** the full revision is available as a title
- **AND** other remotes or schemes render the revision as plain text

#### Scenario: CI URL without a name

- **WHEN** `meta.ci` has a safe http(s) URL and no name
- **THEN** the header and Details show the URL as the link label

#### Scenario: Partial metadata

- **WHEN** `meta.ci` has no URL or no git fields
- **THEN** only the available fields render
- **AND** no empty link or placeholder is rendered

#### Scenario: Legacy/JUnit

- **WHEN** the input is legacy JSON or JUnit
- **THEN** no CI metadata is invented

### Requirement: Improve attachment naming

Attachment names SHALL use the Cucumber file name when present, otherwise a
deterministic `attachment.<extension>` fallback across all inputs. Known
parameterised media types strip parameters and keep their extension; unknown
types normalise to `attachment`.

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

`application/json` attachments (including media-type parameters) SHALL be
pretty-printed and escaped; invalid JSON SHALL fall back to escaped raw text.
Only http(s) `text/uri-list` entries become links; other schemes remain text.
The report SHALL make no request when opened.

#### Scenario: Unknown media type

- **WHEN** an unnamed attachment has an unknown media type
- **THEN** its name is `attachment`
- **AND** the name is deterministic

#### Scenario: Parameterised media type

- **WHEN** an unnamed attachment is `application/json; charset=utf-8`
- **THEN** its name is `attachment.json`

#### Scenario: JSON attachment

- **WHEN** an attachment is `application/json`
- **THEN** the body is pretty-printed in a code block
- **AND** HTML inside the JSON is escaped

#### Scenario: Malformed JSON

- **WHEN** a JSON attachment cannot be parsed
- **THEN** its raw text is shown escaped
- **AND** the report still renders

#### Scenario: URI list

- **WHEN** an attachment is `text/uri-list`
- **THEN** http(s) URIs render as links with `rel="noopener noreferrer"`
- **AND** all other schemes render as escaped text
- **AND** the report itself makes no request

### Requirement: Render Cucumber ANSI logs safely

`text/x.cucumber.log+plain` attachments SHALL render SGR colours (including
256/truecolour) with a copy action. Non-SGR control sequences SHALL be stripped
or escaped, and large logs SHALL fall back to escaped text above 256 KB.

#### Scenario: ANSI log

- **WHEN** a log attachment contains SGR colour codes
- **THEN** the text renders with colours
- **AND** the raw escape sequences are not shown as markup
- **AND** a copy action copies the readable text

#### Scenario: Unsafe URI or CI URL

- **WHEN** a URI-list entry or CI URL uses a non-http(s) scheme
- **THEN** it renders as escaped text, not a link
- **AND** mixed case and leading whitespace are handled safely

#### Scenario: Large log

- **WHEN** an ANSI log exceeds 262,144 UTF-8 bytes
- **THEN** it renders as escaped text without colour parsing
- **AND** the report still renders

#### Scenario: Malicious control sequence

- **WHEN** a log contains non-SGR control sequences or HTML
- **THEN** they are stripped or escaped
- **AND** no script runs

### Requirement: Keep the offline and count contracts

CI metadata and attachment polish SHALL NOT change scenario or attachment
counts, the JSON summary schema, or the no-network baseline. HTML step counts
keep excluding hooks; comparisons use the documented baseline.

#### Scenario: Counts unchanged

- **WHEN** a report with CI metadata and polished attachments is rendered
- **THEN** scenario/attachment counts match the summary baseline
- **AND** HTML step counts keep excluding hooks
- **AND** the summary schema version is 2

#### Scenario: CI metadata is HTML-only

- **WHEN** a Messages report with `meta.ci` is summarised with `--json`
- **THEN** no CI field appears in the summary
- **AND** `schemaVersion` stays 2

#### Scenario: Offline

- **WHEN** the report is opened offline
- **THEN** CI metadata, JSON, URI lists and ANSI logs render without an
  external request
