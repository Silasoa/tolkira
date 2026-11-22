# Tasks

## 1. Gate

- [x] 1.1 Validate the spec and design; confirm the display-only scope, 10 MB
  budget, final-first cap order, summary/history schema unchanged and the
  one-image rule.
- [x] 1.2 Confirm the Playwright/index/model/render/print seams and the real
  retry fixture with an earlier image.

## 2. TDD-Red

- [x] 2.1 Playwright: failed-then-passed status/error/duration/image from a
  synthetic fixture; no image; >3 earlier attempts; run-level budget omission;
  earlier skip not counted; final-first cap.
- [x] 2.2 Messages: multiple starts, repeated/missing attempt numbers, earlier
  error; no earlier image (unmarked envelope ignored); legacy none.
- [x] 2.3 Model: ordered/capped earlier attempts, `3 of 5`, one image per
  report, summary/JSON/CI/email/history unchanged.
- [x] 2.4 Render: collapsed details, escaped message/name, image, print,
  320 px/200%.
- [x] 2.5 en/de keys and `i18n:check`; confirm RED and record it.

## 3. Implement

- [x] 3.1 Add `allAttempts` to the index and `ReportEarlierAttempt` to the
  model.
- [x] 3.2 Read one earlier image under the 10 MB budget, final first.
- [x] 3.3 Render the earlier-attempt block, styles and new keys.
- [x] 3.4 Update LIMITATIONS, AGENT-INTERFACE, README, CHANGELOG and B-043.
- [x] 3.5 Keep summary, history, CI, email, dependencies and caps unchanged.

## 4. Verification and review

- [x] 4.1 Run `npm run hygiene`, `npm run check` and the retry e2e spec
  (`--project=chromium`).
- [x] 4.2 Re-run the checked-in Playwright retry fixture and the report-shell
  host row; record pins/results.
- [x] 4.3 Run SCR, CR, DAR, UXR (collapsed block/320/print), SEC (earlier
  attachments), ILA (keys), CMP (retry parity), PCA (budget/memory) and STR.
- [x] 4.4 Fix findings; record deferred decisions.
- [ ] 4.5 Commit and push; archive after the gate.

## Gate record

- Retry unit suites: 3 files, 26 tests passed (`playwright-retry-evidence`,
  `messages-retry-evidence`, `render-retry-evidence`).
- Retry e2e: `npx playwright test test/e2e/retry-evidence.spec.ts
  --project=chromium`, 3 passed (1.7 s).
- `npm run check`: pass; i18n 24 passed, 78 files / 1203 passed / 5 skipped.
- `npm run hygiene`: pass (739 tracked files, 295 commits).
- Host: checked-in `test/fixtures/playwright/retry-evidence.json` (2,616 B,
  synthetic Playwright JSON shape per `PROVENANCE.md`, config 1.65.0) rendered
  with the built 0.5.0 CLI: 1 scenario, 1 earlier attempt, 67,516 B report.
  Playwright 1.65.1 / Chromium 159.0.8154.6 at 1440x900 and 390x844: collapsed
  `Earlier attempts (1)`, failed 1.2 s, `Error: payment gateway timed out`, one
  image; no document overflow (1425/1440 and 375/390 px), no block overflow, no
  console or page errors. Row in `docs/DROP-IN-VALIDATION.md`.
- Reviews: SCR and DAR blockers fixed in this pass. The byte seam is
  `retryEvidenceFits` with boundary tests for exactly 10 MB, one byte over and
  the final-first reserve; the docs and backlog now state the one-image
  behaviour. 4.5 stays open; no new deferred decisions.
