# ADR 0006 — Keep attachments inside the single HTML file

## Status

Accepted for the external-assets decision (#11).

## Context

Reports embed screenshots, videos, logs and files. Large media (videos, traces)
can push a report past practical sharing or CI-artifact limits. Three options
were on the table: keep rejecting remote URLs; add an explicit split-assets mode
(HTML plus an assets folder); or support only local external files with warnings.

The one-file/offline promise is the product's core. A second output mode would
need a manifest, relative-path validation, CI artifact handling and a second
shareability story. Native Playwright uses a report folder, but that is
deliberately out of scope, and trace viewer/replay is not a Tolkira feature.

## Decision

- Keep the default and only report output a single self-contained HTML file with
  inline attachments. The opt-in `--email <file>` adds one separate mail body
  (see [`../EMAIL.md`](../EMAIL.md)); it is not a linked-assets or split-assets
  mode and does not change the report default.
- Keep rejecting remote URLs, `file:`, UNC/device paths and paths outside the
  allowed roots; keep the skipped-attachment notice and the size warning.
- Do not add a split-assets mode, a CDN default or a linked-assets manifest.
- Keep the 50 MB per-attachment and 100 MB total attachment caps; the 10 MB
  report-size warning stays.
- Revisit only when a user cannot share a report because of media size or a CI
  artifact limit, and only as an explicit opt-in mode with a folder output, a
  manifest, offline validation, no remote defaults and a clear "not one file"
  warning. That revisit needs a new ADR.

## Consequences

- Reports remain portable, offline and a single attachment.
- The opt-in email summary is a second, explicitly requested file; without
  `--email` the report is still the only output.
- Very large media stays out; users compress images and clips or attach them
  separately to the ticket.
- Trace viewer and HTML-report replay remain out of scope.
- The skipped-attachment notice and the size warning are the honest guardrails
  instead of an unspoken second mode.
