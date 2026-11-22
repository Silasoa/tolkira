# ci-publishing

## Why

GitHub Actions and GitLab recipes are documented, but Azure DevOps has no
annotation format and Jenkins HTML Publisher and sharded-report setups have no
recipe. This is the small remaining CI slice from the 0.5 research: Azure
annotations plus documented (not live-tested) Jenkins and merge-reports
recipes. The large all-expanded no-JS mode is deliberately deferred.

## What Changes

- `--ci azure` emits Azure DevOps logging commands: errors for executed failed,
  undefined and ambiguous scenarios, warnings for executed skipped, pending and
  unknown scenarios, and a final section with the exact counts. Unexecuted
  scenarios are counted only. It keeps exit 0, emits no `##vso[task.complete]`,
  caps annotations (50 error/20 warning) with an omitted line, truncates messages
  at 4000 code points and escapes `%`, `]`, CR and LF into one inert line.
- `--ci-out` stays Markdown-only; `--ci azure` with `--ci-out` is invalid usage,
  and the `--json` remediation does not suggest `--ci-out` for azure.
- `docs/CI.md` gains Azure, Jenkins HTML Publisher and sharded-report recipes.
  The Jenkins recipe states the inline/CSP behavior and the current no-JS limit;
  the deferred all-expanded no-JS mode is recorded as B-042.
- GitHub, Markdown, JSON summary, report and schema bytes are unchanged; no
  dependency or locale change.

## Impact

- Capability: `cli-api`.
- Code: `src/ci.ts`, `src/cli.ts`.
- Tests and docs: `test/ci.test.ts`, `test/cli-ci.test.ts`, `docs/CI.md`,
  `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`, README, CHANGELOG, BACKLOG
  B-042.
- No DROP-IN host row: this is deterministic CLI text and documentation, not an
  input adapter, report shell, print/PDF/email or compatibility-shim change;
  Jenkins itself is not run.
