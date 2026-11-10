# Tasks

## 1. Fixtures and model

- [x] 1.1 Add CCK `rules`, `backgrounds` and `tags` `.ndjson`/`.feature`
  fixtures with a provenance note; verify they parse and expose rules,
  backgrounds and tags.
- [x] 1.2 Write RED model tests for optional rule metadata (id, keyword, name,
  description, tags), `ownTags` vs inherited `tags`, and feature/rule
  background metadata.
- [x] 1.3 Attach rule/background metadata from the Gherkin tree, add `ownTags`,
  mark legacy synthetic backgrounds, and keep `ReportFeature.scenarios` flat;
  verify 1.2 passes and counts are unchanged.
- [x] 1.4 Add legacy/JUnit fallback tests: no invented rules/backgrounds,
  synthetic legacy backgrounds skipped, feature/scenario tags best effort.

## 2. Rendering

- [x] 2.1 Write RED render tests for feature tags, rule sections (heading,
  description, tags), a rule with scenarios, a rule with an outline, mixed
  feature/rule ordering, own-tag display and empty background headings.
- [x] 2.2 Group render items by rule and implement rule sections; verify 2.1
  passes and features without rules keep their layout.
- [x] 2.3 Write RED tests for feature/rule background headings and
  descriptions; verify background steps are not duplicated.
- [x] 2.4 Implement background headings/descriptions; verify 2.3 passes.
- [x] 2.5 Add rule/background names, descriptions and tags to search text and
  hide empty rule sections after filtering; verify search finds a rule, tag and
  background and the search cap still works.
- [x] 2.6 Test escaping of rule/background names, descriptions and tags; verify
  no markup executes.
- [x] 2.7 Add an integration test: model scenario counts equal summary counts,
  every scenario remains in triage/matrix, inherited tags stay filterable and
  the summary remains version 1.

## 3. Browser and responsive

- [x] 3.1 Add a browser test for a rule with an outline and background: rule
  section, tags, background and outline visible.
- [x] 3.2 Add a browser test for search by rule name/tag, status/tag filtering
  across two rules, empty rule hiding and no-JS visibility.
- [x] 3.3 Verify 320 px and 320 px at 200 % text zoom with rule/background
  headings; no horizontal page scroll or clipped text.
- [x] 3.4 Add rule/background fixtures to the visual snapshot set.

## 4. Documentation, gate and review

- [x] 4.1 Update `docs/CHANGELOG.md`, `docs/CUCUMBER-COMPATIBILITY.md`,
  `docs/AGENT-INTERFACE.md` and `GLOSSARY.md` with rules, backgrounds, tag
  inheritance, the HTML-only structure and the legacy fallback.
- [x] 4.2 Run the full reviewer set (SCR, CR, DAR, SEC, UXR, PCA, CMP); the CMP
  reviewer compares the official formatter first, then MCHR, Allure and
  Playwright on the same fixtures. Fix every blocker.
- [x] 4.3 Run `npm run check` and `npm run test:e2e`; verify the gate is green.

## Workflow follow-up

- Archive the change after the review set and the user approve it.
