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
- `suites` is an array;
- `config` is an object;
- `stats` is an object.

This is deliberately stricter than "has suites" so a random JSON object is
still rejected as unsupported. Malformed JSON remains `json-validation` and
keeps the existing parse error. A parsed object that fails the Playwright shape
also remains `json-validation`.

`load.ts` dispatches `playwright` to a new `parsePlaywrightJson(content, file,
{ idPrefix })`. The adapter receives the raw file content so it can parse once
and resolve path attachments relative to the file.

## Normalization path

`parsePlaywrightJson` emits `Envelope[]` directly: `meta`, `testRunStarted`,
one `gherkinDocument` per project/file, a `pickle` and `testCase` per spec, one
`testCaseStarted` per result with `attempt = result.retry`, step events,
attachments and `testRunFinished`. Reuse the pure id, duration and status
helpers from the legacy adapter or move them to a small shared module; do not
copy their semantics.

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
projects do not overwrite each other. Build one feature per project, with the
feature URI `playwright://<project>`; each scenario keeps the spec file as its
URI, so provenance and directory merging stay per file. A feature name is the
project name, so the feature list reads as the Playwright configuration; the
rule path keeps the file and describe context.

If the report has no project name (older or hand-written JSON), use the file
path as the feature name and keep one feature per file.

Spec tags keep their `@` prefix. Known `skip`, `fixme` and `fail` annotations
become `@skip`, `@fixme` and `@fail`; other annotations are appended to the
scenario description as `Annotation: <type> - <description>`. A `test.status`
of `flaky` adds `@flaky` so the HTML filter can surface it.

### Status

- `passed` -> passed
- `failed`, `timedOut`, `interrupted` -> failed
- `skipped` -> skipped
- `undefined` or no results -> unexecuted but not passed
- `test.status === 'expected'` with a failed final result is an expected
  failure: render passed, add `@expected-failure` and append the error text to
  the scenario description
- `test.status === 'flaky'` with a passed final result is passed, add `@flaky`
- `test.status === 'unexpected'` with a passed final result is an unexpected
  pass: render failed, add `@unexpected-pass` and a synthetic failure message
- `result.status` is the source of truth for every other case.

Use the final result for the visible scenario. If earlier attempts failed,
attach a small text attachment with their status and error messages so the
retry history is not lost. Set the generated `testCaseStarted.attempt` to the
final result's `retry` index after normalization.

### Steps

Flatten `JSONReportTestStep` depth-first. A step's text is its `title` plus an
optional `subtitle`; nesting is shown with a `›` prefix. A step with an error
is failed; otherwise it inherits the final result status. If a test has no
steps, create one synthetic step carrying the final status and duration so the
status counts remain correct.

Durations are milliseconds in Playwright and nanoseconds in the legacy
normalizer; multiply by 1,000,000. The final scenario duration comes from the
result duration.

### Attachments

Playwright attachments have `name`, `contentType`, and either a base64 `body`
or a `path`.

- Inline `body` becomes a legacy `embedding` with its content type.
- `path` is resolved against the input file's directory. Only regular files
  whose real path stays inside that directory are read. Absolute paths,
  `..` escapes, symlinks and missing files are skipped.
- `stdout` and `stderr` entries become `text/plain` attachments; `{ buffer }`
  entries are decoded from base64 as `application/octet-stream`, not
  interpreted as HTML.
- The existing `sanitizeEnvelopes` enforces the 50 MB per-attachment and 100 MB
  total limits and rejects external/remote attachments.
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

- top-level `config`, `suites` and `stats` objects/arrays;
- suite `specs` and `suites` arrays;
- spec `tests` array;
- test `results` array;
- attachment `name`/`contentType` strings and `body`/`path` types;
- step `title` and `duration`.

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
