# Tasks

## 1. Spec gate

- [x] 1.1 Run PIR and DXR over proposal, spec and design; fix blockers.
  PIR and DXR PASS on 2026-11-19 after six review rounds.
- [x] 1.2 Link the change to the promoted issue and #24. Promoted as #25.

## 2. TDD-Red

- [x] 2.1 Add a Playwright fixture with a statically skipped test without
  steps; keep the existing summary assertion (`status: "skipped"`,
  `executed: true`) and assert the counts and unchanged schema keys.
- [x] 2.2 Add render tests for 1 passed / 1 failed / 1 skipped in one feature:
  `50%`, `1 / 2 attempted`, feature `1 passed of 2 attempted` with `1 failed`
  and `1 skipped`, skipped pill and bar segment; Details `1 / 2 attempted`;
  a skipped-only run shows `No scenarios attempted` and no ratio; an empty run
  keeps `0%` and `0 / 0`.
- [x] 2.3 Add a render test for a started, resultless row: header
  `2 scenarios with results` and `1 unexecuted`; no unexecuted label when every
  row has a result; the string `executed scenarios` is gone from the header.
  Scope header assertions to `.meta` or use `{ exact: true }`; `getByText` also
  matches the live region and source cards.
- [x] 2.4 Add a Playwright fixture with one two-file feature; assert
  `2 spec files` in the Report row, the triage title and the Details matrix and
  no arbitrary path at 1440 px; assert the matrix at 320/390/768 where the
  Report row hides its source; keep a single-file assertion.
- [x] 2.5 Add a Playwright fixture whose error message ends with
  `at <file>:<line>:<col>` plus a location, one containing it mid-sentence, one
  message with backslash-separated paths, two errors with different locations
  (both kept), one location without a column, and a `file:1` location while the
  message only contains `file:12`; assert the description contains the location
  once and that a message without it still gets one.
- [x] 2.6 Add render assertions for `Run environment`, `Test time` (header and
  Details), `Scenario time` (matrix), the sum sentence and the header title.
- [x] 2.7 Add browser coverage for the skipped ratio and the multi-file source
  at 320, 390, 768, 1024, 1440 px and 320 px at 200 % text zoom.
- [x] 2.8 Confirm the new tests fail for the right reason before implementation.
  Red suite committed at `3182515`.

## 3. Implement

- [x] 3.1 Compute run and Details ratios over attempted scenarios; render
  `N scenarios with results` and `N unexecuted`; handle skipped-only and empty
  runs as specified; update the feature text.
- [x] 3.2 Show a distinct display-URI count for multi-file features in the
  Report row, triage title and Details matrix.
- [x] 3.3 Append a Playwright error location only when no part already contains
  it.
- [x] 3.4 Rename the environment heading and duration labels; add the sum
  sentence and the header title.
- [x] 3.5 Keep the summary shape, JSON keys, `schemaVersion` and all existing
  filter/bar/count behaviour.

## 4. Docs

- [x] 4.1 Update the `executed` definition, the HTML pass-rate note and the
  duration wording in `docs/AGENT-INTERFACE.md`; align `GLOSSARY.md`.
- [x] 4.2 Update the skipped, location and duration notes in
  `docs/PLAYWRIGHT-JSON.md`.
- [x] 4.3 Update the count paragraph in `docs/ARCHITECTURE.md`, the
  `Cucumber environment` line in `README.md`, and the Feature/Details rows in
  `DESIGN.md` (source badge, `Run environment`).
- [x] 4.4 Add one `docs/CHANGELOG.md` entry for the clearer counts and labels.

## 5. Verification and review

- [x] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 5.2 Run the review swarm: SCR, CR, DAR, UXR, CMP.
- [x] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md`.
- [x] 5.4 Update the #24 checklist, commit and push with the issue and change
  reference.

## Gate record

2026-11-19: `npm run hygiene` ok; `npm run check` 598 passed, 1 skipped;
`npm run test:e2e` 237 passed (Chromium, Firefox, WebKit). Review swarm: SCR,
CR, DAR, UXR and CMP pass with no blockers; the fixer closed the non-blockers
and SCR/CR/DAR re-checks pass. Deferred: triage membership for skipped results,
CI summary labels, the matrix caption and 320 px count wrapping, all in
`docs/BACKLOG.md`.
