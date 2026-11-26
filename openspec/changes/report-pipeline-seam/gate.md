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
| Gate | `npm run check` | 105 files, 2,113 passed, 11 skipped; coverage 95.09/88.33/97.05/96.48 |
| Browser | `npm run test:e2e` | 478 passed, 8 skipped (PDF rows skipped in Firefox/WebKit by config) |
| Package | `npm run package:check` | publint and attw green; 92 tarball entries |
| Hygiene | `npm run hygiene` | ok, 910 tracked files, 544 commits |

Coverage floors unchanged; no expectation was weakened. The TDD-Red state was
6 of 9 focused suites failing at import (0 tests collected there; 69 passed in
the migration/guard files) and 25 `tsc` errors, all on the missing API.

## Byte parity

- `dist/index.d.ts`: SHA-256 `24F07109…2F66`, 1,616 B, byte-identical.
- `dist/cli.d.ts`: SHA-256 `39D03902…2667`, 171 B, byte-identical.
- `dist/index.js`: same 20 exports, 365,482 B (+0.28 %); the esbuild bundle
  bytes move because the implementation moved, as the contract allows.
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

- New `src/loaded-run.ts` 91 lines (limit 120); `src/render/html.ts` 97 lines
  (pinned shell test limit 100); `src/run.ts` shrinks by the moved assembly.
- One internal addition beyond the design: `runRenderOptions` in
  `src/options.ts` keeps `renderOptions` applied once while `html.ts` stays
  under its pinned shell-test limit. It is not exported from the package.
- Diff surface as planned: `src/loaded-run.ts`, `run.ts`, `stream.ts`,
  `render/html.ts`, `render/types.ts`, `options.ts` (helper), the five migrated
  render tests, two new suites, `docs/ARCHITECTURE.md`,
  `docs/AGENT-INTERFACE.md`, `DESIGN.md`. No CSS, client script, markup, i18n,
  summary, baseline, history, email, PDF or CI module changed.
- `GLOSSARY.md` needed no change; "Loaded run" stays an internal term.

## Reviews

Pending: SCR, CR, DAR, STR, SEC, PCA on the implementation commit.
