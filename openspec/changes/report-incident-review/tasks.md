# Tasks

## 1. Contract and pre-implementation review

- [x] 1.1 Finish the change contract: this file, `proposal.md`, `design.md`
  and the `report-rendering` delta, including AC1-AC12 and the edge matrix.
- [x] 1.2 Run PIR and DXR in parallel over the corrected contract. PIR checks
  parity and vision: the panel does not drop a parity feature, the detail is
  not duplicated, and the visual language is a work surface. DXR checks the
  module home, helper reuse, row link, test plan, static/print and host rows.
- [x] 1.3 Fold every blocker into the contract; record the verdicts in
  `gate.md`.
- [x] 1.4 Record the measured baseline: report bytes for one failed fixture,
  the current triage order, the current report CSS/token map, and the JSON/CI/
  email/manifest/history bytes.

## 2. TDD Red

- [x] 2.1 Write `test/render-incident.test.ts` from the delta: panel presence
  and absence (all passed, skipped only, unknown only, incident statuses),
  first-in-ordered-list selection, several-incident line, mixed
  skipped/unknown + failed remaining count, row link and no second detail
  (standalone, rule and outline rows), the triage's first link to the panel
  (default, filtered, static), reused chronological detail (hooks, After hook,
  passed-hook group), working copy actions with the panel scope, diagnostics
  for `undefined`/`ambiguous`, step without a message, first-line summary for a
  long error, no-evidence line, image/text/video/skipped attachments, baseline
  badge in the summary, outline-example label via the shared helper, escaping,
  tags/source/duration, German copy and plurals, run-level hook failure
  without a panel.
- [x] 2.2 Add a composable incident fixture: 1, 2 and 7/8-step scenarios, a
  failed After hook, a skipped-only run, an unknown run, a rule-nested outline
  example, one screenshot, one text attachment and one no-attachment scenario.
  The one-step helpers in `test/render-helpers.ts` are not enough.
- [x] 2.3 Add an HTML test that the panel renders in default, static and print,
  is not filtered, the row is a link while other rows keep their disclosure,
  a static text attachment renders without a lightbox, PDF and no-JS keep the
  panel, and the report CSS carries the Incident review tokens with no new
  elevated/shadowed container. Add a contrast assertion over paper,
  surface-2, surface-3 and the status text in light, dark and print. Prove
  summary, JSON, CI, email, manifest and history bytes unchanged; the client
  bundle delta is explained by the three allowed client changes: the failure
  copy scope, scenario-scoped expand/collapse and the list-scoped empty copy.
- [x] 2.4 Write `test/e2e/incident.spec.ts`: above-the-fold minimum (summary,
  status, first failing step and the first error line), row link keyboard and
  focus, copy failure/log inside the panel with the feature title, scenario
  name and facts (both clipboard texts), collapse/expand scoped to scenarios,
  the filtered empty copy and the triage link to the panel (default, filtered,
  static), 320 px and 200 % text zoom with a long error, static form,
  print/PDF, German labels, dark mode, active filter without a dead CTA,
  7/8-step and plural boundaries. Migrate the existing `details.scenario`
  selectors to the link row.
- [x] 2.5 Run the new tests and confirm they fail for the intended reason.

## 3. Implement

- [x] 3.1 Commit A: retune the tokens and shell rules in
  `src/render/report.css` for the Incident review language (paper/ink, radius,
  one-pixel rules, type scale, print radius 6 px, no new elevated/shadowed
  containers) and run `npm run styles` to regenerate `src/render/styles.ts`.
  Do not edit `styles.ts` directly; no markup change in this commit. Keep
  Details/Trends/baseline/tag styles on the shared tokens. Re-pin the report
  characterization after this commit.
- [x] 3.2 Commit B: extract the summary/detail builders from `renderScenario`
  (`scenarioBody`), move `scenarioLabel` from `triage.ts` to `format.ts` and
  use it in both, thread an `incidentId` through `renderFeature`,
  `renderFeatureItem`, `renderOutline`, `renderScenario`, `renderExamples`,
  `renderRuleBlock` and `renderTriage` (as a parameter, not an import), add the
  incident selector, top summary and panel builder in `src/render/report.ts`,
  and give the incident row the link form (`Shown above`, no disclosure)
  wherever the grouping places it; keep the `scenarioId` anchor. Add the panel
  CSS to `report.css`, run `npm run styles`, and re-pin the characterization
  again. Edit `src/render/report-client.ts` to resolve `data-copy-scope`
  **only for `failureText`**; the copy-log handler keeps its nearest attachment
  `details`. The wrapper carries the feature title, scenario name and facts.
  Rebuild the generated client bundle (`client-bundle.ts` via the assets/build
  script), re-pin its size, and test both copied texts. Point the triage's
  first-incident link at `#incident`, scope the expand/collapse copy to
  scenario rows, and adjust the filtered empty copy. Do not create a parallel
  detail renderer or a new module that cycles with `report.ts`.
