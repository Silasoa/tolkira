# Tasks

## 1. Gate

- [ ] 1.1 PIR + DXR over this proposal, the two spec deltas and the design;
  check every base requirement that mentions the default shell, print, static
  mode or history reading for a contradiction. Fold blockers into the contract
  before Red.
- [ ] 1.2 Confirm the seams: `src/render/details.ts` (`renderAnalysisView`),
  `src/render/trends.ts` (`renderTrendsView`), `src/render/report.css` around
  the `.metaList` rules and `@container (max-width: 16rem)`, the `localeCss`
  block in `src/render/html.ts`, the generated `src/render/styles.ts`, and
  `src/history.ts` (`readSidecar`, `readHistory`, `storedSchema`,
  `writeHistory`). Confirm no new catalog key or dependency.
- [ ] 1.3 Record the BOM scope decision (strip in `readSidecar`, so
  `readHistory` and `storedSchema` accept a BOM; `writeHistory` stays BOM-free
  and normalises on the next successful write) and the intentional
  characterization/golden re-pin (design open question 1) before Red.

## 2. TDD-Red

- [ ] 2.1 B-048 unit: a default report with no history has exactly one `<main>`
  inside `#report-view`; `#analysis-view` has no `<main>` and keeps its class,
  role, label, ID and `hidden`; no `#trends-view`; two tabs. A default report
  with two history runs has one `<main>`, three tabpanels and the three IDs. A
  static report still has one `<main>` and no tab roles. Assert heading order
  and the `#analysis-view, #trends-view` print rule.
- [ ] 2.2 B-048 browser: one `main` role at 320, 390, 768, 1024 and 1440 px and
  at 320 px / 200 % text; no horizontal overflow; Details and Trends panels
  keep their bounding boxes; save before/after visual captures for CMP.
- [ ] 2.3 B-039 unit: the narrow container rule is present in `REPORT_CSS`
  with one column and start-aligned values; the German override is present in
  the locale string; the base 2fr/3fr rule at 100 % is untouched; `styles.ts`
  is regenerated, not hand-edited.
- [ ] 2.4 B-039 browser: with a long metadata URL in Details, 320 px / 200 %
  yields one computed track, `text-align: start`, a wrapped link and no
  horizontal overflow; 320 px / 100 % and 390 px / 100 % keep two tracks and
  `text-align: right`; 768, 1024 and 1440 px are unchanged; the German boundary
  case passes.
- [ ] 2.5 B-049 unit in `test/history.test.ts`: valid no-BOM file (regression),
  one BOM plus valid JSON, BOM-only, BOM plus invalid JSON, two leading BOMs,
  and byte equality after every read. The schema peek accepts a BOM-prefixed
  target. An append to a BOM-prefixed sidecar succeeds and writes the same
  bytes as the same append without the BOM, with no run lost. A writer test
  pins no BOM in the output and unchanged schema/validation. Existing error
  text is asserted, not loosened.
- [ ] 2.6 Confirm RED for all three; no existing test is deleted or weakened.
  Assertions that encoded the three-`<main>` defect are updated in place and
  named in the change record.
- [ ] 2.7 B-054 visual evidence (test-only): one e2e test renders the default
  and the `--static` report from `test/fixtures/messages/screenshot.ndjson` and
  writes viewport captures to `test-results/visual/<engine>/`: 1440 px and
  390 px for both forms, plus 320 px at 200 % text for both forms, six PNGs
  per engine per run. The engine folder keeps the three parallel projects from overwriting
  each other; the existing `playwright-visual-*` CI artifacts pick the PNGs up.
  No pixel assertions, no committed images, no new dependency; each form
  asserts its title before capture. Expected green from the first run, not part
  of the RED set. B-054 changes no report behaviour, so this change adds no
  requirement delta for it.

## 3. Implement

- [ ] 3.1 B-048: replace the default `<main class="shell analysis">` wrapper in
  `details.ts` and `trends.ts` with `<div class="shell analysis">`; keep every
  panel attribute and ID. Leave `report.ts` and the static branches alone.
- [ ] 3.2 B-039: add the narrow `@container` rule to `report.css`, add the
  German override after the existing `:lang(de) .metaList` rule in `html.ts`,
  run `npm run styles`, and confirm the generated string matches `report.css`.
- [ ] 3.3 B-049: strip exactly one leading U+FEFF in `readSidecar` after the
  bounded read, so `readHistory` and `storedSchema` share the rule; leave
  `writeHistory`'s serialisation unchanged and BOM-free.
- [ ] 3.4 Re-pin intentionally: replace the nine default characterization
  hashes, the two-run history hash and the two golden HTML files
  (`test/fixtures/render-golden/minimal.html` and
  `attachments-presentation.html`). Inspect the diff: only the two
  `<main>`→`<div>` replacements, their closing tags and the narrow CSS string
  are allowed. Record the byte delta.
- [ ] 3.5 Docs: update `docs/ARCHITECTURE.md` (default and static both render
  one `<main>`), `docs/AGENT-INTERFACE.md` (remove the default three-`<main>`
  defect note; add the one-BOM sidecar sentence: reads and the schema peek
  accept it, the next successful write removes it), `docs/LIMITATIONS.md` (static
  row no longer claims the default keeps three `<main>`), and
  `docs/BACKLOG.md` (move B-039, B-048, B-049 and B-054 to Resolved at archive
  time).
- [ ] 3.6 Changelog: add `## [0.6.1] - Unreleased` to `docs/CHANGELOG.md` with
  `### Fixed` entries for the one `<main>` default, the narrow metadata
  stacking and the BOM-tolerant history sidecar read with a BOM-free next
  write. Do not change `package.json` (`version` stays 0.6.0) and do not create
  a tag, stage or publish.

## 4. Verification and review

- [ ] 4.1 `npm run hygiene`, `npm run check` and `npm run test:e2e` (report-level
  change) are green; typecheck, lint, unit tests and build included. Record the
  exact counts, the client bundle size and the report byte delta.
- [ ] 4.2 Independent reviewers in one batch: SCR (both deltas), CR, DAR, SEC
  (history input parsing and file handling), UXR (report shell, stack
  breakpoint and landmarks), STR (module/test health) and CMP (default report
  captures at 320, 390, 768, 1024, 1440 px and 320/200 against 0.6.0; only the
  wrapper and the narrow metadata rule may differ). A failing review spawns a
  fixer, not the implementer of record.
- [ ] 4.3 Host rows in `docs/DROP-IN-VALIDATION.md`: Seed-Test (legacy JSON and
  the `cucumber-html-reporter` shim) and the official Cucumber-js host (legacy
  JSON and Messages) at minimum, because the report shell changes. Record host,
  pin, artifact and result. Confirm the report has one `<main>`, no horizontal
  overflow at 1440/390 and 320/200, and no console errors. The other required
  release rows stay for the release pass.
- [ ] 4.4 Gate record: commands, results, characterization re-pin evidence, the
  exact CSS rule and German override, the BOM read/peek/append table, host
  rows and the byte delta. Deferred findings get a backlog trigger; nothing is
  dropped silently.
- [ ] 4.5 Fix every review finding or record a decision with a trigger; re-run
  the gate after fixes.

## 5. Release boundary

- [ ] 5.1 Do not bump the version, tag, stage or publish. 0.6.1 preparation and
  approval remain a separate user decision after this change is complete and
  reviewed.
