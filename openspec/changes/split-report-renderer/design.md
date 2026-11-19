# Design

## Context

One file owns the public entry, the shell and every view. The goal is real
ownership, not one file per function: each module must have a reason to exist
and a one-way dependency on the modules below it.

Data flow: input files → `loadInputs` → `sanitizeEnvelopes` →
`buildReportModel` (inside `renderHtml`) → the view modules → one HTML string.
The shell, CSP and client bundle stay in `html.ts`. This follows ADR 0005
(server-rendered shell) and keeps the package surface unchanged.

## Modules and dependency direction

Layers, top to bottom; a module may import only from a lower layer:

```
html.ts            shell, CSP, renderHtml assembly (summarizeIndex stays here)
  report.ts        report header, toolbar, features, scenarios, steps, hooks,
                   feature-row chrome
  details.ts       Details header, run/environment panels, analysis layout
    triage.ts      needs-attention index, source strip
    matrix.ts      feature-by-status matrix
    attachments.ts image/text/video/log/file rendering
    ci.ts          CI header and detail rows
    format.ts      status/duration/date/bar helpers, health, counts, tags,
                   safeHttpUrl, orderFeatures
      types.ts     RenderOptions, DisplayStatus, OrderedFeature
```

`format.ts`, `types.ts` and `ci.ts` import no view module. `escape.ts`,
`dom-contract.ts`, `markdown.ts`, `ansi.ts`, `styles.ts`, `client-bundle.ts`,
`search.ts` and `report-client.ts` stay as they are. `report.ts` stays under 800
lines; if it grows past that or a second consumer needs scenario/step rendering,
extract `scenarios.ts`/`steps.ts` then (backlog trigger).

## Function ownership

- `types.ts`: `RenderOptions`, `DisplayStatus`, `OrderedFeature`.
- `format.ts`: `ALL_STATUSES`, `STEP_GLYPHS`, `statusLabel`, `statusClass`,
  `durationLabel`, `dateLabel`, `barWidth`, `featureBar`, `displayStatuses`,
  `compareStatus`, `bySeverity`, `orderFeatures`, `countStatuses`,
  `attentionCounts`, `executedOnly`, `featureSourceLabel`, `healthMarkup`,
  `tagsMarkup`, `statusBar`, `countPills`, `safeHttpUrl`, `hookLabel`. `triage`
  and `matrix` import `ALL_STATUSES`; they never copy it, because a copy would
  silently reorder their output.
- `ci.ts`: `githubRepoPath`, `githubBaseUrl`, `shortRevision`,
  `githubCommitUrl`, `revisionMarkup`, `ciNameMarkup`, `ciHeaderMarkup`,
  `ciDetailRows`.
- `attachments.ts`: `JsonFrame`, `prettyJson`, `jsonBody`, `uriListBody`,
  `textAttachmentBody`, `renderAttachment`.
- `triage.ts`: `TRIAGE_FEATURE_LIMIT`, `TRIAGE_SCENARIO_LIMIT`, `SOURCE_LIMIT`,
  `TriageEntry`, `scenarioLabel`, `renderTriageRow`, `renderTriage`,
  `renderSourceStrip`.
- `matrix.ts`: `matrixStatuses`, `renderFeatureMatrix`.
- `details.ts`: `renderAnalysisView`.
- `report.ts`: `SEARCH_MESSAGE_LIMIT`, `UNDEFINED_LEAD`, `AMBIGUOUS_LEAD`,
  `metadataLine`, `scenarioTags`, `renderDiagnostic`, `renderStepText`,
  `renderStep`, `renderHook`, `renderRunHooks`, `backgroundText`,
  `backgroundMarkup`, `ruleSearchText`, `scenarioText`, `RenderItem`,
  `RuleBlock`, `renderScenario`, `renderExamples`, `renderOutline`,
  `renderFeatureItem`, `renderRuleBlock`, `featureShape`, `renderFeature`,
  `renderReportView`.
