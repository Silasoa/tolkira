# host-parity-fixes

## Why

The final host validation left two real producer gaps:

- **B-036:** Maven/Surefire puts nested test classes in one `<testsuite>`;
  Tolkira folds `Outer$Nested` into the outer feature, so 15 Surefire class rows
  become 12 features. The cases are counted, but the class distinction is lost.
- **B-034:** Cucumber-JVM writes `before`/`after` hook `output` text; Tolkira
  maps the hook status and name but drops the output. A user loses hook
  diagnostics.

## What Changes

- JUnit: when one `<testsuite>` contains testcases with more than one non-empty
  `classname`, split it into one report feature per classname, preserving every
  testcase, status, duration and source file. A suite with one classname keeps
  its current feature. No JSON/schema change beyond the existing feature count.
- Legacy JSON: accept a string or string-array `output` on `before`/`after`
  hooks and attach it as a `text/plain` hook attachment with a stable name; the
  existing hook renderer shows it beside the hook. The attachment count follows
  the existing attachment semantics.
- No new dependency, no schema field, no package change.

## Impact

- Capabilities: `input-formats` and `report-rendering`.
- Code: `src/input/junit.ts`, `src/input/legacy.ts`, tests and docs.
- The Spring host row moves from 12 to 15 features in the 2026-11-22 host run;
  the Cucumber-JVM host row shows the 12 real hook outputs from the same date.
