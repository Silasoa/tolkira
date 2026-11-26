# Design — report pipeline seam

## Context

Current shape (2026-11-26, `ff0384e`):

- `src/run.ts:61-104` loads groups, sanitises all envelopes, calls `indexRun`,
  derives `comparison` and `summary`, collects attachment/input counts and
  provenance, then spreads all of it into `renderHtml` options.
- `src/render/html.ts:54-97` accepts `(envelopes, RenderOptions)`, sanitises the
  envelopes again, falls back to `indexRun` and `summarizeIndex` when `index` or
  `summary` is absent, and renders the shell.
- `src/stream.ts:28-33` passes its collected envelopes to `renderHtml` with the
  public options.
- `src/render/types.ts:8-30` declares 14 option fields; `inputFiles` and
  `inputBytes` are read only by the Details run panel, where an absent value
  omits the row (`src/render/details.ts:73-81`).
- `summarizeIndex(index, comparison)` already expects a sanitised index;
  `scenarioIdentities(index)` and `compareBaseline` are called in `run.ts`.

The review target (`docs/research/architecture-2026-11.md` section 3.3):
`renderRun(run: LoadedRun, options: RenderReportOptions)` with an opaque
`LoadedRun` built by the pipeline; `renderHtml` internal over a trusted run;
sanitise once at the seam; public signatures unchanged.

## Target shape

### `src/loaded-run.ts` (new, internal)

```ts
export interface LoadedRunFacts {
  baseline?: BaselineSummary;
  provenance?: Map<string, string>;
  skippedAttachments?: number;
  inputFiles?: number;
  inputBytes?: number;
}

export interface LoadedRun {
  readonly envelopes: Envelope[];        // sanitised exactly once
  readonly index: RunIndex;
  readonly summary: ReportSummary;
  readonly comparison?: BaselineComparison;
  readonly provenance?: Map<string, string>;
  readonly skippedAttachments: number;
  readonly inputFiles?: number;   // undefined omits the Details row
  readonly inputBytes?: number;
}

export function buildLoadedRun(
  envelopes: Envelope[],
  facts?: LoadedRunFacts,
): LoadedRun;
```

- `buildLoadedRun` owns `sanitizeEnvelopes`, `indexRun`, `compareBaseline` and
  `summarizeIndex`, in that order. It replaces `run.ts`'s local `loadRun`
  assembly and removes those imports from `run.ts`.
- The interface carries a `unique symbol` brand that is **not exported**, so no
  module outside `src/loaded-run.ts` can construct a `LoadedRun` object literal.
  The builder is the only producer; the brand is compile-time only and adds no
  runtime field.
- Missing facts default to `undefined` (comparison, provenance, input counts);
  only `skippedAttachments` defaults to `0`, matching today's `?? 0`. The
  absent input counts must keep the Details row omitted for direct renders.

### `src/render/html.ts`

- `renderRun(run: LoadedRun, options: RenderReportOptions): Promise<string>` is
  the trusted entry. It applies `renderOptions(options)` once (default title),
  reads `history` from the options, and never calls `sanitizeEnvelopes`,
  `indexRun` or `summarizeIndex`. It takes the model from `run.envelopes`,
  `run.provenance` and `run.index`, the summary from `run.summary`, the
  attachment notice from `run.skippedAttachments`, and fills the view options
  from the run: `comparison` whenever present, `inputFiles`/`inputBytes` only
  when present. A run fact always wins; a caller cannot supply one.
- `renderHtml(envelopes: Envelope[], options: RenderReportOptions = {})`
  becomes a thin wrapper: `renderRun(buildLoadedRun(envelopes), options)`. It
  keeps its async signature, its default title through `renderOptions`, and its
  runtime behaviour of ignoring unknown keys such as `baseline`.
- The shell assembly, CSP, view calls, CSS conditions and `applyReportSize`
  order stay byte-for-byte as today.

### `src/render/types.ts`

`RenderOptions` shrinks to the view-facing fields:

```ts
title, metadata?, logo?, accent?, locale?, history?, static?,
comparison?, inputFiles?, inputBytes?
```