- [x] 3.3 Mount the panel after the toolbar/live region and before the baseline
  panel; keep the baseline below the toolbar and the triage/index unchanged.
- [x] 3.4 Add the English and German catalog keys (title, run-failed/attention
  badge, `Shown above`, no-evidence line, remaining plural, scenario-scoped
  expand/collapse copy, list-scoped empty copy); run `npm run assets` and
  `npm run i18n:check`.
- [x] 3.5 Update `DESIGN.md` (visual language, token roles, incident panel),
  the module maps in `docs/ARCHITECTURE.md`, the term in `GLOSSARY.md`, the
  README hero and the `docs/comparison/new-shell-*` rasters for the 0.7 shell
  (with raster provenance); no public API change.
- [x] 3.6 Re-pin characterization hashes for the intended report change; prove
  the summary, JSON, CI, email, manifest and history bytes unchanged and record
  the report-size delta with a screenshot fixture (thumbnail plus panel image).
  Measured with `--title "Incident review size"` and no other options:
  `legacy/failed.json` 89,878 → 94,300 B (+4,422 B, +4.9 %);
  `messages/screenshot.ndjson` 94,831 → 99,184 B (+4,353 B, +4.6 %). The
  minified stylesheet grew by the token and panel rules; the screenshot fixture
  adds the panel chrome while the detail moves out of the row, so the image is
  still embedded once in the detail plus the row thumbnail. The client bundle
  moved 15,438 → 15,831 B (+393 B): the failure copy scope plus the scenario-
  scoped expand/collapse handler.

## 4. Verification and gate

- [x] 4.1 Run the focused suite: incident, report, static, print, i18n,
  attachments, baseline, characterization.
- [x] 4.2 Run `npm run check` (typecheck, lint, knip, format, build, coverage)
  and `npm run hygiene`.
  Result: i18n, assets, typecheck, lint, knip, format and build passed; the
  unit/coverage run has 2,162 passed, 11 skipped and 0 failed of 2,173 tests.
  Correction: the earlier record of three Red tests was stale; `5654f8f`
  corrected their 0-based ids to the existing 1-based anchors and their
  closed-row `.detailInline` count to one server-rendered body per disclosure
  row. No test is skipped or loosened. `npm run hygiene` is green.
- [ ] 4.3 Run `npm run test:e2e` on Chromium, Firefox and WebKit; viewports
  320, 390, 768, 1024, 1440 and 320 at 200 % text zoom.
- [ ] 4.4 Run host rows 1-5 from `docs/DROP-IN-VALIDATION.md`; record host,
  pins, artifact sizes and result. A red host blocks or needs a written,
  user-approved exception.
- [ ] 4.5 Run `npm run package:check`; record the tarball entries and the
  bundle delta. The client-bundle delta is limited to the copy scope, the
  scenario-scoped expand/collapse and the list-scoped empty copy; every other
  bundle and report byte delta is explained.
- [ ] 4.6 Run the CMP parity comparison; only the intended report differences
  are allowed. Record the result.
- [ ] 4.7 Write `gate.md`: commands, counts, coverage, report-size delta,
  byte-parity evidence, host rows and CMP, including the two implementation
  commits.
- [ ] 4.8 Run the Impeccable manual detector
  (`impeccable detect --json --changed`) over the changed report UI once,
  fix mechanical findings and record the rest for the reviewers.
- [ ] 4.9 Run the Impeccable finish review over the rendered report
  (desktop/mobile, light/dark/print), record the verdict, and attach raster
  provenance to every shipping screenshot (README hero included).

## 5. Reviews

- [ ] 5.1 Run UXR, SCR, CR, DAR, STR, SEC, PCA and ILA in parallel on the
  implementation commits; CMP after the report change.
- [ ] 5.2 A failing review spawns a fixer, then a delta re-check; every
  finding is fixed, filed or recorded with a trigger.
- [ ] 5.3 Commit and push after every completed step with a conventional
  message and the B-057/change reference; run `npm run hygiene` before every
  commit. Do not archive, bump the version, tag or publish.

## Deferred

- A run-level hook incident panel (BeforeAll/AfterAll); the existing run hooks
  section carries the error and the trigger is a user report.
- Per-failure selection without a new client script; links only in this change.
- Folding the triage list into the incident panel for several failures.
- Details and Trends layout changes; this change only shares tokens.
