# Tasks

## 1. Spec gate

- [x] 1.1 Run PIR and DXR over the proposal, spec delta and design; fix
  blockers.
- [x] 1.2 Confirm the change is linked to issue #15 and the scope is approved.
- [x] 1.3 Record the approval in this file before code starts.

Approved by the user on 2026-11-19 as written, including the multi-line
`error_message` and failed-status fixes.

## 2. Real producer fixture

- [x] 2.1 Add the Behave feature, step definitions and PNG under
  `test/fixtures/behave/features/`.
- [x] 2.2 Run Behave 1.3.3 in the `python:3.11` container with
  `PYTHONDONTWRITEBYTECODE=1`, write to a container temp path, verify it is
  non-empty, then copy it to `test/fixtures/behave/behave-real-attachments.json`.
  Do not hand-edit producer values; delete any `__pycache__`.
- [x] 2.3 Add `PROVENANCE.md` with Python and Behave versions, date, container,
  command, expected non-zero exit, recorded status and the public-safe scan
  result.
- [x] 2.4 Add the `behaveProducerFixture` helper to `test/fixtures.ts` and
  confirm the producer tree is the only new fixture directory.

## 3. TDD-Red

- [x] 3.1 Add failing raw-shape and public-safety tests in
  `test/behave-producers.test.ts` over the recorded JSON: `text` and
  `error_message` arrays, `status: "error"`, `mime_type: "image/png"`, no
  absolute path, home path or URL across all fixture artifacts.
- [x] 3.2 Add failing adapter, summary and report assertions in
  `test/behave-producers.test.ts` over the real fixture: newline-joined doc
  string and error message, table headings/rows, attachment type and bytes
  equal to `sample.png`, a pinned screenshot-step duration, one passed / two
  failed, run failed, and the HTML content.
- [x] 3.3 Add failing synthetic edge tests in `test/legacy.test.ts`: string
  `text` unchanged; invalid number/object/mixed-array `text`/`error_message`
  shapes rejected with a clear file/field error; `hook_error` and
  `cleanup_error` failed; line-array doc string and error message with
  HTML-like text escaped; unsupported dry-run/WIP and xfail statuses rejected.
- [x] 3.4 Confirm the new tests fail for the intended reasons before the
  adapter changes and run them with
  `npx vitest run test/behave-producers.test.ts test/legacy.test.ts`.

## 4. Implement

- [x] 4.1 Accept `string | string[]` for step `text` and result
  `error_message`; normalise arrays through the existing text helper.
- [x] 4.2 Validate `text` and `error_message` as string or string array and
  reject other shapes before rendering.
- [x] 4.3 Accept `error`, `hook_error` and `cleanup_error` and map them to
  failed.
- [x] 4.4 Keep the existing legacy, synthetic Behave and Messages behavior
  green.

## 5. Docs

- [x] 5.1 Update `docs/LIMITATIONS.md`: Behave row, date, real-run cover,
  missing error text, dry-run/WIP status list and scenario-hook limits.
- [x] 5.2 Update `docs/CUCUMBER-COMPATIBILITY.md`: header date, fixture
  definition and location, Behave row, breaking-change note, test list and
  reproduce command naming `test/behave-producers.test.ts`.
- [x] 5.3 Update `README.md`: producer table, limitations date and both
  "remaining Behave real-run gap" references.
- [x] 5.4 Update `docs/COMPARISON.md`, `docs/ARCHITECTURE.md`,
  `docs/AGENT-INTERFACE.md` and `docs/research/open-questions.md`; fix the
  false Behave-nanoseconds statement.
- [x] 5.5 Add the unreleased changelog entry and mark B-012 resolved in
  `docs/BACKLOG.md`.

## 6. Verification and review

- [x] 6.1 Run `npm run hygiene`, `npm run check` and `npm run test:e2e`.
- [x] 6.2 Run the review swarm: SCR, CR, DAR, STR and SEC. Record why CMP, UXR
  and PCA are not triggered by an adapter/fixture-only verification change.
- [x] 6.3 Fix findings and record any deferred decision in `docs/BACKLOG.md`.
- [x] 6.4 Commit on the worktree branch with issue #15 and the change
  reference. Do not merge, close, tag, stage, publish or archive.

## Gate record

2026-11-19: `npm run hygiene` ok (472 tracked files, 220 commits);
`npm run check` 39 files, 669 passed, 2 skipped; `npm run test:e2e` 273 passed
(Chromium, Firefox, WebKit). Review swarm: SCR, CR, DAR, STR and SEC. Blockers
were the false-positive doc-string report assertion, the over-broad
"crash-like statuses" wording, the `cleanup_error` producer claim and the stale
task ledger; all fixed and re-reviewed with no remaining blockers. CMP, UXR and
PCA were not triggered: the change adds no report feature or shell surface and
no hot path. Deferred decisions: B-018 residual legacy argument/doc-string
validation and B-019 element-level Behave status, both with triggers in
`docs/BACKLOG.md`. Committed on the worktree branch with `Refs #15` and
`Change: verify-real-behave-run`.
