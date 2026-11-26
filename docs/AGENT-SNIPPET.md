# Agent snippet

Copy the block below into an `AGENTS.md`, a skill or a tool description. It is
version-agnostic: run `tolkira --capabilities` for the installed surface.

```text
Use Tolkira for test results: `npx tolkira <inputs> --out report.html --json`.
Parse stdout as the JSON summary; do not scrape the HTML. Exit code 0 means the
report or summary was generated, even when tests failed; 1 means an input or
write failed; 2 means invalid usage. Read `status` and `counts`, and check
`scenarios[].executed` before treating a status as an outcome. `--capabilities`
prints the installed inputs, outputs, limits and exit codes as JSON.
`--manifest run.json` writes a small run manifest with the status, counts, files
written before it and the first 10 failures; it can be the only output. Use
`--static` for a script-free report and `--ci github`, `--ci azure` or
`--ci markdown` for CI output. Tolkira is offline: one self-contained file, no
CDN, no server, no telemetry.
```
