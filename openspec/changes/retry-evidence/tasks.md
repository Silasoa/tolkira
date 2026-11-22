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

- [ ] 4.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [ ] 4.2 Re-run the real Playwright retry artifact and the report-shell host
  row; record pins/results.
- [ ] 4.3 Run SCR, CR, DAR, UXR (collapsed block/320/print), SEC (earlier
  attachments), ILA (keys), CMP (retry parity), PCA (budget/memory) and STR.
- [ ] 4.4 Fix findings; record deferred decisions.
- [ ] 4.5 Commit and push; archive after the gate.

## Gate record

To be filled after verification.
