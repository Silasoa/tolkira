# Tasks

## 1. Gate

- [x] 1.1 Validate the spec and design; confirm the Azure command mapping,
  caps, no-task-result/exit-0 contract and no schema/locale/dependency change.
- [x] 1.2 Confirm the existing CI formatter seams, CLI `--ci-out` rejection and
  docs structure.

## 2. TDD-Red

- [x] 2.1 Azure failure/warning/final/empty annotations and exact counts.
- [x] 2.2 Caps, omitted line, 4000-character truncation, newline/`%`/`]`/ANSI
  escaping, no task-result command, unexecuted counted only.
- [x] 2.3 `--ci azure` accepted; `--ci azure --ci-out` exits 2; `--json --ci
  azure` remediation; invalid `--ci` lists azure; GitHub/Markdown full strings
  unchanged; failed scenarios still exit 0.
- [x] 2.4 Confirm RED for the missing Azure format; existing CI tests stay
  green.

## 3. Implement

- [x] 3.1 Add `azure` to `CiFormat`, `formatAzure`, CLI usage/parser/rejection.
- [x] 3.2 Add the docs/CI Azure, Jenkins and shard recipes;
  `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`, README and CHANGELOG.
- [x] 3.3 Add BACKLOG B-042 for the deferred all-expanded no-JS mode.
- [x] 3.4 Keep report, JSON, email, history, PDF, locale and dependencies
  unchanged.

## 4. Verification and review

- [x] 4.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 4.2 Run SCR, CR, DAR, SEC (CI text injection), CMP and STR; no UXR/ILA
  because no report UI or locale string changes.
- [x] 4.3 Fix findings; record deferred decisions.
- [x] 4.4 Commit and push; archive after the gate.

## Gate record

- Hygiene: ok (687 tracked files, 273 commits).
- Check: 74 files, 1129 passed, 4 skipped; typecheck, lint, build and i18n
  green.
- E2E: 364 passed, 8 skipped (Chromium, Firefox and WebKit; 320/390/768/1024/
  1440 and 320 at 200% text zoom).
- Host: no DROP-IN row. This is deterministic CLI text plus documentation, not
  an input adapter, report shell, print/PDF/email or compatibility-shim change.
  Azure commands are unit-tested; Azure, Jenkins and shard recipes are
  documented/unit-tested, not live-host-tested.
- Reviews: SCR, CR, DAR, SEC, CMP and STR PASS after the fixer and rechecks.
- Deferred: Azure/Jenkins/shard recipes have no live-host run; Azure's Issues
  view may show at most 10 issues per severity even though up to 50/20 commands
  reach the log; 4000 code points can expand after percent escaping; B-042
  static all-expanded no-JS mode is out of scope.
- No report, JSON schema, email, locale or dependency change; GitHub and
  Markdown bytes are unchanged. The Azure tests live in `test/ci.test.ts` and
  `test/cli-ci.test.ts`; the temporary `test/ci-publishing.test.ts` was removed.
