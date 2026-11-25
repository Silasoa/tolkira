# Spec Delta

## ADDED Requirements

### Requirement: Enforce the maximal strict typecheck in the gate

The check gate SHALL compile the server and test sources with `strict` plus
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`,
`noUncheckedSideEffectImports`, `noFallthroughCasesInSwitch`,
`allowUnreachableCode: false`, `allowUnusedLabels: false` and
`isolatedModules`. A type error SHALL fail the gate.

#### Scenario: Strict flag violation fails

- **WHEN** an indexed read is used without a guard or default
- **THEN** the typecheck fails
- **AND** the same holds for an explicit `undefined` in an exact optional
  property, a missing `override`, an unused local or parameter, a missing
  return, an unreachable statement and a fallthrough case

### Requirement: Typecheck the browser graph without Node types

The gate SHALL compile the browser graph in a separate program with no Node type
declarations, so a browser module cannot rely on a Node global. A type error in
that program SHALL fail the gate.

#### Scenario: Browser program has no Node globals

- **WHEN** a module reached from the browser entry imports a `node:` module or
  reads `process`
- **THEN** the browser typecheck fails
- **AND** a server module that legitimately uses the DOM still compiles in the
  server program

### Requirement: Enforce the maximal lint set at zero warnings

The gate SHALL run one lint pass with correctness rules as errors, suspicious,
performance and pedantic rules as warnings, the import, promise, node,
TypeScript and Vitest plugins, and type-aware rules. Only the documented
exceptions may be off. Any finding at warning or error severity SHALL fail the
gate. The lint configuration SHALL be asserted by a test, so turning a rule or
category off without changing the contract fails the suite.

#### Scenario: A warning fails the gate

- **WHEN** the lint run reports one warning
- **THEN** the gate fails
- **AND** a clean run exits zero

#### Scenario: A type-aware defect fails the gate

- **WHEN** a module creates a floating promise or awaits a non-thenable
- **THEN** the type-aware lint run reports it
- **AND** the gate fails

#### Scenario: Documented exceptions stay quiet

- **WHEN** the lint run scans the test suite and the compatibility shim
- **THEN** the configured assertion names satisfy the empty-expectation rule
- **AND** the allowed globals satisfy the underscore rule
- **AND** the named scoped-off rules produce no finding in their files
- **AND** the fixture casts in `test/**` do not trip the assertion rule

### Requirement: Check formatting without changing output

The gate SHALL verify formatting with one pinned formatter and config. The
format scope SHALL exclude generated sources, report CSS, test fixtures and
committed goldens, so formatting cannot change a report byte. The repository
SHALL enforce LF checkout line endings, so the check gives the same result on
Windows, Linux and macOS. A formatting violation SHALL fail the gate.

#### Scenario: Unformatted source fails

- **WHEN** a tracked source file differs from the formatter output
- **THEN** the format check fails

#### Scenario: Same verdict on every checkout

- **WHEN** the gate runs on a fresh Windows, Linux or macOS checkout
- **THEN** the working tree is LF and the format check reports the same files
- **AND** an existing CRLF working tree is re-checked out rather than
  reformatted to pass

#### Scenario: Generated and golden files are out of scope

- **WHEN** the formatter runs and the assets are rebuilt
- **THEN** generated TypeScript, report CSS, fixtures and golden HTML are
  unchanged
- **AND** the committed characterization hashes and golden files stay
  unchanged

### Requirement: Fail an empty test selection and enforce a coverage floor

The unit test gate SHALL fail when no test matches its pattern. It SHALL collect
coverage over `src/**/*.ts`, excluding the browser entry that only the browser
suite covers, and SHALL fail below 93 percent statements, 86 percent branches,
95 percent functions and 95 percent lines.

#### Scenario: Empty selection fails

- **WHEN** the test pattern matches no file
- **THEN** the test gate fails instead of passing

#### Scenario: Coverage floor

- **WHEN** the unit suite runs below any threshold
- **THEN** the gate fails
- **AND** the measured baseline above the floor passes

### Requirement: Preserve behaviour and package content

The tooling baseline SHALL NOT change runtime behaviour, report bytes, the
public API or the shipped entry points. The characterization baseline SHALL
follow the base requirement "Keep the characterization baseline"; this change
introduces no intentional render change. The formatter and the coverage
provider SHALL be development-only dependencies.

#### Scenario: Report bytes unchanged

- **WHEN** the same fixtures are rendered before and after the change
- **THEN** the report bytes are identical
- **AND** no characterization hash or golden file is re-pinned

#### Scenario: Runtime surface unchanged

- **WHEN** the packed package is inspected
- **THEN** its entry points, runtime dependencies and file set are unchanged
- **AND** the public declaration names the same input types
- **AND** the internal helper declaration change does not add or remove an
  entry point
