# TDD-Red record

- Date: 2026-11-23
- Scope: tests only. `test/junit.test.ts` changed; no production, docs,
  catalogs, CSS or fixtures touched.
- Command: `npx vitest run test/junit.test.ts`
- Result: 28 tests, 6 failed, 22 passed. All 6 failures are the new
  directory-skip behaviour; the guards pass.

## Added tests

New `describe('empty JUnit documents in a directory')` inside
`describe('JUnit XML input')`, using the existing `tempDir`, `copyFile` and
`writeFile` helpers.

| # | Test | Kind |
|---|------|------|
| 1 | `skips a Surefire zero-test document and renders the rest` | new-red |
| 2 | `skips a bare zero-test testsuite and renders the rest` | new-red |
| 3 | `rejects a directory with only zero-test documents and writes no report` | new-red |
| 4 | `rejects an explicit list that includes a zero-test document` | guard |
| 5 | `rejects a malformed JUnit document in a directory instead of skipping it` | guard |
| 6 | `renders exactly one scenario for one test case plus an empty document` | new-red |
| 7 | `skips two empty documents and renders the usable one` | new-red |
| 8 | `keeps a skipped empty document in the input-file count` | new-red |
| 9 | `keeps nested test cases when the wrapper suite has none of its own` | guard |

Existing tests kept unchanged:

- `rejects a JUnit document without test cases` — guard for an explicit
  zero-test file (required case 4).
- `maps nested suites and ignores an empty suite` — existing nested-suite
  coverage; no duplicate added.

## RED proof

All new-red failures come from the current `Unsupported JUnit XML ...` throw
during directory load, not from compile or type errors. The numbers are the
table numbers above.

1. Table #1 `skips a Surefire zero-test document and renders the rest`
   `Error: Unsupported JUnit XML in ...\empty.xml: expected <testsuites> or <testsuite> with <testcase>.`
2. Table #2 `skips a bare zero-test testsuite and renders the rest`
   `Error: Unsupported JUnit XML in ...\empty.xml: expected <testsuites> or <testsuite> with <testcase>.`
3. Table #3 `rejects a directory with only zero-test documents and writes no report`
   `expected [Function] to throw error matching /No supported report files found\./ but got 'Unsupported JUnit XML in ...\bare.xml: ...'`
4. Table #6 `renders exactly one scenario for one test case plus an empty document`
   `Error: Unsupported JUnit XML in ...\empty.xml: expected <testsuites> or <testsuite> with <testcase>.`
5. Table #7 `skips two empty documents and renders the usable one`
   `Error: Unsupported JUnit XML in ...\bare.xml: expected <testsuites> or <testsuite> with <testcase>.`
6. Table #8 `keeps a skipped empty document in the input-file count`
   `Error: Unsupported JUnit XML in ...\empty.xml: expected <testsuites> or <testsuite> with <testcase>.`

## Guards (green before the change)

- Table #4 `rejects an explicit list that includes a zero-test document` — pins
  the explicit-file boundary: `/Unsupported JUnit XML in .*empty\.xml/`.
- Table #5 `rejects a malformed JUnit document in a directory instead of
  skipping it` — pins `/Invalid JUnit XML in .*broken\.xml at line \d+/`; the
  skip must not swallow a parse error.
- Table #9 `keeps nested test cases when the wrapper suite has none of its own`
  — a document whose root suite only wraps a non-empty child suite still
  renders.
- `rejects a JUnit document without test cases` (existing) — the explicit-file
  scenario keeps the specific error.

## Command output summary

```
Test Files  1 failed (1)
     Tests  6 failed | 22 passed (28)
  Duration  621ms
Exit code: 1
```

## Notes and deviations

- Table #3 asserts both the loader error through `renderReport` and, through
  `runCli([dir, '--out', output])`, that the output directory stays empty.
- Table #8 asserts the skipped file still counts as an input file
  (`generateReport(dir).inputFiles === 2`); no path matching is involved.
- Table #9 was added because the existing nested fixture has a direct test case
  on the wrapper suite; the wrapper-only shape was not covered.

## Fixer pass (review findings, 2026-11-23)

The four reviews found that the first skip was wider than "no test cases": any
zero-suite parse was skipped, including an unrecognised wrapper root, a
multi-root document and a `<testcase>` nested under an unknown element. The
guard now requires one recognised root and no `<testcase>` anywhere; the added
tests are listed in `tasks.md`. Seven tests were added, none removed or
weakened: 35/35 pass in this file.
