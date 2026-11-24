# Spec Delta

## ADDED Requirements

### Requirement: Keep local user paths out of display URIs

The report, JSON summary, CI text and copied failure text SHALL NOT show a local
user name in a display URI. A `file://` URL and the Windows `/C:/...` form SHALL
keep their path root; a leading `Users`, `home` or `Documents and Settings`
segment and the next segment SHALL be dropped after a drive or `/mnt/<drive>`
mount. Relative URIs, the `/features/` marker and the last-three fallback SHALL
stay. The model feature-name fallback SHALL use `displayUri`.

#### Scenario: POSIX file URL

- **WHEN** a scenario URI is `file:///home/alice/proj/features/login.feature`
- **THEN** the display URI is `features/login.feature`
- **AND** the HTML, `--json` `uri` and `feature` fields and copied failure text
  contain no `alice`

#### Scenario: WSL mount path

- **WHEN** a scenario URI is `/mnt/c/Users/alice/proj/login.feature`
- **THEN** the display URI is `proj/login.feature`
- **AND** no surface contains `alice`

#### Scenario: Windows file URL

- **WHEN** a scenario URI is `file:///C:/Users/alice/proj/login.feature`
- **THEN** the display URI is `proj/login.feature`
- **AND** no surface contains `alice` or the `C:` drive prefix

#### Scenario: Absolute path without a features marker

- **WHEN** a scenario URI is `/home/alice/work/proj/login.feature`
- **THEN** the home segment and `alice` are dropped
- **AND** the remaining last-three path segments are shown
- **AND** no surface contains `alice`

#### Scenario: Legacy adapter applies the home rule

- **WHEN** a legacy JSON feature URI is `file:///home/alice/proj/login.feature`
- **THEN** the normalised URI does not contain `alice`
- **AND** the report, `--json` and copied text use that normalised URI

#### Scenario: Shortened URI remains escaped and offline

- **WHEN** a shortened URI contains HTML-like text
- **THEN** it renders as escaped text
- **AND** the report makes no network request

#### Scenario: Model feature-name fallback

- **WHEN** a feature has no AST name and its pickle URI is a file URL with a
  local user name
- **THEN** the report model's `featureName` and the summary `feature` use the
  display URI
- **AND** neither contains the local user name

#### Scenario: Relative path is unchanged

- **WHEN** a scenario URI is `features/login.feature`
- **THEN** the display URI is `features/login.feature`
- **AND** the legacy normalised URI is `features/login.feature`

### Requirement: Use the later start on a full attempt tie

When two `testCaseStarted` envelopes for one pickle have the same attempt number
and the same timestamp, the report and the JSON summary SHALL use the later
envelope in input order. A higher attempt number or a later timestamp SHALL keep
the existing precedence. The selected start SHALL supply the rendered status,
attempt, timestamps, attachments and summary row.

#### Scenario: Equal attempt and empty timestamps

- **WHEN** a pickle has two starts with attempt 0 and empty timestamps, the
  first failed and the second passed
- **THEN** the report shows the scenario as passed
- **AND** the summary entry is passed
- **AND** the selected start is the second one

#### Scenario: Distinct attempt

- **WHEN** two starts have different attempt numbers
- **THEN** the higher attempt wins as before
- **AND** the tie rule does not apply

#### Scenario: Distinct timestamp

- **WHEN** two starts have the same attempt and different timestamps
- **THEN** the later timestamp wins as before
- **AND** the tie rule does not apply

#### Scenario: Missing timestamp

- **WHEN** the later start has no timestamp and the earlier start has a
  timestamp
- **THEN** the timestamp comparison uses the existing zero default
- **AND** a full tie still selects the later start

#### Scenario: Three starts on a tie

- **WHEN** three starts share the same attempt and timestamp
- **THEN** the last start in input order is selected
- **AND** the report and summary agree

## MODIFIED Requirements

### Requirement: Render attachments safely

The report SHALL render supported images, videos and text attachments. It SHALL
NOT execute HTML or SVG attachments as active content. A non-base64 image,
video or audio body that cannot be percent-encoded because it contains an
unpaired UTF-16 surrogate SHALL fall back to a base64 data URI built from its
UTF-8 bytes. A normal UTF-8 media body SHALL keep a readable data URI, a BASE64
body SHALL keep its existing data URI unchanged, and an empty body SHALL render
no data URI. No attachment SHALL abort the whole report.

#### Scenario: Screenshot is shown

- **WHEN** a step has a PNG attachment
- **THEN** the open scenario shows the image inline

#### Scenario: HTML attachment is not executed

- **WHEN** a step has an HTML attachment containing a script
- **THEN** the script does not execute and the content is shown as escaped text

#### Scenario: Lone surrogate in an image body

- **WHEN** a non-base64 image body contains an unpaired UTF-16 surrogate
- **THEN** the report renders
- **AND** the image uses a `data:<type>;base64,` source
- **AND** no partial report is written

#### Scenario: Lone surrogate in a video or audio body

- **WHEN** a non-base64 video or audio body contains an unpaired UTF-16
  surrogate
- **THEN** the report renders
- **AND** the media uses a `data:<type>;base64,` source
- **AND** the run does not fail with `URI malformed`

#### Scenario: Normal UTF-8 media body

- **WHEN** a non-base64 image, video or audio body is valid UTF-8
- **THEN** its existing readable percent-encoded data URI is unchanged
- **AND** no base64 fallback is used

#### Scenario: BASE64 media body

- **WHEN** a media attachment is declared BASE64
- **THEN** its existing `data:<type>;base64,` source is unchanged
- **AND** it is not re-encoded

#### Scenario: Empty media body

- **WHEN** a media attachment has an empty body
- **THEN** no data URI is rendered
- **AND** the report still renders
