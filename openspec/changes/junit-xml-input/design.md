# Design

## Why JUnit XML

It is the one format nearly every framework and CI system can emit. It is not a
rich report model: a `<testcase>` has a name, `classname`, `time`, a status
element and optional `system-out`/`system-err`. There are no steps and no
screenshots. That is acceptable for a basic mode whose job is "show me what
failed and how long it took".

## Parser

Use `fast-xml-parser@^4.5.3` (MIT, one dependency, `strnum`). A hand-written
XML parser would be a security and correctness liability. The parser is a
runtime dependency; it is external in the CLI/index bundle and installed with
the package.

Configuration:

- preserve attributes (`classname`, `file`, `time`, `message`);
- force arrays for `testsuite`, `testcase`, `failure`, `error`, `skipped`,
  `system-out`, `system-err`;
- parse tag values as strings;
- do not resolve external entities or DTDs.

Input is still capped by the existing 100 MB total input limit.

## Mapping

| JUnit XML | Report model |
| --- | --- |
| `<testsuites>` | run container (optional) |
| `<testsuite name="...">` | feature; name falls back to `classname` or `JUnit XML` |
| `<testcase name="..." classname="...">` | scenario with one synthetic step |
| `<failure>` / `<error>` | failed; `message` + text become the step message |
| `<skipped>` | skipped |
| no status child | passed |
| `time="1.234"` | duration 1234 ms; missing/NaN -> 0 |
| `<system-out>` / `<system-err>` | `text/plain` attachments on the scenario |
| `file` attribute | scenario URI; otherwise the input file |

Every testcase gets a stable synthetic pickle/step/test-case pair so the
existing report view model, filters and JSON summary work unchanged.

## Detection

- Add `.xml` to the supported extensions.
- In `loadEnvelopes`, sniff XML before Messages: first non-whitespace character
  is `<` and the content contains `<testsuite` or `<testsuites`.
- Explicit malformed XML fails with a file/line error; directory scan ignores
  non-JUnit `.xml` files? No: a `.xml` file in a report directory that looks
  like JUnit is parsed; a malformed `.xml` fails unless the compatibility shim's
  `ignoreBadJsonFile` path is used (that shim is legacy-JSON only for now).
- Do not treat arbitrary XML as JUnit.

## Status and totals

- Failure/error -> failed; skipped -> skipped; otherwise passed.
- The scenario duration is the testcase `time`.
- The run duration is the sum of scenario durations.
- No retries, parameters, fixtures or attachments beyond `system-out`/`err`.

## Limitations

- No screenshots, videos, traces or arbitrary attachments.
- No Gherkin steps, doc strings or data tables.
- `<properties>` and `<testsuite>` totals are not trusted; Tolkira recomputes.
- JUnit XML dialects differ in attribute names; v0.1 handles the common
  Jenkins/Gradle/Maven/pytest/Playwright shape and fails clearly otherwise.

## Security

- Escaping, CSP and attachment sanitisation are inherited.
- XML input is untrusted: no DTD/external entity resolution, 100 MB input cap,
  and text is escaped in the report.
- `system-out`/`err` are text attachments, never HTML.
