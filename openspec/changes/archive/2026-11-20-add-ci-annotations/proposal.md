# Proposal

## Why

CI engineers need failures in the PR and check UI, not only inside an HTML
artifact. `--json` already exposes the stable report summary, but turning that
summary into GitHub Actions annotations or a Markdown job summary is left to
custom scripts. A built-in formatter removes that glue, keeps the offline
promise and gives GitLab and GitHub the same deterministic input.

## What Changes

- Add `--ci github|markdown` to format the report summary for CI.
- Add `--ci-out <file>` for Markdown/GitLab job summaries; without it, CI output
  goes to stdout.
- GitHub mode emits capped error annotations for failed, undefined and
  ambiguous scenarios, notices for skipped, pending and unknown scenarios, and a
  final notice with every non-zero status bucket and the unexecuted count.
  Workflow-command values are escaped.
- Markdown mode emits a deterministic counts table and a capped failed-scenario
  list; it also handles skipped and empty runs.
- `--ci` works without `--out` by summarising the inputs; with `--out` the HTML
  is still written. `--json` and `--ci` share stdout only when `--ci-out` sends
  the CI text to a file.
- Exit codes stay unchanged: annotations describe the run, they do not make the
  report command fail.
- Add CLI/formatter tests and GitHub Actions/GitLab examples.

Out of scope: posting comments, calling the GitHub or GitLab API, network
access, a hosted service, changing summary schema v2, or annotating every step.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-api`: add an opt-in CI output mode that formats the stable summary as
  GitHub Actions annotations or Markdown without network access.

## Impact

- `src/cli.ts`, a new pure formatter module, `src/output.ts` use for
  `--ci-out`, tests, CLI usage and `docs/CI.md`.
- No runtime dependency, no summary schema change, no report HTML change.

## Review gate

PIR and DXR run before implementation; implementation is a TDD pair. Refs #5.
