# Tasks

## 1. Spec gate

- [x] 1.1 Run PIR and DXR over proposal, spec and design; fix blockers.
- [x] 1.2 Confirm the change is linked to issue #4.

## 2. TDD-Red

- [x] 2.1 Add detection-table cases for Playwright JSON, malformed JSON and
  non-misclassification of Cucumber legacy, Messages and JUnit.
- [x] 2.2 Add a real Playwright JSON fixture covering two projects and two
  files in one project, nested describes and steps, passed/failed/skipped/
  flaky, expected failure, unexpected pass, timedOut, retries, inline and path
  attachments, tags, annotations and error context. Copy the safe attachment
  files into the fixture directory and rewrite every absolute path,
  `config.rootDir`, `config.configFile`, annotation location and error location
  to a relative fixture path.
- [x] 2.3 Add adapter tests for project/file/rule mapping, final status,
  expected failure counted once as passed (including timedOut/interrupted),
  unexpected pass counted as failed, flaky attempt, skipped-without-results,
  non-skipped no-results visibility, step statuses, annotation descriptions,
  source paths/control codes, errors, attachment safety, malformed shapes and
  merged inputs.
- [x] 2.4 Add explicit tests for empty runs, run-level errors, stdout/stderr,
  markdown error context, safe/outside attachment roots, path-size rejection
  before read, loader dedupe and CLI exit/absent output.
- [x] 2.5 Confirm the new tests fail for the right reason before implementation.

## 3. Implement

- [x] 3.1 Add the Playwright shape detector and loader dispatch.
- [x] 3.2 Add the Playwright adapter with one feature per project,
  file/describe rules, direct envelopes, attempts, statuses, steps, errors,
  run-level errors and safe attachments.
- [x] 3.3 Set the Playwright producer metadata and generated IDs, including
  repeat-each tests.
- [x] 3.4 Normalise `text/markdown` to `text/plain` in the adapter so error
  context renders as readable text.
- [x] 3.5 Keep existing Cucumber legacy, Messages and JUnit behavior green.

## 4. Docs

- [x] 4.1 Update `docs/LIMITATIONS.md` with the native adapter and path
  containment limit.
- [x] 4.2 Update `docs/COMPATIBILITY.md`, `docs/JUNIT-XML.md`, the README
  producer table and input examples, and the CLI usage text.
- [x] 4.3 Add `docs/PLAYWRIGHT-JSON.md` with the native JSON contract,
  detection, mapping, producer/HTML-only note, stdio attachment size and
  path-attachment limit; link it from `docs/README.md`.
- [x] 4.4 Update `docs/AGENT-INTERFACE.md` current limits for the native
  Playwright input, final-attempt behavior and HTML-only producer metadata.
- [x] 4.5 Add the Playwright JSON contract and detection rule to the input
  spec.

## 5. Verification and review

- [x] 5.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 5.2 Run the review swarm: SCR, CR, DAR, CMP, SEC.
- [x] 5.3 Fix findings and record any deferred decision in `docs/BACKLOG.md`.
- [x] 5.4 Commit and push with the issue and change reference.

## Gate record

2026-11-18: `npm run hygiene` ok; `npm run check` 549 passed, 1 skipped;
`npm run test:e2e` 231 passed (Chromium, Firefox, WebKit). Review swarm:
SCR, CR, STR, SEC and CMP pass after fixes; DAR blockers were the error-path
claim, project fallback and release wording, all corrected. Deferred
follow-ups are recorded in `docs/BACKLOG.md`.
