# release Specification

## Purpose

The release pipeline proves and publishes exactly the artifact that passed the
gate: it packs once, checks the manifest, types and CLI surface, smokes the same
tarball, records and verifies its digest, and stages it with provenance. It
also verifies dependency signatures, attaches a CycloneDX SBOM and keeps the
workflow dependencies pinned and linted.

## Requirements

### Requirement: Publish the artifact that was checked

The release SHALL pack once in a non-privileged `package` job and upload the
tarball plus its SHA-256 as one artifact. The token-bearing `publish` job SHALL
download that artifact, verify the digest immediately before
`npm stage publish` and stage that exact file. `publish` SHALL NOT pack,
build, run `npm ci`, check the package or smoke it. Both jobs SHALL use the
same pinned npm, and runs for one tag SHALL be serialized.

#### Scenario: The staged file is the checked file

- **WHEN** the package check passes and the smoke test runs in the package job
- **THEN** the smoke test installs the tarball from the pack directory
- **AND** the package job records the tarball's SHA-256 and uploads the tarball
  and digest as `tolkira-release`
- **AND** the publish job downloads that artifact, verifies the digest and
  passes the exact path to `npm stage publish`
- **AND** no step runs `npm stage publish .`

#### Scenario: A check failure blocks staging

- **WHEN** the manifest, publint, attw or the CLI smoke fails
- **THEN** the package job stops
- **AND** no release artifact is uploaded and nothing is staged

#### Scenario: Tag guards still run first

- **WHEN** the tag does not match the package version or is not on
  `refs/heads/main`
- **THEN** the package job fails before any install or pack
- **AND** the guard resolved the full `refs/heads/main` ref, not a short name
- **AND** the existing gate jobs still have to be green

#### Scenario: A tampered artifact cannot be staged

- **WHEN** the downloaded tarball's SHA-256 differs from the digest the package
  job reported
- **THEN** the publish job stops
- **AND** nothing is staged

#### Scenario: One run per tag stages

- **WHEN** two workflow runs exist for the same tag
- **THEN** they queue instead of staging concurrently
- **AND** no run is cancelled between the digest check and the stage

### Requirement: Verify dependency signatures and attach an SBOM

The release SHALL run `npm audit signatures` and generate a CycloneDX SBOM in
the `package` job, after `npm ci` and before the tarball upload. The SBOM SHALL
cover the lockfile's external runtime tree, not bundled code (B-075), and SHALL
be uploaded as `tolkira-sbom` with `if-no-files-found: error`.

#### Scenario: A bad signature blocks the release

- **WHEN** an installed dependency fails signature verification
- **THEN** the package job stops
- **AND** no release artifact is uploaded and nothing is staged

#### Scenario: The SBOM is available

- **WHEN** the package job reaches the SBOM step
- **THEN** the CycloneDX file `tolkira-sbom.cdx.json` is written from the
  lockfile production tree for the package version
- **AND** it is uploaded as the `tolkira-sbom` artifact
- **AND** the upload fails if the file is missing

#### Scenario: No scheduled maintenance job

- **WHEN** the workflows are inspected
- **THEN** no schedule runs the signature check or the SBOM
- **AND** both run only in the release workflow

### Requirement: Pin and lint the workflow dependencies

Every `uses:` in a workflow SHALL reference a 40-hex commit with a version
comment. Dependabot SHALL keep the pins current with a cooldown of at least
seven days. CI SHALL run actionlint and zizmor; a finding SHALL fail the job
unless it has a written suppression reason. Checkouts SHALL set
`persist-credentials: false`, `id-token: write` SHALL be scoped to the publish
job, and the release workflow SHALL NOT restore a package-manager cache.

#### Scenario: An unpinned action fails the config test

- **WHEN** a workflow adds `uses: owner/action@v1`
- **THEN** the workflow config test fails
- **AND** the same holds for a pin without a version comment

#### Scenario: A workflow finding fails CI

- **WHEN** actionlint or zizmor reports a finding
- **THEN** the workflows job fails
- **AND** a suppression without a reason does not pass review

#### Scenario: Pins stay current

- **WHEN** Dependabot opens an action update
- **THEN** it updates the commit SHA and the version comment
- **AND** the workflow config test still passes

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

### Requirement: Keep the npm token out of the build job

Only the `publish` job SHALL have `id-token: write` and map `NPM_TOKEN`. The
`package` job SHALL run with `contents: read`, SHALL NOT receive the npm token
or `id-token: write`, and SHALL be the only job that checks out the repository,
installs dependencies, builds, packs or smokes the package. The `publish` job
SHALL reference the `release` environment.

#### Scenario: The token-bearing job has no build inputs

- **WHEN** the release workflow is inspected
- **THEN** the `publish` job has no checkout, `npm ci`, build, pack, package
  check, smoke, signature check or SBOM step
- **AND** it downloads the `tolkira-release` artifact and verifies its digest
- **AND** it is the only job with `id-token: write` and `NPM_TOKEN`

#### Scenario: The package job cannot deploy

- **WHEN** the `package` job is inspected
- **THEN** its permissions are `contents: read` only
- **AND** it does not reference `secrets.NPM_TOKEN` or `id-token: write`

### Requirement: Protect release tags and gate the publish

The repository SHALL protect `refs/tags/v*` with an active ruleset that blocks
deletion, updates and non-fast-forward changes. It SHALL define a `release`
environment that only accepts `v*` tags and requires the maintainer as
reviewer. The `publish` job SHALL reference that environment. Self-review MAY
stay allowed while the project has one maintainer; the setting and the trigger
to disable it SHALL be recorded.

#### Scenario: A release tag cannot be moved or deleted

- **WHEN** a ruleset on the repository is read back
- **THEN** an active tag ruleset covers `refs/tags/v*`
- **AND** it blocks deletion, update and non-fast-forward
- **AND** no bypass actor is configured

#### Scenario: The publish waits for approval

- **WHEN** a `v*` tag starts the release workflow and both gates pass
- **THEN** the publish job waits on the `release` environment
- **AND** the maintainer approves the deployment before the npm token is used
- **AND** a tag outside `v*` cannot deploy to that environment

#### Scenario: The settings are recorded

- **WHEN** a release is prepared
- **THEN** the ruleset and environment read-back is in the change gate record
- **AND** the self-review decision names its trigger to change

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
