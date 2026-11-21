# Design

## Context

The shim already resolves `jsonFile`/`jsonDir`, expands directories, filters
invalid files when `ignoreBadJsonFile` is true and writes the HTML atomically.
The old reporter's `lib/jsonDir.js` merges features by `uri`, marks every
element with a `retried` value parsed from the file name, and writes the array
to `<output>.json` with two-space indentation. Seed-Test's group analysis reads
that sidecar.

## Sidecar writer

- Add a small helper in the compat module, not the core loader: the sidecar is a
  migration aid, not a new core artifact.
- Run after `generateReport` succeeds and after the HTML report is written. A
  sidecar failure fails the compat call; the HTML may remain. A failed HTML
  write leaves no sidecar. The old reporter writes the sidecar first; the shim
  writes it second so a failed report cannot leave a stale sidecar.
- Read each resolved input file, parse the legacy array, and merge:
  - key by `uri`, or `Feature: URI Not Present` when absent;
  - keep the first feature object and append later `elements`;
  - add `retried: 0` to each element (the old filename-derived retry hack is not
    reproduced; Seed-Test's group analysis does not consume it).
- `JSON.stringify(merged, null, 2)`; write with `writeAtomic`, which creates the
  parent directory, uses a temp file and renames.
- Only when `jsonDir` is set and `jsonFile` is not. `jsonFile` wins, matching
  the existing input rule.
- Refuse to write when `<output>.json` is an input with a feature URI that no
  other input represents; fail with a clear message and leave the input
  unchanged. If every feature URI in that file is represented by the other
  inputs, it is a previous sidecar: exclude it from the report inputs, do not
  duplicate its features, and replace it atomically. Seed-Test's group output
  and sidecar live inside the group directory, so the second run must take this
  path.
- If a directory file is malformed and `ignoreBadJsonFile` is true, the existing
  report path already skips it; the sidecar merges the valid files. If
  `ignoreBadJsonFile` is false, generation fails before the sidecar.
- No timestamp sorting and no old HTML transformation.

## Tests

- A two-feature `jsonDir` produces `<output>.json` with two features, merged
  elements and `retried: 0`; the file is pretty-printed.
- `jsonFile` produces no sidecar, including when `jsonDir` is also set.
- A sidecar path that equals an input fails without changing the input.
- A failed HTML write leaves no sidecar.
- The existing callback, CJS and warning tests stay green.

## Compatibility

- The old reporter's exact `retried` filename parsing and timestamp sorting are
  not reproduced; they are not required by Seed-Test and are documented.
- The sidecar contains the legacy input shape, not the normalised Messages
  model. The core CLI/API never writes it.

## Risks

- A very large `jsonDir` is read a second time for the sidecar. The existing
  100 MB input cap applies and the compatibility path is not a hot path.
- The sidecar is a derived file in a migration aid; a stale sidecar from an
  earlier run is replaced atomically.
