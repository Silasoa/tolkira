# TDD-Red record

Date: 2026-11-22
Scope: `attachment-diagnostics` tasks 2.1–2.3.
Test file: `test/attachment-diagnostics.test.ts`.
No `src/`, docs, config, fixture or existing test was changed.

## Command and result

```text
npx vitest run test/attachment-diagnostics.test.ts

Test Files  1 failed (1)
Tests       1 failed | 3 passed (4)
```

The one Red test is the new per-scenario behaviour. The other three tests are
passing guards that pin current behaviour the change must not break.

## Test map

| # | Test | Status | Pins |
|---|------|--------|------|
| 1 | shows a per-scenario notice with the final-attempt skip count | **RED** | Two outside-root path attachments: scenario count 2, scenario notice once, run-level count/notice stay, no outside read, JSON/CI/email unchanged |
| 2 | renders an inside-root attachment without a scenario notice | green | Inside root: zero count, no notice, attachment renders |
| 3 | does not show a notice when an earlier attempt skipped and the final one is clean | green | Final attempt is the only source of the scenario count |
| 4 | renders a failed hook attachment beside the hook and in the scenario list | green | Existing failed-hook attachment rendering is not regressed |

## Exact Red failures

All four failures come from test 1 and describe the same missing behaviour:
the count exists only at run level, so the scenario detail has no notice.

```text
AssertionError: expected +0 to be 2
 ❯ test/attachment-diagnostics.test.ts:139
   expect.soft(skippedCount(scenario)).toBe(2);

AssertionError: expected '<details class="scenario" id="scenario-1-1" ...'
  to contain '<div class="attachmentWarning"'
 ❯ test/attachment-diagnostics.test.ts:140
   expect.soft(detail).toContain('<div class="attachmentWarning"');

AssertionError: expected +0 to be 1
 ❯ test/attachment-diagnostics.test.ts:141
   expect.soft(occurrences(detail, escapedNotice(2))).toBe(1);

AssertionError: expected 1 to be 2
 ❯ test/attachment-diagnostics.test.ts:146
   expect(occurrences(generated.html, escapedNotice(2))).toBe(2);
```

Observed in the failing run:

- `generateReport().skippedAttachments` is already `2` and the run-level
  `noticeShell` renders; its notice occurs once in the HTML.
- `ReportScenario` has no `skippedAttachments`; `skippedCount` reads `0`.
- The scenario detail contains no `attachmentWarning` and no notice text.
- Total notice occurrences are `1` (run level only), not `2`.

The fourth failure is the duplicate signal from the same cause: with only the
run notice present, the global count cannot reach two. It is a hard assertion
because it must pass once the scenario notice exists.

## Why each Red is correct

- `specs/input-formats/spec.md` requires the final Playwright attempt to carry
  the skip count and `ReportScenario` to copy it. `src/input/playwright.ts`
  currently only increments `PlanContext.skippedAttachments`; `PlannedAttempt`
  has no count and `src/report/model.ts` has no scenario field.
- `specs/report-rendering/spec.md` requires the scenario detail to show
  `report.attachmentNotice` with that count while the run-level notice stays.
  `scenarioBody` in `src/render/report.ts` has no notice branch.
- The test asserts the contract, not an implementation shape. The scenario
  count is read through an optional cast so `tsc --noEmit` is green before the
  field exists; it is still a runtime assertion, so the test fails now and must
  pass after the field is added.
- The `2` count is the plural English catalog text. The helper escapes the two
  apostrophes exactly as `escapeHtml` does, so the match is against rendered
  HTML, not source terminology.
- The two outside files contain unique markers and neither marker appears in
  the HTML, model or attachment envelopes: the diagnostic counts without
  reading outside the roots.

## Guard behaviour (green before implementation)

- Inside root: `skippedAttachments` is `0`, no scenario or run notice, and the
  text attachment body renders. This must stay true.
- Earlier attempt outside, clean final attempt: `generateReport` reports `0`,
  the scenario attempt is `1`, no notice appears and the earlier marker is not
  read. The count must come from the final attempt only.
- Failed hook with an attachment: the failed hook `<li>` contains the
  attachment name and body, and `ReportScenario.attachments` contains the same
  attachment. This is the pinning test from the proposal; no renderer change is
  expected.
- Summary JSON, Markdown/GitHub CI text and email HTML are identical to a
  control report with no attachments. The summary has no new field, so the
  `--json`, CI and email surfaces stay unchanged while the HTML becomes more
  specific.

## Expected implementation effect

Task 3.1/3.2 should turn test 1 green: carry the final attempt's positive count
to `ReportScenario`, then render the existing notice inside the scenario detail.
Tests 2–4 and the JSON/CI/email assertions must remain green without loosening
any assertion.
