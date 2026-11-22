# Spec Delta

## ADDED Requirements

### Requirement: Run the check gate on Windows

CI SHALL run the full `npm run check` gate on `windows-latest` with Node 22 for
every push and pull request, in addition to the existing Linux and macOS jobs.

#### Scenario: Windows check

- **WHEN** a push or pull request runs CI
- **THEN** a Windows Node 22 job installs with `npm ci`
- **AND** it runs `npm run check`
- **AND** a failure blocks the workflow

#### Scenario: Existing matrix stays

- **WHEN** the Windows job is added
- **THEN** the Linux Node 22/24/26 check matrix, Linux e2e and macOS e2e remain
