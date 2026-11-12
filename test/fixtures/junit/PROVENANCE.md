# JUnit producer fixture provenance

These fixtures are synthetic but modelled on the public output shape of common
JUnit XML producers. They contain no recorded CI run, real path, token or
personal data. Date recorded: 2026-11-12.

| Fixture | Producer shape | Basis | Covers |
| --- | --- | --- | --- |
| `jest-junit.xml` | jest-junit 16.x for Jest | jest-junit README and default reporter output | `<testsuites>`, `<testsuite>`, passed/failed/skipped, `<failure>`, testcase-level `<system-out>`/`<system-err>` |
| `pytest.xml` | pytest 8.x `--junitxml` | pytest JUnit XML documentation and default output | suite `<properties>`, passed/failed/skipped, `<failure>`, suite-level `<system-out>`/`<system-err>` |
| `gradle.xml` | Gradle 8.x test task | Gradle test reporting output | root `<testsuite>`, `<properties>`, passed/failed/error/skipped, `<failure>`, `<error>`, suite-level `<system-out>`/`<system-err>` |

The adapter does not map suite-level output; the pytest and Gradle fixtures
keep it to prove the parser tolerates it without inventing test cases or
attachments. Testcase-level output is asserted as text attachments in
`test/junit-producers.test.ts`.
