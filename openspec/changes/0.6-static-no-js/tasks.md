# Tasks

## 1. Gate

- [x] 1.1 PIR + DXR over the proposal, spec delta and design; fold blockers
  into the contract before Red.
- [x] 1.2 Confirm the tab, details, lightbox, print and CSP seams, and that no
  new catalog key is needed.
- [x] 1.3 Confirm the decisions: `--static`, dead controls removed, `data-*`
  attributes kept where the control remains, and `--pdf` stays explicit.

## 2. TDD-Red

- [x] 2.1 Static render: no `<script>`, `script-src 'none'`, `connect-src
  'none'` with no source, no client-message block, no tab bar or tab roles, no
  dangling `aria-labelledby`/`aria-controls`, exactly one `<main>`, every
  `<details>` open (feature, scenario, hook group, earlier attempts, text
  attachment, triage rest), no lightbox or image button, no copy-failure button,
  no search/tag/status filter control.
- [x] 2.2 Static views: Report and Details visible; Trends visible with two or
  more history runs and absent with zero or one.
- [x] 2.3 Default characterization: the committed hashes and golden HTML are
  unchanged; scripts, controls, collapsed passed rows and the three `<main>`
  elements remain.
- [x] 2.4 CLI/API: `--static` with `--out` and `--pdf`; no report surface exits
  2; `--static --json` writes nothing; the `--static --baseline` composition is
  owned by the baseline change and pinned there. The Red CLI test covers the
  existing `--static --history` composition instead.
- [x] 2.5 Browser: JavaScript disabled at 320, 390, 768, 1024 and 1440 px and
  320 px at 200 % text; German labels; an image visible; a bookmarked
  `?query=`/`?hide=`/`?tag=` URL shows the full report; no horizontal overflow;
  print includes every section.
- [x] 2.6 PDF: `--static --pdf` uses a script-free source and includes Details
  and Trends.
- [x] 2.7 Size: record the static and default bytes for the standard fixture.
- [x] 2.8 Confirm RED; no existing test is deleted or weakened.

## 3. Implement

- [x] 3.1 Add `static` to the render options and the CLI, with the
  `--out`/`--pdf` requirement and the usage error.
- [x] 3.2 Thread the mode through `html.ts`: omit both scripts, the client
  block, the tab bar, the lightbox and the dead toolbar/copy/image controls; set
  `script-src 'none'` and keep `connect-src 'none'`.
- [x] 3.3 Open every `<details>` in `report.ts`, `attachments.ts` and
  `triage.ts`; stack the panels; remove the tab roles and dangling aria from all
  three panels; keep exactly one `<main>` and the three view IDs.
- [x] 3.4 Document the mode, the no-JS/print result, the removed controls, the
  kept IDs, the architecture seam, the bookmarked-URL limit and the Jenkins
  note; fix the stale AGENT-INTERFACE static no-JS sentence; record the default
  multiple `<main>` as B-048.
- [x] 3.5 Close the two 365-run Trends shell findings deferred from
  `0.6-history-window` (UXR, 2026-11-23): the sparkline emits one marker per run
  and becomes a dense chain at 365 points, and the 365-row table buries the
  sparkline and the flaky note ~14k px down the page. Sample or hide the point
  markers above a density threshold and cap the Trends table height on screen
  with a sticky header, reset in print. Verify at 320 px and 200 % text with a
  365-run sidecar. The same pass carries the three UXR minors from the same
  review: the print header breaks mid-word (`src/render/report.css:545`,
  `Duratio/n`), the `Current` tag wraps under the date (`:341`, `:347`), and the
  sparkline box is letterboxed at 200 % text (`:279`). It also fixes the
  user-decided tab-strip blocker: at 320 px / 200 % the third tab is clipped out
  of the one-row scroll strip (`src/render/report.css:72-74`, `.views` nowrap
  plus `overflow-x: auto`). Make every tab visible (wrap to a second row, or a
  visible scroll affordance that scrolls the active tab into view), update
  `test/e2e/trends.spec.ts:130-159`, which currently pins `nowrap`, and verify at
  320 px, 390 px and 320 px / 200 % on Chromium, Firefox and WebKit.

Decisions (2026-11-23, no action): roving tabindex for inactive tabs
(`src/render/report-client.ts:45-63`) — the APG pattern is optional and the arrow
keys already move focus between tabs; sparkline `aria-hidden` — the report spec
declares the sparkline decorative and the Trends table carries the same data.

## 4. Verification and review

- [x] 4.1 `npm run hygiene`, `npm run check`, `npm run test:e2e`.
- [ ] 4.2 SCR, CR, DAR, UXR, STR and CMP; ILA if any label or layout changes.
- [x] 4.3 Run the relevant `docs/DROP-IN-VALIDATION.md` rows on the final tree
  and record host, pin and result. The Windows official Cucumber-js host row
  passed; the other required host rows and the Linux/macOS runs remain pending
  for CI/next release (see the record below).
