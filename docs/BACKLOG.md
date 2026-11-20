# Backlog and decision log

This is the durable runbook for review findings, architecture candidates and
product ideas. Nothing is silently discarded: every finding is either **fixed**,
**filed as a GitHub issue**, or **recorded as a decision** here with the reason.

## Workflow

1. A review, architecture pass or planning session produces a finding.
2. The coordinator gives it an ID (`B-001`), an area and a priority.
3. Choose one:
   - **Fix now** — small enough for the current slice.
   - **Issue** — draft it, pass the IR review, then file it on GitHub with the
     `area:*` and `priority:*` labels and link it here. A spec is written
     before implementation.
   - **Decision** — reject or defer with a concrete reason and a trigger for
     revisiting. This is the only allowed way to not act.
4. Issues move through the normal workflow: IR review → OpenSpec change and
   PIR/DXR spec review → TDD-Red → implementer → review swarm → archive.
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
- Specs are the contract. The OpenSpec CLI and its skills are installed
  globally; do not hardcode CLI flags in issues, specs or docs.
- Only the coordinator closes issues; workers never close, archive or publish.

## Open work

| ID | Area | Priority | Item | Issue |
| --- | --- | --- | --- | --- |
| B-010 | Report | P3 | PDF/email summary | [#13](https://github.com/Silasoa/tolkira/issues/13) |
| B-018 | Input | P3 | CR-only text keeps CR (fast-path probe ignores CR; pre-existing) | — |

**Label taxonomy (2026-11-13).** Remote labels now match
[`triage-labels.md`](agents/triage-labels.md): one surface `area:*`, one
`priority:*` and one readiness label. `accepted` was added for triaged work
without an approved spec; the old theme labels (`area:parity`,
`area:architecture`, ...) were removed.

**IR review (2026-11-13).** The remaining open issues passed. Optional
refinements before promotion: #8 refresh the line count and name the e2e
specs; #12 keep the locale trigger explicit; #13 narrow to print CSS or one
delivery format; #15 name the fixture and the missing Behave shapes; #17 name
the benchmark path and budget.

**Localisation triggers (2026-11-20).** The `en`/`de` change deliberately stops
at neutral copy and one catalog per language. Revisit these only when a user
asks or a locale needs them:

- **Pseudo-locale** — add when a translation change needs an automated
  expansion/overflow check beyond the German viewport gate.
- **Localized default title** — the title stays `Tolkira report` because it
  feeds the history id; add only with a stable id strategy.
- **RTL** — add when an RTL locale ships; `dir` is already resolved from the
  locale entry but no RTL catalog or mirroring work exists.
- **In-report switcher** — add only if one file must carry several locales;
  today one report holds one locale and the client bundle carries no non-English
  catalog.
- **Select/gender** — add when a real string needs grammatical gender or a
  `select`; the formatter intentionally supports placeholders and plural only.
- **English singular grammar in triage/health** — pre-existing sentences such as
  `1 of 2 scenarios need attention` and the screen-reader health text
  `1 of 1 attempted scenarios passed` are deliberately left unchanged so the
  English output stays as today. Fix with the next English copy change or when a
  user reports it; the German copy is already correct and this change does not
  correct the English wording.

## Resolved

- **B-009 German UI and localisation** — implemented on 2026-11-20 in the
  `add-report-localisation` change: `--locale en|de` (default `en`, `de-AT` uses
  `de` and keeps its tag), ICU JSON catalogs with a generated typed module,
  German numbers/dates/durations via `Intl`, a localized report shell and
  client messages, and an English/German agent guide. One locale per build; no
  switcher, RTL or CLI/CI translation. The one-file default is unchanged.
  [#12](https://github.com/Silasoa/tolkira/issues/12) is resolved.
- **B-007 Optional history file and trends** - implemented in `main` on
  2026-11-19 in the `add-history-trends` change: opt-in `--history <file>`,
  aggregate-only `schemaVersion: 1` sidecar with a 30-run cap, dedupe,
  atomic write and strict validation, plus a Trends tab with a table and
  sparkline from two runs. The one-file default is unchanged.
  [#10](https://github.com/Silasoa/tolkira/issues/10) is resolved. The change
  remains active for the archive pass.
- **B-008 External or split-assets attachment mode** — decided on 2026-11-19 in
  [ADR 0006](adr/0006-inline-attachments.md): keep one inline HTML file, reject
  remote URLs, `file:`, UNC and outside-root paths, and do not add a
  split-assets mode. Revisit only when a user cannot share a report because of
  media size or a CI artifact limit, then as a new opt-in design with its own
  ADR. [#11](https://github.com/Silasoa/tolkira/issues/11) is resolved.
- **B-005 Split render/e2e suites and fixture helpers** — implemented in `main`
  on 2026-11-19 in the `split-test-suites` change. The render suite is split by
  report flow, the browser report spec by journey, and fixture paths, report
  creation, clipboard stubs and the hostile ANSI payload share one helper.
  [#8](https://github.com/Silasoa/tolkira/issues/8) is resolved.
- **B-006 Attachment byte consolidation** — implemented in `main` on 2026-11-19
  in the `consolidate-attachment-bytes` change. `src/attachment.ts` owns decoded
  byte accounting, the caps, the allowlist, fallback names, kind and text
  presentation; the summary and rendered HTML are unchanged.
  [#9](https://github.com/Silasoa/tolkira/issues/9) is resolved.
- **B-014 `stripAnsi` benchmark** — implemented in `main` on 2026-11-19 in the
  `benchmark-strip-ansi` change. `npm run bench:ansi` measures clean and
  escape-laden corpora against scan-only and char-append references, runs in the
  Node 22 CI check job, and keeps the fast path (about 9.6x on the clean corpus)
  with identical output. [#17](https://github.com/Silasoa/tolkira/issues/17) is
  resolved.
- **B-012 Real Behave run with attachments and doc strings** — implemented on
  2026-11-19 in the `verify-real-behave-run` change. The recorded run covers a
  multiline doc string, a data table, an inline PNG, a multiline error message
  and an `error` status; the adapter joins Behave line arrays and maps the
  `error` and `hook_error` step-result statuses to failed, while accepting
  `cleanup_error` defensively in a step result. Dry-run/WIP statuses and
  scenario-level hook failures without a step result remain documented limits.
  [#15](https://github.com/Silasoa/tolkira/issues/15) is resolved by this
  change.
- **B-004 Renderer split** — implemented in `main` on 2026-11-19. `html.ts` is
  the shell, CSP and `renderHtml` assembly; `report`, `details`, `triage`,
  `matrix`, `attachments`, `ci`, `format` and `types` own the views behind a
  one-way layer test. Output stayed byte-identical against the characterization
  hashes and golden snapshots. [#7](https://github.com/Silasoa/tolkira/issues/7)
  is resolved.
- **B-017 Playwright OSS comparison findings** — addressed on 2026-11-19 via
  #25 (presentation clarity), #26 (attachment warning) and #27 (failed-only
  preset); remaining items have backlog decisions with triggers.
  [#24](https://github.com/Silasoa/tolkira/issues/24) is resolved.
- **B-001 Playwright JSON adapter** — implemented in `main` on 2026-11-18, not
  yet released. The native adapter covers projects, file/describe rules,
  retries, steps, attachments and run-level errors; see
  [`docs/PLAYWRIGHT-JSON.md`](PLAYWRIGHT-JSON.md).
  [#4](https://github.com/Silasoa/tolkira/issues/4) is resolved.
- **B-002 CI annotations and Markdown/PR-step summary text** — implemented in
  `main` on 2026-11-18, not yet released. `--ci github` emits capped GitHub
  Actions annotations and `--ci markdown` writes deterministic summary text for
  stdout, `$GITHUB_STEP_SUMMARY`, a PR-step summary or `--ci-out`; see
  [`docs/CI.md`](CI.md). Posting a PR comment or calling a CI provider API
  remains out of scope. [#5](https://github.com/Silasoa/tolkira/issues/5) is
  resolved.
- **B-003 Seed-Test 2.0 group sidecar** — resolved for Tolkira on 2026-11-13.
  The 0.3.0 smoke proved that Seed-Test owns the ~10-line sidecar pre-merge and
  needs no Tolkira change. [#6](https://github.com/Silasoa/tolkira/issues/6) is
  closed; evidence is in
  [`docs/research/seed-test-2-integration.md`](research/seed-test-2-integration.md).
- **B-011 Generated-assets build seam** — decision retained; #14 closed. Keep
  the current convention until a second consumer or a stale-output incident.
- **B-013 JUnit suite-level output** — decided: suite-level output stays
  intentionally unattached; `docs/JUNIT-XML.md` documents it and fixtures
  cover both producer shapes. #16 closed.
- **B-015 Node 20 support policy** — decided and implemented: Node 22 is the
  floor (ADR 0002, `docs/COMPATIBILITY.md`); CI covers 22, 24 and 26. #18
  closed.
- **B-016 Public repo hygiene** — audit complete; #20 closed. Removed the
  tracked `model.diff`, added Playwright, cache, editor and swap patterns to
  `.gitignore`, added `docs/README.md` and linked it from `README.md`,
  `CONTRIBUTING.md` and `llms.txt`, archived three unreferenced research notes,
  added the issue/backlog/commit workflow and `npm run hygiene` with CI, and
  replaced the `.opencode` copies with `.agents` skills in `e93b677`.
  Comparison images are kept by decision.
- **Backlog tracker #19** — closed; `docs/BACKLOG.md` is the single open-work
  ledger, GitHub issues are the work items.

## Decisions (do not re-open without a trigger)

- **G13 external attachments / split assets.** Resolved by
  [ADR 0006](adr/0006-inline-attachments.md): one inline file only, no remote
  URLs, CDN defaults or split-assets mode. Revisit only when a user cannot share
  a report because of media size or a CI artifact limit, then as a new opt-in
  design with its own ADR.
- **G16 lazy rendering.** Deliberate no-JS trade-off. Revisit only after a
  measured large-run problem; the static report is much smaller.
- **Themes/charts.** Deliberate non-goal. Branding is title, metadata, logo,
  accent and dark mode.
- **Comparison images.** Keep the referenced `docs/comparison` images (about
  3.3 MB, 54% of tracked bytes). Revisit if the repo exceeds 10 MB, the images
  exceed 5 MB, or a lighter format preserves the comparison.
- **Generated assets.** Keep the current convention until a second consumer or
  a stale-output incident occurs (B-011).
- **Node 20.** Keep Node 22 LTS as the supported floor until a green Node 20
  smoke test exists (B-015).
- **Skipped results in Needs attention.** Triage still lists skipped results as
  needing attention while the pass ratio treats them as not attempted.
  Revisit when a user reports the triage as noisy or misleading; changing its
  membership is a separate report-rendering decision.
- **Failed-only preset hides triage and sources.** The preset hides the triage
  index and source strip so only failed rows and their controls remain; both
  return when the preset is undone. Revisit if users use the preset as a triage
  surface.
- **CI summary labels.** `--ci markdown` keeps `Duration` and the GitHub notice
  says `executed scenarios`; align them with the report's `Test time` when the
  CI surface is next touched.
- **History `revision?` field.** The aggregate entry has no source revision
  because the stable summary has none. Add an additive optional `revision?` to
  schema version 1 when the summary gains a commit or source revision; readers
  ignore unknown fields, so no schema bump is needed. Trigger: `--json` exposes
  a revision that a trend should carry.
- **Recording history from `--json`/`--ci` without HTML.** `--history` requires
  `--out`, so a summary-only or CI-only run records nothing. Trigger: an agent
  or CI consumer wants trend data without a report file; then decide whether the
  sidecar is read-only, written, or both, and specify the flow.
- **Attachment warning in `--json` and `--ci` without HTML.** The HTML report
  and the HTML-writing CLI warn about outside-root path attachments; summary v2
  has no warning field. Trigger: an agent or CI consumer needs the signal in the
  summary or annotations, including when HTML is also written.
- **Per-attachment diagnosis.** The notice is run-level only; it does not name
  which scenarios or attachments were skipped. Trigger: a user needs to know
  which scenarios lost attachments after seeing the notice.
- **Missing or unreadable attachment warning.** Only outside-root path
  attachments are counted for the report warning; missing and unreadable files
  inside a root stay silent. Trigger: a user reports a missing attachment the
  report does not flag, or the CLI gains a general attachment diagnostic.
- **Flaky status and retry history.** The #24 comparison found one incidental
  flake in a teaching fixture, not a user need for flake forensics. Keep flaky
  folded into passed with `@flaky`; a flaky count/status or first-attempt
  evidence would need a schema v2 decision. Trigger: a user asks for flake
  forensics or a reported flaky rate becomes a problem.
- **CR-only message text.** The fast-path probe excludes CR while the scan strips
  it, so a CR-only message is returned unchanged and a message with CR plus
  another control loses CR. This predates #17; the benchmark excludes CR to keep
  the change behaviour-neutral. Trigger: when `stripAnsi` logic or its tests are
  next changed (a comment-only edit does not fire it), or a CR-only message is
  reported. Promote to an issue then.
- **ANSI benchmark follow-ups.** Deferred from #17: caching the quick benchmark
  document across tests (the suite is about 3 s; not worth the test
  restructuring), a full-mode structural unit test (the Node 22 Linux CI step
  already runs full mode), a fault-injected output-equivalence path (production
  and the references share the scanner, so it would test the harness), host
  metadata and Linux calibration (the JSON stays host-neutral; the fixed Linux
  run is the stable signal), and a `review` job-summary line (a `review` exits 0
  by design). Trigger: the benchmark is next changed, a mismatch is suspected,
  or the CI budget flakes.
- **Details matrix caption.** The caption still says `Executed scenarios only.`
  and 320 px can split `1` from `failed`; align the wording and the cell layout
  with the next vocabulary pass if users report it.
- **Report scenario/step split.** Keep `report.ts` as one module while it stays
  under about 800 lines and has one consumer. Extract `scenarios.ts`/`steps.ts`
  when it exceeds that size or a second consumer needs scenario/step rendering.
- **B-018 Unvalidated legacy argument and doc-string shapes.** Residual
  unvalidated `arguments[].content` and `docString.content` shapes can still
  throw a raw TypeError. It fails closed before any report is written and is
  pre-existing. Trigger: the next legacy validation change, a user report, or
  untrusted report exchange.
- **B-019 Element-level Behave status is ignored for scenario status.** A
  scenario-level hook failure without a step result can render as passed. It is
  documented in `docs/LIMITATIONS.md`. Trigger: a user reports a Behave hook
  failure rendered as passed, or before claiming full Behave hook support.

## Review follow-ups (2026-11-18)

- **Playwright adapter structure.** Keep one adapter until about 1,800 lines or
  a second JSON shape; then split validation at the existing `validate*` seam.
  A shared millisecond time helper waits for a third adapter.
- **Playwright retry artifacts.** Only the final attempt is rendered; earlier
  screenshots and error context are not exposed. Revisit if flake forensics
  becomes a requirement.
- **Attachment containment.** `realpath` blocks symlink and UNC escapes;
  hardlinks inside the roots and growth after the descriptor size check require
  local write access and are accepted for local CI artifacts. Revisit for
  untrusted report exchange.
- **Windows junction/cross-drive and repeat-each** are covered by Linux CI and
  counter IDs, but not by dedicated fixtures; add when a producer needs it.
- **Playwright file-level grouping.** A project feature spanning several files
  can split one spec file across rule sections. Revisit when navigation becomes
  a real user problem; trigger: a user request for a file-level view, then
  specify a view or toggle with one-file-one-group acceptance.
- **Native Playwright report additions.** Copy prompt (agent-ready failure
  text), slowest scenarios and a step filter are candidates in #24; the step
  filter waits for a real report with >30 steps per scenario, and a project
  filter is only useful for multi-project reports. Do not copy the trace
  viewer, report folder, JS-only SPA, snapshot diff or worker gantt.
- **CI output polish.** Add file/line annotations when the summary exposes
  source lines, aggregate skipped notices, add a flaky warning, expose run-hook
  detail beyond one run error, and clarify the attachment-count label. Trigger:
  the next CI usability request or a provider annotation-limit incident.

## Ideas (not scheduled)

- **Export Playwright test definitions/cases.** A report could expose the
  test/spec definitions (title, steps, file/line) as JSON or Markdown for
  migration or test-case management. Trigger: a user asks for case import or
  export; this is not report parity and no issue exists yet.

## Fixed in 0.3

- Outlines/examples, hooks, diagnostics, empty-run semantics, rules/tags,
  Markdown, tag expressions/URL state, CI metadata, attachment polish, CJS
  wrapper, stream adapter, parameter highlighting.
- Architecture: `indexRun` single projection, pure input detection, typed DOM
  contract, CSS filter-status contract.
