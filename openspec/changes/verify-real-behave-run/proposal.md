# Proposal

## Why

`docs/LIMITATIONS.md` still records Behave 1.3.3 as partial: the real fixture
covers pass/fail statuses and seconds-based durations, but no real multiline
doc string, data table, attachment or multiline error message is checked in.
The Behave fixtures are shaped by what we expect the producer to emit, so they
cannot prove that the adapter accepts real producer output. Behave is also the
only legacy producer whose duration unit and step-argument encoding differ
from the Cucumber dialect.

A real Behave 1.3.3 run in the documented `python:3.11` container produced the
missing shapes. It also exposed three adapter gaps that the synthetic fixtures
do not show:

- Behave writes a multiline doc string as an array of lines in `text`.
  Tolkira accepted the value but passed the array through to the report model,
  which crashed while rendering instead of showing the doc string.
- Behave writes a multiline error message as an array of lines in
  `error_message`. The adapter passed that array into text handling that calls
  string methods, which crashes in the same way.
- Behave uses `status: "error"` for a step that raises a non-assertion
  exception and `hook_error` for a failing step hook; `cleanup_error` is
  recorded on the scenario/feature when context cleanup fails. Tolkira rejected
  the whole file as malformed because `error` and `hook_error` were not in the
  accepted vocabulary.

Without fixing these, a crashed or failing real run can produce no report at
all, and the real fixture cannot be verified end to end.

## What Changes

- Record one real Behave 1.3.3 JSON run with a multiline doc string, a data
  table, an inline PNG attachment, a multiline failed assertion and a step
  `error`. Keep the producer feature, step definitions and image next to the
  recorded JSON with provenance.
- Accept Behave's line-array form for both `text` and `error_message`, normalise
  it to text before the report model reads it, and reject other value shapes
  with a clear legacy-JSON error instead of a renderer crash.
- Accept the Behave step-result statuses `error` and `hook_error` as failed,
  and accept `cleanup_error` defensively if a producer writes it in a step
  result. Keep the existing pass/fail/skip/pending/undefined/ambiguous mapping
  unchanged.
- Verify the real fixture through the legacy adapter, the API summary and the
  generated HTML.
- Update the dated limitations, Cucumber compatibility matrix, README,
  comparison, architecture, agent interface, changelog, research notes and
  backlog entry B-012.

Out of scope: a Behave Messages formatter (Behave has none), older Behave
versions, dry-run/WIP statuses (`untested`, `untested_pending`,
`untested_undefined`, `pending_warn`), `xfailed`/`xpassed`, scenario-level hook
failures that produce no step result, a full hook/status matrix, installing
Python or Behave on the host, report shell changes, and new runtime
dependencies.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `input-formats`: accept the real Behave 1.3.3 argument, error-message and
  status shapes and keep a recorded real-producer fixture with its provenance.

## Impact

- `src/input/legacy.ts` — doc-string and error-message normalisation, input
  validation and failed-status mapping.
- `test/legacy.test.ts`, `test/behave-producers.test.ts`, `test/fixtures.ts` and
  `test/fixtures/behave/` — real fixture, producer source, image, provenance
  and tests.
- `docs/LIMITATIONS.md`, `docs/CUCUMBER-COMPATIBILITY.md`, `README.md`,
  `docs/COMPARISON.md`, `docs/ARCHITECTURE.md`, `docs/AGENT-INTERFACE.md`,
  `docs/CHANGELOG.md`, `docs/BACKLOG.md` and `docs/research/open-questions.md`.
- No change to the CLI, report shell, summary schema or dependencies.

## Review gate

PIR and DXR run over this proposal, the spec delta and the design before
implementation. Implementation is a TDD pair. Refs
[#15](https://github.com/Silasoa/tolkira/issues/15).