- [ ] 4.4 Record the static/default size delta, the client bundle size and the
  combined `--static --baseline` case after all four changes land. The
  static/default and client-bundle numbers are recorded; the baseline
  composition is pending the baseline change.
- [ ] 4.5 Fix findings; record deferred decisions with a trigger.

Review findings (2026-11-23): PIR/DXR found the static mode contradicted nine
unmodified base requirements (B1) plus the Details-tab scenario in "Show summary
and detailed test results", the `<details>` list missed `attachments.ts` and
`triage.ts` (B2), the dead controls were kept (D5/I5), the Report panel kept
`role="tabpanel"` and a dangling `aria-labelledby` (I9), the print page break is
keyed by `#analysis-view`/`#trends-view` rather than `.tabPanel` (I8), "no
`connect-src`" was false (I10), and the default report's multiple `<main>` was
not recorded (D6). The delta now has one MODIFIED requirement per contradicted
base requirement, the design lists every `<details>` site, the dead toolbar,
copy-failure and image-lightbox controls are removed, all three panels drop the
tab roles and dangling aria while keeping their IDs, `connect-src 'none'` is
stated correctly, and the default three `<main>` elements stay unchanged with
B-048. The docs list gains `docs/PRODUCT.md` and `GLOSSARY.md` (D20). No
implementation task is marked done.

Implementation notes and deviations (2026-11-24):

- The Red render suite omitted `static: true` from six `render-static.test.ts`
  option objects (shell, details, hostile, stacked views, the 0/1 history cases
  and the 30-run case) while asserting the static form. The same option shape is
  the default guard, so the opt-in contract is the only consistent reading; the
  implementation added `static: true` to those option objects and left every
  assertion unchanged.
- The static e2e `beforeAll` passed `all-statuses.ndjson` and `hooks.ndjson`
  together; those checked-in Messages fixtures reuse gherkin/pickle ids (`27`),
  so the CLI rejects the run as a duplicate-id input. The report now uses
  `screenshot.ndjson` plus `all-statuses.ndjson`; hook groups, earlier attempts,
  text attachments and the triage rest list stay covered by the static unit
  fixture set. No assertion changed.
- The 3.5 shell fixes live in `TRENDS_SHELL_CSS` in `trends.ts` and are appended
  only when the report renders Trends (`history.length >= 2`), not in the
  always-on `report.css`. The spec requires the no-history default HTML to stay
  byte-identical, and all five findings exist only when the third tab/table
  renders. The committed characterization hashes and goldens stay green; every
  default or static report with Trends gets the wrapped tab strip, capped table
  with sticky header, whole-word print header, inline `Current` tag and
  ratio-correct sparkline. A 365-run sidecar e2e covers 320 px and 200 % text on
  all three engines.
- The sparkline hides its point markers above 60 plotted runs and keeps the
  polyline; 60 markers still render. The static 30-run test and the existing
  trends unit suite are unchanged.
- `--static --baseline` is deliberately absent: the baseline change owns the
  flag and the composition. The CLI static test pins the `--static --history`
  composition instead.
- `--static` is validated before the generic "at least one output" error, so a
  `--static --json`/`--ci`/`--email` run names `--out` or `--pdf` on the first
  stderr line and writes nothing.

## Gate record

- PIR/DXR: completed 2026-11-23; all findings folded into the delta, design and
  tasks before Red.
- Focused tests: `npx vitest run test/render-static.test.ts
  test/cli-static.test.ts` 20/20; the added stream/trends boundary tests bring
  the focused set to 49/49. Focused e2e `static.spec.ts` + `trends.spec.ts`
  12/12 per engine (36/36).
- `npm run hygiene`: pass (795 tracked files, 338 commits).
- `npm run check`: pass; 84 test files, 1352 passed, 5 skipped; typecheck, lint
  and build green; client bundle 15,268 B under the 16,000 B budget.
- `npm run test:e2e`: pass on Chromium, Firefox and WebKit; 409 passed, 8
  skipped. The default 6-worker run twice exposed unrelated Firefox load flakes
  (`search.spec.ts` tag filter once; four `parity-metadata.spec.ts` cases once);
  every flake passed isolated, and the recorded clean run used `--workers=3`.
- Host rows: Windows official Cucumber-js host (`@cucumber/cucumber@13.3.0`,
  Node 26.13.1, Playwright 1.65.1) passed; see
  `docs/DROP-IN-VALIDATION.md`. Seed-Test, Playwright movies-app, Spring
  PetClinic and Cucumber-JVM rows plus the Linux/macOS CI runs are pending for
  CI/next release.
- Size measurements: standard `screenshot.ndjson` fixture, title "Static size":
  default 92,877 B; static 73,844 B; static is 19,033 B smaller. Client bundle
  15,268 B (budget 16,000 B). The combined `--static --baseline` size is
  pending the baseline change.
- Review round: pending.
