# Tasks

## 1. Gate

- [x] 1.1 PIR + DXR over the proposal, spec delta and design; fold blockers
  into the contract before Red.
- [x] 1.2 Confirm the current summary field order, the Markdown insertion
  point, the report model's pickle id, the conditional CSS build seam and the
  history reader posture; no new runtime dependency.
- [x] 1.3 Confirm the decisions recorded in the proposal: name-first identity,
  the count set, the API surface, the panel location and the German copy. ILA
  stays a later catalog review.

## 2. TDD-Red

- [x] 2.1 Matcher decision table: every baseline/current status pair, unexecuted
  rows, added rows, absent rows, no order or status pairing; retries are one row
  per pickle with the latest attempt.
- [x] 2.2 Identity: reordered run, renamed `*.feature` file with a unique base
  key, renamed feature and scenario, outline coordinates (including the
  positional limit), duplicate names, a 0.5 baseline without `example`, and an
  ambiguous group counted once.
- [x] 2.3 Reader: missing, empty, invalid JSON, wrong schema, non-regular,
  directory, symlink to a directory, symlink to a regular file, oversized,
  missing `executed`, non-object entries, wrong field types, unknown status,
  prototype keys exit 1 with no pollution, deep nesting, control/bidi names,
  absolute URI, `..` URI, BOM, nested `baseline` block; only identity/status
  fields are trusted; every invalid shape exits 1 without a write.
- [x] 2.4 Summary/JSON: block and `change` only with a baseline; schema stays 2;
  stable key order (`change` after `executed`, `example` after `attempt`);
  `notInThisRun` carries `executed` and sorts numerically with missing
  `example` last; cap at 50; no absolute path; no `id` field; no-flag keys
  absent; `example` on Messages outline rows only; no summary golden changes.
- [x] 2.5 CI: exact line, zero counts, singular/plural, ambiguous suffix, one
  blank line after the line, empty and all-unexecuted runs, no line without a
  baseline, GitHub/Azure bytes unchanged.
- [x] 2.6 Report: panel counts and list cap, the `--json` pointer line, badges,
  pickle-id join, German labels, escaping, no-JS, print/PDF, filter-active
  panel, 320 px and 200 % text, no horizontal overflow, conditional CSS.
- [x] 2.7 CLI/API: each surface, email-only and GitHub/Azure-only rejection,
  path collisions, missing baseline, 10 MiB boundary, `BaselineSummary` export,
  `summarizeReport` options, and the stream/`renderHtml` limit.
- [x] 2.8 E2E: two real runs sharing one baseline, a renamed feature file, a
  fixed scenario, a new failure and a not-in-this-run scenario at 320 and
  1440 px; print/PDF contains the panel; `--static --baseline` after the static
  change lands.
- [x] 2.9 Confirm RED for every new expectation; no existing test is deleted or
  weakened.

## 3. Implement

- [x] 3.1 Add `src/baseline.ts` with the reader, matcher and classification;
  import `displayUri` from `summary.ts`; build the comparison once with the
  block and the pickle-id change map.
- [x] 3.2 Add `options.baseline` to `generateReport`, `renderReport` and
  `summarizeReport`, `--baseline` to the CLI, path validation, the read order
  and the exit codes; export `BaselineSummary`.
  Note (2026-11-24): this change owns the `--baseline` path-collision row in the
  0.6-history-window spec and adds `--baseline` to the shared path list
  (`pathConflicts`).
- [x] 3.3 Add the summary `baseline` block, per-scenario `change`, the outline
  `example` field and the documented key order.
- [x] 3.4 Add the report panel, row badges, the separate conditional
  `src/render/baseline.css` string, the `--json` pointer and the en/de catalog
  keys.
- [x] 3.5 Add the Markdown line at the pinned insertion point; keep GitHub and
  Azure bytes unchanged.
- [x] 3.6 Document the option, the API, the schema, the CI recipe without the
  `--json > baseline.json` truncation trap, one baseline per suite/variant, the
  shard rule, the two-run artifact, the 10 MiB limit, the stream limit and the
  architecture seam; fix `docs/PRODUCT.md`, `GLOSSARY.md` and `docs/I18N.md`;
  resolve the backlog row at archive time.

## 4. Verification and review

