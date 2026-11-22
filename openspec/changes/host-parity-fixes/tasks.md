# Tasks

## 1. Gate

- [x] 1.1 Validate the spec/design; confirm JUnit split semantics and hook
  output attachment, no schema/dependency/locale change.
- [x] 1.2 Confirm the existing hook renderer and JUnit fixture helpers.

## 2. TDD-Red

- [x] 2.1 JUnit nested-class fixture: two features, all cases/statuses/source;
  one-class suite unchanged.
- [x] 2.2 Legacy hook output string/array -> hook attachment/body/name and
  rendered text; no output -> no attachment.
- [x] 2.3 Confirm RED for the missing split/attachment; guards stay green.

## 3. Implement

- [x] 3.1 Split JUnit suites by classname when multiple.
- [x] 3.2 Map legacy hook output to a text/plain hook attachment.
- [x] 3.3 Update `docs/JUNIT-XML.md`, `docs/CUCUMBER-COMPATIBILITY.md`,
  `docs/CHANGELOG.md`, `docs/BACKLOG.md` (B-034/B-036 resolved) and
  `docs/DROP-IN-VALIDATION.md` host expectations.
- [x] 3.4 Keep JSON/CI/email schemas, dependencies and the one-file rule
  unchanged beyond the existing feature/attachment totals.

## 4. Verification and review

- [x] 4.1 Run `npm run hygiene`, `npm run check`, `npm run test:e2e` and the
  final host matrix.
- [x] 4.2 Run SCR, CR, DAR, UXR and CMP; SEC if hook attachments need it.
- [x] 4.3 Fix findings; record deferred decisions.
- [x] 4.4 Commit and push; no release until the separate release approval.

## Gate record

- Hygiene: ok (659 tracked files, 265 commits).
- Check: 72 files, 1077 passed, 4 skipped; typecheck, lint, build and i18n green.
- E2E: 358 passed, 8 skipped.
- Hosts: Spring 2026-11-22, 15 features/59 scenarios, exact Surefire match;
  Cucumber-JVM 2026-11-22, 3 features/9 scenarios/52 results/12 real hook
  outputs; Playwright movies-app 8/8; Cucumber-JS legacy/Messages byte-equal.
- Reviews: SCR, CR, DAR, UXR and CMP PASS after the fixer/recheck rounds.
- Deferred: the Seed-Test app and optional producer variants need their own
  stacks; a written host-matrix exception covers this release. All-green host
  runs do not exercise failure/skip rendering; the two-line hook join is
  synthetic-only; split JUnit suites change feature count and
  `scenarios[].feature` names. No schema, dependency or one-file change.
