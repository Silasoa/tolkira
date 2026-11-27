# Proposal

## Why

B-074. `docs/BACKLOG.md` carries B-074 as the tracking entry; no GitHub issue
exists for this change. The release workflow runs `npm ci`, the build, the
package check, the
smoke test and the stage in one token-bearing job. A compromised development
dependency installed by `npm ci` can therefore change files after the tarball
digest is recorded, and a token-bearing job with the whole development tree is
a larger target than the publish step needs.

The repository also has no ruleset on `v*` tags and no `release` environment.
A pushed tag can be moved or deleted, and the publish job starts without a
human approval gate. Both are repository settings, so the workflow file alone
cannot enforce them.

## What Changes

- Split the release into a non-privileged `package` job and a token-only
  `publish` job. The package job runs the tag guards, `npm ci`,
  `npm audit signatures`, `npm run package:check`, the tarball smoke test, the
  digest and the SBOM, then uploads the tarball plus digest as
  `tolkira-release` and the SBOM as `tolkira-sbom`.
- The publish job references the `release` environment, downloads the
  `tolkira-release` artifact, verifies the recorded SHA-256 and stages that
  exact file with provenance. It has no checkout, no `npm ci`, no build, no
  pack, no package check and no SBOM step.
- Protect `refs/tags/v*` with an active repository ruleset (no deletion, no
  update, no non-fast-forward) and create the `release` environment with the
  maintainer as required reviewer and `v*` as its only allowed tag.
- Keep self-review allowed while the project has one maintainer; the setting
  and the trigger to disable it are recorded. The npm token stays a repository
  secret, mapped only by the publish job.
- Update the release workflow tests, `CONTRIBUTING.md` and
  `docs/ARCHITECTURE.md`.

## Capabilities

### Modified Capabilities

- `release`: the checked tarball is built and smoked in a non-privileged job,
  the token-bearing job only downloads, verifies and stages it, and the
  repository protects release tags and gates the publish with an environment.

## Impact

- CI only. No runtime dependency, report byte, public API, package entry point
  or version change. No tag, stage or publish in this change.
- The release now pauses for an environment approval before staging; the
  maintainer approves once per release. Tag pushes need no new credential.
- `actions/download-artifact` is added as a SHA-pinned action.

## Out of scope

- Moving `NPM_TOKEN` from a repository secret to an environment secret.
- npm trusted publishing, a second maintainer, or changing the staged-publish
  flow with 2FA.
- CodeQL, Scorecard, dependency review and the other B-073 verification work.
