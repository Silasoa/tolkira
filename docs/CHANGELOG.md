# Changelog

All notable changes to Tolkira are recorded here. The format follows
Keep a Changelog and the project uses semantic versioning.

## [Unreleased]

### Added

- In the Report view, features and scenarios with any non-passing status
  (including skipped and unknown) are listed first. The "Needs attention" index
  shows five features directly, up to fifteen more behind a disclosure, and up
  to three non-passing scenario links per feature. Details and the JSON summary
  keep their existing order.
- Feature rows show passed/total counts, non-passing counts and a proportion
  bar; the Details feature table is now a feature-by-status matrix with totals
  and durations.
- Feature and scenario anchors: opening a `#scenario-...` link expands the
  target and its ancestors. A compact source strip appears for multi-file runs
  with per-input status, counts and a bar; it is omitted when a URI or file
  name is ambiguous.

### Fixed

- `--logo` without `--out` now fails with a usage error instead of silently
  ignoring the logo file.
- Non-finite or negative Messages durations are clamped to zero in the JSON
  summary and the HTML report.
- Explicit empty Messages files report the same “Input is empty” diagnostic as
  empty files found by directory scanning.
- Merging two JUnit XML files keeps both features; each input gets its own ID
  namespace.
- Source provenance also checks pickle URIs and ignores inputs without features
  when detecting duplicate file names.

## [0.1.2] - 2026-11-04

### Fixed

- The `tolkira` bin now runs when npm installs it as a symlink on Linux and
  macOS; previously the main-module check compared the symlink path and the
  resolved module path and silently did nothing.
- The tag filter no longer overflows at 320 px with 200 % text zoom in Firefox
  and WebKit.
- JUnit numeric character references are decoded in names and messages.

## [0.1.1] - 2026-11-04

### Added

- Tag filter in the Report toolbar, combined with text search and status
  filters.
- Search highlighting via the CSS Custom Highlight API, with a safe fallback.
- “Copy failure” action on failed scenarios, including a clipboard fallback
  and polite confirmation.
- Visual report screenshots in CI, uploaded as the `playwright-visual`
  artifact for desktop light/dark, Details, lightbox, 390 px and 320 px text
  zoom.
- JUnit XML edge-case coverage: nested suites, skipped/error cases, system
  output, entities, CDATA, empty suites, missing attributes and malformed XML.
- Strict JUnit XML validation before parsing; malformed documents now fail with
  a file-specific error and a line/column when available.

### Changed

- README rewritten for users: plain language, AI-generation disclosure,
  accessibility notes, Seed-Test link and a shorter internal documentation
  section.
- CI runs on pushes to `main` and uses `actions/checkout@v7` and
  `actions/setup-node@v7`.
- Fixture toolchains are documented as container/CI jobs; no host installs.
- Documentation truth pass for JUnit, the compatibility shim, the comparison
  notes and the remaining-work list.

### Fixed

- JUnit `<failure>` and `<error>` elements without attributes are now marked
  failed; text-only, CDATA-only and self-closing failures no longer report a
  false green.
- JUnit XML rejects unknown or invalid entity references and reports a usable
  line/column for malformed documents.
- Search highlighting preserves offsets for case mappings that change string
  length.
- Clipboard failure now announces “Copy failed”, keeps keyboard focus and does
  not duplicate hook labels or leave an empty `Error:` line.

## [0.1.0] - 2026-11-04

### Added

- Initial repository scaffold: product context, architecture, glossary,
  governance, review protocol, ADRs and OpenSpec bootstrap change.
- Toolchain: TypeScript 7 strict, oxlint, Vitest 5, esbuild, Playwright, CI
  matrix for Node 22/24/26 and npm release workflow.
- Cucumber Messages input and single-file HTML rendering with the Tolkira
  shell.
- Legacy Cucumber JSON adapter with features, scenarios, steps, tags, hooks,
  outlines, doc strings, data tables, statuses, durations and embeddings.
- Screenshot/text attachment preservation and a safe HTML attachment check.
- CLI and API: multiple inputs, directory input, content-based detection, title
  and repeated metadata.
- Stable JSON summary (`--json`, `summarizeReport`, `generateReport`) with
  status counts, durations, attachments and per-scenario failures.
- Visible report shell with title, summary counts, metadata, optional logo and
  accent colour, and system dark mode.
- Simple default report plus optional Details tab; no React runtime.
- Report shell refresh: warm paper surface, hairline sections, monospace
  measurements, fixed thumbnail gutter in scenario rows, chevrons, search that
  opens matching features, empty state, an environment block in Details, and a
  screenshot lightbox with Escape/close support.
- Report CSS now lives in `src/render/report.css` and is generated into
  `src/render/styles.ts`; agents edit real CSS, not a JSON string.
- `tolkira/compat/cucumber-html-reporter` (experimental): old options object,
  warnings for unsupported options, recursive `jsonDir`, `ignoreBadJsonFile`.
- JUnit XML basic mode: suites, test cases, statuses, durations, failures and
  `system-out`/`system-err`; suites map to features, no Gherkin steps or
  screenshots.
- Cucumber compatibility fixtures: cucumber-js 2.3.1-13.3.0, Behave 1.3.3
  (seconds normalised), cucumber-jvm 7.22.1 and cucumber-ruby 12.0.1, including
  Messages fixtures for jvm and ruby. Ruby Messages exceptions now merge
  `exception.message` with the stack trace.
- Removed `@cucumber/html-formatter`; runtime dependencies are
  `@cucumber/messages` and, loaded only for XML input, `fast-xml-parser`.
- Type and text-relative spacing use `rem`; the report reflows at 200 % page
  zoom and doubles cleanly with the browser's text-size setting.
- Independent production A11Y/UX pass: WebKit focus restoration and tabpanel
  entry, focusable table scroll regions, step status glyphs, search that opens
  matched scenarios, grouped Details environment/metadata, lightbox scroll lock,
  and 320 px text-zoom reflow without clipped content.
- Expand-all / collapse-all controls, automatic screenshot disclosure, and
  accessible status labels, permalinks, main landmark and live filter counts.
- Seed-Test comparison harness, screenshots and offline comparison.
- Escaped title/metadata/names, metadata bar, offline/no-CDN check.
- Restrictive CSP, remote attachment rejection, remote Markdown image
  stripping, atomic output writes and a 10 MB size warning.
- Fixtures for Messages (passing and failing), legacy JSON,
  failed/pending/undefined/skipped statuses, screenshots and HTML attachments.
- Unit and Playwright browser tests, including search and an HTML attachment
  execution check.

### Known gaps

- User-supplied custom CSS, external attachment mode, real Behave
  attachments/doc strings, and a broader edge-case matrix.
