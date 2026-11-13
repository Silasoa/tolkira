# Tasks

## 1. TDD-Red

- [x] 1.1 Add `test/input-detect.test.ts` with a decision table over
  `(content, identity)`: legacy payloads, malformed legacy, JUnit, Messages,
  BOM, extension fallbacks, explicit versus directory identity and precedence
  collisions; verify it fails because `src/input/detect.ts` does not exist.
- [x] 1.2 Remove the temporary-directory sniff tests from
  `test/inputs.test.ts` that the pure decision table now covers; verify the
  remaining loader tests still target file-system behavior.

## 2. Implementer

- [x] 2.1 Add `src/input/detect.ts` with the pure detection table and verify
  1.1 turns green.
- [x] 2.2 Rewire `src/input/load.ts` to call `detectInput` while keeping
  directory behavior, ordering, the 100 MB cap, content-hash dedupe,
  validation-only adapter calls and duplicate id detection; verify the existing
  loader suite stays green.
- [x] 2.3 Run the targeted input suites and `npm run check`.

## 3. Handover

- [x] 3.1 Commit and push after `git pull --rebase`; report the commit hash,
  tests and preserved behavior.

## Gate record

2026-11-13: targeted suites green (`input-detect`, `inputs`, `boundaries`,
`junit`, `messages-producers`, `legacy`; 6 files, 98 tests). `npm run check`
green (26 files, 467 tests): assets, typecheck, lint, build, unit tests.
Browser tests not run: no report-level change.

## Workflow follow-up

- Coordinator runs review, then decides on archive. Do not archive, tag or
  publish in this change.
