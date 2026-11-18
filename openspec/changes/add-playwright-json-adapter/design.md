# Design

## Context

Tolkira already normalizes legacy Cucumber JSON and JUnit XML into Cucumber
Messages, then uses one renderer. Playwright's JSON reporter is a third
producer with a richer shape: projects, nested suites, per-project tests,
retries, nested steps and attachments. The adapter should build Cucumber
Messages directly. A test with retries needs several started attempts, which
the legacy feature-array shape cannot express; forcing it through that path
would fake attempts or duplicate scenarios.

## Detection

`detectInput` stays pure and I/O-free. Add a `playwright` decision after the
legacy, JUnit and Messages checks:

- the parsed value is a non-array object;
- `config` is an object and `stats` is an object;
- the object owns a `suites` key (even when its value is malformed) or has an
  `errors` array.

`suites` may be malformed; the adapter validates it and throws a
Playwright-specific error instead of falling through to a generic unsupported
input. A report with `config` and `stats` but no `suites` key and no `errors`
array remains `json-validation`, so a random JSON object is still rejected.
Malformed JSON remains `json-validation` and keeps the existing parse error.

Detection returns the parsed value with the decision, as the legacy branch
does. `load.ts` dispatches `playwright` to
`parsePlaywrightJson(parsed, file, { idPrefix })`; there is no second JSON
parse. The adapter receives the file path so it can resolve path attachments
relative to it.

## Normalization path

`parsePlaywrightJson` emits `Envelope[]` directly: `meta`, `testRunStarted`,
one `gherkinDocument` per input/project, one `pickle` and `testCase` per
test (project), one `testCaseStarted` per result with `attempt =
result.retry`, step events, attachments and `testRunFinished`. A spec that ran
in two projects therefore has one pickle/testCase pair per project. Reuse the
pure id, duration and status helpers from the legacy adapter or move them to a
small shared module; do not copy their semantics.

The existing `indexRun`/`latestAttempt` then selects the final attempt, which
is the user-facing result. Earlier attempts remain in the envelopes for the
attempt count; only the latest attempt is rendered, which matches the current
summary contract.

## Mapping

Playwright hierarchy: project -> file -> describe -> spec -> test -> result.

| Playwright | Tolkira |
| --- | --- |
| project name | feature name (fallback: file path) |
| file + describe path | rule name and description |
| spec title (minus tags) | scenario name |
| spec test (one project) | scenario |
| each result | one started attempt; final result is visible |
| retry index of the final result | scenario attempt |
| spec tags and annotations | scenario tags/metadata |
| nested result steps | flattened steps with a `>` depth prefix |
| `result.error` / `errors` | step error message, snippet and location |
| attachments | inline embeddings or safe path reads |
| `stdout` / `stderr` | text attachments |

One spec may have tests in several projects. Emit one scenario per test so
projects do not overwrite each other. Build one feature per input/project, with
the feature URI `playwright://<idPrefix>/<project>`; each scenario keeps the
spec file as its URI, so provenance and directory merging stay per file. A
feature name is the project name, so the feature list reads as the Playwright
configuration; the rule path keeps the file and describe context.

If the report has no project name (older or hand-written JSON), use the file
path as the feature name and keep one feature per file.

Playwright spec tags lack the `@` prefix, so normalise them to `@tag` for the
existing search and tag-expression semantics. Strip trailing `@tag` tokens
from file, describe and spec titles before they become rule or scenario names.
Known `skip`, `fixme` and `fail` annotations become `@skip`, `@fixme` and
`@fail`; their description and every other annotation are appended to the
scenario description as `Annotation: <type> - <description>` (HTML-only,
matching the summary contract).
A `test.status` of `flaky` adds `@flaky`; a failed expected failure adds
`@expected-failure`; an unexpected pass adds `@unexpected-pass`.

### Status

Apply these in order, because the model derives status from step results:

1. `test.status === 'expected'` with a failed, timedOut or interrupted final
   result is an expected failure: emit **passed** step results (including any
   step that errored), append the error text to the scenario description, add
   `@expected-failure` and keep the scenario passed.
2. `test.status === 'unexpected'` with a passed final result is an unexpected
   pass: add one synthetic failed step with `Expected to fail, but passed`,
   add `@unexpected-pass` and keep the scenario failed.
3. `test.status === 'skipped'` is skipped. If there are no results, emit one
   synthetic skipped step so the scenario is visible and counted as skipped.
4. `passed` -> passed.
5. `failed`, `timedOut`, `interrupted` -> failed.
6. `undefined` or no results for a non-skipped test -> unexecuted, not passed.
7. `test.status === 'flaky'` with a passed final result is passed, add
   `@flaky`.
8. `result.status` is the source of truth for every other case.

The step results, not a separate scenario status field, drive the report
status. The expected-failure and unexpected-pass envelope rules are mandatory;
the implementer must not leave an expected failure red or an unexpected pass
green. Key expected failure on `test.status`/`expectedStatus`, not only on
`result.status`, so `test.fail()` plus a timeout is still green.

The step results, not a separate scenario status field, drive the report
status. These two envelope rules are therefore mandatory; the implementer must
not leave an expected failure red or an unexpected pass green.

Use the final result for the visible scenario. Emit one `testCaseStarted` per
result with `attempt = result.retry`; the model's attempt is 0-based, so the
second attempt is `attempt === 1` and the HTML shows `Attempt: 2`. A test with
no results still gets one started attempt with no step results, so it stays
visible as unexecuted instead of disappearing from the summary.

### Steps

