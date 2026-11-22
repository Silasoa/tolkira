# Design

## Context

`src/input/playwright.ts` reads path attachments through
`resolveAttachmentPath`. When every candidate is outside the input file's folder
and the working directory, it increments `context.skippedAttachments` and returns
undefined. `attachmentsForResult` collects the final attempt's inline and path
attachments. `src/report/model.ts` copies the final attempt's attachments into
`ReportScenario`; the run-level `skippedAttachments` reaches `renderHtml`, which
shows `report.attachmentNotice`. Hook attachments already live on `ReportHook`
and `renderHook` renders them; the slice pins that with a test.

## Input

- Add `skippedAttachments: number` to `PlannedAttempt`.
- `resolveAttachmentPath` gets an optional on-skip callback; it still increments
  the run-level `context.skippedAttachments` and calls the callback for the
  local attempt counter.
- `attachmentsForResult` returns `{ attachments, skipped }`: count only path
  attachments that were outside every root, not inline bodies, missing paths or
  trace zips. The final attempt stores the count; earlier attempts store zero.
- The synthetic Playwright error attempt stores zero.

## Model and report

- Add optional `skippedAttachments` to `ReportScenario`; set it from the final
  attempt when positive.
- In the scenario body, before the attachment list, render the existing
  `report.attachmentNotice` with the count inside the existing
  `attachmentWarning` style. The run-level notice stays.
- The count is internal; the summary, `--json`, CI and email do not change.
- The failed-hook attachment path is unchanged and gets a regression test.

## Tests

- Playwright fixture with a final attempt path attachment outside the roots:
  the attempt/scenario count is positive, the scenario HTML contains the notice,
  the run-level count stays, and the attachment is absent.
- A path inside the roots: no scenario notice; the attachment renders.
- An earlier attempt skip with a clean final attempt: no scenario notice.
- A failed hook with an attachment: the hook renders the attachment and the
  scenario attachment list contains it.
- JSON/CI/email byte checks stay unchanged; no new catalog key.

## Risks

- The run-level and per-scenario notices can both appear for one skip; the
  per-scenario one identifies the owner and is the useful addition.
- A path outside every root is not read; the count is diagnostic only.
- The report size grows by the notice text only when a skip exists.
