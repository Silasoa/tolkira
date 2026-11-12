# Proposal

## Why

The compatibility subpath is the migration path for teams using
`cucumber-html-reporter`, but it is ESM-only. Many legacy projects still use
CommonJS, so `require('tolkira/compat/cucumber-html-reporter')` fails before
they can try Tolkira. The core stays ESM; only the shim needs a small CJS
wrapper.

This addresses the MKT drop-in finding without dualising the package.

## What Changes

- Add a `require` condition for `tolkira/compat/cucumber-html-reporter`.
- The CJS wrapper exposes an async `generate(options)` that dynamically
  imports the ESM shim and returns its result.
- Add CJS type declarations and a test that requires the subpath from a real
  `.cjs` file.
- Document the wrapper, Node 22+ requirement and the fact that the core remains
  ESM-only.
- Update ADR 0002 with the narrow compatibility exception.

Out of scope: making the core or the CLI CommonJS; changing the option mapping;
Seed-Test's group sidecar; a default export.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `compatibility`: the compat subpath SHALL also be loadable from CommonJS via
  an async `generate` wrapper.

## Impact

- `package.json` exports, build output, a `.cjs` wrapper, types, tests and docs.
- `docs/COMPATIBILITY.md`, `docs/CHANGELOG.md`, ADR 0002.
- No runtime dependency change.

## Review gate

PIR and DXR run before implementation; implementation is a TDD pair.
