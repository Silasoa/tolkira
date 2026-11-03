# Design

## Decision

Render the report from a Tolkira-owned view model instead of the upstream
`CucumberHtmlStream`. This removes the runtime bundle, gives full control over
the information hierarchy and keeps the output small and offline.

## View model

`src/report/model.ts` builds a `ReportModel` from Messages:

- features, scenarios, steps, tags and descriptions;
- latest attempt per scenario, status and duration;
- step doc strings, data tables, errors and attachments;
- attachment bodies as data URIs or decoded text;
- run start/end, counts and feature summaries.

The view model is internal. The existing `summary.ts` remains the
machine-readable contract and is not coupled to the HTML shape.

## Rendering

`src/render/html.ts` renders the model server-side into one HTML file:

- default Report tab: title, run metadata, pass-rate health panel, search,
  status filters, feature disclosures and failed-first scenario details;
- Analysis tab: feature table, status distribution, metadata and agent summary;
- inline CSS and a small vanilla script for tabs, search, filters and
  expand/collapse;
- hash-based CSP and no external assets.

No React. The HTML is the artifact; the JSON summary remains the agent
interface.

## Security

All text is escaped. HTML/SVG attachments are never inserted as markup:
images and videos use data URIs, text is shown in a `<pre>`, binary content is a
download link. Remote attachments remain rejected in `sanitizeEnvelopes`.

## Compatibility

The CLI, API, input adapters, summary schema, single-file promise and
`--title`/`--meta`/`--logo`/`--accent` options stay unchanged. Old reporter
themes and external screenshot mode are intentionally excluded.
