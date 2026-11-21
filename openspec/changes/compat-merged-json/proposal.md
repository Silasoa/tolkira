# compat-merged-json

## Why

`cucumber-html-reporter` writes a merged legacy JSON file to `<output>.json` when
`jsonDir` is used. Seed-Test's group mode reads that sidecar. The host
validation on 2026-11-21 confirmed the shim renders the HTML but does not write
the sidecar, so the Seed-Test group flow cannot migrate unchanged (B-032).

## What Changes

- When the compat shim is called with `jsonDir` and without `jsonFile`, it
  writes a pretty-printed merged legacy JSON array to `<output>.json`.
- Features are merged by `uri`; duplicate features concatenate their `elements`.
  Every element gets `retried: 0` so the shape matches the common old-reporter
  output.
- The sidecar is written atomically, creates missing parent directories, refuses
  to overwrite an input file, and leaves no partial sidecar on failure.
- `jsonFile` keeps its current behaviour: no sidecar.
- The core CLI/API, the one-file HTML default and the dependency surface do not
  change. No new dependency.

## Impact

- Affected capability: `compatibility`.
- Affected code: `src/compat/cucumber-html-reporter.ts` and its tests.
- Affected docs: `docs/COMPATIBILITY.md`, `docs/DROP-IN-VALIDATION.md`,
  `docs/BACKLOG.md`.
- Seed-Test group mode can keep reading `<output>.json` after the documented
  `await generate(...)` migration.
