# Tasks

Do not start implementation until the user approves this change. Every task is
test-first and should fit in roughly two hours.

## 1. Toolchain and fixtures

- [x] 1.1 Finalise `package.json`, `tsconfig.json`, oxlint, Vitest, esbuild and
  Playwright config; verify `npm install` and an empty `npm run check` path.
- [x] 1.2 Add the CI workflow for Node 22/24/26 (typecheck, lint, test, build)
  and the npm release workflow with provenance. Verify the YAML.
- [x] 1.3 Add a minimal Messages fixture (one passing scenario, one failing
  scenario, one PNG attachment) and a fixture loader test.
- [x] 1.4 Add a minimal legacy JSON fixture without attachments; test that the
  fixture is valid JSON and contains the expected feature.

## 2. Messages vertical slice

- [x] 2.1 RED: CLI test — given a Messages fixture and an output path, the CLI
  writes an HTML file containing the feature name.
- [x] 2.2 GREEN: implement Messages parsing, `CucumberHtmlStream` rendering and
  the CLI output path. Verify the report opens and contains the feature.
- [x] 2.3 RED/GREEN: title injection — `--title` replaces the hard-coded
  `Cucumber` title and escapes `<script>`.
- [x] 2.4 Browser test: render the Messages fixture, expand the failing
  scenario, open the screenshot attachment and use search.

## 3. Legacy JSON vertical slice

- [x] 3.1 RED: adapter test — a legacy feature/scenario/step fixture becomes
  Messages with the same feature, scenario and status.
- [x] 3.2 GREEN: implement the minimal legacy adapter for features, elements,
  steps, statuses and durations.
- [x] 3.3 RED: embedding test — a base64 PNG becomes an attachment and appears
  in the rendered report.
- [x] 3.4 GREEN: implement embeddings → attachments with media types.
- [x] 3.5 RED/GREEN: preserve tags, hooks, background steps, expanded outline
  rows, data tables, doc strings and error messages; add one test per behaviour.
  Reconstructing the original outline `examples` table is deferred.

## 4. Multiple inputs and groups

- [x] 4.1 RED/GREEN: merge two Messages inputs into one report; assert both
  features and stable order.
- [x] 4.2 RED/GREEN: accept a directory and include every supported file.
- [x] 4.3 RED/GREEN: mixed legacy JSON + Messages input produces one report.

## 5. Shell, metadata and branding

- [x] 5.1 RED/GREEN: visible title, summary counts, duration, metadata block
  and key/value entries; escape all values.
- [x] 5.2 RED/GREEN: system dark mode, accent theme token, embedded logo.
- [ ] 5.3 Accessibility check: status text not colour-only, keyboard access to
  attachments and filters.

## 6. Security

- [x] 6.1 RED/GREEN: XSS payloads in title, metadata, feature/scenario/step
  names, tags and attachment names are escaped.
- [x] 6.2 RED/GREEN: HTML attachments do not execute scripts; images render
  from data URIs.
- [x] 6.3 RED/GREEN: generated HTML has no remote asset URLs, CDN links,
  telemetry or remote fonts, and carries a hash-based CSP.
- [ ] 6.4 RED/GREEN: invalid output paths and path traversal attempts fail
  without writing outside the target directory.

## 7. Fixtures and edge cases (ISTQB)

- [x] 7.1 Decision table for statuses: passed, failed, skipped, pending,
  undefined, ambiguous; assert counts and rendering.
- [ ] 7.2 Boundary/equivalence: empty input, one scenario, 1,000 scenarios,
  unicode names, very long names, missing optional fields.
- [ ] 7.3 Add cucumber-jvm and cucumber-ruby fixtures; document any unsupported
  shape. Behave-shaped and cucumber-js fixtures exist.
- [ ] 7.4 Golden HTML checks for the shell structure; keep them stable and
  readable.

## 8. Release 0.1.0

- [x] 8.1 Update README, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`,
  `docs/CHANGELOG.md` and `GLOSSARY.md` with shipped behaviour and limitations.
- [x] 8.2 Verify `npm pack` contents, package size, license and third-party
  notices. 20 files, 78.8 kB packed; AGENT-INTERFACE and GLOSSARY included.
- [x] 8.3 Run the full gate in the foreground: typecheck, lint, tests, build,
  browser test; record the results. Green on 2026-11-02 after fixes: 51 unit
  tests, 3 Playwright tests, 0 audit vulnerabilities.
- [ ] 8.4 Run the blind review set (SCR, CR, DAR, SEC) and fix findings.
- [ ] 8.5 User approval, tag `v0.1.0`, publish with provenance.

## 9. Agent interface

- [x] 9.1 RED/GREEN: `summarizeReport` returns a stable schema with status,
  counts, duration, attachments and per-scenario steps and messages.
- [x] 9.2 RED/GREEN: CLI `--json` prints exactly one summary document, with or
  without `--out`, while failing tests still exit with code 0.
- [x] 9.3 Document the schema, exit codes and agent workflow in
  `docs/AGENT-INTERFACE.md` and README.
- [x] 9.4 Reject remote attachments and strip remote Markdown images before
  summarising or rendering.

## Deferred follow-ups

- External attachments/split assets for oversized reports.
- User-supplied custom CSS.
- Legacy outline `examples` reconstruction.
- History/trends.
- PDF/email.
- German localisation.
- JUnit XML and Playwright JSON adapters.
- CI annotations/PR summary.
