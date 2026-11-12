# Proposal

## Why

Four points remain for the 0.3 parity slice: the optional stream adapter (G14),
optional parameter highlighting (G15), real-shaped JUnit producer coverage and
the structure/test-health cleanup left over from the parity changes. G14 and
G15 are the last documented gaps against the official Cucumber HTML formatter;
the JUnit fixtures close a verification gap rather than a behaviour gap.

No remote tracking issue exists; this change is a coordinator request.

## What Changes

- Export `CucumberHtmlStream`, a Node `Transform` that accepts Cucumber
  Messages envelopes, collects them and renders one HTML document on flush.
  It uses the same options and renderer as `renderReport`, writes no files and
  emits no summary.
- Highlight matched step parameters from exactly one
  `testStep.stepMatchArgumentsLists` entry. Matched fragments are escaped and
  wrapped in a `span.param` with their parameter type; unsafe or malformed
  ranges fall back to plain escaped step text. No new dependency.
- Add synthetic but real-shaped Jest, pytest and Gradle JUnit XML fixtures with
  provenance. Tests only: the adapter's existing behaviour is characterised,
  not extended. Suite-level `system-out`/`system-err` stays ignored as
  documented.
- Add `test/fixtures.ts` helpers for Messages, legacy and JUnit fixture paths
  and use them in the browser specs, removing duplicated path constants.
- Document the stream API, parameter highlighting, fixture provenance and the
  test helper.

Out of scope: themes, history/trends, external or split attachments, lazy
rendering (G16), summary schema changes, new runtime dependencies, release,
tagging and archiving.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-api`: add the Messages stream adapter as a programmatic entry point.
- `report-rendering`: highlight matched step parameters safely.
- `input-formats`: require common JUnit producer shapes to stay covered by
  provenance-bearing fixtures.

## Impact

- `src/index.ts` (stream export), `src/report/model.ts` and
  `src/render/html.ts` (parameter data and markup), `src/render/report.css`
  (highlight style).
- Tests: stream parity with a real Node stream, parameter rendering/escaping
  edges, JUnit producer fixtures, fixture-path helper.
- Docs: `docs/CHANGELOG.md`, `docs/AGENT-INTERFACE.md`,
  `docs/CUCUMBER-COMPATIBILITY.md`, `docs/JUNIT-XML.md`, `README.md`.
- No API breaking change; the summary and report counts are unchanged.

## Review gate

PIR and DXR run before implementation; implementation is a TDD pair. The
coordinator owns review, archive and release.
