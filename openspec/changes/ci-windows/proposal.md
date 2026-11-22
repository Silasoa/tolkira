# ci-windows

## Why

The maintainer develops on Windows and the CLI/paths are tested there locally,
but CI only runs Linux and macOS. A Windows-only path, shell or file-permission
regression can pass the current gate. This is the smallest drop-in-test gap
that does not need a live host.

## What Changes

- Add a `check-windows` CI job on `windows-latest` with Node 22 that runs
  `npm ci` and the full `npm run check` gate.
- Keep the existing Linux Node 22/24/26 matrix, Linux e2e and macOS e2e jobs.
- Do not add Windows browser e2e; the check gate covers typecheck, lint, unit,
  build and i18n. The local Playwright/e2e runs remain Linux/macOS.
- No product code, dependency, schema or report change.

## Impact

- `.github/workflows/ci.yml`, `docs/CHANGELOG.md`, `docs/DROP-IN-VALIDATION.md`
  (CI coverage note).
- CI time increases by one Windows check job.
- No remote issue exists; this is a test-infrastructure gap found in the 0.5
  research.

## Non-goals

- Windows Playwright/WebKit e2e or PDF runs.
- A Windows package-publish job.
- Changes to the supported Node versions or the release workflow.
