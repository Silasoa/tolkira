# Tasks

## 1. Contract

- [x] 1.1 Run PIR + DXR over this proposal, the `test-infrastructure` and
  `release` deltas, the design and the tasks. Fold blockers back into the
  contract before Red. PIR found four release-flow blockers (version
  resolution, npm 12 in the CI package job, the missing release checklist, the
  gate wording) and the attw profile nuance; DXR found the pack-directory,
  bin-resolution, Windows spawn, CI handoff, Node floor, knip entry and doc
  coherence blockers. All are folded in.
- [x] 1.2 Confirm the measured facts on the contract commit: the npm 10 and
  npm 12 pack lists (81 vs 80, `docs/README.md` the only difference), the
  `npm stage publish <tarball> --dry-run` parse (it does not exercise
  provenance), the knip 6.48.0 findings, the zizmor 51-finding baseline, the
  three Action pins and the actionlint checksum. Re-measure after Red if a new
  file changes the pack list.
- [x] 1.3 Record the decisions: no new weekly job; `package:check` stays out
  of the local `check` but is a required CI check; the release publishes the
  checked tarball; knip keeps the manual scripts as entries and ignores
  `playwright-core`, `publint` and `@arethetypeswrong/cli`; attw uses the
  node16 profile and ignores only `cjs-resolves-to-esm`; no CodeQL, fast-check
  or Stryker in this change.

## 2. Red

- [x] 2.1 Add `test/package-manifest.test.ts`: the npm 10 array and npm 12
  object shapes, a complete list passes, a missing `docs/README.md` fails and
  names the file (the B-071 regression), a forbidden `src/` path fails.
- [x] 2.2 Add `test/workflow-config.test.ts`: every `uses:` is 40 hex with a
  version comment; every checkout has `persist-credentials: false`; the release
  resolves `TOLKIRA_VERSION` and uses `/tmp/pack/tolkira-$TOLKIRA_VERSION.tgz`
  for smoke, SBOM and stage, never `npm stage publish .`; the CI package job
  and the publish job install npm 12.2.3; `npm audit signatures`, the SBOM
  command and the Dependabot cooldown exist; a `workflows` job in `ci.yml`
  runs actionlint and zizmor. One repo-wide run scans both workflow files; the
  release does not duplicate it.
- [x] 2.3 Extend `test/tooling-config.test.ts`: the exact eight `check` steps,
  the knip/publint/attw exact pins, the `package:check` script, the attw
  profile and ignore, and the `knip.json` entries.
- [x] 2.4 Confirm RED for 2.1-2.3 and for `npm run lint:dead` while the config
  and the dead-code fixes are absent. The pre-existing suite stays green.

## 3. Package check

- [x] 3.1 Add `scripts/package-check.mjs` with `packEntries`,
  `verifyPackList` and the CLI (pack once, validate, publint --strict, attw),
  plus `scripts/package-check.d.mts`. Create `TOLKIRA_PACK_DIR` before packing;
  resolve the publint/attw bins from `node_modules/<pkg>/package.json` by path,
  spawn `npm pack` through `process.execPath` + `npm_execpath` (no bare Windows
  fallback), and use the realpath-based direct-run guard. Use the default temp
  directory only when the variable is absent.
- [x] 3.2 Add `docs/README.md` to `files`, add `.attw.json` with the node16
  profile and the one `cjs-resolves-to-esm` ignore, add the exact dev pins
  knip 6.48.0, publint 0.3.25 and `@arethetypeswrong/cli` 0.18.5, and add
  `package:check`.
- [x] 3.3 Run `npm run package:check` with the local npm and with npm 12.2.3;
  both must find `docs/README.md` and pass publint and attw. Prove the tarball
  entry count (81), the four compat files and the exact `filename` from
  `npm pack --json` (no glob).

## 4. Release

- [ ] 4.1 Rewrite the publish job: `npm ci`, pin npm 12.2.3,
  `npm audit signatures`, resolve `TOLKIRA_VERSION` after the tag guard, run
  `TOLKIRA_PACK_DIR=/tmp/pack npm run package:check`, record the tarball's
  SHA-256, smoke-test that tarball, generate the CycloneDX SBOM with
  `--package-lock-only --omit=dev` into the fixed `tolkira-sbom.cdx.json`,
  upload the `tolkira-sbom` artifact with `if-no-files-found: error`, verify the
  digest immediately before
  `npm stage publish /tmp/pack/tolkira-$TOLKIRA_VERSION.tgz --provenance
  --access public`. Remove `npm install -g npm@latest` and the directory
  publish.
- [x] 4.2 Keep the tag/version and tag-on-main checks. Move `id-token: write`
  to the publish job; keep `contents: read` at the top. Set
  `persist-credentials: false` on every checkout, remove `cache: npm` from the
  release jobs, and add `cooldown: default-days: 7` to both Dependabot
  entries.
