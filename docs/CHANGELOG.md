# Changelog

All notable changes to Tolkira are recorded here. The format follows
Keep a Changelog and the project uses semantic versioning.

## [Unreleased]

### Added

- `CucumberHtmlStream` is a Node `Transform` over Cucumber Messages envelopes.
  It collects envelopes and emits the same HTML as `renderReport` on flush,
  with the same title, metadata, logo and accent options. It writes no files
  and emits no summary.
- Matched step parameters render inside `span.param` with their Cucumber
  parameter type from `stepMatchArgumentsLists`; all fragments are escaped.
  Steps without exactly one match list, or with invalid/overlapping ranges,
  keep the plain escaped text. Search, copy and the JSON summary are unchanged.
- JUnit XML producer fixtures for jest-junit, pytest and Gradle, with recorded
  provenance and coverage for suites, test cases, failures, errors, skipped
  cases and testcase-level `system-out`/`system-err`. The adapter is unchanged;
  the fixtures characterise its existing behaviour.
- Feature, rule, background, scenario and examples descriptions render a safe
  GFM subset through `markdown-it`: headings, emphasis, code, links, lists,
  tables and blockquotes. Raw HTML stays escaped, links are limited to
  http(s)/mailto with `rel="noopener noreferrer nofollow"`, and images render
  as alt text only without a network request. Descriptions use a block
  container, headings stay within the report hierarchy (`h3`/`h4`), and tables
  use the focusable scroll region. JUnit `description` attributes are read as
  best-effort feature and scenario descriptions.
- Search accepts official Cucumber tag expressions (`and`, `or`, `not`,
  parentheses and escaped tags) through `@cucumber/tag-expressions`. A valid
  tag-shaped query filters by tags; mixed text/tags and invalid expressions fall
  back to substring search. Status filters and the tag dropdown combine with a
  valid expression using AND, and the 20-newly-opened cap applies to the final
  visible set.
- Search and filters persist in `?query=`, repeated lowercase `?hide=` and
  `?tag=`. A report restores them on load, synchronises the search box, status
  buttons and tag select, and updates the URL with `replaceState` while
  preserving the hash and unrelated parameters. `file://` and blocked
  `replaceState` keep filtering functional. Clearing the tag dropdown always
  applies immediately.
- `require('tolkira/compat/cucumber-html-reporter')` now works from CommonJS.
  A tracked `.cts` wrapper emits `.cjs` plus `.d.cts` declarations, dynamically
  imports the ESM shim and forwards `generate(options, callback?)` without a
  default export. The declarations export `CucumberHtmlReporterOptions` and
  `CompatResult`. Callback-only callers no longer leave an unhandled rejection
  when generation fails. The core, CLI and package root stay ESM-only.
- Messages `meta.ci` renders the CI name (or the URL when the name is absent)
  and http(s) job link, plus the git revision, branch and tag when present. A
  safe http(s), scp-like or `ssh://` GitHub remote links the 7-character commit
  to the full revision; other remotes and schemes keep the short revision as
  plain text. The first non-empty CI block wins in a mixed run, and
  legacy-synthesized meta cannot erase it. CI metadata is HTML-only and the
  summary stays schema version 2.
- Unnamed attachments use a deterministic `attachment.<ext>` fallback across
  Messages and legacy JSON. Known parameterised media types keep their
  extension; unknown types become `attachment`. JSON attachments are
  pretty-printed and escaped without losing big numbers or duplicate keys,
  `text/uri-list` entries link only for http(s), and
  `text/x.cucumber.log+plain` logs render theme-aware SGR, 256-colour and
  truecolour output with a copy action. JSON and logs above 262,144 UTF-8
  bytes fall back to escaped text without parsing; non-SGR control sequences
  and bidi controls are stripped.
- Messages rules render as sections with their keyword, name, description and
  tags, ordered by severity without moving scenarios across rule boundaries.
  Rule tags render once on the section; feature tags render once in the feature
  header. Standalone scenario rows show only their own tags; grouped example
  rows repeat neither outline nor examples tags. Inherited tags stay in the tag
  filter and search. A rule section hides when a filter leaves no
  visible scenario.
