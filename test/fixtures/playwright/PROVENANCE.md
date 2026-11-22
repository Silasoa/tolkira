# Playwright JSON fixture provenance

`real-run.json` is a sanitized copy of a local Playwright 1.65.0 JSON reporter
run recorded on 2026-11-18 with two projects (`alpha`, `beta`), retries,
nested steps, inline and path attachments, expected failures, an unexpected
pass, a timed out test and a flaky retry. The raw report stays out of the
repository. Sanitization replaced absolute paths with fixture-relative paths,
removed the Playwright stack traces and terminal colour escapes, and reduced
the config block to the fields the adapter can read. No real user name, email,
token, host or absolute local path remains.

The attachment files in `attachments/` are small synthetic stand-ins for the
files the raw run referenced. `error-context.md` models Playwright's Markdown
error-context page; `note-file.txt` models a `testInfo.attach({ path })`
attachment. Both live inside this fixture directory, so the adapter may read
them.

The remaining fixtures are synthetic and modelled on the documented Playwright
JSON shape. They contain no recorded CI run, real path, token or personal data.

| Fixture | Basis | Covers |
| --- | --- | --- |
| `real-run.json` | sanitized Playwright 1.65.0 JSON reporter output | two projects, file and describe rules, tags, annotations, inline PNG/text attachments, safe path attachment, Markdown error context, failed/flaky/skipped/passed, retries, timed out, expected failure, unexpected pass, nested steps |
| `nested-describes.json` | Playwright JSON shape | two files in one project, several describe levels, tagged file/describe/spec titles, annotation in the scenario description, nested steps with a subtitle |
| `statuses.json` | Playwright JSON shape | `interrupted`, expected failure from `timedOut`, skipped without results, non-skipped without results, a failed result whose step has no error, known annotation tags and descriptions |
| `steps.json` | Playwright JSON shape | one failed step with passed siblings, skipped step status, a failed result without a step error |
| `output.json` | Playwright JSON shape | `stdout`/`stderr` text and base64 buffer entries |
| `errors.json` | Playwright JSON shape | run-level `errors` with no suites and a config location |
| `error-locations.json` | Playwright JSON shape | error locations at the end, mid-sentence and with backslashes; two errors with different locations; no-column and line-prefix locations; column in the text for a no-column location |
| `skipped-no-steps.json` | Playwright JSON shape | pass, fail and a statically skipped test without results, for executed-skip counts |
| `two-files.json` | Playwright JSON shape | one project feature spanning `sample-a.spec.ts` and `sample-b.spec.ts`, for the `2 spec files` label |
| `retry-evidence.json` | Playwright JSON shape | failed-then-passed retry with an inline PNG and an error message, for earlier-attempt evidence |
| `empty.json` | Playwright JSON shape | no suites and no errors |
| `malformed-*.json` | Playwright JSON shape | invalid `suites`, suite `specs`, test `results` and attachment `contentType` |
