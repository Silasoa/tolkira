# Contributing

Thanks for taking a look. Tolkira is spec-first and review-first; please read
this before opening a PR. The full documentation map is in
[`docs/README.md`](https://github.com/Silasoa/tolkira/blob/main/docs/README.md).

## Before code

1. Open or find an issue. If the idea is not actionable yet, record it in
   [`docs/BACKLOG.md`](docs/BACKLOG.md); the decision tree is in
   [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).
2. Write or update the OpenSpec change: proposal, spec delta with acceptance
   criteria, design and tasks.
3. Get user/maintainer approval of the spec.
4. Implement one small vertical slice test-first.

PRs that skip the spec are likely to be closed or converted into a spec
discussion. Docs-only fixes can go straight to a PR.

## Local checks

Requires Node.js 22.12 or newer for development (the dead-code check needs it);
the published package keeps the `>=22` runtime floor.

```shell
npm ci
npx playwright install chromium firefox webkit
npm run hygiene
npm run check
npm run lint:dead
npm run package:check
npm run test:e2e
npm run bench:ansi
```

`npm run check` runs `i18n:check`, assets, both typecheck programs, the
type-aware lint at zero warnings, the dead-code check, the Oxfmt check, the
build and the coverage suite; an empty test glob and coverage below the floor
fail. `npm run lint:dead` is knip with the explicit entries in `knip.json`; a
new unused file, export, type or dependency fails it. `npm run package:check`
builds, packs once and checks that exact tarball (manifest, `publint --strict`
and `attw`); it is a required CI check and runs before a release, not inside
the fast local gate. The required root files include `THIRD-PARTY-NOTICES.md`,
which carries the bundled component's MIT notice and must travel with the
tarball. `npm run hygiene` checks tracked generated/local files,
absolute local paths in docs and commit trailers; CI runs the same check on the
committed tree. actionlint runs in the CI `workflows` job with shellcheck on
`PATH`; if a local actionlint has no shellcheck, install it, because the CI
job is the authoritative proof. `npm run bench:ansi`
measures `stripAnsi` on fixed message corpora and fails on the 500 ms production
budget.

## Pull requests

- Keep the change focused; one change per PR.
- Include tests for new behaviour and edge cases.
- Update docs, glossary and changelog when behaviour changes.
- Do not add a runtime dependency without a written reason.
- Do not commit secrets, customer test data or screenshots from private apps.
- The review gate is blind: reviewers see the spec and the diff, not your
  self-report.

## Commit messages

Use short, imperative English messages, for example:

- `feat: preserve png attachments from legacy json`
- `fix: escape report title`
- `docs: record legacy fixture limitations`

## Commit hygiene

- One logical change per commit; do not mix refactors, formatting and
  behaviour.
- Use a conventional prefix: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`,
  `perf:`, `build:`, `ci:` or `chore:`.
- Run `npm run hygiene` and `npm run check` before committing; run
  `npm run test:e2e` for report changes.
- `npm run hygiene` rejects tracked `model.diff`, `*.official.html`,
  `test-results/`, `playwright-report/`, env/key files, absolute local home
  paths in docs, and `Co-authored-by` trailers.
- Reference the issue and the OpenSpec change in the commit body, for example
  `Refs #12` and `Change: openspec/changes/<name>`.
- Never commit generated or local artifacts, secrets, customer data, or a
  `Co-authored-by` trailer. The usual tool address belongs to an unrelated
  GitHub user.
- Keep the diff scoped; leave unrelated edits out of the commit.

## Releases

A release stages the tarball that passed the gate. The workflow is the release
path; a manual `npm publish` also runs the package check through
`prepublishOnly`, but it does not run the workflow's signature, digest or SBOM
steps.

1. Create the `v<version>` tag on a green `main` commit whose `package.json`
   version matches the tag; the release workflow runs the Linux and macOS gates
   first. The tag-on-main guard resolves `refs/heads/main` explicitly, never an
   ambiguous short name. The `release-tags` ruleset blocks deleting or moving a
   `v*` tag, and the `release` environment only accepts `v*` tags.
2. The non-privileged `package` job verifies dependency signatures, installs
   the pinned npm 12.2.3 and runs `npm run package:check`, which builds, packs
   once and checks that exact tarball. It smokes the same
   `tolkira-<version>.tgz`, records its bare-name SHA-256 and uploads the
   tarball plus digest as `tolkira-release`. The job runs with
   `contents: read` and has no npm token or OIDC.
3. The job generates a CycloneDX SBOM with
   `npm sbom --sbom-format cyclonedx --omit=dev --package-lock-only`, writes
   the fixed `tolkira-sbom.cdx.json`, and uploads it as `tolkira-sbom`; the
   upload fails if the file is missing. The SBOM covers the external runtime
   dependency tree from the lockfile and does not cover bundled code (B-075).
4. The run pauses on the `release` environment. The maintainer approves the
   deployment in the run's deployment review (the run page, Review deployments,
   environment `release`); only then does the `publish` job start and receive
   `NPM_TOKEN`. That job has no project checkout and no build: it downloads
   `tolkira-release`, verifies the tarball against the digest the `package` job
   reported and stages that exact file. No step packs a second tarball. The
   `tolkira-release` artifact expires after 14 days, so a later approval needs a
   fresh tag run.
5. Approve or reject the staged package with the maintainer's 2FA.
6. After approval, confirm `npm view tolkira@<version> version`, create the
   GitHub Release and attach the `tolkira-sbom` artifact.

Runs for one tag queue instead of cancelling, so two runs never stage at once.
A bad release needs a new patch version: the tag cannot be moved or deleted, so
fix the problem and cut the next patch. Never re-stage after approval.

## License

By contributing, you agree that your contribution is licensed under the MIT
License.
