# Tasks

## 1. Gate

- [x] 1.1 Run PIR and DXR over the proposal, spec and design; fix blockers.
- [x] 1.2 Link the change to #10 and B-007.

## 2. TDD-Red

- [ ] 2.1 `src/history.ts` tests: missing file starts empty; invalid JSON, wrong
  schema version, oversized file and malformed entries throw without writing;
  append; identical last run with a different clock dedupes and keeps the old
  timestamp; 30-run retention (29/30/31); stable aggregate id; effective title;
  atomic write.
- [ ] 2.2 CLI tests: first run creates the sidecar and has no Trends tab; second
  appends; missing and corrupt files; `--history ''`; `--history` without `--out`;
  path collisions with input/logo/`--out`/`--ci-out`; a path inside an input
  directory (missing file); history write failure leaves the HTML and exits 1;
  no flag leaves output/files untouched; exit codes.
- [ ] 2.3 Render tests: no tab with 0/1 entries; tab and table with 2+; newest
  first; attempted pass rate and `â€”` for zero attempts; sparkline order and
  segmented line (n/a skipped); labelled focusable table region; 320 px scroll;
  no-JS keeps the Report view; conditional `DOM_IDS.trendsView`.
- [ ] 2.4 Browser test: generate two reports with one temp history file, open
  the second, switch to Trends, check the table, keyboard tabs, 320/1440 and
  200 % text zoom.
- [ ] 2.5 Update the guard tests: DOM ids split into always-present and
  conditional; `trends.ts` in the module-layer set; `html.ts` stays under 100
  lines.
- [ ] 2.6 Confirm the new tests fail for the right reason.

## 3. Implement

- [ ] 3.1 Add `src/history.ts` with schema v1, validation/caps, append/dedupe/
  retention and atomic write.
- [ ] 3.2 Add `--history` parsing, usage, validation, path containment and the
  HTML flow; extend `generateReport`/`RenderReportOptions` with the history list
  and return the appended list as an additive field.
- [ ] 3.3 Add `src/render/trends.ts`, the conditional tab/panel, the
  `DOM_IDS.trendsView` id, the generalized `showView`, the pass-rate helper, the
  sparkline and the table styles.
- [ ] 3.4 Regenerate `styles.ts` and `client-bundle.ts`; intentionally update
  the characterization hashes and goldens; keep the one-file default, summary,
  CI and exit codes unchanged.

## 4. Docs

- [ ] 4.1 Document the sidecar schema, the aggregate/privacy rule, retention,
  dedupe, sharing of embedded aggregates, one-writer limitation and `--history`
  in `docs/AGENT-INTERFACE.md`; add the feature and the sidecar caveat to
  `README.md`.
- [ ] 4.2 Add the Trends tab to `DESIGN.md`, the terms to `GLOSSARY.md`,
  `history.ts`/`trends.ts` to `docs/ARCHITECTURE.md`, and update
  `docs/LIMITATIONS.md`, `docs/COMPATIBILITY.md` and `docs/PRODUCT.md` (history
  is now an opt-in sidecar, not unsupported). One `docs/CHANGELOG.md` entry.
- [ ] 4.3 Add a backlog trigger for an additive `revision?` field and for
  recording from `--json`/`--ci` without HTML.

## 5. Verification and review

- [ ] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [ ] 5.2 Run the review swarm: SCR, CR, DAR, UXR, CMP and a focused SEC pass.
- [ ] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md`.
- [ ] 5.4 Commit and push with #10 and the change reference.

## Gate record

To be filled after verification: unit/e2e counts, review verdicts, sidecar
fixture and any deferred item.
