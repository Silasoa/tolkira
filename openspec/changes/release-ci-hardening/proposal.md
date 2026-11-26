# Proposal

## Why

The 0.6.1 release published a different tarball than the one it tested. The
publish job packs and smoke-tests `/tmp/tolkira-0.6.1.tgz`, then installs
`npm@latest` and runs `npm stage publish .`, which packs a second time. npm 12
no longer includes the nested `docs/README.md` automatically, so the published
tarball has 80 entries instead of 81 (B-071). Measured on 2026-11-26: npm 10
packs 81 entries including `docs/README.md`, npm 12.2.3 packs 80 with that file
as the only difference.

Two more gaps are development-only. Nothing checks the packed package surface
(`exports`, `files`, ESM/CJS resolution), and the GitHub workflows use mutable
major tags plus long inline shell that only runs at tag time. After three
refactor rounds, dead code also accumulates: knip reports 5 unused files, 5
unused exports and 12 unused exported types.

None of this changes what users see. It changes whether the pipeline can prove
that the artifact it ships is the artifact it checked, and it removes ballast
before the 0.7 feature work adds more.

## What Changes

- Add a package check that packs once and checks that exact tarball: the
  manifest (required and forbidden paths), `publint --strict` and `attw`.
  List `docs/README.md` explicitly in `files`, so npm 10 and npm 12 both pack
  it. The check runs in the CI package job and in the release, before the smoke
  test and the publish. Both jobs install the same pinned npm, so the npm 12
  pack list is exercised in CI, not only at tag time.
- Change the release workflow to publish the checked tarball, pin npm 12.2.3
  for packing and publishing, verify dependency signatures, generate a
  CycloneDX SBOM and upload it as an artifact.
- Add knip 6.48.0 with an explicit entry/project config, run it in `check`, and
  remove or un-export the dead items. No public entry export is removed.
- SHA-pin every Action, add actionlint and zizmor jobs, disable persisted
  checkout credentials, and keep Dependabot updating the pins.
- Record the deferred 0.7 verification work in the backlog: CodeQL,
  dependency-review, Scorecard, fast-check property tests for the three
  parsers, Stryker when its Vitest 5 runner works, and knip MCP/repo skills.
- Add config pins: package manifest, workflow pins and the exact check steps.

Out of scope: no runtime dependency, report byte, public API or CLI option
change; no version bump, tag, stage or publish; no weekly schedule; no
Renovate, Changesets, Corepack, git hooks, TypeDoc, dependency-cruiser or
Stryker; no CodeQL or fast-check (0.7).

## Capabilities

### New Capabilities

- `release`: the release stages the artifact that passed the checks, verifies
  dependency signatures, attaches an SBOM and keeps the workflow dependencies
  pinned and linted.

### Modified Capabilities

- `test-infrastructure`: the gate gains the dead-code check; the CI package
  job gains the package check. The exact step list, dev pins and
  package-content requirement are updated.

## Impact

Affected: `package.json` (scripts, dev pins, `files`), `package-lock.json`,
`knip.json`, `.attw.json`, `scripts/package-check.mjs` plus its declaration,
`test/package-manifest.test.ts`, `test/workflow-config.test.ts`,
`test/tooling-config.test.ts`, `.github/workflows/ci.yml`,
`.github/workflows/release.yml`, `.github/dependabot.yml`, `CONTRIBUTING.md`,
`docs/ARCHITECTURE.md`,
`docs/CHANGELOG.md`, `docs/BACKLOG.md`, and the dead-code sites listed in the
design. Runtime dependencies, entry points, report bytes and the version stay
unchanged. Dev-only dependencies grow by knip, publint and
`@arethetypeswrong/cli`, all exact. B-071 is resolved; the 0.7 items live in a
new backlog entry.

Tracking: local backlog B-071; no remote issue exists yet. A GitHub issue is
opened from this contract after IR if the work needs one.
