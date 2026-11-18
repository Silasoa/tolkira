# Playwright OSS comparison: movies-app

Date: 2026-11-18. Status: research, not a release gate.

## Fixture

- Repository: [`debs-obrien/playwright-movies-app`](https://github.com/debs-obrien/playwright-movies-app)
- Commit: `5d2cdf08e12a454132b6c86b3f72718d257ca460`
- Stack: Next.js movies app, local TMDB mock API, Playwright 1.62.1, Node 26.13.1.
- Setup: `npm install`, `npx playwright install chromium`, `.env` copied from
  `.env.example`; Playwright starts the app and mock API through `webServer`.
  No cloud account and no external service beyond TMDB images.

A focused logged-out suite ran on Chromium: `search.spec.ts`,
`navigation.spec.ts`, `movie-list.spec.ts` plus a temporary deterministic
fixture for pass, fail, skip, flaky and `test.fail()`. The repository's own
intentional-failure lesson is `test.fixme`, so the temporary fixture supplied
the failure/retry coverage.

Result: 10 passed, 1 flaky, 1 skipped, 1 failed (deliberately). The first run
also showed a genuine intermittent failure in `movie-list.spec.ts`, which
passed on a later run.

## Native vs Tolkira

| | Playwright HTML/JSON | Tolkira |
| --- | --- | --- |
| Output | 4.7 MB, 29 files | 2.0 MB, one file |
| Scenarios | 12 (skipped excluded from native total) | 13 “executed” |
| Passed / failed / flaky / skipped | 10 / 1 / 1 / 1 | 11 / 1 / folded into passed / 1 |
| Retry detail | Run + Retry #1, first-attempt error | final attempt only, `Attempt: 2`, `@flaky` |
| Attachments | trace viewer, screenshots, video | inline screenshots/video/text, trace zip skipped |
| 320 px | cramped, titles/paths clipped | no horizontal overflow |

## Findings

### Tolkira defects / contract inconsistencies

1. **Skipped is counted as executed.** A skipped test with no Playwright steps
   gets a synthetic skipped step, so `--json` reports `executed: true`, the
   HTML says “13 executed scenarios” and the pass-rate denominator includes it.
   `docs/AGENT-INTERFACE.md` defines `executed` as at least one raw step result.
   Decide whether the flag/count or the definition changes.
2. **Feature source is misleading.** The `chromium` feature spans four files,
   but its header and Details source show one arbitrary spec file. Omit the
   source for multi-file project features or show the file count.
3. **Silent attachment loss.** When the JSON lives apart from `test-results`,
   path attachments are skipped without a warning; a run from the fixture
   directory had 4 attachments / 123 bytes and no screenshots, while a run from
   the project root had 8 attachments / 788,715 bytes. The limit is documented,
   but the report can still look self-contained when it is not.
4. **Duplicate location line.** The expected-failure error block renders
   `at tests/...:44:81` twice.
5. **Wrong run-environment vocabulary.** The Details tab says “Cucumber
   environment” for a Playwright-only report.
6. **Rule grouping loses file cohesion.** One spec file can appear in two rule
   sections, and failure-first ordering interleaves files; native keeps one
   file group. A file-level view or toggle would help.

### Documented basic-mode limits with real costs

- Flaky is flattened to passed + `@flaky`; there is no flaky count/status in
  HTML or `--json`, so agents cannot distinguish 10 passes + 1 flake from 11
  passes.
- Only the final attempt is visible; earlier screenshots/errors are lost,
  which is exactly the flake-forensics evidence.
- No trace viewer or Playwright HTML replay; trace zips are skipped.
- Duration is the sum of final attempts (23.57 s), not wall clock (31.9 s).
- Status chips are toggles; there is no one-click “failed only” filter.
- Hooks are rolled into `Playwright overhead`, not shown individually.

### Advantages observed

- Single offline file instead of a 29-file report folder.
- Better 320 px layout than Playwright's own report.
- Strong tag search/filter; tags expose expected/flaky/skip semantics.
- Details tab and agent summary are useful for CI and agents.

## Fixture suitability

Good ongoing comparison fixture if pinned to a commit and run as a curated
subset. It has a real app, mock API, auth setup, 53 tests, network mocking,
tags, attachments and natural flakiness. Caveats: it is a teaching repo whose
assertions track mock data, and its intentional failure is `fixme`; keep a
separate deterministic fixture for failure/retry/attachment coverage. For
stable regression, save the Playwright JSON plus `test-results` once and
replay it; for an end-to-end smoke, run the app.

Screenshots are in the session temp folder under `tolkira-pw/`: native and
Tolkira at 1440/320, plus flaky, expected-failure, attachments and details.
