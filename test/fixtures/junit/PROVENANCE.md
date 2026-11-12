# JUnit producer fixture provenance

These fixtures are synthetic but modelled on the public output shape of common
JUnit XML producers. They contain no recorded CI run, real path, token or
personal data. Date recorded: 2026-11-12.

| Fixture | Producer shape | Basis | Covers |
| --- | --- | --- | --- |
| `jest-junit.xml` | jest-junit 16.x for Jest | jest-junit README and default reporter output | `<testsuites>`, `<testsuite>`, passed/failed/skipped, `<failure>`, suite-level `<system-out>` tolerated and ignored |
| `pytest.xml` | pytest 8.x `--junitxml` | pytest JUnit XML documentation and default output | suite `<properties>`, passed/failed/skipped, `<failure>`, testcase-level `<system-out>`/`<system-err>` attached |
| `gradle.xml` | Gradle 8.x test task | Gradle test reporting output | root `<testsuite>`, `<properties>`, passed/failed/error/skipped, `<failure>`, `<error>`, suite-level `<system-out>`/`<system-err>` tolerated and ignored |

The adapter maps testcase-level output only. The jest-junit and Gradle fixtures
keep suite-level output to prove the parser tolerates it without inventing test
cases or attachments; the pytest fixture carries the testcase-level output
pytest writes when `junit_logging` captures it. Testcase-level output is
asserted in `test/junit-producers.test.ts`.
