# Tasks

## 1. Spec gate

- [x] 1.1 Run PIR and DXR over proposal, spec and design; fix blockers.
- [x] 1.2 Confirm the change is linked to issue #5.

## 2. TDD-Red

- [ ] 2.1 Add formatter tests for property/message escaping, injection,
  failed/undefined/ambiguous/pending/skipped/unexecuted/empty runs, caps,
  truncation and deterministic output.
- [ ] 2.2 Add Markdown tests for counts, failed list, skipped and empty runs,
  inert code rendering, `--title`, truncation and the caps.
- [ ] 2.3 Add CLI tests for `--ci` without `--out`, `--ci` with `--out`,
  `--ci-out`, `--ci ''`, case-mismatched values, `--ci-out ''`,
  `--ci github --ci-out`, missing `--ci`, `--json` conflict, overwrite
  rejection (including `--out` collision with no files yet), missing
  directories, unwritable output, failed-run exit 0 and HTML unchanged with
  `--ci`.
- [ ] 2.4 Use existing fixtures `messages/ci-full`, `ci-mixed`, `ci-partial`,
  `ci-unsafe`, `ci-ssh`, `ci-url-only` and `empty`; no duplicate fixture family.
- [ ] 2.5 Confirm the new tests fail for the right reason before implementation.

## 3. Implement

- [x] 3.1 Add `src/ci.ts` pure formatters and the dispatcher.
- [x] 3.2 Add `--ci`/`--ci-out` parsing, validation and CLI flow.
- [x] 3.3 Write `--ci-out` atomically and reject input/logo/HTML overwrites.
- [x] 3.4 Keep `--json`, HTML, exit codes and the summary schema unchanged.

## 4. Docs

- [x] 4.1 Add `docs/CI.md` with GitHub Actions and GitLab examples, the
  stdout-only GitHub rule, `>> "$GITHUB_STEP_SUMMARY"` for Markdown, GHES notice
  limits and the unredacted-message warning.
- [x] 4.2 Update CLI usage, `README.md`, `docs/AGENT-INTERFACE.md`,
  `docs/README.md`, `llms.txt` and `package.json` `files`.
- [x] 4.3 Add the CI-output contract to the `cli-api` spec.

## 5. Verification and review

- [ ] 5.1 Run `npm run hygiene`, `npm run check`, `npm run test:e2e` and a
  manual GitHub-annotation probe from the CLI.
- [ ] 5.2 Run the review swarm: SCR, CR, DAR, CMP, SEC.
- [ ] 5.3 Fix findings and record deferred decisions in `docs/BACKLOG.md`.
- [ ] 5.4 Commit and push with the issue and change reference.
