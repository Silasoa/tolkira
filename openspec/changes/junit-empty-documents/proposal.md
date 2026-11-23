# junit-empty-documents

## Why

The 0.5.1 PetClinic host run found that one zero-test Surefire document fails
the whole directory render. A real `mvn test` with Docker off writes
`PostgresIntegrationTests.xml` as a valid `<testsuite tests="0">` with no
`<testcase>`. Tolkira rejects that document and stops, so the other 79 usable
tests never reach the report.

The rejection was designed for a single explicit file: a document with no test
cases is more likely a wrong path or a wrong format than a report. In a
directory produced by a test runner, an empty suite is normal (a skipped
integration class, a conditional test group). One such file should not hide the
rest of the run.

## What Changes

- A JUnit document with no test cases is skipped when it is found in a
  directory scan; the remaining documents render normally.
- A JUnit document with no test cases that is named explicitly still fails with
  the existing clear file-specific error. An explicit file is a deliberate
  request and keeps the wrong-file guard, including when the same file is also
  found in a scanned directory.
- Invalid or malformed XML, DTD/entity declarations and unsafe markup still
  fail hard, including inside a directory. The skip is limited to a
  well-formed document that is exactly one recognised `<testsuites>`,
  `<testsuite>` or `<testcase>` root and contains no `<testcase>` anywhere. A
  wrapper root (for example `<testResults>`), a multi-root document and a
  `<testcase>` under an unrecognised element still throw the existing
  `Unsupported JUnit XML ...` error.
- When every scanned JUnit document is zero-test, the run fails with the
  loader's existing `No supported report files found.` error and writes no
  report. A mixed Cucumber + zero-test JUnit directory still succeeds.
- `docs/JUNIT-XML.md` states the directory rule; `docs/CHANGELOG.md` gets a
  0.5.1 bullet; B-047 is resolved.

## Impact

- Capability: `input-formats`.
- Code: `src/input/junit.ts` (parser option and two guard helpers),
  `src/input/load.ts` (pass the option for directory files only; re-validate an
  explicit JUnit duplicate in the dedup branch).
- Tests: `test/junit.test.ts`.
- Docs: `docs/JUNIT-XML.md`, `docs/CHANGELOG.md`, `docs/BACKLOG.md`,
  `docs/DROP-IN-VALIDATION.md` (host re-run).
- No report, summary, history, catalog, CSS or dependency change. A valid
  directory renders the same bytes as before; a directory that previously
  failed now renders its usable documents. The skipped file still contributes a
  loader group and stays in the `inputFiles` count, as an unrelated scanned
  file already does.

## Out of scope

- Rendering a zero-test JUnit document as an empty feature or a visible notice.
- Changing the Playwright empty-run behaviour (it already accepts an empty run).
- The zero-byte attachment drop, which remains a recorded decision.
- Any change to the explicit-file error message or exit code.
