# Cucumber input compatibility

2026-11-04. "Tested" means a real producer output is checked in under
`test/fixtures/legacy/` and parsed and rendered by the fixture tests (`test/legacy-version.test.ts`,
`test/legacy-jvm.test.ts`, `test/legacy-ruby.test.ts` and
`test/messages-producers.test.ts`). Each fixture is a two-scenario feature: one
passes, one fails with `Error: boom`.

The dated cross-format limitations table is
[`docs/LIMITATIONS.md`](LIMITATIONS.md) (last verified 2026-11-11).

## Legacy JSON

| Producer | Tested | Notes |
| --- | --- | --- |
| cucumber-js | 2.3.1, 3.2.1, 4.2.1, 5.1.0, 6.0.7, 7.3.2, 13.3.0 | The shape is stable enough. 2.x has no `type` on elements and uses absolute URIs; duration units vary below 6.0.5. |
| Behave | 1.3.3 real run (`behave-real.json`) | Duration is seconds and is normalised to milliseconds. A real run with attachments and doc strings is still outstanding; the synthetic `behave.json` covers those shapes. |
| cucumber-jvm | 7.22.1 real run | The legacy `json` formatter still ships in 7.x/8.x. The fixture covers `classpath:` URIs, nanosecond durations and a Java assertion. |
| cucumber-ruby | 12.0.1 real run | The legacy `json` formatter still ships; the fixture covers relative paths, nanosecond durations and a Ruby `RuntimeError`. |

## Messages

| Producer | Tested | Notes |
| --- | --- | --- |
| cucumber-js | 11.2.0 fixture | 7.0 introduced Messages; the fields Tolkira reads exist since Messages 15/16. |
| cucumber-jvm | 7.22.1 real run | `message` formatter; protocol 27.2.0, `classpath:` URIs and Java exceptions. |
| cucumber-ruby | 12.0.1 real run | `message` formatter; `exception.message` carries the readable error while `message` is the stack, so the report merges them. |
| Behave | not applicable | No Messages formatter. |

## JUnit XML

JUnit is basic mode: suites, test cases, statuses, durations, failures, errors,
skipped cases and testcase-level `system-out`/`system-err`. Fixtures modelled
on real output shapes, with provenance in `test/fixtures/junit/`, cover:

| Producer | Tested shape | Notes |
| --- | --- | --- |
| jest-junit | 16.x | Synthetic but real-shaped; `<testsuites>` root; suite-level `<system-out>` is tolerated, not mapped. |
| pytest | 8.x `--junitxml` | Synthetic but real-shaped; `<properties>` plus testcase-level `system-out`/`system-err` are mapped. |
| Gradle | 8.x test task | Synthetic but real-shaped; root `<testsuite>`, `<properties>`, `<failure>`/`<error>`/`<skipped>`; suite-level output is tolerated, not mapped. |

See [`JUNIT-XML.md`](JUNIT-XML.md) for the mapping and limits.

## Scenario outlines

Messages input carries the Gherkin document, so Tolkira groups executed
examples under one outline section and numbers them `#1.1`, `#1.2`, `#2.1`.
Examples blocks and rows whose test case never started are omitted, matching the
official formatter. A row whose selected test case started with zero raw
results stays visible as an unexecuted row with its original numbering and no
outcome. Outline and examples tags, descriptions and keywords come from the
AST; the substituted values remain visible in the steps. Outlines are ordered
failed-first like the rest of the report; examples inside an outline keep their
Gherkin order and numbering.

Legacy JSON has no Gherkin document and arrives with examples already expanded.
Tolkira keeps those rows flat and does not invent an outline. A Messages
outline without examples also falls back to a flat row; this is a deliberate
difference from the official formatter, which renders the outline with no
examples.

## Rules, backgrounds and tags

Messages input carries rules and backgrounds in the Gherkin document. Tolkira
renders a rule as a section with its keyword, name, description and tags.
Scenarios and outlines stay inside their rule. Feature-level items and rule
sections are ordered by severity and then by first input position; scenarios do
not move across rule boundaries. Features without rules keep their previous
layout.

Feature tags render once in the feature header. Rule tags render once on the
rule section. Scenario tags render on their scenario row or, for an outline, on
the outline heading; examples tags render once on the examples heading. Example
rows show no tags. Feature, rule, scenario and examples tags remain in the
pickle tag set for the tag filter, search and the JSON summary, but they are
not repeated on every row. A rule section is hidden when a search, status
or tag filter leaves no visible scenario below it.

Feature and rule backgrounds render their keyword, name and description once
when the name or description is non-empty. Their steps stay in the scenario
step lists, as Cucumber compiles them into each pickle; Tolkira does not render
a second background step list. The `backgrounds` Compatibility Kit sample has an
anonymous background and therefore shows no background heading.

Legacy JSON has no reliable rule or background structure. Its normalisation
synthesizes a Background node for step resolution, marks it synthetic and the
report model skips it. Legacy feature and scenario tags remain best effort.
JUnit has neither rules nor backgrounds. The JSON summary stays version 2 and
continues to expose only the flat scenario list and inherited `scenarios[].tags`;
rule and background structure is HTML-only.

