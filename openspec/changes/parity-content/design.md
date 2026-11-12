# Design

## Context

See `proposal.md`. Descriptions are currently escaped plain text. Search is a
substring over `data-search`; status filters and the tag dropdown are in-memory
only. The report is server-rendered with one inline script.

## Goals / Non-Goals

**Goals:**

- Safe GFM descriptions everywhere.
- Tag-expression search and URL state without changing counts/summary.
- Keep the no-JS static report and the 20-match cap.

**Non-Goals:**

- G14/G15, themes, external attachments, summary schema changes, a client-side
  search index.

## Decisions

### Safe Markdown with `markdown-it`

Add `markdown-it` as a server-side dependency with `html: false`,
`linkify: false`, `typographer: false`. Disable the image rule; validate link
targets against http(s)/mailto; render the result inside the existing
description elements. Escape any raw text that Markdown leaves untouched.
Feature/rule/background/scenario/examples descriptions all use one helper.

Written reason: a safe GFM subset is not worth hand-rolling; `markdown-it` is
small, maintained and server-side, and raw HTML stays disabled.

### Tag-expression parser in the inline script

Support tags, `and`, `or`, `not` and parentheses. Tokenize, build a small AST
and evaluate it against the row's tag set. If parsing fails, fall back to
substring search; do not show an error. Keep the existing status/tag filters
combined with the expression. The 20-match cap applies to the final visible set.

### URL state

On load, read `query`, repeated `hide`, and `tag` from `URLSearchParams` and
apply them after the script initializes. On changes, write with
`history.replaceState` so typing does not flood history; listen to `popstate`
for back/forward. Do not persist the search-open state.

### Contracts

Counts and the summary are unchanged. Markdown is HTML-only. Tag expressions
and URL state are progressive enhancements; the static report stays readable
without JavaScript.

## Risks / Trade-offs

- **Markdown XSS** → `html:false`, no images, link allowlist, tests.
- **Tag grammar edge cases** → parser tests and substring fallback.
- **URL state drift** → one serializer/parser helper and browser tests.
- **Search cap** → apply after tag/text/status/tag-filter combination.
- **Dependency** → one server-side package with a written reason.

## Migration Plan

No schema/CLI/API change. HTML output changes for Markdown descriptions and
URL-driven views.

## Open Questions

None.
