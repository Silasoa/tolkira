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

- [ ] 4.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [ ] 4.2 Record a local Playwright fixture with outside/missing/unreadable
  attachments plus the Playwright movies-app report-shell row; record the exact
  fixture, pin and result. The Seed-Test host is legacy and has no Playwright
  skips.
- [ ] 4.3 Run SCR, CR, DAR, UXR (notice/list), SEC (names/escaping), ILA (keys),
  CMP (attachment parity) and STR.
- [ ] 4.4 Fix findings; record deferred decisions.
- [ ] 4.5 Commit and push; archive after the gate.

## Gate record

To be filled after verification.
