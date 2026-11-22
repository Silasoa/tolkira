# report-css-minify

## Why

The one-file report embeds the full stylesheet. The audit measured the
unminified `REPORT_CSS` at about 46 KB and found a safe ~6 KB (13 %) win from
CSS minification. Report size is a product requirement, especially for small
suites where the fixed stylesheet dominates. The source `report.css` stays
readable; only the generated string changes.

## What Changes

- `scripts/build-styles.mjs` minifies the stylesheet with the existing esbuild
  dev dependency before writing `src/render/styles.ts`.
- `report.css` remains the source of truth; no runtime minifier, new dependency
  or CDN. Layout, classes, print rules and the client bundle are unchanged.
- Goldens, characterization hashes and byte-size expectations are refreshed;
  the browser gate verifies 320/1440 and print.
- No schema, CLI, locale or dependency change.

## Impact

- Capability: `performance`.
- Code: `scripts/build-styles.mjs`, generated `src/render/styles.ts`.
- Tests: a stylesheet-size/shape test, goldens, e2e/print.
- Host: report-shell change; re-run the Playwright 1440/390 row.
- No remote issue exists; the trigger is the measured 0.5 audit.

## Non-goals

- Minifying the client JS, search data or HTML.
- Splitting assets, changing the one-file rule or adding a build-time CSS
  framework.
- A source map or readable in-report CSS.
