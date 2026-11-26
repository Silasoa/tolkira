# Design

## 1. Context

The 0.6.1 publish job packs and smoke-tests a tarball, then runs
`npm install -g npm@latest` and `npm stage publish .`. The second command packs
again, so the tested bytes are not the published bytes. Measured on 2026-11-26
with the same tree:

- npm 10 (local): 81 entries, including `docs/README.md`;
- npm 12.2.3 (the version the release installed): 80 entries, with
  `docs/README.md` as the only difference.

`npm stage publish <tarball> --dry-run` with npm 12.2.3 parses the packed file
and lists its contents; the dry run does not exercise provenance, which the
first real stage proves. This is the B-071 root cause and the fix.

The rest is verification debt: the package surface is unchecked, the workflows
use mutable major tags and long inline shell, and knip finds 5 unused files, 5
unused exports and 12 unused exported types after three refactor rounds. All
are development-only.

## 2. Package check

### 2.1 Script

`scripts/package-check.mjs` is one command that packs once and checks that
tarball. It exports two pure functions for the tests and runs as a script only
when invoked directly:

- `packEntries(packed)` normalises the `npm pack --json` result. npm 10 returns
  an array, npm 12 returns an object keyed by package name; both shapes are
  tested.
- `verifyPackList(paths, packageJson)` returns a list of errors. It requires
  every explicit file in `files`, the docs listed there (including
  `docs/README.md`), and the root/entry/compat paths; it rejects `src/`,
  `test/`, `openspec/`, `scripts/`, `node_modules/` and `.github/`. Tarball
  paths are normalised from the `package/` prefix.
- The CLI creates `TOLKIRA_PACK_DIR` with `mkdirSync(dir, { recursive: true })`
  before packing; `npm pack --pack-destination` fails `ENOENT` on a fresh
  runner otherwise. Without the variable it uses a fresh temp directory that is
  removed afterwards. It prints the tarball path and the entry count on
  success.
- `npm pack` is spawned through `process.execPath` plus
  `process.env.npm_execpath` when `npm run` provides it, with the
  `npm.cmd`/shell branch from `scripts/bench-compare.mjs` as the fallback, so
  Windows works without a bare `spawn('npm')`.
- It then runs `publint run <tarball> --strict` and `attw <tarball>` through
  `process.execPath` and the package bin. The bin paths are read from
  `node_modules/<pkg>/package.json` by path, not `require.resolve`: publint's
  exports map hides `./package.json`. The bins are `publint/src/cli.js` and
  `@arethetypeswrong/cli/dist/index.js`.
- The direct-run guard is
  `import.meta.url === pathToFileURL(process.argv[1]).href`, not
  `import.meta.main`, which needs Node 22.18.
- `--pack-dir` is not parsed; the environment variable is the only input, so
  the script stays small.

`scripts/package-check.d.mts` declares the two exports, so
`test/package-manifest.test.ts` is typechecked without putting the `.mjs`
scripts into the TypeScript program. The declaration is a boundary, not a
second implementation.

`package:check` is `npm run build && node scripts/package-check.mjs`. It is not
part of `npm run check`, because it builds and packs and the local gate stays
fast. It runs in the CI `package` job, in the release publish job, and locally
before a packaging change. The CI job sets `TOLKIRA_PACK_DIR=/tmp/pack` so the
tarball survives into the smoke step.

### 2.2 Manifest rules

Required:

- `package.json`, `README.md`, `LICENSE`, `llms.txt`, `DESIGN.md`,
  `SECURITY.md`, `GLOSSARY.md`;
- every `docs/*.md` named in `files`, now including `docs/README.md`;
- `dist/index.js`, `dist/index.d.ts`, `dist/cli.js` and the four compat files
  (`.js`, `.cjs`, `.d.ts`, `.d.cts`).

Forbidden: `src/`, `test/`, `openspec/`, `scripts/`, `node_modules/`,
`.github/`.

`docs/README.md` is added to `files` explicitly. npm 10 already packs it; npm 12
does not, and the explicit entry makes the set independent of the npm version.
The npm 10 pack list stays at 81 entries; the npm 12 list returns to 81 instead
of 80.

### 2.3 attw

`.attw.json` uses `profile: "node16"` and ignores exactly one rule:

- `cjs-resolves-to-esm`: the package root is ESM-only; the CJS surface is the
  `./compat/cucumber-html-reporter` subpath.

The node16 profile checks node16 (CJS and ESM) and bundler, and marks node10 as
ignored. node10 is below `engines` (`>=22`), so excluding it at the profile
level is more honest than a global `no-resolution` ignore, which would also
hide node16 and bundler failures. Verified on 2026-11-26: exit 0, root and
compat green, node10 ignored. The profile and the one rule are pinned by
`test/tooling-config.test.ts`, so a change needs a contract change.

## 3. Release flow

