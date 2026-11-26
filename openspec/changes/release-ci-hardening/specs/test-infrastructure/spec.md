# Spec Delta

## ADDED Requirements

### Requirement: Run the dead-code check in the gate

The check gate SHALL run knip with an explicit entry and project config. An
unused file, export, type or dependency that is not an entry or a documented
exception SHALL fail the gate.

#### Scenario: A new unused export fails

- **WHEN** a module gains an exported value, type or file that nothing imports
  and that is not an entry
- **THEN** the dead-code check fails
- **AND** the gate fails

### Requirement: Pin the dead-code entries and exceptions

The config SHALL name the public entry, the CLI entry, the two compat entries,
the browser bundle entry, the manual scripts and the test files.
`playwright-core`, `publint` and `@arethetypeswrong/cli` SHALL be the ignored
dependencies: the first is an optional peer loaded at runtime, the other two
are spawned by the package check. No other dependency SHALL be ignored. No
export reachable from the package entry or the compat entry SHALL be removed.

#### Scenario: Entries and fixtures stay quiet

- **WHEN** the manual scripts, the compat entry and the CJS type fixture are
  scanned
- **THEN** they count as entries or ignored paths
- **AND** the check stays green

#### Scenario: The public surface is not removed

- **WHEN** knip flags an export that is reachable from `src/index.ts` or the
  compat entry
- **THEN** the export stays
- **AND** the config gets a documented exception instead

### Requirement: Check the packed package surface

The package gate SHALL pack once and check that file. The packed set SHALL
equal the documented `files` set plus npm's automatic root files; an unexpected
path SHALL fail, and `docs/README.md` SHALL be required unconditionally. Glob
entries in `files` are patterns, not literal paths; absolute, `..` and
backslash paths SHALL fail. `publint --strict` and `attw` SHALL run on the
tarball.

#### Scenario: The B-071 regression fails

- **WHEN** the npm 12 pack list omits `docs/README.md`
- **THEN** the manifest check fails and names the missing path
- **AND** the tarball is not used for a smoke test or a publish

#### Scenario: A forbidden path fails

- **WHEN** the tarball contains a `src/`, `test/`, `openspec/`, `scripts/`,
  `node_modules/` or `.github/` path
- **THEN** the manifest check fails

#### Scenario: An unexpected or unsafe path fails

- **WHEN** the tarball contains a path outside the documented `files` set, or an
  absolute, `..` or backslash path
- **THEN** the manifest check fails and names the path
- **AND** the tarball is not used for a smoke test or a publish

### Requirement: Pin the package-check exceptions

The attw config SHALL use the node16 profile and ignore exactly
`cjs-resolves-to-esm` (the ESM-only root); node16 (CJS and ESM) and the bundler
SHALL stay checked, and node10 is out of scope below `engines`.
`docs/README.md` SHALL be listed in `files`, so npm 10 and npm 12 pack it. The
manifest check SHALL read the npm 10 array and the npm 12 object shapes the
same way.

#### Scenario: Both npm JSON shapes are accepted

- **WHEN** `npm pack --json` returns the npm 10 array or the npm 12 object
- **THEN** the manifest check reads the same file list
- **AND** the result does not depend on the npm version

## MODIFIED Requirements

### Requirement: Preserve behaviour and package content

The tooling baseline SHALL NOT change runtime behaviour, report bytes, the
public API or the shipped entry points. The characterization baseline SHALL
follow the base requirement "Keep the characterization baseline"; this change
introduces no intentional render change. The formatter, the coverage provider,
knip, publint and `@arethetypeswrong/cli` SHALL be development-only
dependencies. The packed file set SHALL equal the documented `files` set;
`docs/README.md` is explicit, so the set does not depend on the npm version.

#### Scenario: Report bytes unchanged

- **WHEN** the same fixtures are rendered before and after the change
- **THEN** the report bytes are identical
- **AND** no characterization hash or golden file is re-pinned

#### Scenario: Runtime surface unchanged

- **WHEN** the packed package is inspected
- **THEN** its entry points and runtime dependencies are unchanged
- **AND** the public declaration names the same input types
- **AND** `docs/README.md` is present under npm 10 and npm 12
