# Proposal

## Why

The parity research (`docs/research/parity-2026-11.md`, section 4) finds no P0
and leaves one report gap worth a 0.7 feature: cucumber-reporting has a tag
overview with counts, while Tolkira offers only a tag dropdown and a
tag-expression search. A reader can filter by `@smoke` but cannot see that
`@smoke` holds 40 scenarios of which 6 fail. The old reporter and MCHR have no
summary either, so a small server-rendered table closes the cucumber-reporting
gap without copying its tag pages; the official React formatter has tag
filtering only, no count overview.

The bundle's other two parity items were verified as already delivered on
2026-11-26:

- An absolute per-scenario start time renders in the scenario detail
  (`src/render/report.ts`, `report.startedMeta`) as `2026-11-26 09:30 UTC` in
  English and `26.11.2026, 09:30 UTC` in German, fed by the Messages
  `testCaseStarted.timestamp` and Playwright start times. Legacy JSON and JUnit
  ship no per-scenario timestamp; nothing is synthesized.
- Messages `testCaseStarted` attempts already project into the collapsed
  `Earlier attempts` block (`d5fdebe`, `test/messages-retry-evidence.test.ts`)
  while final-attempt counts and the summary stay unchanged.

Both are recorded as resolved in `docs/BACKLOG.md` (B-060, B-061).

## What Changes

- Add a server-rendered tag overview to the Details view: one row per tag with
  the executed scenario, failed and skipped counts, sorted by failed count then
  scenario count and capped at 50 rows with a complete-tag-count note.
- Count executed scenario rows, matching the report's other counts; inherited
  feature, rule and examples tags count the row once. A tag only on unexecuted
  rows renders with zeros, so the existing tag filter keeps its tag set and
  behaviour.
- Add the catalog keys in English and German, the table styles, unit and
  browser tests, and the design-system row.
- Render the table in the default, static and print forms; it does not react to
  the toolbar filter.

Out of scope: no summary or history schema change, no client-script change, no
tag drill-down or tag pages, no per-tag timing, no tag crossing into the
`--json`, CI, email or manifest output, no legacy/JUnit timestamp synthesis.

## Capabilities

### Modified Capabilities

- `report-rendering`: the Details view gains a tag overview with scenario,
  failed and skipped counts.

## Impact

Affected: `src/render/tags.ts` (new), `src/render/details.ts`,
`src/render/html.ts` (conditional CSS injection), the English and German
catalogs, `DESIGN.md`, `docs/CHANGELOG.md`, `docs/BACKLOG.md`, the
report-rendering delta, plus `test/render-tags.test.ts` and
`test/e2e/tags.spec.ts`. Tagged reports grow by the table and its conditional
CSS; untagged reports and the JSON/CI/email bytes stay unchanged. There is no
version bump: the package stays 0.6.1 until the 0.7.0 release; no release, tag
or publish is part of this change.
