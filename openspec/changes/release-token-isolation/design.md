# Design

## 1. Context and trust boundary

The release workflow runs on a `v*` tag. Today one `publish` job holds the npm
token, runs `npm ci` (the whole development tree), builds, packs, smokes,
records the digest, generates the SBOM and stages. The digest proves that the
staged file is the smoked file, but a dependency that runs during `npm ci` or
the build can rewrite the tarball before the digest is recorded, and any code in
that job can read `NPM_TOKEN`.

Baseline on 2026-11-27, read through the GitHub API:

- rulesets: none;
- environments: none;
- collaborators: one admin (`Silasoa`);
- repository secret: `NPM_TOKEN` only.

`release.yml` is the only workflow that maps the token. Tags are created by the
maintainer; nothing prevents moving or deleting one.

## 2. Job split

### 2.1 `package` job (no token, no OIDC)

Runs after `gate-linux` and `gate-macos`, with `permissions: contents: read`.

Order: checkout (`fetch-depth: 0`, no persisted credentials), Node 22, the
tag/version guard, the tag-on-main guard, `npm ci`, pinned npm 12.2.3,
`npm audit signatures`, `package:check`, digest, tarball install and CLI smoke,
CycloneDX SBOM, artifact uploads. The guards run before any install, as today.

Job outputs: `version` and `sha256` from the version and digest steps. The
version is also written to `GITHUB_ENV` for the job-local paths; the outputs are
what the publish job uses, because `GITHUB_ENV` does not cross jobs.

Artifacts:

- `tolkira-release`: `tolkira-<version>.tgz` and
  `tolkira-<version>.sha256`, `if-no-files-found: error`, 14 days. The `path:`
  uses `${{ steps.version.outputs.value }}` because a shell variable is not
  expanded in a `with:` block.
- `tolkira-sbom`: the unchanged SBOM upload.

The digest file is written from inside `/tmp/pack`, so it records the bare file
name and stays valid after the artifact round trip. The digest also leaves the
job as `outputs.sha256`; the publish job compares the tarball against that
output, not against the file that travelled beside it, so a report of "the
artifact was tampered with" does not rest on a self-referential check.

### 2.2 `publish` job (token only)

`needs: package`, `environment: release` (tag policy `v*`), permissions
`contents: read` and `id-token: write`, timeout 20 minutes.

Steps: setup Node (registry URL, no cache) so npm has the auth config, download
`tolkira-release` into `/tmp/pack`, re-check `v<package version>` against
`GITHUB_REF_NAME`, install npm 12.2.3, verify the digest (with `cd /tmp/pack`,
because `sha256sum -c -` resolves names against the current directory), then
`npm stage publish` that exact path with `--provenance --access public` and
`NODE_AUTH_TOKEN`.

No checkout, no `npm ci`, no build, no pack, no package check, no smoke, no
signature check, no SBOM. The only network inputs are the pinned npm package
and the already-built artifact; the digest is verified after both and directly
before staging.

npm provenance is generated from the OIDC token and the environment context
(`GITHUB_REPOSITORY`, `GITHUB_SHA`, workflow ref); it does not need a working
tree, and the tarball carries the public `repository` field npm matches against
the OIDC repository.

### 2.3 Serialization

The workflow declares `concurrency: { group: release-${{ github.ref }},
cancel-in-progress: false }`. Two runs for the same tag queue instead of
staging twice; a run is never cancelled between the digest check and the stage.

The pinned npm 12.2.3 is installed from the public registry in the privileged
job, as it is today. That is a deliberate acceptance: no project code or
project dependency runs there, and the only downloaded code is the publishing
tool itself. Revisit when npm trusted publishing supports staged publishes (the
token disappears) or the runner image ships npm 12.2.3.

## 3. Repository settings

- Ruleset `release-tags`, target `tag`, active, includes `refs/tags/v*`, rules
  `deletion`, `update`, `non_fast_forward`. No bypass actor: a maintainer can
  edit or disable the ruleset, but a pushed tag cannot be moved or deleted by a
  normal push. A bad release therefore needs a new patch version, not a re-tag;
  `CONTRIBUTING.md` says so.
- Environment `release`: required reviewer `Silasoa` (numeric id 18676028),
  custom tag policy `v*` only. The PUT enables custom branch policies and the
  policy needs a second POST; without it every deployment is blocked. The
  environment is read back after both calls, because a deleted environment is
  recreated unprotected by the next job that references it.
  `prevent_self_review` stays off while the project has one maintainer;
  turning it on would deadlock every release. With one admin the gate is a
  deliberate pause before the token is used, not separation of duties. Trigger
  to enable it: a second maintainer with release rights joins.

Settings are applied with `gh api` and read back; the gate record stores the
read-back, not just the write.

## 4. Failure modes

| Failure | Where it stops | Effect |
| --- | --- | --- |
| Gate red | `package` never runs | nothing uploaded, nothing staged |
| Tag/version or tag-on-main mismatch | `package` tag guards, before install | no pack |
| Package check or smoke red | `package` | no artifact |
| Dependency install compromised after digest | publish job has no install | digest check fails or stages the checked bytes |
| Artifact differs from the digest output | publish digest check | nothing staged |
| Artifact expired or missing (14 days) | publish download step | nothing staged |
| `release` environment deleted | next run recreates it unprotected | gate read-back fails before a tag |
| Two runs for the same tag | `concurrency` queue | one stages at a time |
| No approval | environment gate | job waits, no token use |

## 5. Tests

`test/release-workflow.test.ts` reads the workflow text and pins the job graph,
the guard-before-install order, the exact `run` command list of `publish`, its
`uses` list, artifact names, the `needs.package.outputs` digest handoff, the
environment, the permissions and the concurrency block, so a re-added
`npm ci`, checkout or local action fails. `test/workflow-config.test.ts` keeps
the action pins, checkout credentials, npm pin and SBOM upload assertions,
moved to the `package` job where they now run, and asserts that `NPM_TOKEN`
appears once in the release workflow and only in `publish`.

The repository settings are not in the workflow file; a manual read-back in the
gate record covers them. No new runtime test, no report byte change.

## 6. Risks and decisions

- The publish job now depends on an artifact round trip; a failed upload or
  download blocks staging, which is the intended fail-closed behaviour.
- The environment approval adds one manual step per release. Accepted: the
  release is already a manual decision.
- Self-review stays enabled for the single maintainer; this is weaker than a
  two-person rule and is recorded with its trigger.
- The token remains a repository secret instead of an environment secret. The
  environment gate now blocks the job before any step, and only `publish` maps
  the secret; moving it needs the maintainer to re-enter the token and is left
  as a follow-up if a second maintainer or automated approval appears.
