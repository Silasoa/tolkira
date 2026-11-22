# retry-evidence

## Why

Flaky/retry visibility is the second research cluster: users want to know why a
scenario failed before it passed. Tolkira already renders the final attempt,
shows `Attempt: n` and (since 0.5) a Flaky share in Trends, but the earlier
attempt's error and screenshot are parsed away from the report. The backlog
entry B-043 asks for exactly this evidence. This change is display-only and does
not change the flaky status, the summary schema or the history schema.

## What Changes

- The Playwright adapter keeps earlier attempts (already present as separate
  `testCaseStarted` envelopes) and adds one earlier screenshot from the first
  failed earlier attempt when it fits a run-level 10 MB retry-evidence budget.
  Earlier attachments stay out of the summary counts and the total attachment
  cap is respected; final attachments are planned first and always win.
- The report index exposes all starts per pickle, and the internal report model
  carries up to three executed earlier attempts with attempt number, status,
  duration, first failure message and at most one image per report.
- The scenario detail gains a collapsed, JS-free "Earlier attempts" block with
  status, duration, error text and the image. It shows `3 of 5` when capped, is
  escaped, included in print and hidden for single-attempt scenarios.
- Legacy JSON has no retry model and keeps today's output. Messages with
  multiple starts work. The summary schema 2, JSON, CI, email, history and
  dependencies do not change.

## Impact

- Capabilities: `input-formats`, `report-rendering`.
- Code: `src/input/playwright.ts`, `src/report/index-run.ts`,
  `src/report/model.ts`, `src/render/report.ts`, `src/render/report.css`,
  locale catalogs, attachment budget config.
- Tests/docs: Playwright/Messages retry tests, summary/CI/email guards, report
  e2e/print, LIMITATIONS, AGENT-INTERFACE, README, CHANGELOG, BACKLOG B-043.
- Host: real Playwright retry artifact (the movies-app pin had no retries);
  Seed-Test report-shell row where available.

## Non-goals

- A flaky/passed-after-retry status or a summary schema field.
- Retry history in the sidecar, filters, or a retry trend.
- All earlier attachments, all earlier screenshots, trace viewer or diffs.
- Changing the 50 MB/100 MB caps, the one-file rule or the summary version.
- Earlier evidence for legacy JSON, which has no retry data.