- Messages feature and rule backgrounds render their keyword, name and
  description once when either is present. Background steps stay in their
  scenario step lists and are not duplicated. Legacy normalisation marks its
  synthetic background, so legacy JSON never invents rule or background
  structure.
- Compatibility Kit fixtures for `rules`, `backgrounds` and
  `rules-backgrounds`, plus local tag and rule/outline/background compositions.
- Messages scenario outlines are grouped under one outline section with their
  examples blocks. Executed examples are numbered `#1.1`, `#1.2`, `#2.1` and
  keep their own outcome, attachments and anchor. The triage index and copied
  failures include the example number and examples block name.
- Legacy Cucumber JSON arrives with expanded examples and stays flat. Messages
  outlines without examples also stay flat as a deliberate fallback.
- Per-scenario hooks are shown separately from steps, with names, status,
  duration, errors and attachments. Passed hooks are collapsed; failed and
  skipped hooks stay visible.
- BeforeAll/AfterAll test-run hooks get a Hooks section below the feature list,
  with status, duration, errors and attachments.
- Messages undefined steps show "No step definition found." with every
  suggestion snippet, escaped as code and labelled with its language.
  Ambiguous steps show "Multiple matching step definitions found:" with the
  matching patterns and report-relative `uri:line` source references. The lead
  is shown even without suggestion or definition envelopes; diagnostics render
  only for undefined and ambiguous steps and are searchable.
- Executed features and scenarios whose status is not `passed` (undefined,
  ambiguous, pending, skipped, unknown) open by default. Passed scenarios stay
  collapsed unless they carry an image. Unexecuted rows stay collapsed and show
  no outcome; an all-unexecuted feature opens, while a mixed feature opens only
  for an executed non-passed or image scenario. The search cap still opens at
  most 20 rows, now counting only rows the search newly opens.
- The JSON summary gains optional `suggestions` and `definitions` fields on
  summary steps for undefined and ambiguous Messages steps. The fields are
  additive on top of the version-2 summary.
- Compatibility Kit fixtures for `undefined`, `undefined-multiple`,
  `ambiguous`, `all-statuses` and `empty`, plus a `non-passed` stress mode for
  1,000 auto-opened scenarios.
- Legacy JSON and JUnit keep status-only behaviour: undefined and ambiguous
  legacy steps show the lead but never invented snippets or definitions, and
  JUnit renders no diagnostics.

### Changed

- Test fixtures resolve through `test/fixtures.ts` helpers; the browser specs
  no longer repeat `fileURLToPath(new URL(...))` fixture constants.
- Empty and unexecuted scenarios now match the official formatter. A scenario
  whose selected test case started with zero raw step results, including a
  started-but-unfinished case, renders as an unexecuted row without an outcome
  and leaves the header, feature row and bar, triage index, source strip and
  Details matrix. Attachments emitted for an unexecuted attempt are dropped from
  the HTML and summary counts. Never-started pickles stay pruned. An
  all-unexecuted feature gets status `unknown`, stays visible and opens while
  its rows stay collapsed. The header reports executed `passed / total`, so an
  empty run shows `0 / 0`.
- **Breaking:** the JSON summary schema is version 2. Every scenario carries
  `executed`; scenario counts cover executed scenarios only, so
  `counts.scenarios.total` can be smaller than `scenarios.length`. Unexecuted
  entries keep `status: "unknown"` and add `executed: false`. The overall status
  ignores unexecuted scenarios. Legacy Cucumber JSON scenarios with no steps and
  no hooks are now unexecuted, so their scenario totals drop by one compared
  with version 1; legacy steps without a result and JUnit test cases remain
  executed.

## [0.2.0] - 2026-11-10

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
  target and its ancestors, moves focus to the target summary, and scrolls it
  into view. A compact source strip appears for multi-file runs with per-input
  status, counts and a bar; it is omitted when a URI or file name is ambiguous.
- On viewports of 560 px or narrower the triage index collapses to a one-line
  summary and the source strip hides; the per-feature source badge remains.
- The run header shows the total duration, and each triage row names the first
  failing step with a truncated error excerpt.
- Search opens at most 20 matching scenarios at once and closes them when the
  query is cleared; failure text in the search index is capped per step.

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
- Large legacy feature files no longer hit the argument limit when expanding
  scenario envelopes.

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
