# Tasks

## 1. Fixture and model

- [ ] 1.1 Add the official Compatibility Kit `examples-tables.ndjson` fixture
  and its `.feature` file under `test/fixtures/messages/`, with a short
  provenance note; verify it parses as 7 scenarios across 2 outlines and the
  current summary still reports 5 passed / 2 failed.
- [ ] 1.2 Write RED model tests for outline metadata: each example row carries
  the outline name/keyword/description/tags, examples name/keyword/tags and
  zero-based examples/example indices; verify the tests fail before the model
  change.
- [ ] 1.3 Add the optional outline metadata to `ReportScenario` and the
  Gherkin table-row lookup in `buildReportModel`; verify 1.2 passes and the
  flat scenario count is unchanged.
- [ ] 1.4 Add a fallback test with a pickle whose `astNodeIds` has no valid
  examples row and a legacy JSON fixture; verify both stay flat and the report
  model does not throw.

## 2. Rendering

- [ ] 2.1 Write RED render tests for the grouped structure: one outline
  section, two examples headings and rows labelled `#1.1`, `#1.2`, `#2.1`,
  `#2.2`; verify the tests fail before grouping.
- [ ] 2.2 Group rows in `renderFeature` and render static outline/examples
  headings around the existing scenario row; verify 2.1 passes and standalone
  scenarios keep their current markup.
- [ ] 2.3 Test that outline description and tags render once, examples tags
  render on the examples heading and not per row, and outline/examples names,
  descriptions and tags are escaped; verify the render tests pass.
- [ ] 2.4 Give grouped rows a screen-reader label with the outline and
  substituted scenario name and use a valid heading hierarchy; verify the
  accessibility assertions pass.
- [ ] 2.5 Add the outline/examples styles and responsive rules; verify the
  320 px and 320 px at 200 % text zoom checks show no horizontal page scroll
  and no clipped headings.

## 3. Search, filters and anchors

- [ ] 3.1 Add outline and examples names/tags to the row search text and hide
  empty examples/outline wrappers after filtering; verify a browser test finds
  a row by outline name and leaves no empty headings.
- [ ] 3.2 Verify a `#scenario-...` anchor opens the feature, reveals the
  grouped example and moves focus to its summary; add a browser test.
- [ ] 3.3 Verify status and tag filters hide whole examples blocks and outlines
  with no visible row, and that the 20-match search cap still works; add
  browser tests.

## 4. Documentation, gate and parity review

- [ ] 4.1 Update `docs/CHANGELOG.md` and the Cucumber compatibility notes with
  the Messages-only outline grouping and the legacy flat fallback; verify the
  documented example matches the generated report.
- [ ] 4.2 Run `npm run check`, `npm run test:e2e` and the 1000/5000-scenario
  stress runs; record the timings and confirm no meaningful size regression.
- [ ] 4.3 Run the CMP reviewer against the official formatter on the same
  `examples-tables` fixture, record concrete gaps and fix any blocker before
  handover.

## Workflow follow-up

- Archive the change after the review set and the user approve it.
