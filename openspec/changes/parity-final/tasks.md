# Tasks

## 1. TDD-Red

- [x] 1.1 Add a parameter fixture with typed arguments, markup/entity
  characters, no arguments, and multiple match lists.
- [x] 1.2 Write failing render tests for parameter spans, escaping, plain
  fallback, search/copy preservation and edge ranges.
- [x] 1.3 Write a failing real-stream test proving
  `CucumberHtmlStream` output and options equal `renderReport`.
- [x] 1.4 Add provenance-bearing Jest, pytest and Gradle JUnit XML fixtures and
  characterisation tests for suite/testcase/error/failure/skipped and
  testcase-level `system-out`/`system-err`. These are regression tests: no
  production change and no RED is expected when the adapter already matches.
- [x] 1.5 Add `test/fixtures.ts` and replace duplicated browser-spec fixture
  constants; keep the tests green.

## 2. Implementer

- [x] 2.1 Add parameter data to `ReportStep`, render escaped `span.param`
  fragments and the CSS rule; verify 1.1/1.2 green.
- [x] 2.2 Export `CucumberHtmlStream` with the file API's options and renderer;
  verify 1.3 green and the real stream reaches flush.
- [x] 2.3 Keep the summary, search and copy text unchanged; verify 1.4/1.5 and
  the existing suite stay green.
- [x] 2.4 Run `npm run check` and `npm run test:e2e`.

## 3. Documentation and review

- [x] 3.1 Update `docs/CHANGELOG.md`, `docs/AGENT-INTERFACE.md`,
  `docs/CUCUMBER-COMPATIBILITY.md`, `docs/JUNIT-XML.md` and `README.md`.
- [ ] 3.2 Hand the spec and diff to the coordinator for review; fix findings.
- [ ] 3.3 Re-run the gate. Do not archive, tag or publish.

## Gate record

2026-11-12: `npm run check` green (24 files, 408 tests) and
`npm run test:e2e` green (222 tests, Chromium/Firefox/WebKit). One Firefox
diagnostics test timed out under parallel load on the first run and passed
alone and in the full rerun.

## Workflow follow-up

Coordinator owns review, archive and release; implementer reports the commit
and any deferred items.