Flatten `JSONReportTestStep` depth-first. A step's text is its `title` plus an
optional `subtitle`; nesting is shown with a `›` prefix. A step with an error
is failed, except in the expected-failure rule above where every step is
passed. A step without an error is passed, or skipped when the final result is
skipped. If the final result failed, timed out or was interrupted and no step
carries the error, append one synthetic failed `Error` step; do not mark every
step failed. If a test has no steps, create one synthetic step carrying the
final status and duration so the status counts remain correct. An unexpected
pass appends a synthetic failed step even when the normal steps passed.

Durations are milliseconds in Playwright and nanoseconds in the legacy
normalizer; multiply by 1,000,000. The report model sums visible step
durations, so the scenario duration is that sum. When a test has no steps, the
synthetic step carries `result.duration`. This is documented as a basic-mode
limit: hidden Playwright overhead is not invented as a step.

The error message is the final result's `error.message`, then
`errors[].message`, then `error.value`/`error.stack`. Append the snippet and a
relative location. The model strips ANSI from step messages; any error text
appended to a description is stripped before it is stored.

### Attachments

Playwright attachments have `name`, `contentType`, and either a base64 `body`
or a `path`.

- A non-empty inline `body` becomes an attachment with its content type and
  takes precedence; an empty `body` falls back to `path`.
- `path` may be relative or absolute. Accept it only when its real path stays
  inside the input file's directory or the process working directory. Use
  `realpath` and `path.relative` for both roots, with case-insensitive
  containment on Windows. Reject symlinks, non-regular files, missing files and
  paths whose relative form starts with `..`. Playwright emits absolute paths,
  so absolute paths inside either root must work. The cwd root supports the
  common CI layout where `reports/results.json` and `test-results/` are
  siblings; it is not taken from report data.
- Check `lstat` and the file size before reading; enforce the 50 MB per-file
  cap and a running 100 MB total while encoding. A file over the cap fails the
  report rather than being read into memory.
- `stdout` and `stderr` entries become `text/plain` attachments; `{ buffer }`
  entries are decoded from base64 as `application/octet-stream`, not
  interpreted as HTML.
- Normalise Playwright's `text/markdown` to `text/plain` for the report, so
  `error-context.md` renders as escaped readable text instead of a `.bin`
  download. This keeps the change inside the input adapter and its existing
  text-attachment rendering.
- A `path` that starts with `http://` or `https://` is treated as a remote URL
  and skipped; nothing is fetched.
- The existing `sanitizeEnvelopes` remains the final guard for total bytes,
  remote URLs and external attachments.
- `safeMediaType` remains the renderer's last line of defence; unknown types
  become `application/octet-stream`.

This keeps the one-file promise without letting a JSON file read arbitrary
machine paths. It also matches CI layouts where the report and
`test-results/` share a workspace root. It is documented as a limitation.

### Errors

Use the final result's `error.message` first, then `errors[0].message`. Append
`error.snippet` and `error.location` as text so the report keeps the source
context. Do not render the snippet as HTML; the existing renderer escapes it.
Normalize `location.file` relative to the input file's directory or the
Playwright root; if it falls outside, use only the basename. `error-context`
attachments follow the normal attachment path and are embedded when safe.

### Meta

Set `meta.implementation.name = 'Playwright'` and use `config.version` when
present. This makes `environment.producer` read `Playwright <version>`.

### Run-level errors

Playwright reports configuration and runner failures in `report.errors`, often
with no suites. Dropping them would make a crashed run look empty. When
`errors` is non-empty, emit one synthetic `Playwright` feature with URI
`playwright://errors` and one failed scenario per error. The scenario contains
one failed step whose message is the error message plus its location. The
report is visibly failed, and the normal feature order keeps this synthetic
feature last.

### Empty runs

A report with no suites, no errors and zero stats is a valid empty run. Emit
the run start/finish envelopes and accept it; the report shows zero scenarios.

## Validation and errors

The adapter validates:

- top-level `config` and `stats` objects;
- `suites` and `errors` arrays when present; a non-array `suites` is an error
  once the report is classified as Playwright;
- suite `specs` and optional `suites` arrays;
- spec `tests` array;
- test `results` array;
- attachment `name`/`contentType` strings and `body`/`path` types;
- step `title` and `duration`.

Every generated id uses `playwright-${index}` plus a local counter, so two
Playwright inputs or a Playwright plus Cucumber merge cannot collide. A
`repeatEach` run may produce several tests for one spec in the same project;
include the test index in the scenario id even when the names repeat.

Errors name the file and the failing path, for example
`Invalid Playwright JSON in report.json: suites[0].specs must be an array.`
The adapter throws before `renderHtml`; the CLI writes only after a successful
render, so no partial file is produced.

## Alternatives considered

- **Force the data through the legacy feature array.** Less code, but the shape
  has one attempted run per scenario. Retries would need fake attempt numbers
  or duplicate scenarios. Direct Messages won.
- **Keep JUnit only.** Loses projects, retries, steps and attachments; does not
  meet #4.
- **Read every attachment path.** Simple, but an untrusted JSON file could read
  arbitrary files. Containment under the input directory is the trust boundary.
- **Treat each retry as a separate scenario.** Simple, but inflates counts and
  hides the flaky outcome. Final result plus attempt is the user-facing truth.

## Risks

- Playwright's JSON schema is not a formal versioned contract. Keep the adapter
  tolerant of missing optional fields and test the shapes we document.
- Path containment will skip attachments in layouts where the JSON lives in a
  different tree from `test-results/`; documented, and inline attachments still
  work.
- Large reports with many steps increase HTML size. Existing caps and the
  report-size budget remain the guard.
