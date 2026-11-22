# TDD-Red: report-css-minify

Command: `npx vitest run test/styles.test.ts test/dom-contract.test.ts test/render-print.test.ts`

Result: 3 files, 4 failed / 21 passed.

## Intended RED

1. `styles > is the minified source stylesheet`
   `AssertionError: expected ':root {\n  color-scheme: light;…' to be ':root{color-scheme:light;…'`
   `styles.ts` is still generated from the raw source. The spec requires the
   esbuild-minified form (`transformSync(..., { minify: true }).code.trimEnd()`).

2. `styles > is non-empty and smaller than its source`
   `AssertionError: expected 46015 to be less than 46015`
   No minification yet. The expected esbuild output is 40,010 bytes.

3. `dom-contract > colours pressed chips through the attribute the toolbar renders`
   Same raw-vs-minified equality failure. Its selector checks against
   `report.css` still pass; only the removed raw-equality guard is RED.

These are correct: the approved design makes the build emit minified CSS, and
the two guards assert exactly that build shape.

The adapted print assertions pass on raw CSS: `declaration()` no longer requires
a trailing `;`, the dark-mode query is whitespace-tolerant, and widths (13 %,
20 %, 14 %, 6.625 %) plus `7pt` use regexes. Verified against the esbuild output
through a temporary module alias: 24/25 pass, only the unrelated test below
fails. Temporary alias config removed.

## Unrelated RED

`render-print > keeps the skipped-attachment list styled and visible in print`
fails because `.attachmentSkipList` is absent from `report.css`. It belongs to
the in-flight `attachment-skip-reasons` change and was not touched.

Goldens and characterization hashes were not changed.
