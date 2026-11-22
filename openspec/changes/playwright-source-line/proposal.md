# playwright-source-line

## Why

The Playwright JSON adapter preserves the spec location as the Gherkin/Pickle
location, but the report model drops the line. The native Playwright report shows
`movie-list.spec.ts:3`; Tolkira shows only `movie-list.spec.ts`. The host
validation recorded this as B-035: users comparing a failure with the source need
the line. A Playwright feature groups by project, so a multi-spec project also
needs the line per scenario, not only per feature.

## What Changes

- Carry the Pickle location line into the internal `ReportScenario` model.
- Show `displayUri(uri):line` in the scenario summary when the line is a positive
  integer; otherwise show the URI only.
- When every scenario in a feature has the same source URI and the same positive
  line, the feature source label shows `uri:line`; otherwise keep the URI (or the
  existing file count for multiple URIs). The feature row, matrix and triage
  share that helper.
- Adapters that have no real source line (JUnit, legacy JSON without a line,
  Playwright run errors or a missing/zero `spec.line`) keep the Pickle line
  unknown (0), so no `:1` is invented; AST placeholders stay as they are.
- No report JSON schema, `--json`, CI or email change; no new locale key and no
  dependency.

## Impact

- Affected capability: `report-rendering`.
- Affected code: `src/report/model.ts`, `src/render/format.ts`,
  `src/render/report.ts`, `src/render/report.css`, `src/input/playwright.ts`,
  `src/input/legacy.ts`, `src/input/junit.ts` and render tests/goldens.
- The Playwright adapter already carries the line; this completes the path and
  stops synthetic locations from becoming a source line.

## Non-goals

- A clickable source link or editor deep links.
- Changing the feature count or the summary schema.
- Showing a line when scenarios disagree, which would invent a single location.
