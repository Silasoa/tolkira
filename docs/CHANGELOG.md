# Changelog

All notable changes to Tolkira are recorded here. The format follows
Keep a Changelog and the project uses semantic versioning.

## [Unreleased]

### Added

- Flaky trends. The history sidecar gains an optional `flaky` count: executed,
  non-skipped scenarios tagged `@flaky` (any final status) or passed after at
  least one retry. Trends adds `Flaky` and `Flaky share` columns after the pass
  rate. Both show `—` when nothing was attempted or an old entry has no count,
  and a positive share below 0.1% shows a less-than boundary; a note states that
  the tag-or-retry share is a proxy, not a flake probability. A present value
  must be a whole number no greater than attempted. The field is part of the
  aggregate id, and the history schema stays 1. The summary schema, report
  header, JSON, CI, email, dependencies and one-file rule are unchanged; print
  keeps 7 pt with fixed column widths and wrapping headers.
- Azure DevOps CI output and publishing recipes. `--ci azure` emits capped,
  escaped Azure logging commands and a final count section, emits no
  `##vso[task.complete]`, and keeps exit 0; `type=error` may still mark the
  Azure step failed, so publish artifacts in a later
  `condition: succeededOrFailed()` step. `--ci-out` stays Markdown-only and
  `--json --ci azure` names the Markdown alternative. `docs/CI.md` adds Azure
  DevOps, Jenkins HTML Publisher (stock CSP and the download-the-artifact
  default) and sharded-report recipes. GitHub, Markdown, JSON and report bytes
  are unchanged; no dependency, schema or locale change.
- Report size diagnostics. The Details Run panel now names the unique processed
  report files and their bytes, decoded attachment bytes, the exact final report
  HTML bytes and the three largest attachments by decoded bytes; a note states
  that these rows are contributors, not a sum.
  `GeneratedReport` gains additive `inputFiles` and `inputBytes`, and the
  `--max-size` warning names the report HTML, input and decoded attachment
  sizes. Input bytes come from the loader groups, so duplicate-content files are
  not counted. The report-size row is solved from one document measurement with
  an empty-element marker, so it shows the exact UTF-8 byte length without a
  second serialization or a CSP change. New English/German catalog keys, a
  `.sizeList` style and `.gitattributes` fixture normalization ship with the
  change; the summary schema, CI text, email, `RenderReportOptions`, one-file
  rule and dependencies are unchanged. Goldens change intentionally.
- Metadata links. Safe absolute `http` or `https` metadata values render as
  links in the HTML report (and the print/PDF derived from it): the Report
  header and Details, with the normalized URL as `href` and the value trimmed
  and stripped of the report's bidi-control set (U+202A–202E, U+2066–2069) as
  the label. Other schemes, scheme-less or malformed URLs, plain text and values
  containing an internal tab, line feed or carriage return stay escaped text.
  The same rule applies to `--meta` and the compatibility shim's `metadata`
  object. The JSON summary, CI text, email, summary schema, locale catalogs and
  dependencies are unchanged.

## [0.4.0] - 2026-11-22

### Added

- JUnit XML nested-class split. When one `<testsuite>` has a nested-class shape
  — more than one distinct non-empty testcase `classname` plus a `$` classname
  or a dotted outer prefix — the report emits one feature per classname, named
  for the class alone with no suite prefix; a suite with one classname keeps its
  suite feature, and unclassed testcases stay in a suite-named feature.
  Classname-template suites, such as jest-junit's `"{classname} {title}"`, keep
  one suite feature instead of turning every test into a feature. Every testcase,
  status, duration and the source file is preserved, so Surefire's
  `Outer$Nested` class rows no longer fold into the outer feature. The JSON
  summary schema, CI and email surfaces and dependencies are unchanged; the
  feature total and `scenarios[].feature` names change.
- Legacy JSON hook output. A `before` or `after` hook with a non-null string or
  string-array `output` now renders a `text/plain` attachment named
  `Before hook output` or `After hook output`, with lines joined by `\n`. Null,
  empty strings/arrays and output on non-hook steps add none. The existing hook
  renderer shows it and the summary, CI and email attachment totals count it like
  any other attachment; there is no schema or locale change. This is better than
  cucumber-html-reporter 7.2.0, which ignores hook output, not a parity claim.
  The real 8.1.0 host fixture covers single-line outputs; the `\n` array join is
  covered by the synthetic hook-output test.

