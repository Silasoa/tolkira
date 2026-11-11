# Cucumber HTML formatter parity

Research note, 2026-11-09. Scope: feature parity with the official
`@cucumber/html-formatter` for Cucumber Messages users, with the legacy
`cucumber-html-reporter` option surface noted where it matters. Visual themes
are explicitly out of scope.

No production code, tests or CI were changed. This research note is the only
change made by this task and it is not committed.

## 1. Verdict

Tolkira already matches or exceeds the official formatter on input formats,
CLI/API delivery, custom metadata, search basics, durations, single-file/offline
behaviour, accessibility without JavaScript and the JSON summary.

It is **not yet a drop-in replacement for a Messages run**. The material gaps
are Gherkin source fidelity (scenario outlines/examples, rules and tags), hooks
(especially test-run hooks), failure diagnostics for undefined and ambiguous
steps, and the treatment of scenarios that never executed. Markdown
descriptions and tag-expression search remain second-tier differences; CI
metadata and attachment presentation now match.

The legacy reporter comparison is mostly an option-mapping question, already
covered by `docs/COMPATIBILITY.md`; Tolkira does not need to reproduce its
Bootstrap dashboard or charts.

## 2. What "parity" means here

A Messages user should see the same information and be able to do the same
triage tasks as with the official formatter:

- the Gherkin document as written, including rules, backgrounds, outlines,
  examples and tags;
- the final result of each executed test case, with errors and attachments;
- per-scenario and test-run hooks;
- search and status/tag filtering;
- a status summary and environment metadata;
- one offline file that opens without a server.

Identical DOM, identical API shape and identical styling are not required.
Themes are excluded. The official formatter's React bundle is an
implementation detail, not a parity requirement.

## 3. Method and sources

Read:

- `docs/PRODUCT.md`, `docs/COMPATIBILITY.md`, `docs/AGENT-INTERFACE.md`,
  `docs/research/report-tools.md`, `docs/research/reporter-compatibility.md`;
- `src/report/model.ts`, `src/summary.ts`, `src/render/html.ts`,
  `src/render/report.css`, `src/cli.ts`, `src/input/*`.

Inspected and ran, in a temporary directory outside the repository:

- `@cucumber/html-formatter@24.2.0` (published 2026-09-28), its source,
  README, CHANGELOG, mustache template and `@cucumber/react-components@24.5.0`
  source;
- `cucumber-html-reporter@7.2.0` (published 2024-10-01), its `index.d.ts`,
  README, `lib/reporter.js` and rendered output;
- `@cucumber/compatibility-kit@31.0.0` NDJSON fixtures;
- Tolkira 0.2.0 (`dist/cli.js`) against the same fixtures. The size table was
  first measured on 0.1.2 and re-checked on 0.2.0; the values stayed within
  roughly 2 KB.

Both reports were rendered from the same NDJSON and inspected in Chromium via
Playwright. Sizes below are measured from those local renders, not estimates.

Representative fixture results:

| Fixture | Official HTML | Tolkira HTML | Notes |
| --- | ---: | ---: | --- |
| `empty` | 921 KB | 48 KB | Official React bundle dominates its size. |
| `retry` | 930 KB | 52 KB | Both show the final attempt. |
| `examples-tables` | 942 KB | 60 KB | Both have 7 examples; official groups them into 2 outlines, Tolkira has 7 flat rows. |
| `attachments` | 950 KB | 72 KB | Attachment payloads included in both. |

The official HTML is roughly 920 KB for a minimal fixture because it embeds
React, the formatter CSS/JS and the message stream. Tolkira's shell is roughly
50 KB before payload. This is a product advantage; do not copy the React
runtime to chase parity.

## 4. Feature matrix

Legend: **Match** = equivalent for the user; **Exceeds** = Tolkira does more;
**Partial** = present but materially narrower; **Missing** = not implemented;
**Deliberate** = intentionally different.