The publish job becomes:

1. `npm ci`.
2. `npm install -g npm@12.2.3` (exact; the pack and publish version; its
   `engines` needs Node `^22.22.2`, and the runner's latest 22.x is 22.23.5).
3. `npm audit signatures` (release only; a point-in-time check of the installed
   tree, not of the tarball).
4. Resolve the version once after the tag guard:
   `echo "TOLKIRA_VERSION=$(node -p "require('./package.json').version")" >>
   "$GITHUB_ENV"`. Every later path uses `tolkira-$TOLKIRA_VERSION.tgz` or
   `.cdx.json`; no placeholder and no glob reaches the config test.
5. `TOLKIRA_PACK_DIR=/tmp/pack npm run package:check`. This builds, packs once,
   validates the manifest, runs publint and attw, and leaves
   `/tmp/pack/tolkira-$TOLKIRA_VERSION.tgz`.
6. Install that tarball globally and run the existing CLI smoke test. The smoke
   and the publish now use the same file.
7. `npm sbom --sbom-format cyclonedx --omit=dev` into
   `/tmp/pack/tolkira-$TOLKIRA_VERSION.cdx.json`, uploaded as the
   `tolkira-sbom` artifact with the pinned `upload-artifact` action.
8. `npm stage publish /tmp/pack/tolkira-$TOLKIRA_VERSION.tgz --provenance
   --access public`.

No step repacks from the directory. The tag/version and tag-on-main checks stay
unchanged. `npm stage publish` defers the 2FA proof to the maintainer; after the
stage, the maintainer approves or rejects, confirms
`npm view tolkira@<version> version`, then creates the GitHub Release and
attaches the `tolkira-sbom` artifact. The workflow only stages.

The CI `package` job also installs npm 12.2.3 before `npm ci`, so it exercises
the same npm 12 pack list as the release; it is a required check in CI.

`npm audit signatures` verifies the installed tree (80 packages, about 11 s) and
does not cover the tarball or B-071. esbuild externalizes every runtime
dependency, so the `--omit=dev` CycloneDX tree is the runtime tree.

## 4. Dead code (knip)

`knip` 6.48.0 is pinned exactly. `knip.json` declares:

- entries: `src/index.ts`, `src/cli.ts`, the two compat entries,
  `src/render/report-client.ts` (the browser bundle entry), `scripts/*.mjs`
  (manual tools) and the test files (`test/**/*.test.ts`,
  `test/e2e/**/*.spec.ts`), not the test helpers or fixtures; those are
  project files, so the dead helpers are still reported;
- project: `src/**/*.ts`, `scripts/**/*.mjs`, `test/**/*.ts`;
- ignored paths: `test/fixtures/**`, the generated browser bundle, catalogs and
  styles;
- ignored dependency: `playwright-core` only, because it is an optional peer
  loaded at runtime.

Triage of the 6.48.0 run on 2026-11-26:

| Finding | Decision |
| --- | --- |
| `scripts/baseline-bytes.mjs`, `bench-compare.mjs`, `history-window.mjs` | keep; manual tools, now entries |
| `src/compat/cucumber-html-reporter.cts` | keep; CJS entry |
| `test/fixtures/cjs-types/require-compat.cts` | keep; fixture, ignored path |
| `playwright-core` | keep; optional peer, ignored dependency |
| `BASELINE_MAX_BYTES`, `SUPPORTED_EXTENSIONS` | un-export if used in the file, delete otherwise |
| `SUMMARY_SCHEMA`, `writeJson`, `legacyJson`, `SyntheticScenario`, `EarlierAttachment` | delete; dead test helpers |
| `ClientParams` | un-export if used in the file; types erase, bundle unchanged |
| `RunFeatureDocument`, `RunScenarioNode`, `RunOutlineExample`, `RunSuggestion`, `ReportStatus`, `ReportEarlierAttempt`, `ReportCounts`, `ReportCi`, `ReportEnvironment` | un-export if used in the module, delete otherwise |

No export reachable from `src/index.ts` or from the compat entry is removed. If
knip flags such an export, it is kept and the config gets a documented
exception instead. `lint:dead` runs in `check` after `lint`; a new unused
export fails the gate.

## 5. Workflows

Pins (resolved on 2026-11-26):

- `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` (v7.0.1)
- `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1` (v7.1.0)
- `actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9` (v7.0.2)

Every `uses:` is a 40-hex commit with a `# vX.Y.Z` comment. Dependabot's
existing `github-actions` entry keeps them current, and both Dependabot entries
gain `cooldown: default-days: 7`, so a new release is not opened as a PR on the
same day.

Every checkout sets `persist-credentials: false`; no job pushes with the token.
Permissions move from the workflow top to the jobs that need them:
`contents: read` stays at the top, `id-token: write` moves to `publish` only.
The release jobs drop `cache: npm`: the release runs on a tag and does not need
the cache, and zizmor flags it as cache poisoning for a publishing workflow. CI
keeps its cache.

The pre-change zizmor run (1.33.1, regular persona, offline) reports 51
findings, 24 high: 15+ unpinned uses, 9 missing `persist-credentials`, one
workflow-level `id-token`, three release-cache findings, two Dependabot
cooldown warnings and four ad-hoc installs (our own tarball under test and the
pinned npm CLI). The four ad-hoc hints get an inline
`# zizmor: ignore[adhoc-packages]` with the reason; everything else is fixed.
actionlint 1.7.12 is green on the pre-change tree and stays part of the job.

New `workflows` job in `ci.yml` (Ubuntu, 5 minutes):

- actionlint 1.7.12 from the official release tarball, verified with
  `sha256 8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8`;
  the runner's shellcheck covers the `run:` bodies.
- zizmor 1.33.1 via `pipx run --spec zizmor==1.33.1 zizmor --offline
  --persona=regular --format=plain .`. Exit codes 11-14 mean findings and fail
  the job; a finding is fixed or gets an inline suppression with a reason,
  never a blanket ignore.

The existing CI jobs keep their names and matrix. `check-windows` keeps running
the full gate.

## 6. Gate composition and runtime

`check` becomes:

```json
"i18n:check", "assets", "typecheck", "lint", "lint:dead",
"format:check", "build", "test:coverage"
```

`lint:dead` adds knip. The measured knip run is 2-3 s on this tree; the local
gate grows by that amount and stays under the 20 % rule. knip 6.48 needs Node
`^20.19 || >=22.12`; `CONTRIBUTING.md` says 22.12+ for development, while the
package runtime stays `>=22`. `package:check` adds a build, a pack, publint
(about 2 s) and attw (about 5 s); it runs in the CI package job and the
release, not in the local `check`.

The exact eight-step `check` list is pinned by
`test/tooling-config.test.ts`. The new dev pins are knip 6.48.0, publint
0.3.25 and `@arethetypeswrong/cli` 0.18.5, all exact. npm 12.2.3 is a workflow
pin, not a project dependency.

## 7. Tests

- `test/package-manifest.test.ts`: npm 10 array and npm 12 object shapes; the
  B-071 regression (the 80-entry npm 12 list without `docs/README.md` fails and
  names the file); a forbidden `src/` path fails; a complete list passes.
- `test/workflow-config.test.ts`: every `uses:` is a 40-hex pin with a version
  comment; every checkout disables persisted credentials; the release resolves
  `TOLKIRA_VERSION` and uses `tolkira-$TOLKIRA_VERSION.tgz` for smoke, SBOM and
  stage, never `npm stage publish .`; the CI package job and the publish job
  install npm 12.2.3; `npm audit signatures`, the SBOM command and the
  Dependabot cooldown exist; the `workflows` job runs actionlint and zizmor.
- `test/tooling-config.test.ts`: the eight check steps, the three new dev
  pins, the `package:check` script, the attw profile and ignore, and the
  `knip.json` content.

These are tripwires, not locks: an agent that edits the config and the test
together can still change behaviour. Review is the lock.

## 8. Risks and trade-offs

| Risk | Mitigation |
| --- | --- |
| npm 12 changes the pack list again | the manifest check runs with the pinned npm in the CI package job and the release and fails closed; a bump is a reviewed commit |
| `npm stage publish` drops tarball support | parsed on 2026-11-26 with 12.2.3; provenance is proven at the first real stage; a regression fails before staging |
| knip flags intentional entries | explicit entries and one ignored dependency; a new exception needs a reason in the diff |
| actionlint/zizmor findings block the first run | the pre-change zizmor baseline is 51 findings; the fixes are in this change; the four ad-hoc installs get an inline reason; a new finding fails CI |
| the attw node16 profile hides node10 | deliberate: node10 is below `engines`; node16 (CJS and ESM) and bundler stay checked, and the one ignore is pinned |
| the package check slows CI | it runs in one job, not the matrix; about 7-10 s |

## 9. Deferred to 0.7

Recorded in `docs/BACKLOG.md` as one entry, so nothing is dropped:

- CodeQL default setup for JS/TS (taint analysis for the HTML sinks).
- dependency-review-action for licence and diff policy.
- OpenSSF Scorecard.
- `fast-check` 4.11 with `@fast-check/vitest` 0.6 property tests for the legacy
  JSON, Messages and JUnit XML parsers; a separate change, because it will find
  bugs and those fixes are release material.
- StrykerJS when its Vitest 5 runner works upstream; then nightly/changed
  files, never the PR gate.
- knip MCP/LSP and repo skills for the release and a new input adapter.

No new weekly job. Dependabot keeps its existing weekly schedule;
`npm audit signatures` and the SBOM run at release only.
