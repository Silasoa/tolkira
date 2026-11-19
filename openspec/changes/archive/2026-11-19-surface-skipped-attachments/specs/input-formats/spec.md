# Spec Delta

## ADDED Requirements

### Requirement: Count Playwright path attachments skipped outside the roots

The Playwright adapter SHALL count each path attachment that exists as a regular
non-symlink file but resolves outside every allowed root. It SHALL count once per
attachment and SHALL NOT count inline bodies, missing files, symlinks,
non-regular files, URL schemes, UNC/device paths, trace zips, earlier attempts,
or a relative path that resolves inside a root through the working-directory
fallback. The adapter SHALL expose the count for its input; `generateReport`
SHALL sum the inputs.

#### Scenario: Outside every root

- **WHEN** a final-attempt path attachment exists but its resolved target is
  outside an input file's folder and the working directory
- **THEN** the adapter counts it once
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

#### Scenario: Unavailable paths

- **WHEN** a path is missing, a symlink, a non-regular file, a URL scheme or a
  UNC/device path
- **THEN** it is skipped
- **AND** it is not counted

#### Scenario: Trace and earlier attempts

- **WHEN** an attachment is a Playwright trace zip or belongs to an earlier
  attempt
- **THEN** it is not counted

#### Scenario: Multiple inputs

- **WHEN** two Playwright inputs each skip attachments
- **THEN** `generateReport` sums their counts into one notice
- **AND** an input included twice is counted once
