# Proposal

## Why

Tolkira documents its machine surface in `docs/AGENT-INTERFACE.md`, but an agent
must scrape `--help` and the prose for the version, the accepted inputs, the
outputs, the limits, the summary schema and the exit codes. A run also leaves
no machine-readable list of what it produced: an agent that found `report.html`
cannot tell which other files exist, whether a PDF or email was written, or
where the first failures are without parsing the JSON summary or the HTML.

The 0.7 direction is agent-first discoverability. Two small, bounded additions
close the gap without changing the default one-file output:

- `--capabilities` prints one stable JSON document with the installed facts,
  sourced from the constants that enforce them.
- `--manifest <file>` writes a small JSON manifest of the run: status, counts,
  the artifacts written and the first failures.

`docs/AGENT-SNIPPET.md` gives the copy-paste AGENTS.md/skill block that
`llms.txt` lacks (B-064). The snippet and the new flags are documented together
so an agent reads one story.

The release still requires B-074 (publish-job split, tag protection, release
environment) and B-075 (bundled MIT notice) before the 0.7.0 tag; they are
separate changes and not part of this contract.

## What Changes

- `tolkira --capabilities` prints schema-1 JSON and exits 0; it takes no input
  and no other option.
- `tolkira <inputs> --manifest <file>` writes a deterministic schema-1 manifest
  with the summary status and counts, the artifact files written before it and
  the first 10 failures.
- The manifest is validated like every other output, is written last (before
  stdout), satisfies the at-least-one-output check and leaves no partial file.
- `docs/AGENT-SNIPPET.md` is added, linked from `llms.txt` and the agent
  interface and shipped in the package; `AGENT-INTERFACE.md`, `README.md`,
  `ARCHITECTURE.md`, `docs/README.md` and the changelog are updated.

Out of scope: no summary schema change (stays 2), no HTML report, email, CI or
history byte change, no new public API export, no new runtime dependency, no
network, no timestamp in the manifest, no input paths, no absolute paths except
the documented cross-drive fallback, no `--index` (deferred as B-077), no
`sarif`/JUnit/other report formats, no release, tag or publish.

## Capabilities

### Modified Capabilities

- `cli-api`: the CLI gains a capabilities document and an opt-in run manifest
  with its own path and write rules.

## Impact

Affected: `src/capabilities.ts` (new), `src/artifacts.ts` (new), `src/cli.ts`,
`src/index.ts` only if a shared limit constant needs a module export (no new
public export), `package.json` (`files`), `docs/AGENT-SNIPPET.md` (new),
`docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`, `docs/LIMITATIONS.md`,
`docs/CHANGELOG.md`, `docs/BACKLOG.md`, `docs/README.md`, `llms.txt`,
`README.md`, `DESIGN.md`, the cli-api delta, plus `test/capabilities.test.ts`
and `test/cli-artifacts.test.ts`. The packed file count grows by the snippet;
the default output, report bytes and the JSON summary stay unchanged. There is
no version bump: the package stays 0.6.1 until the 0.7.0 release.
