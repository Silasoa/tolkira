# Proposal

## Why

`main` is red in CI on two jobs, both release blockers:

- `e2e` (since the incident review): 63 failures at 320 px / 200 % text, all
  `pageOverflow` 12 px. The 2.0 labels "Expand all scenarios" and "Collapse all
  scenarios" make the toolbar `.expand` block's min-content wider than the
  shell. Windows fonts fit by a few pixels; Linux fonts overflow, and the
  archive only saw Windows.
- `workflows` (since the release/CI hardening): actionlint with shellcheck
  reports `SC2086` for the unquoted `tolkira-$TOLKIRA_VERSION.tgz` in the CI
  package job and the release package job. The local actionlint runs on Windows
  without shellcheck, so the archived gate missed it.

Both are small, verified fixes. They must land before any 0.7.0 tag.

## What Changes

- Let the toolbar `.expand` block wrap its two buttons and keep them end-aligned,
  so its min-content is one button, not two. The desktop layout is unchanged.
- Quote the versioned tarball path in the CI and release install commands, and
  pin the quoted form in the release workflow test plus a unit check in the
  workflow config test that no unquoted `/tmp/pack/tolkira-$TOLKIRA_VERSION.tgz`
  path word survives in either workflow.
- Add an e2e assertion that `.expand` stays inside the toolbar at 320 px /
  200 % and stays one line at 1440 px.
- Print `shellcheck --version` in the CI `workflows` job before actionlint, so
  the integration cannot disappear silently, and pin that order in the workflow
  test.
- Re-pin the report goldens/characterization hashes for the intended CSS bytes;
  no content, markup or schema change.

## Capabilities

### Modified Capabilities

- `report-rendering`: the toolbar controls stay inside the report shell at
  320 px with 200 % text.
- `release`: workflow commands that interpolate the versioned tarball path are
  shellcheck-clean.

## Impact

- Report CSS grows by a few bytes; every report byte changes only by that CSS.
- No runtime dependency, public API, CLI option or version change. No tag,
  stage or publish in this change.

## Out of scope

- New toolbar controls, copy changes or a redesign of the expand behavior.
- Replacing actionlint/shellcheck or moving the gate off Linux.
- The `NPM_TOKEN`/build-trust decisions from B-074.

No GitHub issue exists; this is a release-gate fix recorded here and in
`docs/BACKLOG.md`.
