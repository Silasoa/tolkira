# junit-empty-documents

## Why

The 0.5.1 PetClinic host run found that one zero-test Surefire document fails
the whole directory render. A real `mvn test` with Docker off writes
`PostgresIntegrationTests.xml` as a valid `<testsuite tests="0">` with no
`<testcase>`. Tolkira rejects that document and stops, so the other 78 usable
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
  request and keeps the wrong-file guard.
- Invalid or malformed XML, DTD/entity declarations, multi-root documents and
  unsafe markup still fail hard, including inside a directory. The skip is
  limited to a well-formed document that simply contains no `<testcase>`.
- When every scanned document is empty, the run fails with the loader's existing
  `No supported report files found.` error and writes no report.
- `docs/JUNIT-XML.md` states the directory rule; `docs/CHANGELOG.md` gets a
  0.5.1 bullet; B-047 is resolved.

## Impact

- Capability: `input-formats`.
- Code: `src/input/junit.ts` (one parser option), `src/input/load.ts` (pass the
  option for directory files only).
- Tests: `test/junit.test.ts`.
- Docs: `docs/JUNIT-XML.md`, `docs/CHANGELOG.md`, `docs/BACKLOG.md`,
  `docs/DROP-IN-VALIDATION.md` (host re-run).
- No report, summary, history, catalog, CSS or dependency change. A valid
  directory renders the same bytes as before; a directory that previously
  failed now renders its usable documents. The skipped file still appears in
  the input-file list, as an unrelated scanned file already does.

## Out of scope

- Rendering an empty JUnit document as an empty feature or a visible notice.
- Changing the Playwright empty-run behaviour (it already accepts an empty run).
- The zero-byte attachment drop, which remains a recorded decision.
- Any change to the explicit-file error message or exit code.
