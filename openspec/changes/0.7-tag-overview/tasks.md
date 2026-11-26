# Tasks

## 1. Contract

- [x] 1.1 Run PIR + DXR over this proposal, the report-rendering delta, the
  design and the tasks. Fold blockers back into the contract before Red.
- [x] 1.2 Record the measured baseline: report bytes for a tagged fixture
  before the change, the current tag filter option set and the current Details
  panel order.

## 2. Red

- [x] 2.1 Write `test/render-tags.test.ts` from the spec: counts per tag with
  failed, skipped and passed executed rows plus an unexecuted-only tag with
  zeros; inherited feature/rule/examples tags; duplicate tag on one row; sort
  by failed then count then code-unit order; the 50-row cap, failing-tag
  visibility and `Showing 50 of 60 tags`; no-tag absence; escaping; tag set
  equals the filter's; `t.number` formatting.
- [x] 2.2 Add an HTML test that the panel renders in the Details view and not
  on the Report tab, that `REPORT_CSS` carries no tag rule, that an untagged
  report carries neither the panel nor `TAG_TABLE_CSS`, and that the summary,
  CI and email bytes are unchanged.
- [x] 2.3 Write `test/e2e/tags.spec.ts`: Details visibility, filter invariance,
  320 px / 200 % scroll, static form, print and German labels.
- [x] 2.4 Run the new tests and confirm they fail for the intended reason.

## 3. Implement

- [x] 3.1 Add `src/render/tags.ts` with the pure row builder (dedupe per row,
  counts, sort, cap), the panel renderer and `TAG_TABLE_CSS`.
- [x] 3.2 Mount the panel in `src/render/details.ts` after the analysis grid
  and before the run attachments.
- [x] 3.3 Inject `TAG_TABLE_CSS` into the `<style>` block in `src/render/html.ts`
  only when the overview renders; keep `REPORT_CSS` unchanged.
- [x] 3.4 Add the seven keys to the English and German catalogs and run
  `npm run i18n:check`.
- [ ] 3.5 Update `DESIGN.md` (Details row and module list) and
  `docs/CHANGELOG.md`.

## 4. Reviews

- [ ] 4.1 Run SCR, CR, DAR, UXR, CMP and ILA blind and in parallel.
- [ ] 4.2 Fix every finding with a separate fixer or record a decision with a
  trigger; re-run the gate; delta re-check the reviewers.

## 5. Host validation

- [ ] 5.1 Run the report-shell rows 1-5 in `docs/DROP-IN-VALIDATION.md` on
  their pinned hosts; check the tag panel (or its absence on tagless JUnit),
  320/1440 px, 200 % text and print.
- [ ] 5.2 Record host, pin and result here; a red host blocks or needs a
  written, user-approved exception.

## 6. Gate and archive

- [ ] 6.1 `npm run hygiene`, `npm run check` and `npm run test:e2e` are green;
  record counts and runtime.
- [ ] 6.2 Update `docs/CHANGELOG.md` (Unreleased) and `docs/BACKLOG.md`
  (B-059 resolved, B-060/B-061 already resolved).
- [ ] 6.3 Archive the change, sync the report-rendering spec, push. No version
  bump, tag, stage or publish.
