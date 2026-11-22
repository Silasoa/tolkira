# TDD-Red record — host-parity-fixes

Date: 2026-11-22
Test file: `test/host-parity-fixes.test.ts`. No `src/`, docs, config, fixture or
existing test was changed.

Command: `npx vitest run test/host-parity-fixes.test.ts`
Result: 4 tests, 2 failed, 2 passed. `npx tsc --noEmit` passes.

## Red failures

1. `JUnit nested classes > splits one testsuite into one feature per classname`

   ```text
   AssertionError: expected 1 to be 2
    ❯ test/host-parity-fixes.test.ts:48
      expect(summary.counts.features).toBe(2);
   ```

   Why correct: `featureFromSuite` returns exactly one feature per `<testsuite>`
   and never reads `classname`; `Outer` and `Outer$Nested` are folded together.
   The spec requires one feature per distinct classname with all cases,
   statuses, durations and source preserved.

2. `legacy hook output > attaches before and after hook output as text attachments`

   ```text
   AssertionError: expected [] to have a length of 2 but got +0
    ❯ test/host-parity-fixes.test.ts:157
      expect(attachments).toHaveLength(2);
   ```

   Why correct: `LegacyStep` has no `output`; the hook loop emits only
   `testStepStarted`/`testStepFinished` and step embeddings, so no hook
   attachment envelope exists. The spec requires a `text/plain` attachment tied
   to the hook test step, named `Before hook output` / `After hook output`,
   with array lines joined by `\n`, counted by the summary and rendered by
   `renderHook`.

## Green guards

- One-class suite: one feature named `checkout` (green now, must stay).
- No hook output: no attachment envelopes, summary total 0, no output name in
  the HTML (green now, must stay).

## Notes

- JUnit feature names are asserted exactly as the classname (classname-only, no
  suite prefix).
- `basic.xml` has three classnames in one suite, so its current 2-feature
  expectation in `test/junit.test.ts` is an intentional later adjustment, not
  a guard this change can keep unchanged.
