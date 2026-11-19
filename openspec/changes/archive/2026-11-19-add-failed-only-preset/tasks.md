# Tasks

## 1. Spec gate

- [x] 1.1 Run PIR and DXR over proposal, spec and design; fix blockers.
  PIR and DXR PASS on 2026-11-19.
- [x] 1.2 Link the change to the promoted issue and #24. Promoted as #27.
  Archive `clarify-run-presentation` before this change because both modify
  “Handle empty features and runs”.

## 2. TDD-Red

- [ ] 2.1 Unit render and DOM contract: the toggle appears for failed plus
  another status and for failed plus an unexecuted row (an isolated
  failed+unexecuted envelope set), and not for a passed-only or failed-only
  run; the markup has `data-filter-preset="failed"` and
  `aria-pressed="false"`; every `button.filter` has exactly one of
  `data-filter-status` or `data-filter-preset`.
- [ ] 2.2 Unit `scenarioVisible`: a statusless row is hidden only when
  `unexecuted` is in `hidden`; status rows are unaffected.
- [ ] 2.3 Unit `search.ts`: `isFailedOnlyState` is true only for failed on, all
  other present off, sentinel present; `pruneFailedOnly` drops a lone sentinel
  and keeps a valid preset; `serializeUrlState` round-trips the sentinel.
- [ ] 2.4 Browser (`test/e2e/failed-only.spec.ts`): press hides other statuses
  and statusless rows, keeps the header counts, hides the triage and source
  strip, sets the URL and live count; undo restores all; a manual chip change
  clears the sentinel and leaves statusless rows visible; a partial chip state
  does not press the toggle; reload restores the pressed state; search combines
  and a matching unexecuted row stays hidden; the tag filter combines on failed
  rows; empty state; keyboard; a derived failed+unexecuted (fail-fast) run
  offers the toggle, pressing hides the blank row and undo shows it;
  320/390/768/1024/1440 and 320 at 200 % text zoom.
- [ ] 2.5 No-JS: the toggle is inert and the static rows remain.
- [ ] 2.6 Confirm the new tests fail for the right reason before implementation.

## 3. Implement

- [x] 3.1 Add the selector constant and sentinel constant; extend
  `scenarioVisible` and the URL parser/serializer.
- [x] 3.2 Render the toggle under the presence condition.
- [x] 3.3 Add the client preset click, derived pressed state, chip sync and
  sentinel clearing.
- [x] 3.4 Add the preset styling and rebuild the stylesheet and the client
  bundle.
- [x] 3.5 Keep the chips, search, tag, live count, empty state and no-JS
  behaviour unchanged outside the preset.

## 4. Docs

- [x] 4.1 Add the toggle to the `DESIGN.md` toolbar inventory and filter
  interaction rule, and the `README.md` filter bullet; add the preset carve-out
  to `docs/ARCHITECTURE.md` and the state terms to `GLOSSARY.md`.
- [x] 4.2 Note the `unexecuted` pseudo-status in `docs/AGENT-INTERFACE.md`
  (`?hide=`) and add one `docs/CHANGELOG.md` entry naming `hide=unexecuted`.

## 5. Verification and review

- [x] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 5.2 Run the review swarm: SCR, CR, DAR, UXR, CMP.
- [x] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md`.
- [x] 5.4 Update the #24 checklist, commit and push with the issue and change
  reference.

## Gate record

2026-11-19: `npm run hygiene` ok; `npm run check` 628 passed, 2 skipped;
`npm run test:e2e` 273 passed (Chromium, Firefox, WebKit). Review swarm: SCR,
CR, DAR, UXR and CMP pass; DAR's two glossary blockers and the CMP/UXR/CR
non-blockers were fixed and re-checked. Deferred: triage/source visibility under
the preset (backlog trigger) and a browser reload case for the fail-fast preset
(unit-covered). Archive `clarify-run-presentation` before this change.
