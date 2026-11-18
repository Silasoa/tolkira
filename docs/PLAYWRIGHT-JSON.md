# Playwright JSON (native adapter)

Tolkira reads the Playwright JSON reporter directly. This is a **basic** input
mode with real Playwright structure: projects, files, describe levels, retries,
nested steps, tags, annotations, attachments and run-level errors. It does not
replay Playwright's HTML report or open a trace viewer.

## Usage

```shell
PLAYWRIGHT_JSON_OUTPUT_NAME=report.json npx playwright test --reporter=json
tolkira report.json --out reports/report.html
```

You can mix Playwright JSON with Cucumber legacy JSON, Messages and JUnit XML in
one report:

```shell
tolkira reports/ --out report.html
```

A directory is scanned recursively; the same file passed explicitly and through
its directory is included once.

## Detection

`detectInput` stays pure. A JSON object is Playwright when all of these hold:

- it is a non-array object;
- `config` and `stats` are objects;
- it owns a `suites` key (even when the value is malformed) or has an `errors`
  array.

A report with `config` and `stats` but no `suites` key and no `errors` array is
still unsupported JSON. Malformed JSON keeps the existing parse error. A
malformed `suites` value is routed to the Playwright adapter and fails with a
file-specific `Invalid Playwright JSON in <file>` error, never as a generic
unsupported input and never with a partial report.

## Mapping

| Playwright | Report |
| --- | --- |
| project name | feature; falls back to `projectId`, then the file path when the report has no project |
| file + describe path | rule, for example `checkout.spec.ts › cart › payment` |
| spec title (minus trailing `@tags`) | scenario name |
| one spec test in one project | one scenario |
| each result | one attempt; the final result is the visible one |
| `result.retry` | attempt index (the HTML shows `Attempt: retry + 1`) |
| nested result steps | flat steps in order, deeper levels prefixed with `›` |
| `result.error` / `errors` | failed step message, snippet and relative location |
| spec tags and known annotations | `@tag`, `@skip`, `@fixme`, `@fail`, `@slow` |
| every annotation | `Annotation: <type> - <description>`, or `Annotation: <type>` without one |
| `stdout` / `stderr` | `text/plain` and `application/octet-stream` attachments |
| run-level `errors` | one failed `Playwright` feature, one scenario per error |

Features use `playwright://<idPrefix>/<project>`; a report without a project name
uses `playwright://<idPrefix>/file/<normalised-file>`. Each scenario keeps the
spec file as its URI, so directory merging and provenance stay per file.

### Status

The final result, together with `test.status` and `test.expectedStatus`, drives
the scenario:

- passed -> passed;
- failed, `timedOut` or `interrupted` -> failed; the status is never treated as
  passed;
- `test.status: "flaky"` with a passed final result -> passed, plus `@flaky`;
- `test.status: "expected"` (or `expectedStatus: "failed"`) with a failed,
  timed-out or interrupted final result -> an expected failure: all step results
  are passed, the error text sits in the scenario description, and the scenario
  carries `@expected-failure`;
- an unexpected pass -> one synthetic failed step and `@unexpected-pass`;
- `skipped` with no results -> one synthetic skipped step, so the scenario stays
  visible and counts as skipped;
- a non-skipped test with no results -> an empty started attempt, visible as
  unexecuted, not passed and not skipped.

A failed result with steps but no step error keeps the ordinary steps and appends
one synthetic failed `Error` step. A test with no steps gets one synthetic step
carrying the final status and `result.duration`. Step durations are exclusive:
a parent step's duration minus its children's durations. When the visible steps
sum to less than `result.duration`, one explicit `Playwright overhead` step
carries the residual, so the scenario duration equals `result.duration`. Hidden
Playwright time is never folded silently into a child step.

### Errors

When `result.errors` is non-empty it is the failure source and every entry is
concatenated; otherwise `result.error` is used. Playwright often repeats the
same failure in both places, so this avoids showing it twice. Within an error
the message is `message`, then `value`, then `stack`. The snippet follows, then
a source location relative to the input file's directory or the process working
directory; a path outside both uses only its basename. ANSI and C0/C1 control
codes are stripped, and absolute local paths in the message, value, stack and
snippet are replaced by a relative path or basename. That includes common POSIX
roots (`/Users`, `/home`, `/tmp`, `/var`, `/opt`, `/etc`, `/usr`, `/private`,
`/mnt`, `/srv`, `/root`, `/workspace`), while normal text and URLs stay intact.
No absolute local path is embedded in the report.

## Attachments

Playwright attachments have `name`, `contentType` and either a base64 `body` or a
`path`.

- A non-empty `body` wins and is embedded with its declared content type.
- An empty `body` falls back to `path`.
- A relative `path` is resolved against the input file's directory first, then
  the process working directory. An absolute `path` must itself stay inside one
  of those roots.
- Only the final path component is `lstat`-checked. Parent symlinks are followed
  by `realpath`, and the resolved target must still be a regular file inside the
  roots. Symlinks, missing files, non-regular files, URL schemes (`http:`,
  `https:`, `file:`) and UNC/device paths (`\\`, `//`) are skipped without
  reading.
- The file is opened, then sized and read through that descriptor, so a size
  check cannot be invalidated by a path change. A file above 50 MB fails
  generation; the running total is capped at 100 MB. No partial report is
  written.
- `text/markdown` becomes `text/plain`, so `error-context.md` renders as escaped
  readable text instead of a binary download.
- Playwright trace attachments (`name: "trace"`,
  `contentType: "application/zip"`) are skipped. Other zip bodies stay ordinary
  attachments.
- `stdout` and `stderr` text entries become `text/plain`; base64 buffer entries
  become `application/octet-stream` and are never interpreted as HTML.

The process working directory root supports the common CI layout where
`reports/results.json` and `test-results/` are siblings. It is taken from the
process, never from report data. A layout where the JSON and the referenced
files live in unrelated trees is unsupported; those path attachments are
skipped, while inline attachments still work.

## Run-level errors and empty runs

A report with no suites but a non-empty `errors` array becomes a failed
`Playwright` feature; this keeps a crashed or misconfigured run from looking
empty. A report with no suites, no errors and zero stats is a valid empty run
and renders zero scenarios.

## Basic-mode limits

- No trace viewer, Playwright HTML-report replay or trace zip reading. Trace zip
  attachments are skipped and do not count towards the attachment budget.
- An embedded video attachment uses the existing inline video element only.
- Only the final attempt is rendered; earlier results supply the attempt count
  and are otherwise not exposed as scenario rows.
- Playwright producer metadata (`Playwright <config.version>`) and annotation
  descriptions are HTML-only; the JSON summary stays schema version 2.
- Playwright's JSON schema is not a formal versioned contract. Missing optional
  fields are tolerated, but malformed `suites`, `specs`, `results` and
  attachment types fail with a file-specific error.
- The usual Tolkira limits apply: 100 MB total input, 50 MB per attachment and
  100 MB total attachments.
