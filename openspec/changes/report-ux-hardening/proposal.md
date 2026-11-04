# Proposal

## Why

v0.1.0 shipped the core report and the compatibility baseline. Three report
features are still missing from the stated v0.1 scope or from real use:

- `PRODUCT.md` promises tag filters; the report only searches tags as text.
- Search opens matching scenarios but does not show which text matched.
- A failed scenario is visible, but copying the failure into a ticket or an
  agent prompt is manual.

At the same time, visual regressions are only caught by human inspection, JUnit
XML has one happy-path fixture, and several project docs describe an older
state. Those are trust gaps for a report generator that claims to replace an
unmaintained tool.

## What Changes

- Add a tag filter to the Report toolbar; combine it with search and status
  filters.
- Highlight search matches with the CSS Custom Highlight API and a safe
  feature-detect fallback.
- Add a "Copy failure" action for failed scenarios, including a clipboard
  fallback and polite confirmation.
- Publish visual report screenshots from CI as downloadable artifacts.
- Add JUnit XML edge-case fixtures: nested suites, skipped/error, system
  output, entities, empty and malformed documents, and mixed input.
- Correct stale docs: README, product scope, comparison notes, compatibility
  shim scope and remaining-work list.
- Release the result as 0.1.1.

## Impact

- Report shell markup, styles and the inline script.
- Browser and unit tests, plus a new visual Playwright spec and CI artifact
  upload.
- JUnit tests and fixtures.
- Documentation only elsewhere.
- No change to the JSON summary schema, input formats or CLI contract.
