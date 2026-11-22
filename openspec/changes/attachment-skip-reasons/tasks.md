# Tasks

## 1. Gate

- [x] 1.1 Validate the spec and design; confirm the final-attempt scope, reason
  enum, name sanitization, caps and no schema/locale-count change beyond the new
  notice keys.
- [x] 1.2 Confirm the Playwright/model/render/CLI seams and the archived
  `attachment-diagnostics` change is not duplicated.

## 2. TDD-Red

- [x] 2.1 Playwright: outside, missing, unreadable, not-regular, non-local, mixed,
  >3 cap, sanitized name, count includes all, caps still throw.
- [x] 2.2 Model/render: entries copied, escaped list, more-line, run notice,
  print.
- [x] 2.3 CLI/compat: generic warning, exact count, no names on stderr.
- [x] 2.4 en/de keys and `i18n:check`; existing tests stay green.
- [x] 2.5 Confirm RED for the missing entries/notice; record it.

## 3. Implement

- [x] 3.1 Add the skip reason/name types and WeakMap entries.
- [x] 3.2 Classify Playwright candidates and record final-attempt entries.
- [x] 3.3 Copy entries to the model and render the notices/list.
- [x] 3.4 Make the CLI/compat warning reason-neutral.
- [x] 3.5 Update LIMITATIONS, AGENT-INTERFACE, PLAYWRIGHT-JSON, GLOSSARY,
  README/CHANGELOG and catalogs. State that the run-level skipped count now
  includes missing, unreadable, non-regular and non-local paths.
- [x] 3.6 Keep summary, CI, email, history, dependencies and caps unchanged.

## 4. Verification and review

- [x] 4.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 4.2 Record a local Playwright fixture with outside/missing/unreadable
  attachments plus the Playwright movies-app report-shell row; record the exact
  fixture, pin and result. The Seed-Test host is legacy and has no Playwright
  skips.
- [x] 4.3 Run SCR, CR, DAR, UXR (notice/list), SEC (names/escaping), ILA (keys),
  CMP (attachment parity) and STR.
- [x] 4.4 Fix findings; record deferred decisions.
- [ ] 4.5 Commit and push; archive after the gate.

## Gate record

- 4.1 `npm run check`: i18n 24/24, typecheck, lint, build and unit
  **1175 passed / 5 skipped** (three new review-fix tests; the earlier gate was
  1172/5). The five skips are Windows-only guards; three are the Playwright
  platform cases (chmod-unreadable file, symlinked non-regular attachment,
  symlinked path). `npm run test:e2e`: **373 passed / 8 skipped** (Chromium,
  Firefox, WebKit, 1.5 min). The focused
  `test/e2e/attachments.spec.ts --project=chromium` run is **3/3**.
- 4.2 Local fixture `%TEMP%\opencode\attachment-skip-host-20261122` (Playwright
  1.65.0 JSON, built 0.5.0 CLI): one outside-root, one missing and one
  Windows-locked unreadable path attachment. Output: notice **3 path attachments
  were skipped.**; list `outside.png - outside the allowed roots`,
  `missing.png - missing`, `locked.png - unreadable`; the sanitized names drop
  their `shots/` prefix. The HTML contains no fixture, outside or cwd absolute
  path. The CLI stderr warning is count-only. Playwright movies-app pin
  `5d2cdf0` (`playwright.json`): 8/8 scenarios, no document overflow at 1440 or
  390, 0 console errors.
- Count semantics: the run-level `skippedAttachments` now counts every skipped
  final-attempt path attachment (outside, missing, unreadable, not-regular,
  non-local); the summary schema, CI text, email and history are unchanged.
  Earlier attempts stay out of scope (`retry-evidence`).
- 4.3 Reviews done: SCR, CR, DAR, UXR, SEC, ILA, CMP and STR. Findings fixed in
  this pass: stale backlog entries, naming and changelog tense, the where-line,
  arbitrary URL schemes, the zero-count/entries guard, Red scaffolding, the
  test-file BOM, print-test relaxations moved back to `report-css-minify`, and
  the name-cap loop/comment.
- 4.4 All findings fixed; no deferred decision. The CSS-minify test
  relaxations stay with the in-flight `report-css-minify` change. 4.5 remains
  open.
