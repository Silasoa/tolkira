# Tasks

## 1. Fixtures and model

- [ ] 1.1 Add the official Compatibility Kit `hooks.ndjson` and `.feature`
  files under `test/fixtures/messages/` with a provenance note; verify the
  fixture contains per-scenario hooks and test-run BeforeAll/AfterAll hooks.
- [ ] 1.2 Add synthetic Messages coverage for a named passed hook, a named
  failed hook with an attachment, a run hook with an attachment, a missing Hook
  envelope and a start without finish; verify each parses.
- [ ] 1.3 Write RED model tests for separate hooks: `scenario.steps` excludes
  hooks, `scenario.hooks` carries type/name/status/duration/message/attachments,
  `model.runHooks` carries BeforeAll/AfterAll, hook attachments are counted but
  not duplicated, and the JSON summary stays version 1 with `keyword: "Hook"`.
- [ ] 1.4 Add `ReportHook`, `ReportRunHook`, `ReportScenario.hooks` and
  `ReportModel.runHooks`; collect per-scenario and run hooks, keep test-case
  order and use generic labels for missing metadata. Verify 1.3 passes and
  existing scenario counts are unchanged.
- [ ] 1.5 Add fallback tests for legacy per-scenario hooks, no test-run hooks
  in legacy and no hooks in JUnit; verify the report model does not throw and
  the expected hook rows exist.

## 2. Rendering

- [ ] 2.1 Write RED render tests for the scenario subtitle (`N steps · M
  hooks`), named and unnamed hook labels, failed hooks inline, passed hooks
  behind a `N hooks` disclosure, and hook attachments.
- [ ] 2.2 Implement the scenario hook group and hook rows; verify 2.1 passes
  and scenarios without hooks keep their current markup.
- [ ] 2.3 Write RED render tests for the run Hooks section: BeforeAll/AfterAll
  rows, status/duration/error/attachments, omitted when empty, and fallback
  labels for missing metadata.
- [ ] 2.4 Implement the run Hooks section above the feature list; verify 2.3
  passes and no-JS output remains readable.
- [ ] 2.5 Add hook names and error messages to the scenario search text with
  the existing message cap; verify search finds a hook name and error and the
  20-match cap still works.
- [ ] 2.6 Test escaping of hook names, type labels, messages and attachment
  names; verify no markup or script executes and the SEC review can reuse the
  fixture.
- [ ] 2.7 Add hook group/run-hook styles and responsive rules; verify the hooks
  fixture at 320 px and 320 px at 200 % text zoom has no horizontal page scroll
  or clipped hook labels, and add it to the visual snapshot set.

## 3. Browser and regression

- [ ] 3.1 Add a browser test that opens the passed-hooks disclosure, keeps a
  failed hook visible, and checks the scenario subtitle counts.
- [ ] 3.2 Add a browser test for the run Hooks section, including a failed run
  hook error and attachment.
- [ ] 3.3 Verify keyboard operation of the hooks disclosure, focus behaviour
  and the no-JS report; add assertions.
- [ ] 3.4 Verify the JSON summary still reports hooks as steps with
  `keyword: "Hook"` and `schemaVersion: 1`; add a regression test and document
  the HTML/summary difference.

## 4. Documentation, gate and parity review

- [ ] 4.1 Update `docs/CHANGELOG.md`, `docs/CUCUMBER-COMPATIBILITY.md`,
  `docs/AGENT-INTERFACE.md` and `GLOSSARY.md` with hook rows, the run Hooks
  section, legacy fallbacks and the unchanged summary contract; verify the
  documented example matches the generated report.
- [ ] 4.2 Run the full reviewer set from `docs/agents/review.md` (SCR, CR, DAR,
  SEC, UXR, PCA, CMP); the CMP reviewer compares the official formatter first,
  then MCHR, Allure and Playwright on the same fixtures. Record findings and fix
  every blocker.
- [ ] 4.3 Run `npm run check` and `npm run test:e2e`; verify the full gate is
  green before handover.

## Workflow follow-up

- Archive the change after the review set and the user approve it.
