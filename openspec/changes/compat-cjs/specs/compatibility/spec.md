# Spec Delta

## ADDED Requirements

### Requirement: Load the compat subpath from CommonJS

The compatibility subpath SHALL be loadable with `require()` and SHALL expose
an async `generate(options, callback?)` function. It SHALL delegate to the ESM
shim, forward the optional callback, and SHALL NOT add a default export.

#### Scenario: Require from CommonJS

- **WHEN** a CommonJS file requires `tolkira/compat/cucumber-html-reporter`
- **THEN** it receives an object with a `generate` function
- **AND** `await generate(options)` writes the report and returns the same
  result shape as the ESM import

#### Scenario: Legacy callback

- **WHEN** a CommonJS caller passes a callback to `generate`
- **THEN** the callback receives the same success/error result as the ESM shim
- **AND** the returned promise still resolves or rejects consistently

#### Scenario: Errors propagate

- **WHEN** the ESM shim rejects an option or fails to write the report
- **THEN** the returned promise rejects with the same error
- **AND** no report is left half-written

#### Scenario: No default export

- **WHEN** a caller reads `.default`
- **THEN** it is undefined
- **AND** the named `generate` path remains the only supported entry

#### Scenario: Node requirement

- **WHEN** the package is installed on Node 22 or later
- **THEN** the CJS wrapper loads
- **AND** older Node versions keep the documented engine error

### Requirement: Keep the core ESM-only

The CJS wrapper SHALL apply only to the compatibility subpath. The core package,
CLI and other exports SHALL remain ESM-only.

#### Scenario: Core require fails

- **WHEN** a CommonJS file requires the package root
- **THEN** it fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`
- **AND** no root `default` condition or CJS core build is shipped