`comparison`, `inputFiles` and `inputBytes` stay because `report.ts` renders
the baseline panel/badges and `details.ts` renders the input row; `renderRun`
fills them from the loaded run and only when the run has them. `index`,
`summary`, `provenance` and `skippedAttachments` are removed. A type test
proves that the caller-facing options of `renderHtml`/`renderRun` reject all
seven internal facts.

### `src/run.ts`

- `loadRun(resolved, baseline)` becomes: load groups once, then
  `buildLoadedRun(envelopes, { ...(baseline === undefined ? {} : { baseline }),
  ...(provenance === undefined ? {} : { provenance }), skippedAttachments,
  inputFiles, inputBytes })` using the existing conditional-spread idiom
  required by `exactOptionalPropertyTypes`. Provenance is still set only for
  multi-group runs.
- `render(run, options, history)` calls `renderRun(run, { ...options, ...
  (history === undefined ? {} : { history }) })`; `renderRun` applies
  `renderOptions` itself, so no pre-normalised title is passed.
- `GeneratedReport` reads `run.summary`, `run.skippedAttachments`,
  `run.inputFiles ?? 0` and `run.inputBytes ?? 0`; the file path always sets
  both counts, so the public `GeneratedReport` numbers never change.
- `summarizeRunFromResolved` and `summarizeReportFromResolved` keep their
  behaviour and return values.

### `src/stream.ts`

On flush: `renderRun(buildLoadedRun(this.envelopes), this.options)`.
`renderRun` applies the same `renderOptions` default title and reads
`options.history` itself, so the stream's current spread is no longer
duplicated. The stream has no baseline, provenance or input counts, so those
facts stay absent.

## Acceptance criteria

- **AC1 (one producer).** `LoadedRun` can only be produced by
  `buildLoadedRun`; a type-level test with `@ts-expect-error` proves a complete
  object literal is rejected outside the module. Fields stay readable.
- **AC2 (no recompute in the trusted entry).** `renderRun` does not call
  `sanitizeEnvelopes`, `indexRun` or `summarizeIndex`. A spy test in a
  dedicated file proves zero calls; `renderHtml` calls `buildLoadedRun`
  exactly once.
- **AC3 (single sanitise).** A spy test proves `sanitizeEnvelopes` is called
  exactly once for `renderHtml` (inside `buildLoadedRun`) and zero times for
  `renderRun`; a run built from an unsanitised envelope with a remote Markdown
  image renders no remote URL. The spy is the proof; sanitising is idempotent,
  so an idempotence probe proves nothing.
- **AC4 (narrow caller options).** `RenderOptions` no longer declares `index`,
  `summary`, `provenance` or `skippedAttachments`; the caller-facing options of
  `renderHtml` and `renderRun` reject all seven internal facts (including
  `comparison`, `inputFiles`, `inputBytes`) as a type error
  (`@ts-expect-error` test), while `renderRun` still renders comparison,
  provenance and the input row from the run.
- **AC5 (public API unchanged).** `src/index.ts` exports, signatures and
  `dist/index.d.ts` stay byte-identical; `dist/index.js` changes only by the
  moved implementation and gains or loses no export; `renderHtml` still
  ignores a `baseline` key at runtime; `CucumberHtmlStream` keeps its
  constructor and output.
- **AC6 (byte parity).** For one mixed fixture,
  `renderReport(file, options)` and
  `renderRun(buildLoadedRun(parseMessages(...), facts), options)` produce
  identical bytes. `facts` carries the same input counts, the multi-file
  provenance when applicable, the same `baseline` for the baseline variant and
  the same `skippedAttachments` when the fixture triggers the notice; title,
  locale and static variants included. Stream output equals `renderReport`
  (existing test).
- **AC7 (facts survive).** Provenance still reaches the source strip for
  multi-file runs; a skipped-attachment count still renders the notice; a
  baseline comparison still renders the panel and badges. The migrated tests
  assert the same visible output as before.
- **AC8 (empty and boundary cases).** Zero envelopes render the empty report;
  a run with no facts has no comparison and keeps the Details input row
  omitted (absent counts, not `0`); one history run does not render Trends and
  two do; `static` true and false are unchanged; a run's comparison wins over
  any caller value.
- **AC9 (no output drift).** The full unit suite, characterization hashes,
  CLI equivalence artefacts, `package:check` and the three-engine browser suite
  stay green. No CSS, script, markup, ARIA or i18n assertion changes.
