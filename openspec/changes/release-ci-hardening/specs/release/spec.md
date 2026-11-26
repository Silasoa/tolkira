# Spec Delta

## ADDED Requirements

### Requirement: Publish the artifact that was checked

The release publish job SHALL pack once, run the package check and the CLI
smoke test on that tarball, and pass the same file to `npm stage publish`. It
SHALL NOT repack from the directory, SHALL resolve the version once
(`tolkira-<version>.tgz`, no glob), and SHALL use the same pinned npm as the CI
package job. A failed check or smoke SHALL block staging. The tag/version and
tag-on-main checks SHALL stay in front.

#### Scenario: The staged file is the checked file

- **WHEN** the package check passes and the smoke test runs
- **THEN** the smoke test installs the tarball from the pack directory
- **AND** `npm stage publish` receives that exact path
- **AND** no step runs `npm stage publish .`

#### Scenario: A check failure blocks staging

- **WHEN** the manifest, publint, attw or the CLI smoke fails
- **THEN** the publish job stops
- **AND** nothing is staged

#### Scenario: Tag guards still run first

- **WHEN** the tag does not match the package version or is not on `origin/main`
- **THEN** the publish job fails before pack or stage
- **AND** the existing gate jobs still have to be green

### Requirement: Verify dependency signatures and attach an SBOM

The release SHALL run `npm audit signatures` on the installed tree before
staging and SHALL generate a CycloneDX SBOM with `npm sbom --sbom-format
cyclonedx --omit=dev`. esbuild externalizes every runtime dependency, so that
tree is the runtime tree. The SBOM SHALL be uploaded as the `tolkira-sbom`
artifact. Neither step SHALL run on a new schedule; they run at release only.

#### Scenario: A bad signature blocks the release

- **WHEN** an installed dependency fails signature verification
- **THEN** the publish job stops
- **AND** nothing is staged

#### Scenario: The SBOM is available

- **WHEN** the publish job reaches the SBOM step
- **THEN** the CycloneDX file is written for the package version
- **AND** it is uploaded as the `tolkira-sbom` artifact

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

This change SHALL NOT add a runtime dependency, change a package entry point,
change a report byte, change a public declaration or bump the version. The
release-surface work SHALL be development- and CI-only.

#### Scenario: Entry points unchanged

- **WHEN** `package.json` and the packed compat files are compared with 0.6.1
- **THEN** `bin`, `exports` and the runtime dependency names are unchanged
- **AND** only `files` gains the explicit `docs/README.md`

#### Scenario: No version change in the tooling change

- **WHEN** the change is archived
- **THEN** the version is still 0.6.1
- **AND** no tag, stage or publish happened
