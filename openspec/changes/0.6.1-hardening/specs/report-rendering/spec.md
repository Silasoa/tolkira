# Spec Delta

## ADDED Requirements

### Requirement: Keep local user paths out of display URIs

For an absolute path or file URL, the display URI shown in the report, JSON
summary and copied failure text SHALL NOT contain a local user name. A
`file://` URL and the Windows `/C:/...` form SHALL keep their path root. On an
absolute path or file URL, including after a `/mnt/<drive>` mount, a leading
`Users`, `home` or `Documents and Settings` segment and the next segment SHALL
be dropped.

#### Scenario: POSIX file URL

- **WHEN** a scenario URI is `file:///home/<user>/proj/features/login.feature`
- **THEN** the display URI is `features/login.feature`
- **AND** the HTML, the `--json` `uri` field and the copied failure text contain
  no `<user>`

#### Scenario: WSL mount path

- **WHEN** a scenario URI is `/mnt/c/Users/<user>/proj/login.feature`
- **THEN** the display URI is `proj/login.feature`
- **AND** no surface contains the user name

#### Scenario: Windows file URL

- **WHEN** a scenario URI is `file:///C:/Users/<user>/proj/login.feature`
- **THEN** the display URI is `proj/login.feature`
- **AND** no surface contains the user name or the `C:` drive prefix

#### Scenario: Absolute path without a features marker

- **WHEN** a scenario URI is `/home/<user>/work/proj/login.feature`
- **THEN** the home segment and `<user>` are dropped
- **AND** the remaining last-three path segments are shown
- **AND** no surface contains the user name

#### Scenario: Legacy adapter applies the home rule

- **WHEN** a legacy JSON feature URI is `file:///home/<user>/proj/login.feature`
- **THEN** the normalised URI does not contain `<user>`
- **AND** the report, `--json` and copied text use that normalised URI

#### Scenario: Shortened URI remains escaped and offline

- **WHEN** a shortened URI contains HTML-like text
- **THEN** it renders as escaped text
- **AND** the report makes no network request

### Requirement: Keep relative paths and the features marker stable

A relative URI SHALL stay unchanged, and the `/features/` marker and the
last-three fallback SHALL stay where they already apply. A relative path that
starts with a home segment is outside the no-user-name rule.

#### Scenario: Relative path is unchanged

- **WHEN** a scenario URI is `features/login.feature`
- **THEN** the display URI is `features/login.feature`
- **AND** the legacy normalised URI is `features/login.feature`

#### Scenario: Relative home-segment path stays out of scope

- **WHEN** a scenario URI is `home/<user>/proj/login.feature`
- **THEN** the display URI is unchanged
- **AND** the no-user-name rule does not apply to it

### Requirement: Use the display URI for the model feature name

The report model's feature-name fallback SHALL use `displayUri`. The summary
`uri` SHALL use `displayUri`; its `feature` field keeps the empty fallback when
no feature name exists.

#### Scenario: Model feature-name fallback

- **WHEN** a feature has no AST name and its pickle URI is a file URL with a
  local user name
- **THEN** the report model's `featureName` uses the display URI
- **AND** the summary `uri` uses the display URI and its `feature` field stays
  empty
- **AND** neither contains the local user name

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
