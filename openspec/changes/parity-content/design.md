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
`linkify: false`, `typographer: false`, `breaks: true`. Replace the `<p
class="description">` wrappers with block `<div class="description">` and
remove `white-space: pre-line`; cap headings (level 1 renders as `h3`, levels
2-6 as `h4`) and let tables scroll in the existing `.tableWrap` region.
Validate link targets against http(s)/mailto with
`rel="noopener noreferrer nofollow"`. The Markdown image renderer owns inline,
reference and linked images and emits alt text only. The sanitizer may still
neutralise remote image destinations, but no image path falls through to an
anchor. Feature/rule/background/scenario/examples descriptions all use one
helper.

JUnit has no standard description field. Best effort: read the non-standard
`description` attributes on `<testsuite>` and `<testcase>` as feature and
scenario descriptions. The mapping is documented in `docs/JUNIT-XML.md`; other
JUnit dialects without the attribute keep plain names.

Written reason: a safe GFM renderer is not worth hand-rolling; `markdown-it`
is small, maintained and server-side. The delivered packed size delta is
recorded in `size.md`.

### Tag-expression parser in the inline script

Use the official `@cucumber/tag-expressions` package. A small
`src/render/search.ts` entry exports the tag-shaped check and evaluator; esbuild
bundles it into an IIFE injected before the main inline script. Treat the whole
query as an expression only when it is tag-shaped; mixed text/tags stay text.
Invalid expressions fall back to substring search. Status filters and the tag
dropdown combine with a valid expression using AND. While an expression is
active, the tag dropdown stays pinned to its selected tag; clearing the search
releases the shortcut. The 20-newly-opened cap applies to the final visible
set.

### URL state

On load, read `query`, repeated lowercase `hide`, and `tag` from
`URLSearchParams`, apply them, and synchronize the search input, tag select and
status `aria-pressed` state. On changes, write with `history.replaceState` in a
try/catch, preserving the hash and unrelated parameters. Do not add history
entries per keystroke and do not persist the search-open state.

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
