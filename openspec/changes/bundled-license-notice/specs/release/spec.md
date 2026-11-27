# Spec Delta

## MODIFIED Requirements

### Requirement: Keep the release surface unchanged

A release-surface change SHALL NOT add a runtime dependency, change a package
entry point, change a public declaration or bump the version outside its
approved release. A change that adds a package file or changes report bytes
SHALL do so in its own specification change with the report gate.

#### Scenario: Entry points unchanged

- **WHEN** `package.json`, `exports` and the packed compat files are inspected
- **THEN** `bin`, `exports` and the runtime dependency names are unchanged

#### Scenario: The notice change is scoped

- **WHEN** the bundled-license-notice change is archived
- **THEN** `files` gains only `THIRD-PARTY-NOTICES.md`
- **AND** report bytes change only by the notice comment and its displayed size
- **AND** no runtime dependency, entry point, public declaration or version
  changed

#### Scenario: No version change in the tooling change

- **WHEN** a tooling change is archived
- **THEN** the version is unchanged
- **AND** no tag, stage or publish happened

## ADDED Requirements

### Requirement: Ship third-party notices with the package

The published package SHALL include `THIRD-PARTY-NOTICES.md` with the full MIT
notice of every third-party component bundled into `dist`. The package check
SHALL require the file in the tarball. The CycloneDX SBOM SHALL remain the
external runtime dependency tree only and SHALL NOT be extended to bundled
code in this change.

#### Scenario: The notice file is in the tarball

- **WHEN** the package check inspects the packed tarball
- **THEN** `THIRD-PARTY-NOTICES.md` is required and listed as a root file
- **AND** a tarball without it fails the check

#### Scenario: The SBOM scope is unchanged

- **WHEN** the release generates the CycloneDX SBOM
- **THEN** it still covers the lockfile's external runtime tree only
- **AND** the bundled component is documented in the notice file instead