- `html.ts`: `inlineScriptHashes`, `csp`, `renderHtml`, the shell string and a
  one-line `export type { RenderOptions }` for path stability.

Only `renderHtml` crosses the module surface (`src/index.ts`, `src/stream.ts`);
`RenderOptions` stays internal. `summarizeIndex` stays in the assembly.

## Reflow and measured length

The longest single-line returns are about 1-1.5 KB, not 4-8 KB. They are split
by extracting fragment helpers that return the same concatenated string, for
example `reportHeader`, `toolbar`, `featureSummary`, `scenarioSummary`,
`scenarioBody`, `detailsHeader`, `runPanel` and `environmentPanel`. No newline
is added inside a template literal, so the bytes do not change. No helper is
extracted purely to shorten a line; it must own a recognisable fragment.

## Reflow order

The issue lists “reflow first”, but the fragment helpers need their final owner;
extracting them in `html.ts` and moving them afterwards would touch every line
twice. Split first, then extract the fragments in the owning module. This is a
recorded deviation, not a silent one.

## Verification

1. **Committed characterization before the refactor.** Add
   `test/render-characterization.test.ts`: for each fixture in the set below,
   render with `vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))` and
   assert SHA-256 of the HTML against a constant recorded from the current code.
   The fake time pins the legacy `new Date()` fallback, so `happy.json` and
   `failed.json` are deterministic. Add the file, run it green, and commit it.
2. **Committed golden.** Add `test/render-golden.test.ts` with two file
   snapshots generated from the current code and the same fake time:
   - `legacy/minimal.json` with a title;
   - `messages/attachments-presentation.ndjson` with a title, metadata, accent
     and a small PNG data-URI logo.
   Commit the snapshots; the refactor keeps both byte-identical. The two files
   are the reviewable sample; the hash set is the breadth check.
3. **Module-layer test.** Add `test/render-modules.test.ts` with 3.7, after the
   modules exist: read the relative imports of the new render modules and assert
   the layer direction (`html` → `report`/`details` →
   `triage`/`matrix`/`attachments`/`ci` → `format` → `types`), the expected
   module set, that the foundation modules import no layered module, and that
   `html.ts` stays shell-only. It is green at the end of the split and guards
   later imports; `tsc` alone does not reject cycles.
4. Fixture set for 1 and the extra CLI hash check:
   `messages/screenshot.ndjson`, `messages/all-statuses.ndjson`,
   `messages/empty-statuses.ndjson`, `legacy/happy.json`, `legacy/failed.json`,
   `playwright/real-run.json`, `playwright/two-files.json`,
   `playwright/skipped-no-steps.json`. The CLI hash check can use the non-legacy
   files because it cannot fake the clock; the test covers all eight.
5. Re-run the characterization and `npx tsc --noEmit` after each split task, not
   only at the end. `model.source` is the producer label, not a path, so the
   hashes are portable.
6. Run `npm run check` and `npm run test:e2e`.
7. Confirm `git diff` shows no change to `package.json` exports, CSS,
   `styles.ts`, `client-bundle.ts` or the CSP.

## Security review

SEC is not triggered: the refactor moves attachment and escaping code without
changing an input, path, media type or trust boundary, and the characterization
plus the existing attachment tests pin the markup. Any byte change fails the
hashes.

## Risks

- A missed helper or a wrong-direction import fails the module-layer test;
  `tsc` only catches missing modules, not cycles. The layer list is the rule.
- Extracting a fragment can change whitespace if the template literal is split
  inside the string; the hash test catches it, including trailing spaces before
  `>` that the existing suite does not assert.
- The CSP hashes the inline client script; the shell string must stay identical.
- The golden files duplicate the inlined CSS and client script; expect roughly
  240 KB total and revisit if the repository size budget tightens.
- Reviewers must not ask for a behavior spec delta for a refactor; the archive
  uses `--skip-specs`.