| Area | Official formatter 24.2.0 | cucumber-html-reporter 7.2.0 | Tolkira 0.2.0 | Verdict |
| --- | --- | --- | --- | --- |
| Input formats | Cucumber Messages only (NDJSON stream) | Legacy Cucumber JSON only | Legacy JSON, Messages (`.jsonl`/`.ndjson`), JUnit XML; auto-detected; directories and multiple inputs | **Exceeds** |
| Entry points | ESM `CucumberHtmlStream` Transform; Java/Ruby/.NET wrappers; no CLI since v19 | CommonJS `generate(options, callback?)`; no CLI | CLI, ESM API (`generateReport`, `renderReport`, `summarizeReport`), compat shim | **Exceeds**, except no stream adapter |
| Attachments | Inline base64 and external `attachment.url`; image, video, log, text, `text/uri-list`, JSON, binary; image/video collapsed in `<details>`; download button | Inline images or external screenshot files; text/JSON/binary; no video/audio special handling | Inline only; image (lightbox), video, audio, text, binary; JSON, URI-list and ANSI logs rendered; 50 MB each / 100 MB total; rejects remote URLs | **Match, except external URLs** |
| Attachment naming | `fileName`, else `attachment.<mime-extension>`, else `attachment` | Sanitised name or generated file | `fileName`, else deterministic `attachment.<ext>`, else `attachment` | **Match** |
| Metadata | `meta.implementation/runtime/os`; `meta.ci` job link and git revision/branch/tag | Arbitrary `metadata` key/value; `name`/`brandTitle`; reads `package.json` | Arbitrary CLI/API metadata; `meta` producer/runtime/OS/CPU/protocol; `meta.ci` job link and git revision/branch/tag | **Match** |
| Search | Full-text Gherkin index; text or tag expression; 500 ms debounce; URL query state. The index covers feature/scenario/rule/background names and descriptions and steps, but not examples block names, examples table values, substituted pickle names, errors or attachments | None | Substring over scenario/feature/URI/keyword/description/tags/steps incl. error messages; single-tag dropdown; no URL state | **Partial** |
| Status filters | Checkboxes that hide statuses; counts; only shown when more than one status exists | None | Toggle buttons per status with counts | **Match** |
| Status counts | Scenario counts by worst final status; pie chart; pass rate | Feature and scenario counts; pass/fail/pending/undefined/ambiguous/skipped/rerun; pie chart | Feature, scenario and step counts; pass rate; attachments; duration | **Exceeds** |
| Retries / attempts | Final attempt only (`testCaseFinished.willBeRetried` filtered); no attempt history | No real retry model; `rerun` comes from a LambdaTest `META_FILE` side channel | Latest attempt by `attempt` number; attempt number shown; no attempt history | **Match** in outcome, **Exceeds** in display |
| Scenario outlines / examples | Gherkin outline rendered once; Examples headings and tags; executed example rows numbered `#1.1`, `#1.2` with outcomes; unexecuted rows and blocks are pruned | Legacy JSON arrives expanded; no outline reconstruction | One flat scenario row per executed example; the first outline's rows share one pickle name; no examples grouping or numbering; description repeats per row | **Missing** |
| Rules / backgrounds / tags | Rule heading, description and tags; background heading/description; feature/rule/scenario/examples tags | No rules; tags per scenario; background is flattened by the legacy JSON | Rule name only in the scenario detail; feature/rule tags not rendered; background heading/description not rendered | **Partial** |
| Hooks | Per-scenario hooks: passed hooks collapsed behind `N hooks`, failed hooks inline, hook names (`Before: name`); test-run hooks section with BeforeAll/AfterAll, status, duration, error, attachments | `before`/`after` merged into scenario steps; no test-run hooks | All per-scenario hooks shown inline as steps; type label only, no hook name; no test-run hooks section | **Partial / Missing** |
| Doc strings / data tables | Rendered; numbers right-aligned in tables | Rendered | Rendered; no numeric alignment | **Match** |
| Step / scenario durations | Step duration only; hidden below 1 ms; scenario duration is an open request | Step and total execution time | Step, scenario, feature and total duration | **Exceeds** |
| Environment / CI | Implementation/runtime/OS icons and text; CI job, commit, branch, tag | Arbitrary metadata only | Implementation/runtime/OS/CPU/protocol; custom metadata | **Partial** |
| Theming / branding | CSS variables; custom title/icon/CSS/JS in Java/.NET; replaceable assets | Four themes; column layout; brand title; logo not native | Title, logo, accent, dark mode; no custom CSS/JS | **Excluded / Deliberate** |
| Large-run handling | Streams envelopes into the file; embeds every message; React builds the query and search index; closed documents are lazily mounted; known [huge-report issue](https://github.com/cucumber/html-formatter/issues/62) | Loads full JSON and renders full HTML; CDN assets | Loads up to 100 MB input; builds full model and full DOM; search expansion capped; 10 MB size warning | **Different trade-off** |
| Single file / offline | Yes by default: CSS, JS and icon inline; external attachment URLs can leave the file | HTML file but Bootstrap/jQuery/Google Charts from CDNs; optional external screenshots | Yes: CSP, no network, attachments inline, remote URLs rejected | **Exceeds** |
| Accessibility / no-JS | React Aria disclosure and headings; search `aria-label`; many status icons unlabelled; blank page without JS | Old Bootstrap markup; no modern a11y contract | Native `details`/`summary`, `aria-live`, screen-reader labels, keyboard tabs and lightbox focus restore; triage links and content readable without JS | **Exceeds** |
| Output / exit codes | No CLI; formatter writes a file; host Cucumber process owns exit codes | No CLI; callback error only | CLI exit 0 for a generated report even when tests failed, 1 parse/render/write failure, 2 invalid usage | **Exceeds** |
| JSON summary | None | None | Versioned `--json` summary | **Exceeds** |
| Security | Markdown sanitised with `rehype-sanitize`; no CSP in the default template; external attachment URLs allowed | Historical XSS issues; CDN scripts | Escaping, hash-based CSP, attachment size caps, remote URLs rejected | **Exceeds** |

The legacy reporter option surface is `theme`, `jsonFile`/`jsonDir`, `output`,
`reportSuiteAsScenarios`, `scenarioTimestamp`, `columnLayout`,
`failedSummaryReport`, `storeScreenshots`/`screenshotsDirectory`/
`noInlineScreenshots`, `launchReport`, `ignoreBadJsonFile`, `name`/`brandTitle`
and `metadata`. The Tolkira compatibility mapping is already documented in
`docs/COMPATIBILITY.md`; this note records only where the rendered information
differs.

## 5. Gap analysis

Cost: **S** = up to a day, one model/render change plus tests; **M** = a few
days, model plus render plus interactions; **L** = a week or more, or a new
dependency/architecture.

| # | Gap | Status | Cost | Conflicts with one-file/offline? | Smallest implementation shape |
| --- | --- | --- | --- | --- | --- |
| G1 | Scenario outline / examples grouping and numbering | Missing | M | No | Group executed `ReportScenario` rows by outline and examples table, preferably with optional outline metadata on each row; render outline heading, tags and description once, then `#examplesIndex.exampleIndex` rows with outcomes. Map `pickle.astNodeIds.at(-1)` to the examples `TableRow`; omit unexecuted rows and blocks. |
| G2 | Test-run hooks (BeforeAll/AfterAll) | Missing | M | No | Collect `testRunHookStarted`/`testRunHookFinished` and `hook`; add `ReportRunHook`; render a Hooks section with name, status, duration, error and attachments. |
| G3 | Hook names and passed-hook collapsing | Partial | S | No | Carry `hook.name` into `ReportStep`; label `Before: name`; hide passed hooks behind a `N hooks` disclosure; keep failed and relevant skipped hooks inline. |
| G4 | Undefined-step suggestions | Missing | S | No | Index `suggestion` envelopes by `pickleStepId`; render "No step definition found" plus snippet `<pre>` blocks under the undefined step. |
| G5 | Ambiguous step definitions | Missing | M | No | Index `stepDefinition` by id; map `testStep.stepDefinitionIds`; render matching patterns and source references under the ambiguous step. |
| G6 | Undefined/ambiguous/pending scenarios stay collapsed | Different | S | No | Open any scenario whose status is not `passed`, not only `failed`, and open the containing feature as well; keep the search auto-open cap. |
| G7 | Empty/no-step scenarios counted as `unknown` and flagged as attention | Different | S/M | No | Add an `executed` flag: keep the finished empty row and also create the started-but-unfinished row, display both without an outcome, exclude them from scenario counts and triage, and set the feature status to `unknown` when every scenario is unexecuted. Open non-passed features (G6), show `0 / 0`, and decide the summary contract (new `executed` field or documented count semantics), bumping `schemaVersion` if needed. |
| G8 | Markdown descriptions | Missing | M with a small dependency, L without | No | Render a safe GFM subset (headings, emphasis, code, links, lists, tables, blockquotes) with HTML escaped; keep the existing remote-image stripping. A dependency needs a written reason. |
| G9 | Rules, background headings and feature/rule tags | Partial | M | No | Build rule nodes in the model; render Rule heading/description/tags and Background heading/description; attach scenarios to their rule; include tags in search. |
| G10 | Search tag expressions and URL state | Partial | M | No | Use `@cucumber/tag-expressions` (official Cucumber package) when the query looks like a tag expression; sync `?query=` and `?hide=` with `URLSearchParams`; keep the tag dropdown as a shortcut. |
| G11 | CI/git metadata from `meta.ci` | Match | — | No | Implemented: reads `meta.ci.name/url` and `meta.ci.git.revision/branch/tag`, renders a CI link (URL when the name is absent) and a short commit for https, scp-like and `ssh://` GitHub remotes. |
| G12 | Attachment presentation polish | Match | — | No | Implemented: deterministic `attachment.<ext>` fallback, pretty JSON, `text/uri-list` links, ANSI logs with copy, and the image lightbox. |
| G13 | External attachments / split assets | Deliberate difference | L | Yes | Do not copy. Keep rejecting remote URLs. A later opt-in split-assets mode is a separate product decision, not parity. |
| G14 | `CucumberHtmlStream`-shaped adapter | Missing, optional | S | No | A Transform that collects envelopes and calls `renderHtml` on flush. Only needed if teams want to swap the formatter inside a Cucumber implementation without a post-run script. |
| G15 | Parameter highlighting in steps | Missing, optional | S | No | Use `testStep.stepMatchArgumentsLists` and `parameterType` names to wrap matched fragments. Cosmetic; not needed for triage. |
| G16 | Lazy rendering of closed documents | Different trade-off | L | No, but conflicts with no-JS | Do not copy React's lazy mount. Measure first; the static report is much smaller and works without JS. |

## 6. Priority

### Required for credible drop-in parity (Messages users)

1. **G1 scenario outlines/examples.** The largest visible difference. A user
   with an outline sees one structured outline in the official report and a
   list of duplicate scenario names in Tolkira.
2. **G2 + G3 hooks.** Test-run hooks are absent entirely, hook names are lost,
   and passed hooks add noise to every scenario's step list.
3. **G4 + G5 + G6 undefined and ambiguous diagnostics.** The official report
   tells the user which snippets to implement or which definitions matched.
   Tolkira currently shows only the status, and undefined/ambiguous scenarios
   stay collapsed.
4. **G7 empty-run semantics.** Counting a scenario with no steps as `unknown`
   and putting it in "Needs attention" is a false alarm. The official report
   shows `0 / 0` and leaves the scenario without an outcome.
5. **G9 rules and tags.** Rules are part of modern Gherkin; flattening them and
   dropping feature/rule tags loses the document structure.

### Should fix for full content parity

6. **G8 Markdown descriptions.** Official renders GFM; Tolkira prints raw
   Markdown. This is a content-fidelity gap, not a triage blocker.
7. **G10 tag-expression search and URL state.** Useful for tag-heavy suites and
   shareable links. The existing dropdown remains a valid shortcut.
G11 (CI/git metadata) and G12 (attachment polish) shipped in the metadata
parity slice and no longer need separate work. The image lightbox remains a
deliberate difference, not a gap.

### Optional / later

10. **G14 stream adapter** if embedding into cucumber-js/jvm/ruby is a real
    request.
11. **G15 parameter highlighting** for visual fidelity.
12. **G16 lazy rendering** only after a measured large-run problem; it would
    weaken the no-JS guarantee.

### Never copy

- The React runtime, the ~900 KB base bundle, or client-side query/search
  indexes. They buy official formatter parity at a size and complexity cost
  that contradicts Tolkira's product promise.
- Embedding the full message stream as JSON alongside the rendered report.
- External attachment URLs, CDN assets or custom JavaScript as defaults.
- Theme clones of Bootstrap, hierarchy or Foundation.
- The legacy `output + '.json'` side effect, browser launch, CDN mode,
  `launchReport`, or LambdaTest-specific rerun metadata.
- Telemetry or analytics of any kind.

## 7. Concrete behaviour differences

### Scenario outlines and examples

Official, from `examples-tables.ndjson`:

- two outline sections: `Scenario Outline: Eating cucumbers` and
  `Scenario Outline: Eating cucumbers with <friends> friends`;
- the first outline has `Examples: These are passing` with `#1.1`, `#1.2` and
  `Examples: These are failing` with `#2.1`, `#2.2`;
- the second outline has one unnamed examples block with `#1.1`, `#1.2`,
  `#1.3`; its numbering resets per outline;
- tags on the examples block, not repeated on every row;
- only executed examples and blocks are rendered; unexecuted rows and blocks
  are pruned.

Tolkira 0.2.0:

- seven flat rows; the first outline's four rows all share the pickle name
  `Eating cucumbers`, while the second outline's rows have substituted names
  such as `Eating cucumbers with 11 friends`;
- no examples headings or numbering;
- the outline description repeats on every row;
- tags appear per row because pickle tags include the examples tags.

Counts agree (5 of 7 passed). Only the structure and numbering differ. The
legacy reporter and multiple-cucumber-html-reporter also flatten examples;
MCHR 4.6.0's Messages adapter maps each pickle to a legacy `scenario` with no
examples metadata. The official formatter is the only structural peer for G1.

### Hooks

Official, from `hooks.ndjson`:

- a passed scenario shows `When a step passes` and `2 hooks` (collapsed);
- a failed scenario shows the failed step and its error, plus `2 hooks`;
- hook names appear when present (`Before: name`);
- test-run hooks appear in a separate Hooks section, including BeforeAll and
  AfterAll with status, duration, error and attachments.

Tolkira:

- every hook is an inline step: `Hook Before hook`, `Hook After hook`;
- hook names are discarded;
- the scenario subtitle counts hooks as steps (`3 steps` for one step plus two
  hooks);
- `testRunHookStarted`/`testRunHookFinished` are accepted by the input parser
  but never rendered, so BeforeAll/AfterAll disappear.

### Undefined and ambiguous steps

Official, from `undefined.ndjson`:

- undefined step shows "No step definition found. Implement with the
  snippet(s) below:" and one or more code snippets;
- ambiguous step shows "Multiple matching step definitions found:" with the
  patterns and source references;
- both are expanded automatically because the document is not passed.

Tolkira:

- undefined and ambiguous scenarios are counted and listed in "Needs
  attention", but stay collapsed;
- the step detail shows only the status, with no snippet or matching
  definition;
- `suggestion` and `stepDefinition` envelopes are validated as known input but
  ignored by the model.

### Empty runs and scenarios without steps

Official, from `empty.ndjson`:

- header `0 % (0 / 0) passed`;
- feature visible with a grey unknown icon;
- blank scenario shown without an outcome;
- no "needs attention" concept.

Tolkira:

- header `0 of 1 passed`;
- `1 unknown`;
- scenario and feature in "Needs attention";
- "No scenarios in this report." only when there are no scenario rows at all.

This is a correctness difference: an unexecuted or step-less scenario is not a
failure signal.

### Retries

Official:

- filters out any `testCaseFinished` with `willBeRetried`;
- counts and displays only the final attempt;
- shows no attempt number.

Tolkira:

- selects the highest `attempt` with a finished/result-bearing
  `testCaseStarted`;
- counts and displays only that attempt;
- shows `Attempt: N` in the scenario detail.

The outcome matches for normal Cucumber streams. A stream that marks the last
attempt `willBeRetried` without a successor would be shown by Tolkira and
hidden by the official formatter; that is an edge case, not a common
difference. Neither report offers attempt history.

### Search and filtering

Official:

- ORAMA full-text index over Gherkin source: feature/scenario/rule/background
  names and descriptions, step keyword/text/doc string/data table;
- tag expressions (`@a and not @b`) parsed with
  `@cucumber/tag-expressions`;
- status checkboxes that hide statuses;
- state persisted in `?query=` and repeated `?hide=` parameters;
- no search over examples block names, examples table values, substituted
  pickle names, error messages or attachments.

Tolkira:

- substring search over scenario name, feature name, URI, keyword,
  description, tags and step text plus the first 2,000 characters of each step
  message/error;
- single-tag dropdown, exact tag match;
- status toggle buttons;
- no URL state;
- caps auto-opened search results at 20.

Tolkira is better at finding an error string; official is better at tag
expressions and sharing a filtered view.

### Attachments

Official:

- fallback name `attachment.<ext>` or `attachment`;
- image/video in a collapsed `<details>` with the filename as summary;
- `text/x.cucumber.log+plain` rendered with ANSI colours and a copy button;
- `text/uri-list` rendered as links;
- `application/json` pretty-printed;
- unknown binary as a download button;
- `attachment.url` rendered as an external image/video/download.

Tolkira:

- fallback name `attachment.<ext>` or `attachment`;
- images inline with a lightbox, video/audio players;
- text attachments in a `<details>` block; JSON pretty-printed; URI lists
  linked for http(s); ANSI logs rendered with a copy action;
- binary as a data-URI download link;
- remote URLs rejected with an error.

The image lightbox is a deliberate difference, not a parity requirement.
External URLs are a deliberate offline boundary.

### Keyboard and no-JavaScript

Official is a React application: without JavaScript the page is blank. With
JavaScript, React Aria provides disclosure and focus behaviour; search and
status filters work; many status icons have no accessible name.

Tolkira renders native `details`/`summary` content, so the report and triage
links remain readable without JavaScript. Search, filters and the lightbox need
JavaScript. Tolkira adds `aria-live` counts, screen-reader status text, a
keyboard tablist and lightbox focus restore. Do not regress this to copy the
official React-only behaviour.

### Output and exit codes

Official has no CLI. The formatter writes a file; the host Cucumber process
decides the exit code. The legacy reporter has no CLI either and only reports
errors through the callback.

Tolkira's CLI is an addition: exit 0 when a report is generated even if tests
failed, 1 for parse/render/write failure, 2 for invalid usage. The JSON summary
is also Tolkira-only. These are advantages, not parity gaps.

## 8. Implementation plan

Do these as separate vertical slices, each with a CCK-style fixture and a
browser check:

1. **Outline/examples model and render (G1).** Add the grouping to
   `src/report/model.ts`; render outline and examples headings in
   `src/render/html.ts`; keep search and status filters working on example
   rows. Acceptance: `examples-tables.ndjson` matches official grouping and
   numbering.
2. **Hooks (G2/G3).** Add run-hook and hook-name data to the model; render a
   Hooks section; collapse passed per-scenario hooks. Acceptance:
   `hooks.ndjson`, `global-hooks.ndjson`, `hooks-named.ndjson`,
   `global-hooks-attachments.ndjson`.
3. **Diagnostics (G4/G5/G6).** Index suggestions and step definitions; render
   them; open non-passed scenarios. Acceptance: `undefined.ndjson`,
   `ambiguous.ndjson`, `pending.ndjson`.
4. **Empty-run semantics (G7).** Add `executed`; exclude unexecuted scenarios
   from counts and triage; update the summary contract and its tests.
   Acceptance: `empty.ndjson`.
5. **Rules and tags (G9).** Add rule nodes, background headings and
   feature/rule tags. Acceptance: `rules.ndjson`, `rules-backgrounds.ndjson`,
   `backgrounds.ndjson`.
6. **Second tier (G8, G10).** Markdown descriptions and tag
   expressions/URL state. G11 and G12 already shipped.

Use the compatibility kit as an external acceptance corpus. It is MIT-licensed
and already covers the edge cases that matter; copying a small subset into
`test/fixtures/messages/` with attribution avoids a new runtime dependency.

## 9. Risks and non-goals

- **Do not chase DOM parity.** The official report's DOM and React state are
  not a product requirement. Chasing them would add a runtime dependency and
  break the no-JS baseline.
- **Do not add a client-side search index.** Tolkira's static data attributes
  and substring search are enough for the target run sizes; an ORAMA index
  would add weight and a second source of truth.
- **Do not support external attachments by default.** It conflicts with the
  one-file/offline promise and with the CSP baseline. Split assets are a later,
  explicit product decision.
- **Do not clone themes.** The official formatter's CSS variables and the old
  reporter's Bootstrap themes are visual choices; Tolkira's shell is its own.
- **Large-run performance needs measurement.** The official formatter lazily
  mounts closed documents; Tolkira renders the full DOM. Tolkira's file is much
  smaller, but a run with thousands of scenarios may still stress the browser.
  Measure before adding lazy rendering, because it would weaken the no-JS
  guarantee.

## 10. Sources

Accessed 2026-11-09.

- [`@cucumber/html-formatter@24.2.0`](https://www.npmjs.com/package/@cucumber/html-formatter/v/24.2.0)
  · [repository](https://github.com/cucumber/html-formatter) ·
  [README](https://github.com/cucumber/html-formatter#readme) ·
  [CHANGELOG](https://github.com/cucumber/html-formatter/blob/main/CHANGELOG.md)
- [`@cucumber/react-components@24.5.0`](https://www.npmjs.com/package/@cucumber/react-components/v/24.5.0)
  · [repository](https://github.com/cucumber/react-components) ·
  [README](https://github.com/cucumber/react-components#readme)
- [`cucumber-html-reporter@7.2.0`](https://www.npmjs.com/package/cucumber-html-reporter/v/7.2.0)
  · [repository](https://github.com/gkushang/cucumber-html-reporter) ·
  `index.d.ts`, `README.md`, `lib/reporter.js`
- [`@cucumber/compatibility-kit@31.0.0`](https://www.npmjs.com/package/@cucumber/compatibility-kit/v/31.0.0)
- Tolkira: `docs/PRODUCT.md`, `docs/COMPATIBILITY.md`,
  `docs/AGENT-INTERFACE.md`, `docs/CUCUMBER-COMPATIBILITY.md`,
  `docs/research/report-tools.md`, `docs/research/reporter-compatibility.md`,
  `src/report/model.ts`, `src/summary.ts`, `src/render/html.ts`,
  `src/render/report.css`, `src/cli.ts`, `src/input/*`.

Observed limitations, not claims from documentation:

- Official formatter source inspected: `CucumberHtmlStream.ts`,
  `index.mustache`, `main.tsx`; React components inspected: `Report`,
  `ExecutionSummary`, `SearchBar`, `FilteredDocuments`, `GherkinDocumentList`,
  `DocumentAccordion`, `Scenario`, `Examples`, `TestCaseOutcome`,
  `TestStepOutcome`, `TestRunHookOutcome`, `Attachment`, `Image`, `Video`,
  `Log`, `Links`, `Unknown`, `DataTable`, `DocString`, `Description`.
- The official formatter has no CLI in 24.2.0; the v19 changelog records the
  removal of the old binary.
- The official JavaScript stream hard-codes the page title `Cucumber`; custom
  titles/icons/CSS/JS are documented for the Java and .NET wrappers.
- The legacy reporter's `rerun` count comes from the LambdaTest-specific
  `META_FILE` environment variable, not from Cucumber retries.
