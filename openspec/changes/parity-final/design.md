# Design

## Context

See `proposal.md`. The official formatter exposes `CucumberHtmlStream` as a
Node `Transform` over envelopes. Tolkira has only file-based
`generateReport`/`renderReport`/`summarizeReport`. Steps render plain escaped
text even though Messages already carries match arguments. JUnit XML has
coverage for synthetic shapes, but no fixtures modelled on the output of Jest,
pytest or Gradle. Test fixture paths are repeated in every browser spec.

## Goals / Non-Goals

**Goals:**

- A drop-in-shaped stream entry point whose HTML equals the file API.
- Safe, dependency-free parameter highlighting that matches the official
  split rule.
- Provenance-bearing JUnit producer fixtures that characterise current
  behaviour.
- One fixture-path helper and less duplication in the browser suite.

**Non-Goals:**

- Incremental/streaming HTML rendering; the stream buffers envelopes and
  renders once on flush, exactly like the file API.
- New JUnit behaviour, suite-level output mapping, or a new summary field.
- G16 lazy rendering, themes, external attachments, summary schema changes.

## Decisions

### Stream adapter

Export `CucumberHtmlStream` from the package root. It extends
`node:stream.Transform` with `objectMode: true`, collects typed `Envelope`
objects in `_transform`, and calls the same renderer as `generateReport` in
`_flush`. It accepts the existing `RenderReportOptions` (title, metadata, logo,
accent) and applies the same default title. On flush it emits one HTML string
chunk. Renderer rejection is forwarded to the transform callback, so
`pipeline`/`for await` see the error. The stream has no file inputs, so it
writes no files and has no provenance groups and no summary result. Teams that
need the summary call `summarizeReport`/`generateReport` on the same Messages
file.

### Parameter highlighting

The report model carries the first match argument list only when
`stepMatchArgumentsLists.length === 1`, mirroring the official formatter.
`group.start` and `group.value` split the pickle step text. Each matched
fragment renders as
`<span class="param" data-parameter-type="...">...</span>`; a missing
`parameterTypeName` falls back to `anonymous`. Every plain and matched fragment
goes through `escapeHtml`. Invalid starts, out-of-range values and overlapping
arguments are skipped so the full original text is emitted at most once.
Zero argument lists, multiple lists (ambiguous) and empty arguments render the
existing escaped plain text. The summary, `data-search` text and copy-failure
text continue to use the unmodified step text. One CSS rule uses the existing
accent text colour; no new dependency or client script.

### JUnit producer fixtures

Add `jest-junit.xml` (jest-junit shape), `pytest.xml` (pytest junitxml shape,
including `<properties>` and suite-level output) and `gradle.xml` (Gradle test
XML shape with a root `<testsuite>` and `<properties>`). Each file starts with
a comment recording shape, producer/version, date and that it is synthetic but
modelled on public output. A `PROVENANCE.md` repeats the table. Tests assert
status mapping, failure/error text, skipped cases, durations and
testcase-level `system-out`/`system-err` attachments. The adapter is not
changed; if a fixture exposed a real bug it would be raised separately, not
papered over with invented behaviour. Suite-level output remains ignored as
`docs/JUNIT-XML.md` already states.

### Fixture-path helper

`test/fixtures.ts` exports `fixturePath`, `messagesFixture`, `legacyFixture`
and `junitFixture`, all rooted at `test/fixtures`. Browser specs and new tests
import these helpers instead of repeating `fileURLToPath(new URL('../fixtures/...'))`.
The helper is test-only; nothing enters `dist`.

## Contracts

- `CucumberHtmlStream` is additive; no existing export changes.
- The summary schema and counts do not change.
- Parameter markup is HTML-only; plain text, search and copy behaviour stay
  unchanged.
- No new runtime dependency; no network request.

## Risks / Trade-offs

- **Whole-run buffering** — the stream does not reduce memory. It is a drop-in
  embedding shape, not an incremental formatter. Documented.
- **Untrusted offsets** — group positions come from the producer. Clamping and
  skipping invalid/overlapping ranges keeps output complete and escaped.
- **Fixture drift** — producer formats evolve. Provenance names the shape and
  version so stale fixtures are visible.
- **Official parity** — parameter highlighting follows the official split rule
  (one argument list, `group.start`/`group.value`); it is cosmetic and does not
  affect triage.

## Migration Plan

No migration. Consumers may adopt the stream instead of writing NDJSON and
calling `renderReport`; existing APIs keep their behaviour.

## Open Questions

None.
