# Tasks

## 1. Gate

- [x] 1.1 Run PIR and DXR over the proposal, spec and design; fix blockers.
- [x] 1.2 Link the change to #10 and B-007.

## 2. TDD-Red

- [x] 2.1 `src/history.ts` tests: missing file starts empty; invalid JSON, wrong
  schema version, oversized file and malformed entries throw without writing;
  append; identical last run with a different clock dedupes and keeps the old
  timestamp; 30-run retention (29/30/31); stable aggregate id; effective title;
  atomic write.
- [x] 2.2 CLI tests: first run creates the sidecar and has no Trends tab; second
  appends; missing and corrupt files; `--history ''`; `--history` without `--out`;
  path collisions with input/logo/`--out`/`--ci-out`; a path inside an input
  directory (missing file); history write failure leaves the HTML and exits 1;
  no flag leaves output/files untouched; exit codes.
- [x] 2.3 Render tests: no tab with 0/1 entries; tab and table with 2+; newest
  first; attempted pass rate and `—` for zero attempts; sparkline order and
  segmented line (n/a skipped); labelled focusable table region; 320 px scroll;
  no-JS keeps the Report view; conditional `DOM_IDS.trendsView`.
- [x] 2.4 Browser test: generate two reports with one temp history file, open
  the second, switch to Trends, check the table, keyboard tabs, 320/1440 and
  200 % text zoom.
- [x] 2.5 Update the guard tests: DOM ids split into always-present and
  conditional; `trends.ts` in the module-layer set; `html.ts` stays under 100
  lines.
- [x] 2.6 Confirm the new tests fail for the right reason.

## 3. Implement

- [x] 3.1 Add `src/history.ts` with schema v1, validation/caps, append/dedupe/
  retention and atomic write.
- [x] 3.2 Add `--history` parsing, usage, validation, path containment and the
  HTML flow; extend `generateReport`/`RenderReportOptions` with the history list
  and return the appended list as an additive field.
- [x] 3.3 Add `src/render/trends.ts`, the conditional tab/panel, the
  `DOM_IDS.trendsView` id, the generalized `showView`, the pass-rate helper, the
  sparkline and the table styles.
- [x] 3.4 Regenerate `styles.ts` and `client-bundle.ts`; intentionally update
  the characterization hashes and goldens; keep the one-file default, summary,
  CI and exit codes unchanged.

## 4. Docs

- [x] 4.1 Document the sidecar schema, the aggregate/privacy rule, retention,
  dedupe, sharing of embedded aggregates, one-writer limitation and `--history`
  in `docs/AGENT-INTERFACE.md`; add the feature and the sidecar caveat to
  `README.md`.
- [x] 4.2 Add the Trends tab to `DESIGN.md`, the terms to `GLOSSARY.md`,
  `history.ts`/`trends.ts` to `docs/ARCHITECTURE.md`, and update
  `docs/LIMITATIONS.md`, `docs/COMPATIBILITY.md` and `docs/PRODUCT.md` (history
  is now an opt-in sidecar, not unsupported). One `docs/CHANGELOG.md` entry.
- [x] 4.3 Add a backlog trigger for an additive `revision?` field and for
  recording from `--json`/`--ci` without HTML.

## 5. Verification and review

- [x] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 5.2 Run the review swarm: SCR, CR, DAR, UXR, CMP and a focused SEC pass.
- [x] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md`.
- [x] 5.4 Commit and push with #10 and the change reference.

## Gate record

- `npm run hygiene`: ok (534 tracked files, 232 commits).
- `npm run check`: 53 files, 799 passed, 3 skipped; typecheck, lint and build
  green.
- `npm run test:e2e`: 282 passed across Chromium, Firefox and WebKit.
- Reviews: SCR, CR, DAR, UXR, CMP and SEC all PASS after two fixer passes. The
  first pass fixed strict ISO validation, descriptor-based size/type checks,
  cross-field counts, the title cap, render guards, the 320 px / 200 % tab row,
  the wider table with passed/failed/skipped, the hint/caption/Current marker
  and the docs. The second pass gave `.trendsTable` its own column widths and
  alignment.
- Deferred with triggers in `docs/BACKLOG.md`: an additive `revision?` field and
  recording from `--json`/`--ci` without HTML. One sidecar per suite and variant
  stays guidance, not enforced.
