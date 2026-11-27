# Gate — release token isolation

## 1. Contract and pre-implementation review

- Contract: `proposal.md`, `design.md`, `specs/release/spec.md`, `tasks.md`;
  `openspec validate release-token-isolation --strict` is green.
- PIR: **PASS** after two rounds. Round 1 blocked the guard-before-install
  order, the self-referential digest (the digest travelled inside the same
  artifact), path expansion in `with:` and the missing `jobs.package.outputs`
  mapping. All were folded into the design and the delta.
- DXR: **PASS** after two rounds. Blockers: exact `run`/`uses` allowlists so a
  re-added `npm ci` or checkout fails, the `cd /tmp/pack` working directory for
  the digest check, the environment's second API call for the `v*` tag policy
  with the numeric reviewer id, and the artifact-expiry, recreated-environment
  and same-tag concurrency rows. All are in the contract.
- Baseline (2026-11-27, read through the GitHub API): one `publish` job holding
  the npm token and `id-token: write`; rulesets `[]`; environments
  `total_count: 0`; one admin (`Silasoa`); one repository secret
  (`NPM_TOKEN`).

## 2. Implementation

Three commits on `main`, not pushed at the time of this record:

| Commit | Subject |
| --- | --- |
| `1fb7f9f` | `ci(release): isolate the token-bearing publish job (B-074)` |
| `0b0dcae` | `test(ci): pin the release split boundaries (B-074)` |
| `e091b2f` | `test(ci): reject disabled uploads and non-tag triggers (B-074)` |

`.github/workflows/release.yml` now has three jobs: the unchanged gates plus
`package` (no token, no OIDC) and `publish` (environment `release`, token and
`id-token: write` only). The package job runs the tag guards before `npm ci`,
builds, checks, smokes, records the bare-name digest and its output, generates
the SBOM and uploads `tolkira-release` (tarball plus digest) and
`tolkira-sbom`. The publish job installs the pinned npm, downloads the
artifact, verifies the tarball against `needs.package.outputs.sha256` and
stages that exact file. Runs for one tag are serialized with
`cancel-in-progress: false`.

No runtime dependency, report byte, public API, package entry point or version
changed. No tag, stage or publish happened in this change.

## 3. Verification

### Gates

- `npm run check` on an isolated worktree at `0b0dcae` (`e091b2f` changes only
  the two workflow test files): 107 files, **2,175 passed / 11 skipped /
  0 failed of 2,186**; typecheck, lint, knip, format and build green.
  Coverage: statements 95.13 %, branches 88.51 %, functions 97.09 %, lines
  96.52 %.
- `npx vitest run test/release-workflow.test.ts test/workflow-config.test.ts`:
  **30 passed** (was 18 before the change).
- `npm run hygiene`: 929 tracked files, 564 commits, green.
- actionlint 1.7.12 (Windows build, archive checksum verified against the
  release checksums): no findings.
- zizmor 1.33.1 (`--offline --persona=regular`): no findings (6 ignored,
  12 suppressed).

### Package

`npm run package:check`: **92 entries**, tarball **702,942 B**, SHA-256
`1BFD0A6586542AEC…EA95` — byte-identical to the 0.7.0 package. Only files
outside the package changed, so there is no report or package-byte change and
no browser run is required for this CI-only change.

### Repository settings read-back

| Setting | Value |
| --- | --- |
| Ruleset `release-tags` (id 28232823) | target `tag`, enforcement `active`, `refs/tags/v*`, rules `deletion`, `update`, `non_fast_forward`, 0 bypass actors, `current_user_can_bypass: never` |
| Environment `release` | required reviewer `Silasoa` (id 18676028), `prevent_self_review: false`, `can_admins_bypass: true`, custom tag policy enabled |
| Deployment policy (id 68499650) | `v*` / `tag` only |

The `update_allows_fetch_and_merge` parameter was dropped by the tag ruleset
API; the `update` rule itself is active and blocks moving a tag. With one
admin, the environment is a deliberate pause before the token is used, not
separation of duties; self-review stays allowed until a second maintainer
joins. Evidence: `.tmp/settings-readback.json` (not tracked).

## 4. Reviews

Round 1 on `1fb7f9f`: SEC **PASS** with two accepted residual risks (the
repository-scoped `NPM_TOKEN` and the build-job trust anchor, both recorded as
backlog decisions with triggers). SCR, CR and DAR **FAIL** on enforcement and
docs only — the workflow, the live settings and the security boundary are
confirmed correct by all four:

- SCR: the tag guard test accepted a hardcoded tag, the package permissions
  were not pinned, the upload order and the "no schedule" / "one pack" checks
  were missing.
- CR: the Unreleased changelog still described the single publish job,
  `ARCHITECTURE` said "no install" while the publish job installs the pinned
  npm, `NODE_AUTH_TOKEN` was only counted globally, and an `if: false` upload
  would have passed.
- DAR: the changelog and architecture wording, the missing "no GitHub issue"
  note, the approval location and the 14-day artifact expiry in
  `CONTRIBUTING`, and a stale task line.

The fixer (`0b0dcae`) closes all of them; the delta re-checks on the fix commit
returned SCR **PASS**, DAR **PASS** and CR **FAIL (minor)**: the `if:` guard
missed the `- if: false` first-key form. `e091b2f` tightens that regex and adds
the exact `NODE_AUTH_TOKEN` line and the tags-only trigger assertion; CR
confirmed the final tree. Two accepted risks are recorded in
`docs/BACKLOG.md` with triggers: the repository-scoped `NPM_TOKEN` (move to an
environment secret when a second maintainer or non-maintainer workflow access
exists) and the package-job build trust anchor (independent rebuild or
reproducible builds).

## 5. Exceptions

None. The actionlint and zizmor runs are local with the same pins as CI; the
`workflows` CI job re-runs both on the push.
