# Spec Delta

## ADDED Requirements

### Requirement: Gate releases on both operating systems and the tag

A release tag workflow SHALL run `npm run hygiene`, `npm run check` and
`npm run test:e2e` on Linux, and `npm run test:e2e` on macOS, before publish. The
publish job SHALL require both gates, fail on a tag/version mismatch and fail
when the tag commit is not on `origin/main`. A green tag SHALL reach the package
smoke and stage step. This records commit `31dd112`; no workflow code changes
here.

#### Scenario: Tag and version mismatch

- **WHEN** a release tag does not equal `v` plus the `package.json` version
- **THEN** the publish job fails
- **AND** nothing is staged or published

#### Scenario: Tag not on main

- **WHEN** the tagged commit is not an ancestor of `origin/main`
- **THEN** the publish job fails
- **AND** nothing is staged or published

#### Scenario: Staging waits for both gates

- **WHEN** the Linux or macOS gate fails
- **THEN** the publish job does not start
- **AND** no package is staged

#### Scenario: Green tag reaches the package smoke

- **WHEN** both gates are green and the tag matches the version on main
- **THEN** the package is packed and installed
- **AND** the CLI smoke test passes
- **AND** the workflow reaches the `npm stage publish` step
