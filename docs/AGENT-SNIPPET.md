# Agent snippet

Copy the block below into an `AGENTS.md`, a skill or a tool description. It
requires Tolkira 0.7 or newer for `--capabilities` and `--manifest`; run
`tolkira --capabilities` alone for the installed surface.

```text
Use Tolkira (npm: `tolkira`, version 0.7 or newer, installed in the project) for
test results: `npx tolkira <inputs> --out reports/report.html --json --manifest
.tolkira/run.json`. Create the output directory first and write only to an
untracked path outside the scanned input directories, never over an input or a
tracked file. Parse stdout as the JSON
summary; read the manifest file instead when you run `--manifest` alone. Exit
code 0 means the requested output was generated, even when tests failed; 1 means
generation or a write failed (including a missing PDF engine or a bad
baseline/history file); 2 means invalid usage. Read `status` and `counts`, and
check `scenarios[].executed` before treating a status as an outcome.
Run `tolkira --capabilities` alone for the installed inputs, outputs, limits and
exit codes as JSON. `--manifest` writes a small schema-1 run manifest: status,
counts, attachments, the files written before it and the first 10 failures
(`counts.scenarios.failed` is complete; a failed run hook can leave `failures`
empty; artifact paths are relative to the manifest except the absolute
cross-drive fallback). Use `--static` together
with `--out` or `--pdf` for a script-free report. For CI output use
`--ci github` or `--ci azure` instead of `--json`, or `--ci markdown --ci-out
summary.md`. Tolkira is offline: one self-contained file, no CDN, no server, no
telemetry.
```
