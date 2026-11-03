# Contributing

Thanks for taking a look. Tolkira is spec-first and review-first; please read
this before opening a PR.

## Before code

1. Open or find an issue that describes the problem.
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
npm run check
npm run test:e2e
```

`npm run check` runs typecheck, lint, unit tests and build.

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

## License

By contributing, you agree that your contribution is licensed under the MIT
License.
