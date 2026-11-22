# flaky-trends

## Why

Tolkira shows a decorative `@flaky` badge and a tagged count for one run, but
Trends only tracks the pass rate. Users cannot see whether retries and tagged
flakes are increasing across runs. This is the remaining small flaky/retry
slice: an additive per-run flaky count and a flaky share in Trends. The earlier
attempt's error/screenshot disclosure is deferred to B-043.

## What Changes

- A new history run gains an optional `flaky` count: executed, non-skipped
  scenarios tagged `@flaky`, or scenarios that passed after at least one retry
  (`attempt > 0`). A tagged final failure counts; a retried final failure does
  not count unless tagged. Old history entries without the field stay absent and
  render `—`; the history schema version stays 1 because the field is additive
  and older readers ignore unknown keys (they drop it on rewrite, so 0.5 should
  write).
- Trends gains `Flaky` and `Flaky share` columns; the share is
  `flaky / attempted` (attempted = total - skipped), with `—` when no scenario
  was attempted or the row predates the field, and `<0.1%` for a positive share
  below 0.1%. A note explains the tag-or-passed-after-retry proxy, the final
  failure rules, that it is not a probability, the run-meta difference in both
  directions, and the legacy `attempt: 0` limit.
- The 11-column Trends table gets a 72rem screen minimum width and fixed A4
  print columns (13/20/14% + 8×6.625%), with wrappable headers and nowrap
  numeric cells; the table still scrolls at narrow widths.
- The summary schema stays version 2 and gains no flaky field; report, JSON,
  CI and email bytes are otherwise unchanged. The history sidecar is the only
  data contract that changes, additively.
- The run-meta `N tagged @flaky` count stays tag-only; the Trends count can be
  larger (retried, untagged) or smaller (skipped/unexecuted tagged excluded).

## Impact

- Capability: `report-rendering`; the history sidecar contract (`cli-api`).
- Code: `src/history.ts`, `src/render/trends.ts`, `src/render/report.css`,
  `src/i18n/locales/*.json`.
- Tests/goldens: history, Trends unit/e2e/print, CLI `--history`.
- Docs: `docs/AGENT-INTERFACE.md` (Run history), `docs/ARCHITECTURE.md`,
  `DESIGN.md`, `docs/LIMITATIONS.md`, `GLOSSARY.md`/`docs/I18N.md`, README
  history, CHANGELOG, BACKLOG B-043 and the existing flaky entry.
- Host: Trends/report-shell change; the Seed-Test compat shim has no
  `--history`, so the Trends check uses the Playwright `5d2cdf0` artifact with a
  two-run tagged fixture; the Seed-Test report-shell row still applies.
- No dependency, summary-schema, CI or email change.