- [x] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e`.
- [x] 4.2 SCR, CR, DAR, SEC, UXR, ILA, CMP and STR; PCA if the summary hot path
  changes. Eight blind reviews ran; the fix round below closes six FAILs.
- [x] 4.3 Run the relevant `docs/DROP-IN-VALIDATION.md` rows on the final tree
  and record host, pin and result.
- [x] 4.4 Measure the no-flag HTML/summary delta and the panel/badge bytes with
  the flag; record the numbers.
- [x] 4.5 After all four changes land, run one combined byte characterization:
  the default report, CI and email bytes are unchanged, and the default JSON
  differs only by the additive outline `example`.
- [x] 4.6 Fix findings; record deferred decisions with a trigger. The fix round
  is recorded below; no finding was deferred.

Review findings (2026-11-23): PIR/DXR found two identity readings (D7/B3), an
undefined count set (D8/B6), a missing `executed` (D9/I7), an undefined API
surface and stream limit (D10/I2), the panel in the wrong capability (D11/I1),
`example` not scoped to Messages (D12/I4), an undocumented 10 MiB cap (D13/I4),
an ambiguous Markdown insertion point (D14/I6), an incomplete collision matrix
(D15/I17), the CSS-in-`report.css` byte break (B3), a lexicographic
`notInThisRun` sort (D18/I18), the false `displayUri` cycle (D19/I16), and a
design-only reader validation list (DXR I3). The delta now has one identity
algorithm, one count set with the `other` residual, `executed` on
`notInThisRun`, the API/stream split, a `report-rendering` panel delta,
Messages-only `example`, the 10 MiB limit, the pinned CI insertion point, the
full collision matrix, a separate conditional `baseline.css`, the numeric sort
and the hostile-shape reader cases. The docs list gains `docs/PRODUCT.md`,
`GLOSSARY.md` and `docs/I18N.md` (D20). Implementation tasks 3.1-3.6, the Red
tasks, the reviews (4.2) and the fix round (4.6) are complete.

### Accepted no-action (2026-11-24)

- SEC: grow-after-stat and POSIX FIFO/device fixtures stay untested; the pre-open
  and descriptor regular-file checks plus the size cap cover the code path, and
  no portable fixture exists on this host.
- CMP: panel placement at 320 px with a long list has no separate pixel case; the
  e2e covers one entry and the search-filter case is pinned.
- CR: `exampleCoordinate` exists in both `src/summary.ts` and
  `src/report/model.ts`; extracting one helper is B-051.

## Gate record

- PIR/DXR: approved 2026-11-23; the findings are folded into the delta and design.
- Focused tests after the fix round: `npx vitest run test/baseline-reader.test.ts
  test/baseline-matcher.test.ts test/baseline-summary.test.ts
  test/ci-baseline.test.ts test/cli-baseline.test.ts test/render-baseline.test.ts
  test/render-characterization.test.ts test/cli-size-warning.test.ts
  test/compat.test.ts test/styles.test.ts` — 174 passed, 3 skipped (Windows
  symlink/unreadable capability guards).
- `npm run hygiene`: ok (808 tracked files, 351 commits on the final tree).
- `npm run check`: green — i18n 24/24, typecheck, lint, build, unit 90 files /
  1494 passed / 8 skipped.
- `npm run test:e2e`: green — 424 passed, 8 skipped (PDF rows on Firefox and
  WebKit), Chromium/Firefox/WebKit. The focused `test/e2e/baseline.spec.ts` run
  is 15/15 across the three engines.
- `openspec validate 0.6-baseline-comparison --strict` and
  `openspec validate 0.6-static-no-js --strict`: both valid.
- Host row: Windows 11 Pro 10.0.26300, Node v26.13.1 — official
  `@cucumber/cucumber@13.3.0` artifact (6,991 B) reused from the `static-no-js`
  host; default report 71,746 B, baseline report 73,471 B (+1,725 B), baseline
  JSON 2,457 B vs 1,976 B (+481 B), static baseline 54,453 B, baseline
  bytes/mtime unchanged; Chromium 1440/390 and print show the panel/list/badge
  with no overflow (-15 px scrollbar offset) or console errors. A fresh producer
  run was blocked by a Cucumber-side support-code loader error before any
  scenario; Linux/macOS rows stay pending CI.
- Size measurements (4.4/4.5): `BASELINE_CSS` 1,058 B; host panel/badges + plural
  copy 667 B (1,725 B total with CSS); CI line 75 B with newline. One-run
  `node scripts/baseline-bytes.mjs` (title `Byte check`, host/date printed):
  examples HTML 86,251 B identical (sha 9ed79ca8593b40c9), baseline +1,426 B,
  static baseline +1,426 B, summary 6,327 B (+175 B), stripped `example`
  6,152 B and sha 88c7fb2528ac1647267ab8cc141ab5ad8427797aab87418480c7916a21d1c6b4;
  legacy-failed HTML 87,683 B identical on the 2026-11-24 run; its sha
  6424c35df77b6d84 is date-dependent because the report embeds the generation
  date, so a later re-run has a different hash while the byte delta stays
  reproducible through `scripts/baseline-bytes.mjs`; baseline
  +1,393 B, static baseline +1,393 B, summary 8,112 B identical; Markdown CI
  671/534 B identical; email 5,275/4,950 B identical. The earlier 1,690 B and
  1,723 B deltas are superseded; the content-dependent standard deltas are
  1,426/1,393 B and the host delta is 1,725 B, all including the same CSS.
- Matcher cost: 20,000 baseline × 20,000 current repeated outline rows compare
  in 20.98 ms on the reference host (first call, JIT included); the regression
  test asserts under 100 ms.
- Review round: eight blind reviews; six FAIL. All blockers and important
  findings are fixed in this round. No blocker or important finding was
  deferred; the accepted no-action minors are recorded above.

### Fix round (2026-11-24)

- Identity is two-phase: coordinate, then URI for the unmatched remainder, both
  with a key-to-index map; a duplicate or missing key stays unmatched for the
  next pass. An extra current row keeps the whole group ambiguous (2 base /
  3 current test).
- Stream type split: `RenderReportOptions` has no `baseline`;
  `BaselineRenderOptions` is exported and used by `generateReport`,
  `renderReport` and `summarizeReport`. `renderHtml` and `CucumberHtmlStream`
  keep `RenderOptions`/`RenderReportOptions`; the test uses `@ts-expect-error`
  plus a runtime-ignore assertion.
- Reader: strict UTF-8, pre-open and descriptor regular-file checks, wrapped
  stat/read errors with a one-line detail, schema-2 history-sidecar detection,
  depth-bounded recursion, 64/65 boundary, and an injected `RangeError` at the
  `JSON.parse` seam. V8 parses two-million-level arrays iteratively, so a real
  input cannot exercise the `RangeError` branch; the injected test is the
  reproducible proof.
- Panel: plural count labels (0/1/2 in both locales), honest JSON-cap pointer
  above 50 rows, no empty heading/list, escaped and control-stripped baseline
  text, visible feature/name separator, and no badge for still-failing/added.
  German copy uses the impersonal `siehe --json`/`Siehe --json`; the German
  render test pins the heading, status line, capped sentence and the absence of
  English chrome.
- Accent + baseline keeps one `<style>` block: `REPORT_CSS +
  :root{--accent:…} + BASELINE_CSS`; the accent golden is regenerated.
- One summary seam: the CLI always calls `summarizeReportFromResolved`;
  `summary.ts` is pure and `summarizeResolvedReport` is gone.
- Pre-change characterization: `test/fixtures/messages/examples-tables.ndjson`
  was rendered at `08a0449` in a temp worktree with a `node_modules` junction.
  The test command was
  `npx vitest run test/__prechange.test.ts` with a temporary test that called
  `renderReport(file, { title: 'Characterization' })` and
  `summarizeReport(file)` under a pinned 2026-01-01 clock; it produced HTML sha
  `c78ea2b0b3a5d6ef1c24849cee8da05ec4f5e8c98bfe3aa4e80b673323ce819e` and the
  summary bytes/hash above. The temporary test was deleted; the pinned values
  live in `test/render-characterization.test.ts`.
- `loadEnvelopes` is kept intentionally as the flat test seam; production paths
  use `loadResolvedInputs`/`loadInputs` so provenance survives.
- `copyBaselineRow` normalization moved to one call at the start of
  `compareBaseline` instead of a per-row copy; the API accepts a raw projection,
  so the display-URI rule still applies.
- `historyConflicts` is `pathConflicts` with a `peer` argument; the baseline
  error says `must not name`, the history error still says `overwrite`.
- `--history` + `--baseline` same-path collision and `--ci-out` + `--baseline`
  have dedicated tests; the email bytes with a baseline are pinned; the compat
  shim warns once about `baseline`.
- New/changed test names: matcher "pairs the unmatched remainder by URI after a
  partial coordinate pass", "stays ambiguous after a partial coordinate pass
  with no unique URI tie", "keeps a repeated group ambiguous when only the
  current side gains a row", "makes a repeated non-outline name in a renamed
  file ambiguous", "pairs 20k repeated outline rows in well under 100 ms";
  reader "accepts a document 64 levels deep and rejects 65", "names the file
  when JSON.parse overflows on extreme nesting", "rejects invalid UTF-8 and
  names the file", "rejects an unreadable baseline and names the file", "a
  history sidecar (schema 2)"; render "shows a not-in-this-run row with its
  feature, name, example and status", "omits the heading and list when no
  baseline row is absent", "states the JSON cap honestly when more than 50 rows
  are absent", "pluralizes the new-failure count 0/1/2 in en/de", "pluralizes
  the ambiguous count 1/2 in en/de", "strips controls, ANSI and bidi marks from
  baseline text", "keeps the baseline CSS in the first style block when an
  accent is set"; CLI "rejects the same path for --baseline and --history",
  "writes a Markdown CI file beside a baseline report", "keeps the email bytes
  unchanged when a baseline is supplied", "rejects a baseline at the type level
  and ignores it at runtime"; characterization "keeps the outline summary minus
  example at the pre-change bytes"; follow-up matcher "keeps a repeated outline
  group ambiguous when one coordinate is missing"; reader "keeps example
  coordinates from a baseline file through the matcher"; render "renders the
  German capped JSON pointer after 50 absent rows".
