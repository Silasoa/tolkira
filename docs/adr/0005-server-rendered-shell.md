# ADR 0005 — Server-rendered Tolkira shell

## Status

Accepted for the simple-report-shell change.

## Context

The first implementation wrapped `@cucumber/html-formatter`. It worked, but the
result looked like the upstream formatter with a header. It also shipped the
React runtime inside every report and made the simple case unnecessarily heavy
and visually constrained.

## Decision

- Build a Tolkira-owned `ReportModel` from Cucumber Messages.
- Render the model server-side into static HTML with a small vanilla script for
  tabs, search, status filters and disclosures.
- Keep the default report simple and single-column; put deeper analysis in an
  optional Analysis tab.
- Do not embed React or the official formatter. The only runtime dependency is
  `@cucumber/messages`.
- Keep HTML and SVG attachments inert and inline images, videos and text as
  before.

## Consequences

- Full control over layout, accessibility and the single-file promise.
- Much smaller reports (~44 kB for the Seed-Test story, ~1.4 MB for 1,000
  scenarios) and no React runtime.
- Tolkira owns the report rendering surface and must maintain the simple
  Gherkin/step presentation itself.
- A more advanced UI can grow in the Analysis tab without changing the input
  adapters or the JSON summary.
