# Tasks â€” report pipeline seam

## 1. Contract and pre-implementation review

- [x] 1.1 Finish the change contract: `proposal.md`, this file and
  `design.md`, including the acceptance criteria AC1-AC10, the edge-case
  matrix and the stop conditions.
- [x] 1.2 Run PIR and DXR in parallel before any production code. PIR checks
  parity and vision: no user-visible change is claimed, no parity feature is
  dropped, and the seam does not promise work that belongs to the input
  pipeline or the render-context refactor. DXR checks the developer and
  integrator view: public API unchanged, stream behaviour unchanged, a fresh
  agent can follow the seam, and the test migration is actionable.
- [x] 1.3 Fold every PIR/DXR blocker into `proposal.md`/`design.md` before
  implementation; record the verdicts in `gate.md`. Both reviewers PASS after
  the input-count, parity-fact, stream-option and bundle-claim fixes.

## 2. TDD-Red

- [x] 2.1 Write `test/loaded-run.test.ts` against the target API: builder
  returns sanitised envelopes, index and summary for empty, single and
  multi-file inputs; `baseline` produces a comparison and a summary with the
  comparison; `provenance`, `skippedAttachments`, `inputFiles` and
  `inputBytes` survive; absent facts leave comparison, provenance and both
  input counts absent (the input row must stay omitted), while
  `skippedAttachments` is `0`; a complete object literal is rejected by the
  brand at type level.
- [x] 2.2 Write `test/render-seam.test.ts`: AC2 spy proof (`vi.mock(...,
  { spy: true })`) that `renderRun` calls no sanitise/index/summary and
  `renderHtml` calls the builder exactly once; AC3 sanitise call count on the
  remote-image case; AC4 `@ts-expect-error` for every internal fact on
  `renderHtml` and `renderRun`; AC6 byte parity between
  `renderReport(file, options)` and
  `renderRun(buildLoadedRun(parseMessages(...), facts), options)` with the same
  input counts, multi-file provenance, baseline and skipped-attachment facts as
  the file path; the extra `baseline` key is still ignored; an
  empty run renders the empty report and omits the input row; two history runs
  render Trends and one does not; a run comparison wins over a caller value.
- [x] 2.3 Migrate the fact-passing direct tests to `buildLoadedRun` +
  `renderRun`: `test/render-empty-run.test.ts`, `test/render-source-strip.test.ts`,
  `test/render-triage.test.ts` (provenance),
  `test/render-static.test.ts` (skipped attachment), and drop the supplied
  `summary` key in `test/parity-metadata.test.ts`. Keep every assertion; only
  the construction changes.
- [x] 2.4 Run the new and migrated tests and record the red state: the new
  files fail on the missing API, the migrated files fail to typecheck, and no
  existing assertion was deleted.

## 3. Implementation

- [x] 3.1 Add `src/loaded-run.ts` with the branded `LoadedRun`,
  `LoadedRunFacts` and `buildLoadedRun`; move `sanitizeEnvelopes`, `indexRun`,
  `compareBaseline` and `summarizeIndex` into the builder. Keep the module
  under 120 lines.
- [x] 3.2 Add `renderRun(run, options)` to `src/render/html.ts` and reduce
  `renderHtml` to the wrapper. The shell, CSP, view calls, CSS conditions and
  `applyReportSize` order stay unchanged. `renderRun` applies `renderOptions`
  once, merges `run.comparison` and the input counts only when present, and
  passes `run.summary`.
- [x] 3.3 Narrow `src/render/types.ts`: remove `index`, `summary`,
  `provenance` and `skippedAttachments`; keep the view-facing fields plus
  `comparison`, `inputFiles` and `inputBytes` (documented as filled by
  `renderRun`, absent when the run has no value).
- [x] 3.4 Switch `src/run.ts` to `buildLoadedRun` + `renderRun`; drop the
  moved imports and the duplicate fact spread. `GeneratedReport`,
  `summarizeRunFromResolved` and `summarizeReportFromResolved` keep their
  values.
- [x] 3.5 Switch `src/stream.ts` to `buildLoadedRun` + `renderRun` on flush.
- [x] 3.6 Make the Red tests green without deleting, skipping or loosening an
  assertion; add any missing test the implementation reveals. Do not touch
  CSS, client scripts, markup, i18n catalogs, summary schema, baseline,
  history, email, PDF or CI modules.

## 4. Verification and gate

- [x] 4.1 Run the focused suite: `npx vitest run test/loaded-run.test.ts
  test/render-seam.test.ts test/render-*.test.ts test/run.test.ts
  test/stream.test.ts test/parity-metadata.test.ts
  test/size-diagnostics.test.ts`. All green, no edited expectations beyond the
  migration.
- [x] 4.2 Run `npm run hygiene` and `npm run check` (i18n, assets, typecheck,
  lint, knip, format, build, coverage). Coverage floors unchanged.
- [x] 4.3 Run `npm run test:e2e`; the report shell must stay unchanged in all
  three engines.
- [x] 4.3b Run host row 2 (official `@cucumber/cucumber@13.3.0`, legacy JSON
  and Messages) on the local build; compare counts, attachments, responsive
  layout at 1440 and 390 and external requests. Record host, pin, artifact
  sizes and result in `gate.md`. If it cannot run locally, record the blocker
  for user decision, not an assumed exception.
- [x] 4.4 Run `npm run package:check`: `dist/index.d.ts` and `dist/cli.d.ts`
  byte-identical, `dist/index.js` free of export changes, tarball gains at
  most one `dist/loaded-run.d.ts`, CLI-observable bytes checked. Record the
  tarball entry count.
- [x] 4.5 Verify byte parity explicitly: for one mixed fixture compare
  `renderReport` with the direct `renderRun` path; compare the CLI report, JSON
  summary, CI file, history and manifest bytes with the pre-change build; run
  the characterization hashes. Stop on any difference.
- [x] 4.6 Verify the diff surface: `src/loaded-run.ts`, `src/run.ts`,
  `src/stream.ts`, `src/render/html.ts`, `src/render/types.ts`, the affected
  render tests, `docs/ARCHITECTURE.md`, `docs/AGENT-INTERFACE.md`, `DESIGN.md`,
  `GLOSSARY.md` if needed and `openspec/changes/report-pipeline-seam/**`. No
  CSS, client script, markup, i18n, summary, baseline, history, email, PDF or
  CI module changed.
- [x] 4.7 Record `gate.md`: commands, counts, coverage, bundle and tarball
  deltas, byte-parity evidence, line counts and the PIR/DXR verdicts.

## 5. Reviews

- [ ] 5.1 Run SCR, CR, DAR, STR, SEC and PCA in parallel on the approved tree.
  PCA is triggered by the render hot path; record the bundle delta against the
  2 % trigger either way. No UXR, ILA or CMP: no visible change, proven by
  byte parity.
- [ ] 5.2 A failing review spawns a fixer (not the implementer of record);
  then re-review the findings. Every finding is fixed, filed or recorded with
  a trigger in `docs/BACKLOG.md`.
- [ ] 5.3 Commit and push after every completed step with a conventional
  message and the B-057/change reference; run `npm run hygiene` before every
  commit. Do not close an issue, archive the change, bump the version, tag or
  publish.

## Deferred

- The render-context refactor (one context object instead of the `options`
  parameter through the views, architecture candidate 4): separate change
  after this seam; it changes the view signatures and must not bundle here.
- Status vocabulary, sidecar reader, input pipeline, filter seam and ICU
  message parser: B-057 order, separate changes.
- B-056 performance work: only if the gate shows a real regression; the seam
  removes one sanitise pass but is not a performance change.
