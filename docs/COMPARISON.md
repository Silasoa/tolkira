# Seed-Test report comparison

This is a visual and functional comparison between the older
`cucumber-html-reporter@7.2.0` (bootstrap theme) and Tolkira, using the Seed-Test
report options and equivalent scenario, story and group inputs.

**Scope (verified 2026-11-27 for the 0.7 Incident review shell).** This page
compares the report shell and migration content only; `--static`, history and
`--baseline` are not compared here (see [`README.md`](../README.md),
[`CI.md`](CI.md) and [`AGENT-INTERFACE.md`](AGENT-INTERFACE.md)).

## Method

- Seed-Test source: [`adessoSE/Seed-Test`](https://github.com/adessoSE/Seed-Test)
  v1.8.1.
- Report options copied from `backend/src/helpers/reporting.ts`: metadata
  `App Version`, `Test Environment`, `Parallel`, `Executed`; the same report
  titles are used.
- The Seed-Test application itself needs MongoDB, a browser runner and its full
  stack. The comparison therefore exercises the same three report modes with
  equivalent Cucumber inputs: one scenario (`minimal`), one story (`happy`) and
  a group (`happy` + `unhappy` + `minimal`).
- Old reporter: `cucumber-html-reporter@7.2.0`, `theme: bootstrap`.
- Tolkira: 0.7 Incident review shell (development snapshot), simple report
  shell, no external assets; the scope note above applies. Raster provenance is
  in [`comparison/PROVENANCE.md`](comparison/PROVENANCE.md).

## Screenshots

Overview: `overview.png` is the 0.6-era composite and is not part of this 0.7
comparison; the table below shows the current shell.
All images are in [`docs/comparison/`](comparison/).

| Mode | Old reporter | Tolkira |
| --- | --- | --- |
| Scenario, expanded | [`old-scenario-expanded.png`](comparison/old-scenario-expanded.png) | [`new-shell-scenario-expanded.png`](comparison/new-shell-scenario-expanded.png) |
| Story, expanded | [`old-story-expanded.png`](comparison/old-story-expanded.png) | [`new-shell-story-expanded.png`](comparison/new-shell-story-expanded.png) |
| Group, expanded | [`old-group-expanded.png`](comparison/old-group-expanded.png) | [`new-shell-group-expanded.png`](comparison/new-shell-group-expanded.png) |
| Failed story, expanded | [`old-failed-expanded.png`](comparison/old-failed-expanded.png) | [`new-shell-failed-expanded.png`](comparison/new-shell-failed-expanded.png) |
| Screenshot attachment (incident panel) | [`old-screenshot-expanded.png`](comparison/old-screenshot-expanded.png) | [`new-shell-screenshot-expanded.png`](comparison/new-shell-screenshot-expanded.png) |
| Offline, story | [`old-story-offline.png`](comparison/old-story-offline.png) | [`new-shell-story-offline.png`](comparison/new-shell-story-offline.png) |

## What works

- Scenario, story and group inputs all render one report.
- Legacy cucumber-js JSON is accepted directly; Messages is accepted too.
- Screenshots survive; image attachments open automatically and `Expand all`
  also opens them.
- Failed steps show the assertion message; pending, undefined and skipped
  statuses are visible.
- Search, status filters, tags, doc strings, data tables, hooks and metadata are
  rendered.
- `Expand all` / `Collapse all` provide the same quick navigation as the old
  reporter.
- The report is fully offline. The old bootstrap report loads Bootstrap,
  jQuery, Moment and Google Charts from CDNs and loses its layout and charts
  offline.
- Tolkira's shell is server-rendered; it does not embed React or the upstream
  formatter.

## Sizes and performance

- Old story report: about 100 kB, but with four remote dependencies.
- Tolkira story report: one HTML file with CSS and script inline and no
  network dependency. The stylesheet source is 52,032 B; every report embeds
  its 45,270 B minified form.
- Tolkira stress run (`npm run stress -- <count>`):
  - 1,000 scenarios / 3,000 steps: about 0.22 s, 1.4 MB HTML.
  - 5,000 scenarios / 15,000 steps: about 0.42 s, 6.9 MB HTML.
- The 10 MB warning is expected for very large groups; external attachments
  remain a follow-up.

## cucumber-html-reporter issue themes

The old reporter's open issues were used as a checklist. Covered by Tolkira
today:

- offline styles and CDN dependencies (fixed: hashed inline assets);
- `<`/`>` and HTML escaping in names, tags, doc strings and errors;
- NDJSON/Messages input and merged groups;
- screenshots inline, multiple attachments, short generated file names;
- total duration, summary counts, tags, data tables and search;
- large inputs (100 MB total cap, attachment caps, 1k/5k stress runs);
- report size warnings and a single-file artifact;
- custom title, metadata, logo and accent;
- passing and failing after-hooks are mapped as test steps;
- skipped, pending, undefined and ambiguous statuses.

Still open or intentionally deferred:

- themes (`bootstrap`, `hierarchy`, `foundation`, `simple`) and column layouts;
- per-scenario absolute timestamps (relative time remains);
- legacy outline `examples` reconstruction;
- Rule structure from legacy JSON (the format does not carry it; Messages
  reports show Rule names);
- hide/show hooks and feature-level embeddings;
- external screenshot directories and lazy loading of external image files;
- full Seed-Test stack with MongoDB and live browser execution.

## Remaining parity gaps

- Old themes: `bootstrap`, `hierarchy`, `foundation`, `simple`. Tolkira has one
  accessible modern theme with an accent colour and logo.
- External screenshot directories (`storeScreenshots`) and lazy loading of
  external image files are not implemented; Tolkira stays single-file. Scenario
  thumbnails already use `loading="lazy"`.
- Column layout and feature-vs-scenario header counts are not configurable.
- Relative time is shown; per-scenario absolute timestamps are not configurable.
- Legacy outline `examples` are expanded rows, not reconstructed.
- Rule structure from legacy JSON is not available in that format; Messages
  reports show the Rule name.
- The full Seed-Test stack (MongoDB, browser execution and issue-tracker
  comments) was not run for this comparison.
