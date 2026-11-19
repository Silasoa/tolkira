# Design

## Context

The #7 split gave every report view a module owner: `report.ts` (shell, header,
toolbar, features, scenarios, steps, hooks, rules), `details.ts`, `triage.ts`,
`matrix.ts`, `attachments.ts`, `ci.ts` and `format.ts`. The tests did not
follow that ownership. `test/render.test.ts` mixes ten flows and repeats its
fixture setup; `test/e2e/report.spec.ts` mixes every browser journey and copies
the same CLI and clipboard setup.

This is a structure-only change. The data flow under test stays
`fixture -> parser -> sanitizer -> buildReportModel -> renderer -> one HTML
string`, exercised through `renderReport`/`renderHtml` in unit tests and through
`runCli` plus a real browser in the e2e suite. No production file changes.
ADR 0002 (one ESM package, Node >= 22) and ADR 0005 (server-rendered shell)
remain the relevant decisions; neither is amended.

## Unit file map

`test/render-helpers.ts` owns the shared assertions and fixture builders:
`renderMessagesFile(file, title?)`, `legacyEnvelopes`, `syntheticRun`,
`featureList`, `matrixTable`, `scenarioOpeningTag`, `featureOpeningTag`,
`scenarioSummary`, `sectionAt` and `failPickle`. Fixture paths come from
`test/fixtures.ts`. The optional title keeps the helper honest when hooks and
rules flows import it; the default stays `Outlines` so existing calls are
unchanged.

| File | Flow | Owning render module |
| --- | --- | --- |
| `render-report.test.ts` | messages shell, metadata, filters, escaping, CSP, duration clamps | `report.ts`, `html.ts`, `format.ts` |
| `render-outlines.test.ts` | outline and examples grouping, numbering, escaping | `report.ts` |
| `render-hooks.test.ts` | per-scenario hooks, run hooks, hook labels | `report.ts` |
| `render-rules.test.ts` | rules, backgrounds, inherited tags, search text | `report.ts` |
| `render-triage.test.ts` | needs-attention index, caps, model order, summary order | `triage.ts`, `summary.ts` |
| `render-feature-matrix.test.ts` | feature rows and the feature-by-status matrix | `report.ts`, `matrix.ts` |
| `render-diagnostics.test.ts` | undefined and ambiguous diagnostics, search index | `report.ts` |
| `render-source-strip.test.ts` | provenance cards, caps, escaping | `triage.ts` |
| `render-open-state.test.ts` | default open state for passed, failed and unknown rows | `report.ts` |
| `render-empty-run.test.ts` | empty, unexecuted and retried rows | `report.ts`, `model.ts` |

`render-attachments`, `render-counts`, `render-markdown`, `render-preset`,
`render-golden`, `render-characterization` and `render-modules` already have a
single owner and stay as they are. `render.test.ts` is removed after its ten
describes have moved. Every resulting file is below 800 lines.

## Browser journey map

`test/e2e/helpers.ts` owns one report-creation signature and the clipboard
stubs:

```ts
writeReport(inputs, title?, prefix?) -> { dir, output }
removeReport(dir) -> Promise<void>
reportUrl(output, search?)
stubClipboard(page)
stubClipboardFailure(page) // keeps the document.execCommand fallback
readClipboard(page)
```

The default output is `report.html`; the title is omitted when it is empty.
`writeReport` creates one fresh `mkdtemp` per call so parallel specs never share
a directory. Every moved test that creates a standard report uses `writeReport`
and `removeReport`, including tests that modify an input first. A test that
needs two reports (the diagnostic markup test) calls `writeReport` twice. No
moved spec keeps a local `mkdtemp` plus `runCli` block.

`test/ansi-payload.ts` owns `ESC`, `HOSTILE_ANSI` and `VISIBLE_ANSI`, shared by
`test/ansi-stripping.test.ts` and the clipboard journey. `playwright.config.ts`
sets `testMatch: '**/*.spec.ts'` so a future helper or `*.test.ts` under
`test/e2e` is never collected by both runners.

| Spec | Journey |
| --- | --- |
| `report.spec.ts` | core report, Messages/Playwright/legacy rendering, multi-file label, malformed hash |
| `search.spec.ts` | status/tag filters, search highlight, search auto-open caps, search opens collapsed rows |
| `triage.spec.ts` | needs-attention focus, source strip |
| `attachments.spec.ts` | HTML attachment inertness, per-example attachments, warning on both tabs at 1440/320 |
| `clipboard.spec.ts` | copy failure, parameterised failure, ANSI stripping, failed copy, empty message, grouped failure |
| `hooks.spec.ts` | per-scenario hooks, run hooks, hook errors, hook search, hook attachments |
| `outlines.spec.ts` | grouped outlines, retried row, grouped search cap |
| `diagnostics.spec.ts` | undefined snippets, ambiguous definitions, inert markup |
| `rules.spec.ts` | rules, backgrounds and outlines together; rule filters |
| `empty-runs.spec.ts` | empty run, blank row, executed counts, attempted ratio, no-scenario state |
| `keyboard.spec.ts` | Details reachability, hook disclosure keyboard |
| `no-js.spec.ts` | the `without scripting` block |
| `responsive.spec.ts` | existing viewport matrix plus the 200 % zoom test |
| `performance.spec.ts` | 1,000-row non-passed load and search budget |

