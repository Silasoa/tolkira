# Proposal

## Why

Two content/search parity gaps remain: Gherkin descriptions are shown as raw
Markdown, and search lacks tag expressions plus shareable URL state. The
official formatter renders GFM and supports `@a and not @b` with `?query=` and
`?hide=` links. These are the last items needed for a credible full-parity
0.3.

## What Changes

- Render a safe GFM subset for feature, rule, background, scenario and examples
  descriptions: headings, emphasis, code, links, lists, tables and blockquotes.
  Raw HTML and images are not rendered; links are limited to http(s)/mailto.
- Support tag expressions in the search box (`and`, `or`, `not`, parentheses).
  A valid expression filters by tags; invalid input falls back to text search.
- Persist query, status filters and the tag selection in `?query=`, `?hide=`
  and `?tag=`; restore them on load and update them with `replaceState`.
- Keep the 20-match auto-open cap, counts and the JSON summary unchanged.
- No-JS reports keep the full static content; URL state and tag expressions are
  progressive enhancements.

Out of scope: G14 stream adapter, G15 parameter highlighting, themes, external
attachments, summary schema changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-rendering`: render safe GFM descriptions and add tag-expression
  search with URL state.

## Impact

- One runtime dependency: `markdown-it` with `html: false` and a custom
  link/image policy. Written reason: a safe GFM renderer is not worth
  hand-rolling and the package is small, maintained and server-side.
- `src/render/html.ts`, `src/render/report.css`, the inline search script,
  model description fields.
- Tests/fixtures: Markdown descriptions, tag expressions, URL state, XSS and
  browser/back-forward behavior.
- Docs: `docs/CHANGELOG.md`, `docs/CUCUMBER-COMPATIBILITY.md`,
  `docs/AGENT-INTERFACE.md` (HTML-only) and `GLOSSARY.md`.

## Review gate

PIR and DXR run before implementation; implementation is a TDD pair.
