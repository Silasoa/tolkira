# Tasks

## 1. Contract

- [ ] 1.1 Run PIR + DXR over this proposal, the `test-infrastructure` and
  `release` deltas, the design and the tasks. Fold blockers back into the
  contract before Red.
- [ ] 1.2 Confirm the measured facts on the contract commit: the npm 10 and
  npm 12 pack lists (81 vs 80, `docs/README.md` the only difference), the
  `npm stage publish <tarball> --dry-run` parse, the knip 6.48.0 findings, the
  three Action pins and the actionlint checksum. Re-measure after Red if a new
  file changes the pack list.
- [ ] 1.3 Record the decisions: no weekly schedule; `package:check` stays out
  of the local `check`; the release publishes the checked tarball; knip keeps
  the manual scripts as entries; only `cjs-resolves-to-esm` and
  `no-resolution` are ignored in attw; no CodeQL, fast-check or Stryker in
  this change.

## 2. Red

- [ ] 2.1 Add `test/package-manifest.test.ts`: the npm 10 array and npm 12
  object shapes, a complete list passes, a missing `docs/README.md` fails and
  names the file (the B-071 regression), a forbidden `src/` path fails.
- [ ] 2.2 Add `test/workflow-config.test.ts`: every `uses:` is 40 hex with a
  version comment; every checkout has `persist-credentials: false`; the release
  stages the `/tmp/pack/tolkira-<version>.tgz` path and never
  `npm stage publish .`; `npm audit signatures`, the npm 12.2.3 pin and the
  SBOM command exist; a `workflows` job runs actionlint and zizmor.
- [ ] 2.3 Extend `test/tooling-config.test.ts`: the exact eight `check` steps,
  the knip/publint/attw exact pins, the `package:check` script, the
  `.attw.json` ignore list and the `knip.json` entries.
- [ ] 2.4 Confirm RED for 2.1-2.3 and for `npm run lint:dead` while the config
  and the dead-code fixes are absent. The pre-existing suite stays green.

## 3. Package check

- [ ] 3.1 Add `scripts/package-check.mjs` with `packEntries`,
  `verifyPackList` and the CLI (pack once, validate, publint --strict, attw),
  plus `scripts/package-check.d.mts`. Use `TOLKIRA_PACK_DIR`; a default temp
  directory is removed after the run.
- [ ] 3.2 Add `docs/README.md` to `files`, add `.attw.json` with the two
  intended ignores, add the exact dev pins knip 6.48.0, publint 0.3.25 and
  `@arethetypeswrong/cli` 0.18.5, and add `package:check`.
- [ ] 3.3 Run `npm run package:check` with the local npm and with npm 12.2.3;
  both must find `docs/README.md` and pass publint and attw. Prove the tarball
  entry count (81) and the four compat files.

## 4. Release

- [ ] 4.1 Rewrite the publish job: `npm ci`, pin npm 12.2.3,
  `npm audit signatures`, `TOLKIRA_PACK_DIR=/tmp/pack npm run package:check`,
  smoke-test that tarball, generate the CycloneDX SBOM (`--omit=dev`), upload
  the `tolkira-sbom` artifact, then
  `npm stage publish /tmp/pack/tolkira-<version>.tgz --provenance --access
  public`. Remove `npm install -g npm@latest` and the directory publish.
- [ ] 4.2 Keep the tag/version and tag-on-main checks. Move `id-token: write`
  to the publish job; keep `contents: read` at the top. Set
  `persist-credentials: false` on every checkout.
- [ ] 4.3 Pin checkout, setup-node and upload-artifact to the resolved commit
  SHAs with version comments, and point the CI `package` job at
  `npm run package:check` and the same deterministic tarball path.
- [ ] 4.4 Prove `npm stage publish <tarball> --dry-run` still parses with
  12.2.3 and record the result; the real stage stays with the user.

## 5. Dead code

- [ ] 5.1 Add `knip.json` with the entries, project, ignored paths and the one
  ignored dependency from the design. Add `lint:dead` after `lint` in `check`.
- [ ] 5.2 Un-export or delete the 17 findings from the design table. Check
  every item against the package entry and the compat entry first; no public
  export is removed. Prove `npm run assets` leaves the client bundle
  byte-identical (`c018a0c3…`).
- [ ] 5.3 Run `npm run lint:dead` clean and record the triage; a kept item
  needs a reason in the config.

## 6. Workflow lint

- [ ] 6.1 Add the `workflows` job: actionlint 1.7.12 from the official tarball
  with the pinned sha256, and zizmor 1.33.1 via pipx with `--offline
  --persona=regular`. A finding fails the job.
- [ ] 6.2 Fix every actionlint and zizmor finding in the workflows, or add a
  `zizmor.yml` entry with a reason. No blanket ignore.

## 7. Docs and backlog

- [ ] 7.1 Update `CONTRIBUTING.md` (`lint:dead`, `package:check`, the release
  artifact rule) and `docs/ARCHITECTURE.md` (gate steps, dev pins, release
  integrity).
- [ ] 7.2 Update `docs/CHANGELOG.md` Unreleased and `docs/BACKLOG.md`: resolve
  B-071 with the npm 12 root cause and add one 0.7 entry for CodeQL,
  dependency-review, Scorecard, fast-check, the Stryker trigger and knip
  MCP/skills. State that there is no weekly job.
- [ ] 7.3 Update the OpenSpec spec deltas if the implementation deviates; run
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