`search-state.spec.ts`, `failed-only.spec.ts`, `parity-metadata.spec.ts` and
`visual.spec.ts` keep their current journeys. The first three move their local
`writeReport` copies to the shared helper; `parity-metadata.spec.ts` also
replaces its local `navigator.clipboard` init script with `stubClipboard` and
its copied-text read with `readClipboard`. `responsive.spec.ts` keeps one
coherent responsive flow and stays below 800 lines after the zoom test moves
in; its remaining inline report setup and `visual.spec.ts`'s setup are outside
this change.

## Preserving assertions

1. Record the baseline before editing:
   - collected unit total and per-file counts, plus the static `expect(`
     inventory (485 in `test/render.test.ts`);
   - collected browser total, titles and the static inventory (466 in
     `test/e2e/report.spec.ts`);
   - eight characterization hashes and both golden files;
   - `git ls-files --eol` and `core.autocrlf` proving the LF checkout.
   The pass/skip split is platform-specific: `playwright.test.ts` skips two
   symlink cases on Windows, `cli-ci.test.ts` skips one Linux-only case, so the
   collected totals are 659 unit and 273 browser runs (91 definitions × 3
   projects), while the passed/skipped split differs by OS.
2. Move exact `describe`/`test` blocks and their imports; do not retype an
   assertion. The only rewritten lines are imports, fixture constants that now
   come from `test/fixtures.ts`, and the shared setup calls.
3. The 49 inline report-creation checks (47 `expect(code).toBe(0)` plus the
   diagnostic markup test's `expect(undefinedCode)` and
   `expect(ambiguousCode)`) move into `writeReport`'s one check; the ANSI
   expected visible text changes from `c1-red` to `c1-csi`. Those are the only
   named assertion moves. Every other `expect(` line and every matcher stays.
4. After the split, compare the sorted multiset of test titles with the
   baseline: unit titles (file path excluded) and 91 browser definitions
   (project excluded, describe chain included), plus the 273 per-project
   entries. Also compare the collected totals and the `expect(` inventory
   (485 unit; 417 in the split browser specs + 1 in `writeReport` = 418). A
   missing, duplicated or renamed title, a missing `expect(` line outside the
   named moves, or a loosened matcher is a blocker.
5. Run `render-characterization` and `render-golden` before and after; require
   zero diff in the characterization test and both golden files. A CRLF
   mismatch is diagnosed (`git ls-files --eol`, `core.autocrlf`), never
   re-recorded; CI on LF is authoritative.
6. Run `npm run check` and `npm run test:e2e`; compare wall clock and the
   per-test duration sum on the same machine with the same default worker
   count. Record OS, core count, workers, Node/Playwright versions and the
   exact command. A >20 % increase is investigated; CI wall-clock time is
   informational and the in-test performance budgets remain the hard guard.

## Hard parts and risks

- Test discovery: Vitest includes only `test/**/*.test.ts`; Playwright gets an
  explicit `testMatch: '**/*.spec.ts'` so helper files and any future
  `*.test.ts` under `test/e2e` are not collected twice.
- Shared e2e helper imports: `test/e2e/helpers.ts` imports `../../src/cli.js`
  and `@playwright/test`, as the current specs do. `test/ansi-payload.ts` must
  be reachable from both Vitest and Playwright, so it uses plain ESM constants.
- Clipboard stubs run through `page.addInitScript` before `page.goto`; wrapping
  them must not move the call after navigation. The failing stub keeps
  `document.execCommand = () => false`, or the failed-copy test stops exercising
  the fallback path.
- Block-level Playwright modifiers move with their tests: the `without
  scripting` wrapper and its `test.use({ javaScriptEnabled: false })` go to
  `no-js.spec.ts`; `test.slow()` moves with the 1,000-row performance test.
  The four no-JS tests still pass with JavaScript enabled, so a lost wrapper is
  silent; the file must be grepped for the `test.use` line.
- `parity-metadata.spec.ts` has its own no-JS block; it stays in that file and
  is not moved or merged with `no-js.spec.ts`.
- Unifying the ANSI payload changes the visible sample text from the e2e copy
  test (`c1-red`) to the broader unit sample (`c1-csi`). The assertions still
  require the shared visible text and forbid every escape family; the unit test
  keeps the full family list. This is a data unification, not a weaker check,
  and task 4.1 records the literal change.
- Splitting files does not change Playwright's worker count or scheduling:
  `fullyParallel` is on and workers are CPU-bound, while each test was already
  its own scheduling unit. The 1,000-row test keeps its own file as a clear
  performance journey, not as starvation protection; its two 10 s budgets are
  unchanged. If the budget proves flaky on CI, raise the budget or move the
  check to `npm run stress`, not a file split.
- A pure move can silently drop a test when a block boundary is misread. The
  sorted title multiset and the collected totals catch it.
- Windows checkouts with `core.autocrlf=true` already break the committed
  characterization hashes and one fixture assertion. That is a local checkout
  issue, not part of this change; the gate is recorded from an LF checkout.