## Hooks

Messages per-scenario hooks render separately from steps. The subtitle counts
both; named hooks show `Before: name`; passed hooks collapse behind one
`N hooks` disclosure, while failed and skipped hooks stay inline with their
error and attachments. Skipped hooks are kept because they explain the skip;
the official formatter filters some of them. BeforeAll/AfterAll render in a
Hooks section below the feature list; a named run hook shows its bare name.
The section is omitted when empty, while the official formatter shows an empty
section.

Legacy JSON has per-scenario before/after hooks but no test-run hooks. JUnit has
no hooks. The JSON summary stays version 2: hooks stay in
`scenarios[].steps` with `keyword: "Hook"`, plus an optional `name`. Summary
step counts include hooks; the HTML counts steps and hooks separately.

## CI metadata and attachments

Messages input can carry `meta.ci`. Tolkira reads the CI name and URL, the git
remote, revision, branch and tag, and shows them in the report header and
Details. Missing fields are omitted; only http(s) values become links, and a
missing name falls back to the URL as link text. A safe http(s), scp-like or
`ssh://` GitHub remote plus a revision links the 7-character commit to the full
https revision and keeps the full value in the link title; other remotes and
schemes show the revision as plain text. In a mixed run the first non-empty CI block
wins, and meta synthesized by the legacy adapter cannot erase it. CI metadata is
Messages-only; legacy Cucumber JSON has no CI envelope, so pass CI values
through the `metadata` option instead. The JSON summary never includes CI
fields and stays schema version 2.

Attachment names use the Cucumber `fileName` when present. Unnamed attachments
fall back to a deterministic `attachment.<ext>` name in Messages and legacy
JSON; known parameterised media types strip parameters and keep their
extension (`text/uri-list` becomes `.txt` and `text/x.cucumber.log+plain`
becomes `.log`), while unknown or forged types normalise to
`application/octet-stream` and `attachment.bin`. Names are text, never
filesystem paths. `application/json` attachments are pretty-printed without
re-serialising values, so big numbers and duplicate keys survive; malformed
JSON and bodies above 262,144 UTF-8 bytes render as escaped raw text.
`text/uri-list` entries become links only for http(s); other schemes and
protocol-relative values stay escaped text. `text/x.cucumber.log+plain` logs
render safe theme-aware SGR, 256-colour and truecolour spans plus a copy
action; non-SGR control sequences are stripped, and logs above 262,144 UTF-8
bytes render as escaped text without colour parsing. `text/html` attachments
are escaped text, and SVG attachments are only used as an `<img>` data URI;
neither is injected as markup. Attachment counts and the offline single-file
contract are unchanged.

## Step diagnostics

Messages input carries `suggestion` and `stepDefinition` envelopes. For an
undefined step Tolkira shows "No step definition found." and renders every
suggestion snippet as escaped code with its language label. For an ambiguous
step it shows "Multiple matching step definitions found:" and each matching
pattern with its source reference in the relative `uri:line` form.
Multiple snippets and multiple definitions are supported. A passed step can
carry definition ids but never shows a diagnostic.

The lead is status-based: it appears even when the producer sent no suggestion
or definition envelope. Snippets and patterns are Messages-only. Legacy JSON has
no such envelopes, so an undefined or ambiguous legacy step shows the lead and
nothing else; Tolkira never invents a definition. JUnit has no Gherkin step
statuses and renders no diagnostics.

The `undefined`, `undefined-multiple`, `ambiguous`, `all-statuses` and `empty`
Compatibility Kit samples are checked in as fixtures. `ambiguous` already has
two matching definitions; there is no separate `ambiguous-multiple` sample.

## Markdown descriptions

Feature, rule, background, scenario, outline and examples descriptions render a
safe GFM subset: headings, emphasis, inline and fenced code, http(s)/mailto
links, ordered and unordered lists, tables and blockquotes. Raw HTML is escaped
and never executed. Links carry `rel="noopener noreferrer nofollow"`; relative,
`javascript:`, `data:` and `file:` targets stay plain text. Images, including
reference-style and linked images, render as alt text only, so the report makes
no network request and no image becomes an anchor. Description headings never
emit `h1`, `h2`, `h5` or `h6`; tables sit in the focusable scroll region.

The same renderer covers Messages, legacy JSON and JUnit. JUnit has no standard
description field; Tolkira reads the non-standard `description` attributes on
`<testsuite>` and `<testcase>` when present and otherwise keeps plain names.
Descriptions render only in the HTML report and do not change the JSON summary.
The Markdown fixtures are local hand-written inputs, not producer captures:
`markdown-descriptions.ndjson` is authoritative, `markdown-descriptions.feature`
is an abridged illustration of the Gherkin source,
`legacy/markdown-description.json` covers the legacy adapter and
`junit/markdown-description.xml` covers the JUnit description attributes.

## Search and URL state

