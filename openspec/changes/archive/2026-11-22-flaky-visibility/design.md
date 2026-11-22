# Design

## Context

`src/input/playwright.ts` adds the `@flaky` tag to a final passed attempt after a
retry. `ReportScenario.tags` carries it into the report. `countPills` in
`src/render/format.ts` renders the status counts; `scenarioSummary` in
`src/render/report.ts` renders the scenario row. The report catalogs live in
`src/i18n/locales/en.json` and `de.json`; `src/i18n/catalogs.ts` is generated.

## Report

- Add a small `flakyScenarioCount(model)` helper in `format.ts`: count
  `model.features[].scenarios` whose `tags` include `@flaky`.
- In `reportHeader`, when the count is positive, add a run-metadata item
  `N tagged @flaky` using `report.flakySummary`; do **not** add it to
  `.counts`, where it would read as a fourth status. The item is separate from
  the status counts and can wrap with the existing meta line.
- In `scenarioSummary`, when the scenario tags include `@flaky`, add a
  `<span class="flakyBadge" aria-hidden="true">flaky</span>` in the scenario
  sub-line using `report.flakyBadge`; the existing `@flaky` tag remains the
  accessible text, so the badge is decorative.
- Style the run-meta item and badge with the pending palette, with
  `overflow-wrap: anywhere`; no layout change at 320/1440.
- Do not change statuses, counts, the bar or the feature rows.

## Catalog

- Add `report.flakySummary` = `{count} tagged @flaky` (en) /
  `{count} mit @flaky markiert` (de) and `report.flakyBadge` = `flaky` (en/de).
- Run the i18n asset build; key parity must stay green.
- No client key is needed; both are server-rendered.

## Tests

- An adapter/render test with a retry-passed Playwright test: the HTML contains
  the badge and `1 tagged @flaky`; the summary status remains passed; JSON/CI/email
  are unchanged.
- A legacy/Cucumber fixture with a user `@flaky` tag: badge and count appear.
- A no-flaky fixture: no badge, no pill.
- de render: the two keys come from the German catalog; English visible text is
  unchanged.
- 320/1440 no overflow; print keeps the badge.

## Risks

- `@flaky` is a user tag too; the badge reflects a tag, not a computed retry
  status. That is the display-only contract.
- The badge is not a filter; the existing tag filter covers it.
- No size impact beyond the small markup.
