# Proposal

## Why

Tolkira is Cucumber-native, but many teams outside BDD still have weak or stale
HTML reporting. The cheapest useful breadth is **JUnit XML**: nearly every test
framework and CI system emits it, and it needs one adapter rather than one per
framework. This is a basic mode, not a replacement for the Cucumber report.

The trade-off is explicit: JUnit XML has no Gherkin steps, no screenshots and
no attachment model. Tolkira will show suites, test cases, status, duration,
failure text and `system-out`/`system-err`, and will say so.

## What Changes

- Accept `.xml` input files and scan directories for them.
- Parse JUnit XML into the existing Cucumber Messages/report model:
  - `<testsuite>` -> feature;
  - `<testcase>` -> scenario with one synthetic step;
  - `<failure>` / `<error>` -> failed, `<skipped>` -> skipped, otherwise passed;
  - `time` seconds -> milliseconds;
  - `system-out` / `system-err` -> text attachments.
- Add `fast-xml-parser@^5.12.0` (MIT, six transitive dependencies) as the XML
  parser. This is the written reason for a new runtime dependency: a correct
  XML parser is not worth hand-rolling, and JUnit XML is the cheapest broad
  input.
- Document the mode as **basic**: no screenshots, no steps, no Gherkin.
- Keep the Cucumber path unchanged and rich.

## Capabilities

### Modified Capabilities

- `input-formats`: add JUnit XML as a basic input alongside legacy Cucumber
  JSON and Messages.

## Impact

- New runtime dependency; it is external in the CLI/index bundle.
- Updates input detection, tests and `docs/CUCUMBER-COMPATIBILITY.md`.
- No change to the report model or the JSON summary schema; JUnit XML maps into
  the existing model.
