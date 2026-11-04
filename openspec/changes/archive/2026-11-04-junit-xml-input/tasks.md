# Tasks

## 1. Parser and mapping

- [x] 1.1 RED: fixture with two suites, passed/failed/skipped, `time`,
  `system-out` and `system-err`; parse into envelopes.
- [x] 1.2 GREEN: add `src/input/junit.ts` with `fast-xml-parser`; map suites,
  test cases, statuses, durations, messages and text attachments.
- [x] 1.3 RED/GREEN: ensure scenario/feature names, URIs and totals are stable.
- [x] 1.4 RED/GREEN: malformed XML fails with file context, no partial output.

## 2. Detection and loader

- [x] 2.1 RED/GREEN: add `.xml` to supported extensions and sniff JUnit XML by
  content.
- [x] 2.2 RED/GREEN: include `.xml` in directory scans; merge with JSON and
  Messages inputs.
- [x] 2.3 RED/GREEN: keep unrelated XML out of the report.

## 3. Report and summary

- [x] 3.1 RED/GREEN: JUnit input produces the normal report, filters and JSON
  summary.
- [x] 3.2 Add a basic-mode note to the report header or Analysis/Details.
- [x] 3.3 Verify no screenshot, step or attachment affordance is promised for
  JUnit input.

## 4. Packaging, docs and gate

- [x] 4.1 Add `fast-xml-parser@^5.12.0` and verify the dependency reason and
  licence.
- [x] 4.2 Document the mode and its limits in `docs/CUCUMBER-COMPATIBILITY.md`
  and the README feature list.
- [x] 4.3 Run `npm run check`, `npm run test:e2e`, `npm run stress -- 1000`,
  `npm pack --dry-run` and `openspec validate junit-xml-input --strict`.
