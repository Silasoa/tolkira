# flaky-visibility

## Why

The Playwright adapter already adds `@flaky` to a test that passed after a retry,
but the report only shows the generic tag and folds the scenario into passed.
The feature-request survey ranked flaky/retry visibility second; users want a
schema-free first slice that surfaces the existing tag without a schema v2 or an
earlier-attempt store.

## What Changes

- Show a localized `flaky` badge on every scenario whose inherited tags include
  the lowercase `@flaky` tag.
- Add a separate run-metadata count such as `1 tagged @flaky` when at least one
  exists. This is a tagged `@flaky` count, not a computed flake rate or
  detection; a failed or unexecuted tagged scenario also counts.
- Keep the status model unchanged: the scenario remains `passed` in the report,
  JSON summary, CI and email. The badge and count are report-only (HTML/PDF).
- Add two report-catalog keys (`report.flakySummary`, `report.flakyBadge`) in
  en/de; no new schema, field, dependency or input adapter.

## Impact

- Affected capability: `report-rendering`.
- Affected code: `src/render/format.ts`, `src/render/report.ts`,
  `src/render/report.css`, `src/i18n/locales/en.json`, `de.json`, tests.
- The Playwright adapter already emits `@flaky`; Cucumber users can tag it.

## Non-goals

- A flaky status, flake rate or detection, earlier-attempt error/screenshot or
  retry history.
- Changing the JSON summary, CI or email status.
- A new dependency or a client-side filter.
