# Gate — report pipeline seam

Change: `report-pipeline-seam` (B-057). Internal refactor, no spec delta
(`skip_specs: true`). Tree: `fc3dfac` plus the implementation commit.

## Pre-implementation reviews

- PIR: PASS after three rounds. Blockers fixed in the contract: the Details
  input row reads `inputFiles`/`inputBytes` (they stay optional, absent keeps
  the row omitted); AC6 needs the same facts (counts, provenance, baseline,
  skipped attachments) on both paths; `renderRun` owns `renderOptions` and
  `history`; the stream keeps one exact call; bundle parity is export-level,
  not byte-level; AC1 uses a complete object literal.
- DXR: PASS after two rounds. Added the doc surfaces
  (`docs/AGENT-INTERFACE.md`, `src/index` paragraph in `docs/ARCHITECTURE.md`,
  `DESIGN.md`), the host row 2 requirement, `parity-metadata` and
  `size-diagnostics` in the focused suite, and the conditional-spread idiom
  for `exactOptionalPropertyTypes`.

## Commands and counts

| Step | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | green |
| Gate | `npm run check` | 105 files, 2,116 passed, 11 skipped; coverage 95.09/88.35/97.06/96.48 |
| Browser | `npm run test:e2e` | 478 passed, 8 skipped (PDF rows skipped in Firefox/WebKit by config) |
| Package | `npm run package:check` | publint and attw green; 92 tarball entries |
| Hygiene | `npm run hygiene` | ok, 914 tracked files, 545 commits checked; HEAD after the review-fix commit is 546 |

Coverage floors unchanged; no expectation was weakened. The TDD-Red state was
6 of 9 focused suites failing at import (0 tests collected there; 69 passed in
the migration/guard files) and 25 `tsc` errors, all on the missing API.

## Byte parity

- `dist/index.d.ts`: SHA-256 `24F07109…2F66`, 1,616 B, byte-identical.
- `dist/cli.d.ts`: SHA-256 `39D03902…2667`, 171 B, byte-identical.
- `dist/index.js`: same 20 exports, 365,512 B, baseline 364,414 B, +1,098 B
  (+0.301 %); the reviewed seam build was 365,482 B and the stream normaliser
  fix adds 30 B. The esbuild bundle bytes move because the implementation
  moved, as the contract allows.
- CLI fixture (Messages + legacy, baseline, history, manifest): report
  123,080 B, CI file 555 B, manifest 991 B, stdout 9,433 B, stderr 0 B — all
  identical. History equal after pinning the wall-clock `recordedAt`.
- Characterization hashes and the render/CLI suites green inside the gate.

## Host row

- Row 2, official `@cucumber/cucumber@13.3.0`, installed offline from the npm
  cache. Host: Windows 10.0.26300, Node 26.13.1. Producer: 1 feature,
  2 scenarios (1 passed, 1 failed), 2 steps, 2 PNGs / 136 B; `out.json`
  2,053 B, `out.ndjson` 6,174 B; summaries byte-identical at 1,592 B; reports
  71,029 B (JSON) and 71,305 B (Messages). At 1440 and 390 px: 1 feature,
  2 scenarios, 2 screenshots, no overflow, no console errors, no external
  requests. PASS.

## Shape

- New `src/loaded-run.ts` 95 lines (limit 120); `src/render/html.ts` 98 lines
  (pinned shell test limit 100); `src/stream.ts` 37 lines; `src/options.ts` 58
  lines. `src/run.ts` shrinks by the moved assembly.
- Caller-facing options: `RenderCallOptions` (`src/options.ts`) extends
  `RenderReportOptions` and types `comparison`, `inputFiles` and `inputBytes`
  as `never`, so a typed options variable cannot smuggle a run fact;
  `RenderOptions` stays the internal view type. `renderRun` and `renderHtml`
  take `RenderCallOptions`.
- One internal addition beyond the design: `runRenderOptions` in
  `src/options.ts` keeps `renderOptions` applied once while `html.ts` stays
  under its pinned shell-test limit. It is not exported from the package.
- Stream: the flush builds the run inside the promise chain, so a builder
  throw reaches the stream `Error` event through the same `Error` normaliser;
  a non-Error builder throw is wrapped instead of emitted raw.
- Diff surface as planned: `src/loaded-run.ts`, `run.ts`, `stream.ts`,
  `render/html.ts`, `render/types.ts`, `options.ts` (helper and caller type),
  the five migrated render tests, two new suites, `docs/ARCHITECTURE.md`,
  `docs/AGENT-INTERFACE.md`, `DESIGN.md`. No CSS, client script, markup, i18n,
  summary, baseline, history, email, PDF or CI module changed.
- `GLOSSARY.md` needed no change; "Loaded run" stays an internal term.

## Reviews

Blind reviews on `95a7567`, delta re-checks on `95a7567..a1c0d26` and
`a1c0d26..8139373`:

- SCR: PASS. AC1-AC10 met and exercised; no scope creep, no assertion
  weakened. Delta PASS: `cli-baseline` comment, gate counts, and the `never`
  guards strengthen AC4.
- CR: PASS. Brand, `exactOptionalPropertyTypes`, run-facts-win, one
  `renderOptions` application, no cycle, no public d.ts change. Delta PASS:
  the stream build sits inside the promise chain (a runtime probe reproduced
  the raw-string error event without it), and `RenderCallOptions` closes the
  typed-variable hole.
- DAR: PASS, then delta FAIL on two `docs/ARCHITECTURE.md` claims (fact flow,
  `RenderReportOptions` vs `RenderCallOptions`); fixed in `8139373`, DAR
  re-check PASS.
- STR: PASS. Module layer, test migration, proportionate suites. Delta PASS:
  shared fixtures, the pairwise history × baseline byte test, the stream
  regression test, ratchets 98/95.
- SEC: PASS. Sanitise once on every production path, escaping/CSP intact,
  attachments and notice unchanged. Delta PASS: real trust-boundary test,
  non-Error wrap, no envelope or path data in errors.
- PCA: PASS. One sanitise pass removed, no per-render work, no second index;
  bundle 365,512 B (+1,098 B, +0.301 %) against the 2 % trigger. No delta
  needed: its only finding was the recorded percentage, corrected.
- UXR, ILA, CMP: not run by contract; no visible change, byte parity proven.
