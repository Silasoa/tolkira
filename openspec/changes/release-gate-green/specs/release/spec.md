# Spec Delta

## ADDED Requirements

### Requirement: Quote versioned paths in workflow commands

Every workflow `run:` command that interpolates the absolute
`/tmp/pack/tolkira-$TOLKIRA_VERSION.tgz` path SHALL quote the complete path as
one shell word. The CI and release workflow files SHALL both be covered.
actionlint with shellcheck SHALL report no `SC2086` finding, and the CI
workflows job SHALL print the shellcheck version so the integration cannot
vanish silently.

#### Scenario: The package jobs install the quoted path

- **WHEN** the CI package job or the release package job installs the checked
  tarball
- **THEN** the absolute tarball path is quoted as a single shell word
- **AND** no `run:` command contains the bare absolute path word

#### Scenario: The linter proof is visible

- **WHEN** the CI workflows job runs actionlint
- **THEN** it prints the shellcheck version it uses
- **AND** any `SC2086` finding fails the job

#### Scenario: The staged file stays checked

- **WHEN** the release stages the tarball
- **THEN** the quoted path still points at the digest-verified
  `tolkira-<version>.tgz`
- **AND** no second tarball is packed
