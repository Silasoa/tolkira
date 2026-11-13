# Proposal

## Why

Format sniffing and adapter precedence are embedded in the asynchronous file
loop in `src/input/load.ts`. Testing them requires temporary directories and
files even though the decisions depend only on content and a file's identity.
That hides the actual precedence table and mixes I/O concerns with input
classification. This is the "pure input detection" candidate in
`docs/architecture/rewrite-list.md`.

No remote tracking issue exists; this change is a coordinator request.

## What Changes

- Extract format sniffing and adapter selection from the file loop into a pure
  decision table over `(content, identity)`.
- Keep file system work in the loader: directory scanning, ordering, the 100 MB
  total cap, content-hash deduplication, validation error messages and duplicate
  Messages id detection.
- Add a decision-table test suite that exercises sniffing and precedence with
  in-memory content, replacing temporary-directory tests where the file system
  adds no coverage.
- Preserve all externally observable loader behavior: accepted formats,
  precedence, skipped directory files and error messages.

Out of scope: report/model/summary changes, rendering changes, new formats, new
dependencies, API changes, release, tagging and archiving.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a pure refactor; `skip_specs: true` is set because no spec-level
behavior changes.

## Impact

- `src/input/load.ts` (loader keeps I/O and calls the decision table).
- New `src/input/detect.ts` (pure detection and adapter selection).
- `test/input-detect.test.ts` (new decision-table suite).
- `test/inputs.test.ts` (remove sniff cases now covered purely; keep loader
  integration tests).
- No public API, summary schema or runtime dependency change.

## Review gate

Implementation is a TDD slice. The coordinator owns review, archive and
release.