- Flaky visibility for `@flaky` scenarios. A scenario whose inherited tags
  include the lowercase `@flaky` tag shows a localized, decorative `flaky`
  badge in its summary row; when at least one exists, the run metadata adds a
  separate count such as `1 tagged @flaky`, distinct from the status counts. The
  badge uses the pending palette, wraps long labels, survives print and keeps
  the existing tag and status. The two new report catalog keys
  (`report.flakySummary`, `report.flakyBadge`) ship in English and German. The
  JSON summary, CI text, email, status model, counts, filters and dependency
  surface are unchanged, and there is no new schema field or flake-rate claim.

- Per-scenario skipped-attachment diagnostics for Playwright JSON. The final
  attempt carries the number of path attachments skipped outside the allowed
  roots, the report model copies a positive count to the scenario, and the
  scenario detail renders the existing `report.attachmentNotice` text with that
  count. The run-level count, shell notice and CLI warning stay; inline bodies,
  missing paths, trace zips, earlier attempts and synthetic error attempts do not
  count. The JSON summary, CI text, email and dependency surface are unchanged,
  and the existing locale keys are reused. Existing failed-hook attachment
  rendering stays and gains a regression test.

- Merged JSON sidecar for the `tolkira/compat/cucumber-html-reporter` shim. A
  `jsonDir` run without `jsonFile` writes the old reporter's merged legacy array
  to `<output>.json` after the HTML: features merge by `uri` (fallback
  `Feature: URI Not Present`), duplicate elements concatenate, every element
  gets `retried: 0` and the file uses two-space indentation. The write is
  atomic, creates missing parent directories and keeps input order; the old
  timestamp sort and filename-derived retry counter are not reproduced. A second
  run with the report and sidecar inside `jsonDir` excludes and replaces its own
  sidecar when every feature URI is represented by the other inputs. A file at
  that path that is not a valid feature array, or has a unique feature URI, is
  refused unchanged before the HTML is written. Sidecar runs preflight every
  input as a legacy feature array (an array of objects) before the report, with
  one leading UTF-8 BOM accepted; non-array, non-object or non-legacy content
  fails first with an error naming the file. `jsonFile` never writes a sidecar,
  and the core CLI/API, report bytes and dependency surface are unchanged.
