# TDD-Red handoff

## Contracts the Red tests define

- `src/render/search.ts` exports `isTagExpression(query)` and
  `evaluateTagExpression(query, tags)`. The evaluator returns `undefined` for a
  non-tag-shaped or invalid expression so the inline script falls back to
  substring search; it returns a boolean for a valid expression.
- Description tables use the existing `.tableWrap` scroll region with
  `tabindex="0"` and `role="region"`.
- Description heading cap: Markdown level 1 renders as `h3`; levels 2-6 render
  as `h4`. This keeps headings inside the report hierarchy and never emits
  `h1`, `h2`, `h5` or `h6` from a description.
- URL restore reads `query`, every repeated lowercase `hide` value and `tag`,
  synchronizes the search input, status buttons and tag select, and leaves
  unrelated parameters and the hash untouched.

## Resolved: JUnit descriptions

JUnit XML has no standard description field. The coordinator approved the
best-effort mapping: `description` attributes on `<testsuite>` and `<testcase>`
become feature and scenario descriptions. The adapter reads them and
`docs/JUNIT-XML.md` documents the non-standard attribute.

## Resolved: image sanitizer conflict

The Markdown image renderer owns inline, reference and linked images and emits
alt text only. `src/input/sanitize.ts` still neutralises remote image
destinations, but keeps the image syntax and alt text for the renderer; linked
images lose the anchor instead of falling through as links.

## Size baseline

See `size.md`. The tag-expression IIFE is expected to add about 3.3 KB
uncompressed / 1.2 KB gzip per report. `markdown-it` stays server-side.
