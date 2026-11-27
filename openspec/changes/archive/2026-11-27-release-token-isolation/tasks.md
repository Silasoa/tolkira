# Tasks

## 1. Contract and review

- [x] 1.1 Finish the change contract: proposal, design, this file and the
  `release` delta with the split, settings and acceptance scenarios.
- [x] 1.2 Run PIR and DXR in parallel over the contract; fold blockers.
  Result: PIR PASS after two rounds (guard order, digest channel, path
  expansion, output mapping); DXR PASS after two rounds (allowlists, digest
  CWD, environment policy call, concurrency/expiry/recreated environment).
- [x] 1.3 Record the baseline: current job graph, action pins, ruleset and
  environment state (`gh api` read-back).
  Result: one token-bearing `publish` job; no ruleset; no environment; one
  admin; `NPM_TOKEN` only.

## 2. TDD Red

- [x] 2.1 Rewrite `test/release-workflow.test.ts` for the new job graph: the
  guard-before-install order inside `package`, the artifact handoff, the exact
  digest-check command (`cd /tmp/pack` plus
  `echo "$TOLKIRA_SHA256  tolkira-$TOLKIRA_VERSION.tgz" | sha256sum -c -`),
  the `needs.package.outputs` handoff, `publish` needing `package`,
  `environment: release`, `id-token` only in `publish`, the exact `run` and
  `uses` allowlists for `publish`, the concurrency block, and no build steps in
  `publish`.
- [x] 2.2 Move the signature/SBOM and version assertions in
  `test/workflow-config.test.ts` to the `package` job; add the negative checks
  for the publish job and a test that `NPM_TOKEN` occurs once across
  `.github/workflows/*` and only inside `publish`.
- [x] 2.3 Run both files and record the red state.
  Result: 14 failed / 12 passed; the package job was absent, publish still
  had the old 18 commands, no environment and no concurrency.

## 3. Implementation

- [x] 3.1 Split `.github/workflows/release.yml` into `package` and `publish`
  with the artifact handoff, digest verification, environment and permissions.
- [x] 3.2 Re-run the focused workflow tests until green; run actionlint and
  zizmor locally.
  Result: 26/26 green; actionlint 1.7.12 and zizmor 1.33.1 no findings.
- [x] 3.3 Update `CONTRIBUTING.md` (release steps, approval, new patch version
  after a bad release instead of moving a tag) and `docs/ARCHITECTURE.md`
  (release integrity paragraph). Update the B-074 backlog row.
- [x] 3.4 Apply the repository settings with `gh api`: tag ruleset
  `release-tags` (deletion, update, non-fast-forward, no bypass; a tag ruleset
  takes no `update_allows_fetch_and_merge`, so do not send it), the `release`
  environment with the numeric reviewer id, then the `v*` deployment branch
  policy in a second call. Read all three back and record the responses.
  Result: ruleset id 28232823, environment reviewer `Silasoa`, policy
  `v*`/`tag`; the `update` rule is active, deletion and non-fast-forward are
  blocked and there is no bypass actor.

## 4. Verification and gate

- [x] 4.1 Run `npm run check` and `npm run hygiene`.
  Result: 2,171 passed / 11 skipped / 0 failed of 2,182; coverage
  95.13/88.51/97.09/96.52; hygiene 929 files / 562 commits.
- [x] 4.2 Run `npm run package:check`; the tarball must be unchanged except for
  the workflow/docs files outside the package.
  Result: 92 entries, 702,942 B, SHA-256 `1BFD0A65…EA95`, byte-identical.
- [x] 4.3 Write `gate.md` with the job graph, the settings read-back, the test
  counts and the explicit statement that no tag, stage or publish happened.
- [x] 4.4 Review: SCR, CR, DAR and SEC in parallel; fix findings with a delta
  re-check.
  Result: SEC PASS; SCR/CR/DAR FAIL on enforcement and docs only, fixed in
  `0b0dcae`; SCR and DAR delta PASS, CR delta found the `- if:` form, fixed in
  `e091b2f`; CR confirmed the final tree.
- [x] 4.5 Commit and push; do not archive or change the version.
  Result: three commits pushed to `origin/main` (`ad5b4c8..9ea6cb1`); no
  version bump, tag, stage or publish.