- [x] 4.3 Pin checkout, setup-node and upload-artifact to the resolved commit
  SHAs with version comments, install npm 12.2.3 in the CI `package` job
  before `npm ci`, set `TOLKIRA_PACK_DIR=/tmp/pack`, and install the exact
  tarball from `/tmp/pack/tolkira-$TOLKIRA_VERSION.tgz` (no glob).
- [ ] 4.4 Prove `npm stage publish <tarball> --dry-run` still parses with
  12.2.3 and record that it does not exercise provenance; the real stage and
  its provenance proof stay with the user.

## 5. Dead code

- [x] 5.1 Add `knip.json` with the entries, project, ignored paths and the
  three ignored dependencies from the design. The test entries are the test
  files (`test/**/*.test.ts`, `test/e2e/**/*.spec.ts`), not the helpers or
  fixtures, so the dead helpers are still reported. Add `lint:dead` after
  `lint` in `check`.
- [x] 5.2 Un-export or delete the 17 findings from the design table. Check
  every item against the package entry and the compat entry first; no public
  export is removed. Prove `npm run assets` leaves the client bundle
  byte-identical (`c018a0c3…`).
- [x] 5.3 Run `npm run lint:dead` clean and record the triage; a kept item
  needs a reason in the config.

## 6. Workflow lint

- [x] 6.1 Add the `workflows` job to `ci.yml`: actionlint 1.7.12 from the
  official tarball with the pinned sha256, and zizmor 1.33.1 via pipx with
  `--offline --persona=regular`. A finding fails the job.
- [x] 6.2 Fix the zizmor baseline: the 15+ unpinned uses, the 9 missing
  `persist-credentials`, the workflow-level `id-token`, the three release-cache
  findings and the two Dependabot cooldowns. The five ad-hoc installs (three
  tarball smokes and the two pinned npm CLI installs) get an inline
  `# zizmor: ignore[adhoc-packages]` with the reason. Fix every actionlint
  finding. No blanket ignore.

## 7. Docs and backlog

- [x] 7.1 Update `CONTRIBUTING.md` (`lint:dead`, `package:check`, the release
  artifact rule, Node 22.12+ for development because of knip, the SBOM is the
  lockfile tree) and `docs/ARCHITECTURE.md` (gate steps, dev pins, release
  integrity). Add the Releases section: tag → gate → staged publish → 2FA
  approve or reject → confirm `npm view tolkira@<version> version` → create the
  GitHub Release and attach the `tolkira-sbom` artifact; never re-stage after
  approval.
- [x] 7.2 Update `docs/CHANGELOG.md` Unreleased and `docs/BACKLOG.md`: move
  B-071 to `## Resolved` with the npm 12 root cause, correct the
  `docs/CHANGELOG.md` line that says no workflow change, and add one 0.7 entry
  for CodeQL, dependency-review, Scorecard, fast-check, the Stryker trigger
  and knip MCP/skills. State that there is no new weekly job; Dependabot keeps
  its existing weekly schedule.
- [x] 7.3 Update the OpenSpec spec deltas if the implementation deviates; run
  `openspec validate release-ci-hardening --strict`.

## 8. Verification and archive

- [ ] 8.1 `npm run hygiene`, `npm run check`, `npm run package:check` and
  `npm run test:e2e` are green. Record the exact counts, the check runtime
  with and without knip, the package-check runtime and the tarball entry count.
- [ ] 8.2 Run the reviewer set: SCR, CR, DAR, SEC, PCA and STR. UXR, CMP and
  ILA are not triggered because no report byte changes; prove it with the
  characterization hashes and both goldens.
- [ ] 8.3 Fix every finding or record a decision with a trigger, using a
  separate fixer; re-run the gate after fixes. Delta re-check the reviewers.
- [ ] 8.4 Gate record in `tasks.md`, archive the change, sync the specs, close
  B-071, push. Do not bump the version, tag, stage or publish.

## 9. Review fixes

The coordinator ticks these after the gate; this fixer leaves them open.

- [ ] 9.1 Tag refspec: the tag-on-main guard resolves `refs/heads/main`
  explicitly, never an ambiguous short name.
- [ ] 9.2 Digest: the publish job records the checked tarball's SHA-256 after
  the package check and verifies it immediately before `npm stage publish`.
- [ ] 9.3 SBOM: `npm sbom --sbom-format cyclonedx --omit=dev
  --package-lock-only` writes the fixed `tolkira-sbom.cdx.json`, the upload
  fails if it is missing, and the scope excludes bundled code (B-075).
- [ ] 9.4 Strict manifest: the packed set equals the documented `files` set,
  `docs/README.md` is unconditional, glob entries stay patterns, unsafe paths
  fail, and the new test cases cover them.
- [ ] 9.5 Docs corrections: B-071/B-072 root cause and the B-074/B-075 rows,
  ARCHITECTURE, the ADR 0002 amendment, CHANGELOG, README Node/gate lines, the
  docs index, AGENTS/review gate and the CONTRIBUTING release flow.
- [ ] 9.6 Deferred follow-ups: B-074 (same-job tamper, tag protection, release
  environment) and B-075 (bundled MIT notice, SBOM scope) are recorded with
  their triggers.
