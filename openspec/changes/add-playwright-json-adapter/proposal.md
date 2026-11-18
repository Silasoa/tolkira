# Proposal

## Why

Playwright users can only feed Tolkira through JUnit XML today. JUnit loses
projects, retries, steps, attachments and error context, so a Playwright run
renders as a basic list of test cases. Playwright's native JSON reporter is the
stable artifact that carries that data. This closes parity gap #4 without
weakening the one-file, offline promise.

## What Changes

- Detect Playwright JSON by shape before generic JSON validation.
- Normalize projects, files, describes, tests, retries, statuses, steps, errors
  and attachments into the existing Cucumber Messages and report model.
- Map a Playwright project to a feature, file/describe paths to rules and a
  spec to a scenario; use the last result and expose the retry attempt.
- Preserve inline attachments and safely embed path attachments that stay
  inside the input file's directory. Skip missing or outside paths and
  document that limit.
- Preserve tags, annotations, error messages, snippets and error-context
  attachments.
- Add fixtures from a real Playwright run plus synthetic edge cases, and update
  limitations, compatibility and README.

Out of scope: trace or video playback, the Playwright HTML report, remote
attachment URLs, external/split assets, history and a second runtime
dependency.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `input-formats`: accept Playwright JSON, detect it, preserve its projects,
  retries, attachments and error context, and enforce safe attachment paths.

## Impact

- `src/input/detect.ts`, a new Playwright adapter, the input loader and the
  existing legacy normalizer.
- `test/input-detect.test.ts`, a new Playwright test suite and fixtures under
  `test/fixtures/playwright/`.
- `docs/LIMITATIONS.md`, `docs/COMPATIBILITY.md`, `README.md` and the input
  specification.
- No new runtime dependency; Playwright types stay test-only.

## Review gate

PIR and DXR run over this proposal, the spec and the design before
implementation. Implementation is a TDD pair. Refs #4.
