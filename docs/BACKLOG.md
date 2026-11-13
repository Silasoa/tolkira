# Backlog and decision log

This is the durable runbook for review findings, architecture candidates and
product ideas. Nothing is silently discarded: every finding is either **fixed**,
**filed as a GitHub issue**, or **recorded as a decision** here with the reason.

## Workflow

1. A review, architecture pass or planning session produces a finding.
2. The coordinator gives it an ID (`B-001`), an area and a priority.
3. Choose one:
   - **Fix now** — small enough for the current slice.
   - **Issue** — file it on GitHub with the `area:*` and `priority:*` labels and
     link it here. A spec is written before implementation.
   - **Decision** — reject or defer with a concrete reason and a trigger for
     revisiting. This is the only allowed way to not act.
4. Issues move through the normal workflow: OpenSpec change → TDD-Red →
   implementer → review swarm → archive.
5. Re-check this list at every release and after every review swarm.

## How agents work

- This file is intake. A GitHub issue is for durable, actionable, testable
  work; the decision tree is in
  [`docs/agents/issue-tracker.md`](agents/issue-tracker.md).
- One issue per OpenSpec change; keep each issue to one coherent change. Batch
  related chores under one meta issue instead of opening an issue per note.
- `ready-for-agent` means testable acceptance criteria and a linked
  spec/change. Labels route work and never replace the issue body; see
  [`docs/agents/triage-labels.md`](agents/triage-labels.md).
- Commit one logical change with a conventional prefix, reference the
  issue/change, run `npm run hygiene` and `npm run check`, and never add a
  `Co-authored-by` trailer, a generated artifact or a local path.
- Specs are the contract. The OpenSpec CLI version is an implementation detail
  (2.0 migration in progress); do not hardcode CLI flags in issues, specs or
  docs.
- Only the coordinator closes issues; workers never close, archive or publish.

## Open work

| ID | Area | Priority | Item | Issue |
| --- | --- | --- | --- | --- |
| B-001 | Parity | P1 | Playwright JSON adapter | [#4](https://github.com/Silasoa/tolkira/issues/4) |
| B-002 | Vision | P1 | CI annotations and PR summary from `--json` | [#5](https://github.com/Silasoa/tolkira/issues/5) |
| B-003 | Integration | P1 | Seed-Test 2.0 group sidecar | [#6](https://github.com/Silasoa/tolkira/issues/6) |
| B-004 | Architecture | P2 | Reflow and split `html.ts` at view seams | [#7](https://github.com/Silasoa/tolkira/issues/7) |
| B-005 | Tests | P2 | Split render/e2e suites and finish fixture helpers | [#8](https://github.com/Silasoa/tolkira/issues/8) |
| B-006 | Architecture | P2 | Consolidate attachment byte counting and presentation lookup | [#9](https://github.com/Silasoa/tolkira/issues/9) |
| B-007 | Vision | P2 | Optional history file and trends | [#10](https://github.com/Silasoa/tolkira/issues/10) |
| B-008 | Vision | P2 | Decide external or split-assets attachment mode | [#11](https://github.com/Silasoa/tolkira/issues/11) |
| B-009 | Vision | P3 | German UI and localisation | [#12](https://github.com/Silasoa/tolkira/issues/12) |
| B-010 | Vision | P3 | PDF/email summary | [#13](https://github.com/Silasoa/tolkira/issues/13) |
| B-011 | Architecture | P3 | Generated-assets build seam (deferred) | [#14](https://github.com/Silasoa/tolkira/issues/14) |
| B-012 | Research | P3 | Real Behave run with attachments and doc strings | [#15](https://github.com/Silasoa/tolkira/issues/15) |
| B-013 | Tests | P3 | JUnit suite-level output and producer coverage | [#16](https://github.com/Silasoa/tolkira/issues/16) |
| B-014 | Performance | P3 | Benchmark `stripAnsi` fast path | [#17](https://github.com/Silasoa/tolkira/issues/17) |
| B-015 | Decision | P3 | Node 20 support policy | [#18](https://github.com/Silasoa/tolkira/issues/18) |
| B-016 | Meta | P2 | Public repo hygiene and `.gitignore` baseline | [#20](https://github.com/Silasoa/tolkira/issues/20) |

**B-016 status (2026-11-13).** Done: removed the tracked `model.diff`, added
Playwright, cache, editor and swap patterns to `.gitignore`, added
`docs/README.md` and linked it from `README.md`, `CONTRIBUTING.md` and
`llms.txt`, and archived three unreferenced research notes under
`docs/research/archive/`. Added the durable issue/backlog/commit workflow in
`docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`,
`CONTRIBUTING.md` and `AGENTS.md`, plus `npm run hygiene`
(`scripts/check-hygiene.mjs`) for tracked artifacts, absolute local home paths
and `Co-authored-by` trailers, wired into CI. Remaining: reduce the weight of
the comparison images (`docs/comparison/old-*` stays because
`docs/COMPARISON.md` links every image) and finish the `.opencode`/`.agents`
skill deduplication as part of the OpenSpec 2.0 migration.

## Decisions (do not re-open without a trigger)

- **G13 external attachments / split assets.** Deliberate conflict with the
  one-file/offline promise. Product decision tracked in B-008; do not add
  remote URLs or CDN defaults.
- **G16 lazy rendering.** Deliberate no-JS trade-off. Revisit only after a
  measured large-run problem; the static report is much smaller.
- **Themes/charts.** Deliberate non-goal. Branding is title, metadata, logo,
  accent and dark mode.
- **Generated assets.** Keep the current convention until a second consumer or
  a stale-output incident occurs (B-011).
- **Node 20.** Keep Node 22 LTS as the supported floor until a green Node 20
  smoke test exists (B-015).

## Fixed in 0.3

- Outlines/examples, hooks, diagnostics, empty-run semantics, rules/tags,
  Markdown, tag expressions/URL state, CI metadata, attachment polish, CJS
  wrapper, stream adapter, parameter highlighting.
- Architecture: `indexRun` single projection, pure input detection, typed DOM
  contract, CSS filter-status contract.
