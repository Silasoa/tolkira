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
