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

Requires Node.js 22 or newer.

```shell
npm ci
npx playwright install chromium firefox webkit
npm run hygiene
npm run check
npm run test:e2e
```

`npm run check` runs typecheck, lint, unit tests and build. `npm run hygiene`
checks tracked generated/local files, absolute local paths in docs and commit
trailers; CI runs the same check on the committed tree.

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

## License

By contributing, you agree that your contribution is licensed under the MIT
License.
