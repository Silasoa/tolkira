# Tasks

## 1. Report UX

- [x] 1.1 Tag filter: toolbar select, unique sorted tags, combined with search
  and status filters, live count and empty state.
- [x] 1.2 Search highlight: CSS Custom Highlight API, visible-match ranges,
  feature detection and fallback.
- [x] 1.3 Copy failure: failed-scenario button, plain-text failure summary,
  clipboard fallback and polite confirmation.

## 2. CI and test trust

- [x] 2.1 Add a visual Playwright spec for desktop light/dark, Details,
  lightbox, 390 px and 320 px text zoom.
- [x] 2.2 Upload `test-results/` from the e2e job with
  `actions/upload-artifact@v7`.
- [x] 2.3 JUnit edge-case fixtures: nested suites, skipped/error, system
  output, entities, empty and malformed XML, mixed input.

## 3. Documentation

- [x] 3.1 Rewrite README for users: plain language, AI disclosure,
  accessibility, Seed-Test link, user-only docs.
- [x] 3.2 Remove stale planned/missing statements from PRODUCT, COMPATIBILITY,
  COMPARISON and open-questions.

## 4. Release

- [ ] 4.1 Run `npm run check` and `npm run test:e2e`.
- [ ] 4.2 Bump to 0.1.1, update changelog, README status and smoke test.
- [ ] 4.3 Tag `v0.1.1`, stage the npm release and request maintainer approval.
- [ ] 4.4 Create the GitHub release after npm approval.
