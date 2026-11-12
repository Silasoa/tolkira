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

## Blocker: JUnit descriptions

JUnit XML has no standard description field. The fixture
`test/fixtures/junit/markdown-description.xml` uses `description` attributes on
`<testsuite>` and `<testcase>`; the Red test expects those to become the
feature and scenario descriptions. The current JUnit adapter drops them. The
coordinator must either approve that mapping (and the small adapter change) or
scope JUnit descriptions out and amend the spec. The task list and spec say
JUnit supplies descriptions, so the Red test asserts it.

## Image sanitizer conflict

`src/input/sanitize.ts` currently strips remote Markdown image syntax before
rendering. That leaves reference images as literal `![alt][ref]` text and can
turn a linked image into a normal anchor. The new custom image renderer must
emit alt text only for inline, reference and linked images; the sanitizer and
renderer need one owner for images so no image falls through to a link.

## Size baseline

See `size.md`. The tag-expression IIFE is expected to add about 3.3 KB
uncompressed / 1.2 KB gzip per report. `markdown-it` stays server-side.
