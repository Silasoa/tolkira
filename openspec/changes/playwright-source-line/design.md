# Design

## Context

`src/input/playwright.ts` maps `spec.line`/`spec.column` to the Gherkin
`Scenario` and `Pickle` locations. `src/report/model.ts` copies `pickle.uri` into
`ReportScenario.uri` but not the location. `featureSourceLabel` in
`src/render/format.ts` builds a set of scenario URIs and shows one URI or a file
count. The feature label feeds the feature row, the matrix and triage.

## Model

- Add `line?: number` to `ReportScenario`.
- Set it from `pickle.location?.line` only when it is a positive integer;
  do not default missing values. `positiveLine` is exported once from the model
  and shared with the labels.
- Adapters that synthesize locations keep a Pickle line of 0 when no real line
  exists (legacy JSON without a line, JUnit, Playwright run errors and a
  missing/zero `spec.line`); AST placeholders stay at 1.
- Keep the public JSON summary unchanged; the line is render metadata only.

## Scenario label

- Add a small `scenarioSource` span to the scenario summary: `displayUri(uri)`
  plus `:line` when the scenario line is positive. It sits beside the step count
  and tags, is visible below 900 px, wraps with `overflow-wrap: anywhere` and is
  escaped like the feature URI.
- A Playwright project feature can contain scenarios from several spec files;
  the per-scenario line is the native-report equivalent and must not depend on
  the feature's URI set.

## Feature label

- Group the feature's scenarios by `displayUri(scenario.uri)` and collect their
  positive lines.
- No source: return an empty string.
- More than one URI: keep `format.specFiles` with the number of URIs.
- One URI and exactly one distinct positive line: return `${uri}:${line}`.
- One URI with mixed or absent lines: return the URI only.
- The line is escaped with the URI in every caller; no HTML injection.

This intentionally applies to any adapter whose Pickles carry a location, not
only Playwright. A Cucumber feature whose scenarios share a file but have
different lines keeps the file-only label; a one-scenario feature shows its line,
which is a valid precise source.

## Tests

- Render a Playwright project fixture with scenarios from two spec files and
  assert each scenario summary shows its own `file:line`, while the feature
  label does not invent one.
- Render a Playwright spec with a missing/zero line and assert no `:1` and no
  trailing colon.
- Render a legacy/Cucumber feature whose scenarios share a file with different
  lines and assert each scenario shows its own line and the feature label has no
  line suffix.
- Render a feature without a location and assert no trailing colon.
- Render the Playwright `errors` fixture and assert the synthetic run-error
  pseudo-pickle shows no line (B-038).
- Assert the scenario-source CSS wraps and is never hidden at narrow widths; the
  browser viewport matrix verifies 320 px. Regenerate the render goldens for the
  new span intentionally; the JSON/CI/email bytes stay unchanged.

## Risks

- The label is used in three places; a single helper keeps them consistent.
- A feature with one scenario now shows a line where it previously showed none;
  this is additive source information, not a semantic change.
