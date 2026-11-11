# Proposal

## Why

Two second-tier gaps still keep Tolkira from feeling like the official
formatter: Messages `meta.ci` is ignored, and attachment presentation is
plainer than the official report. CI users lose the job/commit link; JSON and
URI-list attachments are less useful than they could be; Cucumber ANSI logs
render as plain text.

This is a small drop-in polish slice after the top-tier parity work.

## What Changes

- Read `meta.ci.name/url` and `meta.ci.git.revision/branch/tag` and show a CI
  link, short revision, branch and tag in the header and Details.
- Attachment naming falls back to `attachment.<extension>` when Cucumber gives
  no file name, with a deterministic extension for common media types.
- `application/json` attachments are pretty-printed and escaped.
- `text/uri-list` attachments render as safe links.
- `text/x.cucumber.log+plain` renders ANSI colours with a copy action, without
  executing terminal control sequences.
- All attachments stay inline, escaped and offline; remote URLs remain
  rejected.
- Counts and the JSON summary keep their current shape.

Out of scope: external attachments/split assets (G13), Markdown (G8),
tag-expression search/URL state (G10), themes, stream adapter and parameter
highlighting.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-rendering`: show CI metadata and improve attachment naming/JSON/
  URI-list/ANSI presentation without weakening the offline baseline.

## Impact

- `src/report/model.ts`: CI metadata and attachment helpers.
- `src/render/html.ts`, `src/render/report.css`: header/Details CI rows,
  attachment renderers, ANSI log styling.
- Tests/fixtures: Messages `meta.ci`, JSON, URI-list and ANSI log fixtures;
  browser and security tests.
- Docs: `docs/CHANGELOG.md`, `docs/CUCUMBER-COMPATIBILITY.md`,
  `docs/AGENT-INTERFACE.md` (CI metadata is HTML-only) and `GLOSSARY.md`.

## Review gate

PIR and DXR run before implementation. Implementation is a TDD pair: a
TDD-Red worker writes failing acceptance/ISTQB tests, then an implementer makes
them green without weakening them.
