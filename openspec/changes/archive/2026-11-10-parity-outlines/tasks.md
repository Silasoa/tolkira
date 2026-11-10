# Tasks

## 1. Fixtures and model

- [x] 1.1 Add the official Compatibility Kit `examples-tables.ndjson` and
  `.feature` files under `test/fixtures/messages/` with a provenance note;
  verify the fixture parses as 7 scenarios across 2 outlines, 5 passed and 2
  failed, and the second outline has an empty examples name and the
  unsubstituted heading `Eating cucumbers with <friends> friends`.
- [x] 1.2 Add the Compatibility Kit `examples-tables-attachment.ndjson` and
  `.feature` files; verify the model sees image attachments on two different
  example rows and not on the outline itself.
- [x] 1.3 Add synthetic Messages coverage for outline tags, outline
  description, examples tags, examples description, HTML/script text, a Rule,
  partial execution, an empty examples block before an executed block, an extra
  AST id, a retry and an executed outline without examples; verify each case
  parses and produces the expected pickles and test cases.
- [x] 1.4 Write RED model tests for the optional outline metadata: outline and
  examples names/keywords/descriptions/tags, zero-based examples/example
  indices, two outlines, numbering across an empty block, partial execution,
  extra AST id, retry and outline-in-rule; verify the tests fail before the
  model change.
- [x] 1.5 Add the optional `outline` metadata to `ReportScenario` and the
  Gherkin examples-row map; use `pickle.astNodeIds.at(-1)`, the map's scenario,
  a membership check and the existing rule walker. Keep `ReportScenario.tags`
  as `pickle.tags`. Verify 1.4 passes, counts stay at 7, and the JSON summary
  counts are unchanged.
- [x] 1.6 Add fallback tests for legacy JSON, an unlinked pickle and an
  executed outline without examples; verify each stays a flat row and the model
  does not throw.

## 2. Rendering

- [x] 2.1 Write RED render tests for two outline sections: the first outline's
  two examples headings and `#1.1`, `#1.2`, `#2.1`, `#2.2`; the second
  outline's unnamed examples heading and `#1.1`, `#1.2`, `#1.3`; and the
  second outline's unsubstituted heading. Verify the tests fail before
  grouping.
- [x] 2.2 Group rows from the input-order scenario array, order groups by
  severity then first input index, order rows by examples/example index, and
  assign row ids from the severity-ordered array used by triage. Verify 2.1
  passes and standalone scenarios keep their current markup and order.
- [x] 2.3 Test that outline tags and description render once, examples tags
  and description render once, tags appear before headings and descriptions
  after, and an empty examples name renders `Examples:`; verify the render
  tests pass.
- [x] 2.4 Test that outline/examples keywords, names, descriptions and tags are
  escaped with the XSS fixture; verify no markup or script is emitted and the
  SEC review can use the same fixture.
- [x] 2.5 Change the grouped row heading to `h5`, keep outline `h3` and
  examples `h4`, and replace the inner "Steps"/"Attachments" `h4` labels with
  non-heading labels; verify a heading-order assertion and the existing
  accessibility tests pass.
- [x] 2.6 Verify per-example attachments: each row shows only its own image
  and attachment count, images do not leak between rows, and the lightbox still
  works; add unit and browser coverage with the attachment fixture.
- [x] 2.7 Add outline/examples styles and responsive rules; verify the outline
  fixture at 320 px and 320 px at 200 % text zoom has no horizontal page scroll
  or clipped headings, and add it to the visual snapshot set.
- [x] 2.8 Add example context to triage labels and copy-failure text via a
  shared helper and data attributes; verify two failing same-name examples are
  distinguishable, each triage link opens the right row, and the copied text
  contains the substituted name, example number and examples name.

## 3. Search, filters and anchors

- [x] 3.1 Add outline and examples names/tags to the row search text, keep
  examples table values out of the index, and hide empty examples/outline
  wrappers after filtering; verify a browser test finds rows by outline name,
  examples name and examples tag with no empty headings left.
- [x] 3.2 Verify a triage link and a hand-written `#scenario-...` anchor open
  the feature, reveal the grouped example and move focus to its summary; add
  browser tests for a failed example and a passed example in a passed feature.
- [x] 3.3 Verify `@failing` keeps the failing block and outline heading while
  hiding the passing block, `@passing` does the reverse, numbering stays stable
  after filtering, and the 20-match search cap still hides empty wrappers.
- [x] 3.4 Verify a retried example renders one row with the latest attempt and
  no duplicate `#1.1` heading; add a model and browser regression test.

## 4. Documentation, gate and parity review

- [x] 4.1 Update `docs/CHANGELOG.md`, `docs/CUCUMBER-COMPATIBILITY.md`,
  `docs/COMPATIBILITY.md`, `docs/AGENT-INTERFACE.md` and `GLOSSARY.md` with the
  Messages-only grouping, legacy/no-examples flat fallback, summary
  duplicate-name limitation and the outline/examples vocabulary; verify the
  documented example matches the generated report.
- [x] 4.2 Add an outline-heavy 1000/5000-scenario stress case and run it with
  the existing stress harness; record timings and confirm no meaningful size
  regression.
- [x] 4.3 Run the full reviewer set from `docs/agents/review.md` (SCR, CR, DAR,
  SEC, UXR, PCA, CMP); the CMP reviewer compares the official formatter first,
  then MCHR, Allure and Playwright on the same fixtures, and treats G8 Markdown
  and G11 `meta.ci` as known out-of-scope differences. Record findings and fix
  every blocker.
- [x] 4.4 Run `npm run check` and `npm run test:e2e`; verify the full gate is
  green before handover.

## Workflow follow-up

- Archive the change after the review set and the user approve it.