The search box accepts the official Cucumber tag-expression grammar when the
whole query is tag-shaped: `@a and not @b`, `not @a`, parentheses and escaped
tag characters. Text mixed with tags and invalid expressions fall back to the
existing substring search, with no error. Status filters and the tag dropdown
combine with a valid expression using AND, and the final visible set still opens
at most 20 newly expanded rows. Clearing the tag dropdown always applies
immediately, even while a tag expression is active.

The report stores `query`, every repeated lowercase `hide` value and `tag` in
the URL, restores them on load and synchronises the search input, status
buttons and tag select. Updates use `replaceState` and preserve the hash and
unrelated parameters. Empty, unknown and uppercase parameters are ignored.
When `replaceState` is unavailable or throws (for example on `file://`),
filtering keeps working. URL state and tag expressions are progressive
enhancements; the static report stays readable without JavaScript.

## Auto-expansion

The report opens every feature with an executed scenario whose status is not
`passed`, including undefined, ambiguous, pending, skipped and unknown. Passed
scenarios stay collapsed unless they carry an image. A feature whose scenarios
are all unexecuted opens; a mixed feature opens only for an executed non-passed
or image scenario, not merely because it contains an unexecuted row. The
unexecuted rows themselves stay collapsed and show no outcome. This applies to
Messages, legacy JSON and JUnit input because it is a status rule, not an
input-format rule. Text search and a valid tag expression still open at most 20
rows, counting only rows they newly open.

The JSON summary stays version 2. Undefined summary steps may carry
`suggestions`; ambiguous summary steps may carry `definitions`. The fields are
optional and additive, so `schemaVersion` does not change. Scenario counts
cover executed scenarios only; an unexecuted scenario keeps `status:
"unknown"` with `executed: false` and `counts.scenarios.total` can be smaller
than `scenarios.length`. A legacy scenario with no steps and no hooks is
unexecuted, so its scenario total drops by one compared with version 1 while
legacy steps without a result remain executed.

## Breaking changes that matter

- **3.2.1 (2017):** JSON mime-type revert; duration handling was still in flux.
- **4.0.0 (2018):** JSON duration reverted to nanoseconds;
  `defineSupportCode` deprecated.
- **6.0.0 (2019):** JSON formatter overhaul, reverted in 6.0.3; duration was
  femtoseconds in 6.0.0–6.0.4 and fixed to nanoseconds in 6.0.5.
- **7.0.0 (2020):** Messages introduced; the `json` formatter was deprecated
  but kept. It is still shipped in 13.3.0.
- **8.0–13.x:** Messages additions are additive for the fields Tolkira reads
  (`workerId`, `Hook.type`, `testRunStartedId`, test-run hooks, external
  attachments).
- **Behave 1.3.3:** JSON duration is in seconds, and features/elements carry
  `status` and `location` strings. The adapter detects that dialect and scales
  durations; Behave has no Messages formatter.
- **cucumber-jvm 7.22.1:** legacy JSON uses `classpath:` URIs, nanosecond
  durations and Java stack traces. The shape matches the Cucumber legacy
  dialect and needs no adapter change.
- **cucumber-ruby 12.0.1:** legacy JSON keeps relative paths and nanosecond
  durations; a Ruby exception is carried as `error_message`. In Messages, the
  readable error is in `exception.message` while `message` is the stack; the
  report merges both.
- **cucumber-jvm 7.22.1 Messages:** protocol 27.2.0, `classpath:` URIs and Java
  stack traces. No adapter change was needed.

## What "best effort" means

- The adapter preserves scenarios, steps, statuses, errors, tags, doc strings,
  data tables and attachments for the tested shape.
- Duration accuracy is only claimed for the tested window (cucumber-js
  6.0.5–13.x). Older producers used different units; the shape still renders.
- A malformed file fails with a clear file/line message. It is never silently
  dropped, except through the compatibility shim's `ignoreBadJsonFile`.
- cucumber-js 1.x and earlier are not tested. The event-protocol era is best
  effort with no claim.

## Reproduce

```shell
npx vitest run test/legacy-version.test.ts
```

The fixtures are generated from a minimal feature with:

```gherkin
Feature: Old cucumber compatibility

  Scenario: passes
    Given a passing step

  Scenario: fails
    Given a failing step
```

The step definitions are one empty function and one that throws `Error: boom`.
The versions were installed in isolated temp projects; the checked-in JSON is
the producer output, not a hand-written approximation.

### Fixture toolchains

Do not install Ruby, Maven, Behave or a JDK on the host to regenerate a
fixture. Use a container or a GitHub Actions job; the image disappears with the
run.

| Producer | Image | Setup |
| --- | --- | --- |
| cucumber-js | `node:22` | `npm install cucumber@<version>` |
| Behave 1.3.3 | `python:3.11` | `pip install behave==1.3.3` |
| cucumber-jvm 7.x | `maven:3.9-eclipse-temurin-21` | run the project's `mvn test` |
| cucumber-ruby 12.x | `ruby:3.4` | `gem install cucumber -v 12.0.1` |

Mount the project into the container, run the producer's JSON or Messages
formatter, and copy only the generated fixture back. A GitHub Actions
`workflow_dispatch` job with the same image is the preferred path for a
reproducible producer matrix; it keeps the host clean and records the toolchain
in the workflow file.