- Opt-in HTML email summary (#13b). `--email <file>` writes one self-contained
  600 px table body from the stable summary: title and status, generation time,
  attempted pass rate as a percentage with a full-sentence note that skipped
  scenarios are not attempts, every non-zero scenario status plus unexecuted,
  the total as scenarios with results, feature/step/duration and
  inline-attachment totals, and the first five failed scenarios in summary
  order (feature, name, status and duration; further failures are a count). It
  composes with `--out`, `--json` and `--ci`/`--ci-out`, writes in the order
  report, email, history, `--ci-out`, stdout, and never changes the report, JSON
  or CI bytes. The email path is validated like an output and is written
  atomically; a write failure exits 1, names the email path, keeps the report and
  skips later outputs. `--locale` now also applies to the email and is accepted
  with `--email` without `--out`. The 17 `email.*` catalog keys ship in English
  and German. `renderEmail(summary, options)` is exported with title, locale,
  report name, validated accent and pinned `now`; there is no logo or image,
  script, link, hidden preheader or remote asset. The email names the report
  basename or states that no full report is attached, uses an inline system font
  stack, wraps long text and caps displayed names at 200 characters, labels the
  attachment count `Attachments in the run`, groups English digits
  (`8,509 bytes`) and renders human durations (`12 ms`, `12.3 s`, `1 min 5 s`,
  `1 h 2 min`). A standard summary stays under 100 KB, makes no request and is
  never sent by Tolkira. See [`docs/EMAIL.md`](EMAIL.md).
- Opt-in PDF export (#13c). `--pdf <file>`, `--pdf-timeout <ms>` and
  `renderPdf(html, options)` print the existing report print view through an
  optional Playwright Chromium engine: all present views and details,
  screenshots, the light palette, fitted tables, A4 portrait via
  `format: 'A4'`, 12 mm print CSS margins and no header, footer, URL or page
  number. The report HTML is loaded with `page.setContent` (no temporary file),
  lazy thumbnails are made eager, HTTP(S) subresources are aborted, fonts and
  images are awaited, the native `beforeprint` opens every detail, and an
  explicit five-minute deadline bounds the font/image wait and the print
  (`--pdf-timeout`/`PdfOptions.timeoutMs` override it; `page.pdf` has no timeout
  option and there is no 30 s browser print default). The write order is report
  → PDF → email → history → `--ci-out` → stdout; a PDF failure exits 1, names the
  path, keeps the report and skips later outputs, and a missing engine exits 1
  with a project-local install command. `--pdf` composes with `--out`, `--email`,
  `--json`, `--ci`, `--history` and `--locale`; without `--out`, `--logo`/
  `--history` still require the report and exit 2, and the email names the PDF.
  `playwright-core` is an optional peer (`^1.65.0`), resolved beside Tolkira or
  from the project working directory, imported dynamically only by `src/pdf.ts`
  and external in the bundle, so the default install and runtime dependency
  surface, report, JSON, CI and email bytes are unchanged; the package gains
  `docs/PDF.md`. Chromium-only, no CLI filter state, no video/audio, no
  Letter/custom paper, page numbers or tagged PDF in this slice. See
  [`docs/PDF.md`](PDF.md) and [ADR 0007](adr/0007-optional-pdf-engine.md).
- Print and Save as PDF. A `@media print` stylesheet hides the interactive
  chrome, repeats the light palette from dark mode, fits the report tables to the
  printable width (A4-compatible, not a fixed CSS paper setting), keeps
  screenshots and starts each present view on a new page. A
  `beforeprint`/`afterprint` handler prints the complete text and screenshot
  archive by default (all panels, every detail, eagerly requested thumbnails;
  an active filter still narrows the Report view). The active tab is never
  changed, and the details, lightbox and overflow state return where
  `afterprint` fires. The print-only reveal cannot stack panels on screen if
  `afterprint` does not fire. The failed-only filter plus print is the
  failures-only archival print; without JavaScript the active Report prints
  with closed details unchanged.
  There is no new string, dependency or delivery format, and browser
  headers/footers and page numbers stay user-controlled. See
  [`README.md`](../README.md#print-or-save-as-pdf).
- Report localisation. `--locale <tag>`, `RenderReportOptions.locale` and the
  stream option render the report shell, labels, status text and accessibility
  names from the active `en` or `de` catalog; `de-AT` keeps its `lang` tag and
  uses `de`. The CLI validates the request before generation and exits 2 with
  the supported list; the API throws instead. `--locale` requires
  `--out`, defaults to `en` and never uses host detection. All visible counts
  are locale-formatted (English keeps raw digits). Test data renders verbatim in
  every locale; Gherkin keywords, tags, errors, attachment content and names,
  metadata, URIs, the JSON summary, CI text and the default `Tolkira report`
  title stay unchanged. The report always embeds the active `client.*` messages
  as an escaped inert JSON block; the client uses that block as its only source,
  supports every `Intl.PluralRules` category and formats `#` and numeric
  parameters. The client bundle contains no non-English catalog. Catalogs live in
  `src/i18n/locales/`; `scripts/build-i18n.mjs` derives each tag from its file
  name, generates a `MessageKey` union plus `Record` maps, and
  `npm run i18n:check` validates each target with its own `Intl.PluralRules` tag,
  rejecting ASCII double quotes, `<`/`>`, messages over 2000 characters and `=N`
  branches. Adding a
  left-to-right locale is mostly a data step: add the JSON file, then update the
  CLI usage line and tests that name the supported list; RTL also needs a
  `DIRECTIONS` entry. One report carries one locale; there is no in-report
  switcher. See [`docs/I18N.md`](I18N.md).
- Opt-in run history and a Trends view. `--history <file>` reads, appends and
  atomically writes a schema-version-1 aggregate sidecar, keeps the newest 30
  runs, rejects invalid, oversized or unsupported files before writing, and
  dedupes an identical last run by its aggregate id while keeping the old
  timestamp. The report adds a third `Trends` tab from the second run with a
  newest-first table and a decorative pass-rate sparkline; the attempted
  pass-rate helper is now shared with the health banner, so a Trends row with no
  attempts shows `—` while the health banner keeps `No scenarios attempted`.
  `generateReport` accepts `history`, appends the current run and returns the
  list; `renderReport` only renders it as given. The sidecar stores counts,
  status, the resolved title (capped at 200 characters), duration and attachment
  totals only, and the tablist label is now `Report views`. See
  [`docs/AGENT-INTERFACE.md`](AGENT-INTERFACE.md#run-history).
- Behave 1.3.3 real-run verification. A recorded producer fixture covers a
  multiline doc string, a data table, an inline PNG, a multiline error message
  and the `error` status. Legacy Behave line-array `text` and `error_message`
  values are joined before rendering, invalid value shapes are rejected with a
  file/field error, and the `error` and `hook_error` step-result statuses map
  to failed, with `cleanup_error` accepted defensively. Dry-run/WIP statuses and
  scenario-level hook failures without a step result remain documented limits.
- `stripAnsi` benchmark. `npm run bench:ansi` measures fixed clean and
  escape-laden message corpora, compares production with scan-only and
  character-append references, enforces a 500 ms production median budget,
  reports a 1.5x fast-path `keep`/`review` decision and runs in the Node 22 CI
  check job.
- Failed-only preset. A `Failed only` toolbar toggle appears when the run has
  failures plus another present status or an unexecuted row; it keeps the failed
  chip on, hides other statuses and statusless rows, and is encoded as the other
  `hide` statuses plus `hide=unexecuted`. The `unexecuted` value is a
  pseudo-status without a chip, restored only with the preset chip state, and
  cleared by any manual chip change. Header counts and the `N unexecuted` label
  are unchanged.
- CI summary output. `--ci github` emits GitHub Actions annotations for failed,
  undefined and ambiguous scenarios, notices for skipped, pending and unknown
  scenarios, and a final notice with every non-zero bucket and the unexecuted
  count. `--ci markdown` emits deterministic Markdown with complete counts, an
  inert failed-scenario list and skipped names; `--ci-out` writes it to a
  standalone file. Output is offline and capped at 50 error / 20 notice
  annotations, 50 failed scenarios, 500 message characters and 20 skipped
  names, with omitted counts stated and exact totals kept. `--json` and
  `--ci` share stdout only with `--ci-out`. See [`docs/CI.md`](CI.md).
- Native Playwright JSON reporter input. Detection recognises a report with
  `config` and `stats` objects plus `suites` or `errors`; the adapter maps one
  feature per project, file/describe rules, one scenario per test and project,
  retries as separate attempts with the final attempt visible, nested steps,
  expected failures, unexpected passes and flaky outcomes. Inline base64
  attachments and safe in-tree path attachments are embedded, `stdout`/`stderr`
  become text attachments, `text/markdown` error context renders as escaped
  text, and run-level errors become a failed Playwright feature. Trace viewer
  and HTML-report replay are not claimed. See
  [`docs/PLAYWRIGHT-JSON.md`](PLAYWRIGHT-JSON.md).
- Skipped Playwright path attachments are surfaced. A path attachment that
  exists as a regular file but resolves outside the input file's folder and the
  working directory is counted once, summed across inputs and exposed as
  `generateReport().skippedAttachments`. The report renders one escaped notice
  in the shared shell, the CLI writes one stderr warning after a successful HTML
  write, and the compat shim adds the same notice and hint to its `warnings`
  array. The footer now says `Attachments are embedded when available.` for
  every report.
  Missing files, symlinks, URL/UNC paths, trace zips, earlier attempts, inline
  bodies and the working-directory fallback are not counted. Summary schema
  version 2, JSON keys, CI text and exit codes are unchanged.

### Changed

- Located pickles now show their source line in the scenario summary
  (`movie-list.spec.ts:3`), so every test keeps its own line even when a
  Playwright project feature spans several spec files. The feature source label
  adds the line only when a feature has one file and every scenario agrees on
  one positive line; mixed or absent lines keep the file only, multiple files
  keep `N spec files`, and no trailing colon is rendered. JUnit, line-less
  legacy input and Playwright run errors or missing lines stay line-less instead
  of inventing `:1`. The JSON summary, CI text and email are unchanged.
- PDF install guidance now uses `playwright-core` alone with
  `npx playwright-core install chromium-headless-shell`; the `playwright`
  package and the full Chromium build are not required. The documented cost is
  about 13 MB plus 285.8 MB unpacked for the headless shell.
- English report output changes only by `dir="ltr"` on `<html>`, the inert
  `tolkira-messages` JSON block, the generated client script and its CSP hash.
  Visible English text, numbers, percentages, durations, dates and CSS are
  unchanged. Non-English reports add a small style override so long status and
  toolbar labels wrap at 320 px and 200 % text zoom. Characterization hashes and
  goldens were updated intentionally for those changes.
- Test-only: the render unit suite is split by report flow and the browser
  report spec by user journey. Fixture paths, report creation, clipboard stubs
  and the hostile ANSI payload now have one shared helper. No product behaviour
  change.
- Attachment byte accounting, the 50 MB/100 MB attachment caps, fallback names,
  kind and JSON/URI-list/ANSI/plain text presentation now come from one shared
  `src/attachment` module. Caps, summary schema version 2, the summary values and
  the rendered HTML are unchanged. The separate 100 MB total-input cap and the
  stream entry point are unchanged.
- Report and Details pass rates now count attempted (non-skipped) scenarios
  while counts and bars still include skipped results. The header names
  `N scenarios with results` and any `N unexecuted` rows, a run with only
  skipped results states `No scenarios attempted`, multi-file features show
  `N spec files`, Playwright errors carry one location, and summed durations are
  labelled `Test time` and `Scenario time`. The Details environment heading is
  now `Run environment`.

## [0.3.0] - 2026-11-13

### Added

- `CucumberHtmlStream` is a shape-compatible Node `Transform` over Cucumber
  Messages envelopes. It buffers the run until flush and takes
  `RenderReportOptions`, emitting the same HTML as `renderReport` with the same
  title, metadata, logo and accent. It writes no files and emits no summary.
- Matched step parameters render inside `span.param` with their Cucumber
  parameter type from `stepMatchArgumentsLists`; all fragments are escaped and
  the step text sits in `span.stepText` so copy keeps the composed text. Steps
  without exactly one match list, or with invalid, truncated, mismatched or
  overlapping ranges, keep the full plain escaped text. Search, copy and the JSON summary
  are otherwise unchanged.
- JUnit XML producer fixtures for jest-junit, pytest and Gradle, with recorded
  provenance and coverage for suites, test cases, failures, errors, skipped
  cases, testcase-level output attachments and suite-level output tolerance.
  The adapter is unchanged; the fixtures characterise its existing behaviour.
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
  extension; unknown types normalise to `application/octet-stream` and
  `attachment.bin`. JSON attachments are
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

### Security

- `--out` and the compatibility shim refuse to overwrite an input file and
  leave the original bytes untouched.
- The 100 MB total input cap is enforced from file metadata before a file is
  read, in the core loader and in `jsonDir` scanning.
- ANSI escape sequences, 8-bit C1 escapes and other C0/C1 controls are removed
  from step, hook and run-hook messages before HTML, JSON summary and clipboard
  copy. Newlines and tabs are kept; text without controls takes a fast path.
- Attachments only keep an explicit media-type allowlist. Unknown or forged
  types normalise to `application/octet-stream` (`attachment.bin`); `text/html`
  is escaped text and SVG is limited to an `<img>` data URI.
- JUnit XML rejects `<!DOCTYPE>` and `<!ENTITY>` declarations outside comments,
  CDATA sections and processing instructions, and reports the declaration kind.

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
