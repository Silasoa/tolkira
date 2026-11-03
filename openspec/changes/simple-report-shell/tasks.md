# Tasks

## 1. View model

- [x] 1.1 RED: model test for feature/scenario/step statuses, durations, tags,
  doc strings, tables, errors and attachments.
- [x] 1.2 GREEN: build `ReportModel` from Messages, latest attempt per scenario.
- [x] 1.3 RED/GREEN: attachment rendering metadata: image/video data URI, text,
  HTML-as-text and binary fallback.

## 2. Simple renderer

- [x] 2.1 RED: render test for title, summary counts, features, scenarios and
  failed-first open state.
- [x] 2.2 GREEN: server-render the Report tab with inline CSS and no React.
- [x] 2.3 RED/GREEN: analysis tab with feature table, status distribution,
  metadata and JSON summary.
- [x] 2.4 RED/GREEN: search, status filters, expand/collapse and tab switching
  in the embedded script.

## 3. Security and accessibility

- [x] 3.1 RED/GREEN: escaped titles, metadata, tags, names, errors and
  attachment names.
- [x] 3.2 RED/GREEN: HTML attachment shown as text; no script execution.
- [x] 3.3 RED/GREEN: CSP hashes, no remote URLs, dark mode and reduced motion.
- [x] 3.4 Browser test: keyboard tab switching, filters, disclosures and
  screenshots.

## 4. Compatibility and release gate

- [x] 4.1 Update unit and browser tests; remove the formatter dependency.
- [x] 4.2 Verify legacy JSON and Messages reports, groups and fixtures.
- [x] 4.3 Run `npm run check`, `npm run test:e2e` (Chromium/Firefox/WebKit),
  `npm run stress -- 1000` and `openspec validate simple-report-shell --strict`.
- [x] 4.4 Refresh Seed-Test comparison screenshots with the new shell.
