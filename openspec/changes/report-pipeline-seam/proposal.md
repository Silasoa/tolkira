# Proposal

## Why

The report pipeline has two render paths that must agree but are not forced
to. `src/run.ts` loads, sanitises, indexes, compares and summarises a run, then
passes `envelopes` plus the precomputed `index`, `summary`, `comparison`,
`provenance`, `skippedAttachments`, `inputFiles` and `inputBytes` through the
14-field internal `RenderOptions` (`src/render/types.ts:8-30`). `renderHtml`
accepts the same options and, when a field is absent, recomputes it from the
envelopes (`src/render/html.ts:54-62`). The caller can therefore supply an
`index` or `summary` that was built from different envelopes, and the renderer
will not notice. `renderHtml` also sanitises a second time after `run.ts`
already sanitised, while `stream.ts` passes raw envelopes through the same
entry.

The wide options also mix caller input with precomputed run facts: the two
input counts are read only by the Details run panel (`src/render/details.ts:73-81`),
where "absent" omits the row and `0` would render "0 files · 0 B", so the
caller cannot express the difference once the fields are defaulted. The trust
state of the envelopes is invisible in the type.

This is the report pipeline seam step of `docs/BACKLOG.md` B-057 and
`docs/research/architecture-2026-11.md` section 3.3. It is an internal
refactor with **no externally visible change**: the report HTML, the public API
and the CLI-observable bytes stay identical.

No remote tracking issue is open for this slice; the tracker is the local
backlog row B-057. If an issue is opened for this work, one independent IR
(Issue Review) runs before it is posted.

## What Changes

- Add `src/loaded-run.ts` with an opaque `LoadedRun` (sanitised envelopes,
  index, summary, optional comparison, provenance, attachment count and
  optional input counts) and one builder, `buildLoadedRun(envelopes, facts)`.
  Sanitising, indexing and summarising happen exactly once, in the builder.
- Add `renderRun(run, options)` to `src/render/html.ts` as the trusted render
  entry. It renders an existing `LoadedRun` and never sanitises, indexes or
  summarises again.
- Keep `renderHtml(envelopes, options)` as the direct/test entry: it builds one
  `LoadedRun` and delegates to `renderRun`, so every existing direct render
  keeps working and sanitises once.
- Narrow the internal `RenderOptions` to the fields the views consume. The
  precomputed `index`, `summary`, `provenance` and `skippedAttachments` leave
  the options and live only in `LoadedRun`; `comparison` and the two input
  counts stay as view fields that `renderRun` fills from the run, and the
  caller-facing options reject them.
- Switch `src/run.ts` and `src/stream.ts` to the seam. `run.ts` builds one
  `LoadedRun` per generate/render/summarise call; the stream builds one on
  flush.
- Update the direct render tests that passed `provenance` or
  `skippedAttachments` through options to build a `LoadedRun` instead. No
  assertion is weakened.
- Update `docs/ARCHITECTURE.md` (the `src/run`, `src/render` and `src/index`
  sections and the renderer module map), `docs/AGENT-INTERFACE.md` (the
  `renderHtml`/`RenderOptions` statement), `DESIGN.md` (renderer module map)
  and `GLOSSARY.md` if it names the old entry.

Out of scope: the render-context refactor (one context object instead of the
`options` parameter through the views, architecture candidate 4); status
vocabulary; sidecar reader; input pipeline; filter seam; ICU message parser;
any markup, CSS, script, ARIA, i18n, summary-schema, history, baseline, email,
PDF or CI change; B-056 performance work; a version bump, changelog, tag,
stage or publish.

## Capabilities

No spec delta: the change is internal and skip_specs is set. The acceptance
criteria are in `design.md` and are exercised by tests named in `tasks.md`.

## Impact

- Public API: unchanged. `generateReport`, `renderReport`, `summarizeReport`
  and `CucumberHtmlStream` keep their signatures and exports;
  `dist/index.d.ts` must stay byte-identical. `dist/index.js` changes only by
  the moved internal implementation, with no export or behaviour change.
- Report output: must stay byte-identical. The existing characterization
  hashes, the render suites, the CLI equivalence suite and the browser suite
  are the proof. Every CLI-observable byte (report, JSON summary, CI file,
  history, manifest, stdout/stderr) stays identical.
- Test surface: 127 direct `renderHtml` calls stay unchanged through the
  wrapper; about eight calls that pass run facts move to `buildLoadedRun`.
- Bundle: `dist/cli.d.ts` stays identical; the internal declarations may gain
  one `dist/loaded-run.d.ts` and change `dist/render/html.d.ts`.
