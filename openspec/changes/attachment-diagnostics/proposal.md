# attachment-diagnostics

## Why

Playwright path attachments outside the allowed roots are skipped, but only a
run-level count reaches the user. The research survey found attachment
reliability to be the largest request cluster (14 % of 395 issue titles). A user
with several scenarios cannot tell which one lost a screenshot or file. A
failed-hook attachment is already mapped and rendered beside the hook; that
behaviour needs a pinning test so it cannot regress.

## What Changes

- Carry the skipped path-attachment count on the final Playwright attempt and
  copy it to the internal `ReportScenario`.
- Show the existing localized path-attachment notice on the affected scenario,
  with the per-scenario count, in addition to the run-level notice.
- Pin the failed-hook attachment rendering with a test; no renderer change is
  expected.
- No JSON summary, `--json`, CI or email schema change; no new dependency. Reuse
  the existing `report.attachmentNotice` key, so no new locale key.

## Impact

- Affected capabilities: `input-formats` and `report-rendering`.
- Affected code: `src/input/playwright.ts`, `src/report/model.ts`,
  `src/render/report.ts` and tests.
- The run-level count and CLI warning stay; the report becomes more specific.

## Non-goals

- Listing every skipped attachment path or reading outside the roots.
- Changing the attachment caps, split assets or the one-file rule.
- A schema/JSON/CI/email field for skipped attachments.
- Tracing every hook output; this slice only pins the existing attachment
  rendering.
