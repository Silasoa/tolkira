# Proposal

## Why

`test/render.test.ts` is 2,288 lines with 92 tests and the browser report spec
is 2,702 lines with 50 tests. A failure points at a wall of unrelated cases,
the renderer module ownership from #7 is invisible in the test layout, and the
same CLI, clipboard and ANSI setup is copied into several specs. The fixture
helper exists but most suites still build fixture paths by hand.

## What Changes

- Split the unit render suite by report flow and by the renderer module that
  owns it: report shell, outlines, hooks, rules/backgrounds, triage, matrix,
  diagnostics, source strip, default open state and empty runs.
- Split the browser report spec by user journey: core report, search/filter,
  triage, attachments, clipboard, hooks, outlines, diagnostics, rules, empty
  runs, keyboard, no-JS and performance.
- Add shared test helpers: `test/render-helpers.ts` for HTML assertions,
  `test/e2e/helpers.ts` for report creation and clipboard stubs, and
  `test/ansi-payload.ts` for the hostile terminal payload shared by the unit
  and browser copy tests. Reuse `test/fixtures.ts` for every fixture path in
  the touched suites.
- Keep every existing assertion. The collected test total and the browser
  journey coverage stay the same; a change is allowed only with a written
  reason in `tasks.md`.
- Record the baseline and final unit/browser counts and runtimes.

Out of scope: product behaviour, renderer source, CSS, markup, CLI/API,
dependencies, coverage policy, visual baselines and rewriting tests for style.

## Acceptance criteria

- The unit render suite and the browser report suite are each split into files
  that cover one flow or journey; no test file exceeds about 800 lines unless
  it covers one coherent flow, and any exception is named in `tasks.md`.
- Every assertion in the original two files exists in exactly one new file.
  The static `expect(` inventory is preserved: the render suite is 484 in the
  ten split files plus 1 in `test/render-helpers.ts`, for 485; the browser
  report spec's 466 lines become 417 across the split specs plus one
  `expect(code)` in the shared `writeReport` helper, because 49 report creation
  checks (47 `expect(code)` plus two diagnostic setup checks) move into it. The
  ANSI expected string changes value, not count. No matcher is loosened.
- The collected unit and browser test totals and the sorted test-title
  multiset (describe chain included) match the baseline, or the difference is
  documented with the reason. Unit files rise from 38 to 47; the 91 browser
  definitions each appear once per project (273 runs). Pass/skip splits are
  platform-specific and are not the parity rule.
- The browser suite still covers triage, attachments, search, keyboard and
  no-JS in named specs. The `without scripting` block moves with its
  `test.use({ javaScriptEnabled: false })` wrapper and its four tests.
- `test/fixtures.ts` is used for fixture paths in the touched suites; report
  creation, the clipboard stubs and the hostile ANSI payload have one shared
  home. The two named assertion moves are the `expect(code).toBe(0)` checks
  absorbed by `writeReport` and the ANSI expected visible text, which changes
  from `c1-red` to `c1-csi` for the broader shared payload.
- The render characterization hashes and both golden files stay unchanged in
  an LF checkout (`i/lf w/lf`, `core.autocrlf=false`). A CRLF mismatch is
  diagnosed, never re-recorded; CI on LF is authoritative.
- `npm run hygiene`, `npm run check` and `npm run test:e2e` are green. Runtime
  is informational: record wall clock and the per-test duration sum on the same
  machine and worker count; a >20 % increase is investigated. The hard
  performance guard stays the in-test `performance.spec.ts` budgets.

## Capabilities

### New Capabilities

- `test-infrastructure`: suite layout, shared helpers and coverage guards for
  the Tolkira tests.

### Modified Capabilities

None. No product contract changes.

## Impact

- `test/render*.test.ts`, `test/e2e/*.spec.ts`, new helper files under `test/`,
  `test/ansi-stripping.test.ts`, `playwright.config.ts`, `docs/CHANGELOG.md`
  and the B-005 entry in `docs/BACKLOG.md`.
- `test/fixtures.ts` is reused, not changed unless a missing fixture category is
  found.
- No `src/`, dependency, public export, output or fixture-content change.

## Review gate

PIR and DXR run before implementation. No TDD-Red: there is no behaviour to
specify. The static assertion inventory, collected counts and title multiset,
the committed characterization hashes and both golden files are the safety net,
comparable to the #7 refactor.
Review swarm: SCR, CR, DAR, STR and PCA (suite structure and runtime). SEC, UXR
and CMP are not triggered because no input, attachment, path, markup or report
output changes. Refs #8 and B-005.
