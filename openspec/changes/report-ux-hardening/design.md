# Design

## Tag filter

Render a labelled `<select data-tag-filter>` in the toolbar when the report has
at least one tag. The first option is "All tags"; the rest are unique scenario
tags, sorted alphabetically. The filter is combined with the existing query and
status filters in `apply()`:

```
match = !hidden.has(status) && queryMatches && tagMatches
```

The live-region count and empty state stay the source of truth. A feature opens
when it contains a match, but scenarios are not force-opened for a tag-only
filter; the tag is already visible in the scenario summary.

## Search highlight

Use the CSS Custom Highlight API:

- collect text-node ranges inside visible scenario content for queries of two
  characters or more;
- cap ranges to avoid pathological search strings;
- register them as `CSS.highlights` under `tolkira-search`;
- clear the registry when the query is empty;
- do nothing when `Highlight` or `CSS.highlights` is unavailable.

The visual style is a `::highlight(tolkira-search)` rule with an accent
background and readable foreground. No DOM mutation is needed, so existing
disclosure, copy and filter behaviour stays intact.

## Copy failure

Failed scenarios get a small "Copy failure" button in the expanded detail. The
handler finds the first step whose `data-status` is `failed`, then copies:

```
Feature: <name>
Scenario: <name>
URI: <uri>
Step: <keyword> <text>
Error:
<message>
```

`navigator.clipboard.writeText` is used first; a temporary textarea plus
`document.execCommand('copy')` is the fallback. On success the label changes to
"Copied" for two seconds and a polite live region announces it. The button is
not rendered for non-failed scenarios.

## CI visual artifacts

A new `test/e2e/visual.spec.ts` renders a mixed report and captures screenshots
for desktop light, desktop dark, Details, lightbox, 390 px and 320 px text zoom
with `testInfo.outputPath`. These are review artifacts, not pixel baselines.

The e2e job uploads `test-results/` with `actions/upload-artifact@v7` under
`playwright-visual`, `if: always()`, 14-day retention. Pixel baselines can be
added later once the shell is stable.

## JUnit hardening

Add fixtures under `test/fixtures/junit/` for nested suites, skipped and error
cases, `system-out`/`system-err`, XML entities and CDATA, empty suites, missing
optional attributes and malformed XML. The tests use the public
`summarizeReport`/`renderReport` API, not adapter internals, so they describe
behaviour rather than implementation.

## Docs truth pass

Update the README for users (plain language, AI disclosure, accessibility,
Seed-Test link), and remove stale "planned/missing" statements from
`PRODUCT.md`, `COMPATIBILITY.md`, `COMPARISON.md` and
`docs/research/open-questions.md`.