- **AC10 (no dead fields).** No renderer code reads a removed option field;
  knip and typecheck are green.

## Edge-case matrix (ISTQB-inspired)

| Dimension | Classes |
| --- | --- |
| Envelopes | empty; one feature; multi-file provenance; unsanitised remote image; attachment at/over cap |
| Facts | none; provenance only; skipped count 0 / >0; baseline absent / present; input counts absent / 0 / >0 |
| Options | title default; metadata; logo; accent; locale; static false / true; history 0 / 1 / ≥2; conflicting run fact |
| Entry | `renderReport`; `generateReport`; `summarizeReport`; `renderHtml`; `renderRun`; stream |
| Path | CLI generate; CLI summary-only; direct render; stream flush |

Pairwise focus: (baseline present × static), (provenance × skipped >0),
(history ≥2 × comparison), (input counts absent × direct/stream),
(empty envelopes × every entry), (run comparison × caller value — run wins).

## Test migration

- `test/render-empty-run.test.ts:159`, `test/render-source-strip.test.ts:53,
  67, 79, 206`, `test/render-triage.test.ts:136` pass `provenance` through
  options → build a `LoadedRun` with `buildLoadedRun(envelopes, { provenance })`
  and call `renderRun`.
- `test/render-static.test.ts:239-244` passes `skippedAttachments` → same
  migration.
- `test/parity-metadata.test.ts:554` passes a precomputed `summary` → drop the
  key; the HTML recomputes it and the test's model/summary assertions stay.
- `test/render-locale.test.ts`, `test/render-trends.test.ts` and the other
  direct calls keep `renderHtml`; only their option type import may need the
  narrowed fields.
- New: `test/loaded-run.test.ts` (builder contract, defaults, comparison,
  brand) and `test/render-seam.test.ts` (AC2, AC3, AC4, AC6, extra `baseline`
  key, empty run).

## Gate

- `npm run hygiene` and `npm run check` (i18n, assets, typecheck, lint, knip,
  format, build, coverage) green.
- `npm run test:e2e` green; no markup change.
- `npm run package:check`: `dist/index.d.ts` byte-identical, `dist/index.js`
  free of export changes, tarball gains at most one internal
  `dist/loaded-run.d.ts`, all CLI-observable bytes identical.
- Characterization hashes and the CLI equivalence suite unchanged; record the
  byte comparison in `gate.md`.
- Run one host row because the change touches the render entry: host row 2
  (official `@cucumber/cucumber@13.3.0`, legacy JSON and Messages) on the local
  build, comparing counts, attachments, responsive layout at 1440 and 390 and
  no external requests. Record host, pin, artifact sizes and result in
  `gate.md`. If the row cannot run locally, record the blocker for user
  decision instead of assuming an exception.
- Reviews: SCR, CR, DAR, STR, SEC (sanitise/attachment path) and PCA (render
  hot path; bundle trigger if growth exceeds 2 %). No UXR, ILA or CMP: no
  user-visible change, proven by byte parity.

## Stop conditions

- Any report HTML, CLI artefact or process-probe byte changes.
- `dist/index.d.ts` changes or `dist/index.js` gains or loses an export; a
  public export changes.
- The brand forces a runtime field or a cast at a call site outside the
  builder.
- A view needs a new parameter or the shell needs a new branch to compile.
- Total line growth exceeds +20 % in `src/run.ts` or `src/render/html.ts`, or
  `src/loaded-run.ts` exceeds 120 lines.
- More than ten test files need assertion changes beyond moving fact
  construction.
- A stop condition is hit: stop and record the blocker in the change instead
  of widening the slice.

## Slices

1. Contract, PIR/DXR, blockers fixed in this file.
2. TDD-Red: write the failing acceptance and edge tests against the target
   API; migrate the fact-passing tests; do not touch `src/`.
3. Implement `src/loaded-run.ts`, `renderRun`/wrapper, narrowed options,
   `run.ts` and `stream.ts`; make Red green without weakening it.
4. Docs (`ARCHITECTURE.md`, `GLOSSARY.md` if needed), line counts, byte and
   bundle comparison, `gate.md`.
5. Review set, fixer, delta re-checks, then user approval for archive.
