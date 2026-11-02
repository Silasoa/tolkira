# Tasks

Do not start implementation until the user approves this change. Every task is
test-first and should fit in roughly two hours.

## 1. Toolchain and fixtures

- [ ] 1.1 Finalise `package.json`, `tsconfig.json`, ESLint, Vitest, esbuild and
  Playwright config; verify `npm install` and an empty `npm run check` path.
- [ ] 1.2 Add the CI workflow for Node 22/24/26 (typecheck, lint, test, build)
  and the npm release workflow with provenance. Verify the YAML.
- [ ] 1.3 Add a minimal Messages fixture (one passing scenario, one failing
  scenario, one PNG attachment) and a fixture loader test.
- [ ] 1.4 Add a minimal legacy JSON fixture without attachments; test that the
  fixture is valid JSON and contains the expected feature.

## 2. Messages vertical slice

- [ ] 2.1 RED: CLI test — given a Messages fixture and an output path, the CLI
  writes an HTML file containing the feature name.
- [ ] 2.2 GREEN: implement Messages parsing, `CucumberHtmlStream` rendering and
  the CLI output path. Verify the report opens and contains the feature.
- [ ] 2.3 RED/GREEN: title injection — `--title` replaces the hard-coded
  `Cucumber` title and escapes `<script>`.
- [ ] 2.4 Browser test: render the Messages fixture, expand the failing
  scenario, open the screenshot attachment and use search.

## 3. Legacy JSON vertical slice

- [ ] 3.1 RED: adapter test — a legacy feature/scenario/step fixture becomes
  Messages with the same feature, scenario and status.
- [ ] 3.2 GREEN: implement the minimal legacy adapter for features, elements,
  steps, statuses and durations.
- [ ] 3.3 RED: embedding test — a base64 PNG becomes an attachment and appears
  in the rendered report.
- [ ] 3.4 GREEN: implement embeddings → attachments with media types.
- [ ] 3.5 RED/GREEN: preserve tags, hooks, backgrounds, outlines, data tables,
  doc strings and error messages; add one test per behaviour.

## 4. Multiple inputs and groups

- [ ] 4.1 RED/GREEN: merge two Messages inputs into one report; assert both
  features and stable order.
- [ ] 4.2 RED/GREEN: accept a directory and include every supported file.
- [ ] 4.3 RED/GREEN: mixed legacy JSON + Messages input produces one report.

## 5. Shell, metadata and branding

- [ ] 5.1 RED/GREEN: metadata block with title, counts, duration and key/value
  entries; escape all values.
- [ ] 5.2 RED/GREEN: dark mode, theme tokens, logo and basic custom CSS.
- [ ] 5.3 Accessibility check: status text not colour-only, keyboard access to
  attachments and filters.

## 6. Security

- [ ] 6.1 RED/GREEN: XSS payloads in title, metadata, feature/scenario/step
  names and attachment names are escaped.
- [ ] 6.2 RED/GREEN: HTML/SVG attachments do not execute scripts; show safe
  content.
- [ ] 6.3 RED/GREEN: generated HTML has no remote asset URLs, CDN links,
  telemetry or remote fonts.
- [ ] 6.4 RED/GREEN: invalid output paths and path traversal attempts fail
  without writing outside the target directory.

## 7. Fixtures and edge cases (ISTQB)

- [ ] 7.1 Decision table for statuses: passed, failed, skipped, pending,
  undefined, ambiguous; assert counts and rendering.
- [ ] 7.2 Boundary/equivalence: empty input, one scenario, 1,000 scenarios,
  unicode names, very long names, missing optional fields.
- [ ] 7.3 Real fixtures from cucumber-js, cucumber-jvm, cucumber-ruby and
  Behave; document any unsupported shape.
- [ ] 7.4 Golden HTML checks for the shell structure; keep them stable and
  readable.

## 8. Release 0.1.0

- [ ] 8.1 Update README, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`,
  `docs/CHANGELOG.md` and `GLOSSARY.md` with shipped behaviour and limitations.
- [ ] 8.2 Verify `npm pack` contents, package size, license and third-party
  notices.
- [ ] 8.3 Run the full gate in the foreground: typecheck, lint, tests, build,
  browser test; record the results.
- [ ] 8.4 Run the blind review set (SCR, CR, DAR, SEC) and fix findings.
- [ ] 8.5 User approval, tag `v0.1.0`, publish with provenance.

## Deferred follow-ups

- External attachments/split assets/CSP.
- History/trends.
- PDF/email.
- German localisation.
- JUnit XML and Playwright JSON adapters.
- CI annotations/PR summary.
