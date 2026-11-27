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

| ID | Area | Priority | Item | Revisit trigger | Issue |
| --- | --- | --- | --- | --- | --- |
| B-018 | Input | P3 | CR-only text keeps CR (fast-path probe ignores CR; pre-existing) | A producer fixture or user report carries CR-only text. | — |
| B-020 | Report | P3 | Print button: the browser print command needs no in-report UI or catalog key | A measured usability failure shows users cannot find the browser print command; it then needs a catalog key. | [#13](https://github.com/Silasoa/tolkira/issues/13) |
| B-021 | Report | P3 | Repeated print title/page header on pages after the first | A shared multi-page PDF or browser print needs page identity with browser headers/footers off; the PDF engine now exists, so this is a page-layout change; pair with B-022. | [#13](https://github.com/Silasoa/tolkira/issues/13) |
| B-022 | Report | P3 | Custom print page numbers or footer text | A shared PDF needs page numbers while the browser footer stays off (it can expose local paths); pair with B-021. | [#13](https://github.com/Silasoa/tolkira/issues/13) |
| B-023 | Email | P3 | `.eml` draft with a real subject | A user needs a ready-to-open draft or a subject that travels with the file; the HTML body cannot set one. | [#13](https://github.com/Silasoa/tolkira/issues/13) |
| B-024 | Email | P3 | Small capped CID or inline logo in the email | A brand requirement shows the text header is not enough and the added bytes stay inside the 100 KB budget and client limits. | [#13](https://github.com/Silasoa/tolkira/issues/13) |
| B-025 | Email | P3 | Build/branch/PR metadata or error snippets in the email | Recipients need triage context in the body itself, or the mail is the only artifact; `--meta` and short errors are the candidates. | [#13](https://github.com/Silasoa/tolkira/issues/13) |
| B-026 | Email | P3 | Configurable failed-scenario cap | Five rows are too few because the email is sent without the report, or a team asks for an Allure-style cap. | [#13](https://github.com/Silasoa/tolkira/issues/13) |
| B-027 | Report | P3 | Tagged PDF/accessibility | A user has an accessibility or compliance requirement for a tagged PDF or reading order; start with Chromium's `tagged` option and verify the text order with a screen reader. | [#13](https://github.com/Silasoa/tolkira/issues/13) |
| B-028 | Report | P3 | PDF size cap, warning or streaming | A large suite produces a PDF that exceeds a CI artifact, mail or memory limit; the five-minute deadline and print volume limits apply first. | [#13](https://github.com/Silasoa/tolkira/issues/13) |
| B-029 | Report | P3 | Chromium OS sandbox for PDF renders | A CI runner or container supports the Chromium OS sandbox and the PDF path processes untrusted attachments; until then the accepted `--no-sandbox` risk is documented in PDF.md. | [#13](https://github.com/Silasoa/tolkira/issues/13) |
| B-030 | Report | P3 | Letter/custom paper size for PDF | A user needs US Letter or a custom paper size; A4 comes from `format: 'A4'` and the 12 mm inset from `@page`, so this is a page-size option plus docs and tests. | [#13](https://github.com/Silasoa/tolkira/issues/13) |
| B-031 | Test | P3 | Performance e2e can exceed its 10 s budget under full parallel load | The spec passes alone and on rerun; repeat CI failures or a real slowdown mean isolate the perf spec or recalibrate the budget after measuring. | — |
| B-050 | Report | P3 | Add a new-failure/fixed list or a local `change` filter for large runs; the panel only counts and lists absent rows | A user asks for the names of new failures or fixed scenarios in a large run; then extend the panel and pin the focus/filter behaviour. | — |
| B-051 | Report | P3 | Extract the shared outline-coordinate helper duplicated in `src/summary.ts` and `src/report/model.ts` | The next change touches `src/summary.ts` or `src/report/model.ts`; then move the helper to one leaf module and keep both labels equal. | — |
| B-053 | Test | P3 | No container smoke: CI covers Linux, Windows and macOS runners, but not `node:22-alpine` (musl) or a slim/distroless image | Before claiming container support, or when a user reports an install or run failure in Docker, Alpine or a distroless CI image; then add install-plus-report smokes for `node:22-alpine` and `node:22-slim` and record the host. | - |
| B-056 | Performance | P3 | At 5,000 scenarios the single-string renderer peaks at 310 MiB RSS and the report needs 1.80 s to finish loading (241,785 DOM nodes), while the official formatter peaks at 77 MiB and loads in 0.67 s; generation (604 ms) and output (10.8 MB, the smallest of the four) are competitive | Planned in the 0.7 performance pass: profile the 5,000 and 10,000 scenario render, prototype a chunked or streaming writer, and decide whether the single-string renderer stays; re-run `scripts/bench-compare.mjs` with the recorded host. A CI host or user hitting the memory or load limit moves it earlier. | - |
| B-057 | Quality | P3 | The architecture review (`docs/research/architecture-2026-11.md`) rates 7 of 14 areas weak: status vocabulary in 8 modules, diverging sidecar readers, a 779-line CLI with a 461-line `runCli` and 38 `return 2` sites, a 14-field `RenderOptions` with double sanitising, path containment in 4 places and 12 files over 400 lines; the ponytail audit adds dead model fields and the `phase` export, copied `excerpt`/`readBounded` helpers, and unused `testRunFinished.success`; a second architecture pass (`docs/research/architecture-session-2026-11.md`) adds the server/browser filter-decision seam and the one ICU message parser, and refines the attachment ledger (at 2026-11-26: 993 lines, a 598-line `runCli`, 42 `return 2` sites; CLI plan/execute slice done 2026-11-26 (`1ee837e`..`b39ba99`): `src/cli.ts` 93 lines, `src/cli/` modules 103/427/336/57/60, total 1,076, all CLI-observable bytes unchanged; report pipeline seam slice done 2026-11-26 (`fc3dfac`..`95a7567` plus the fixer pass): new `src/loaded-run.ts` 95 lines, `src/render/html.ts` 98, `src/stream.ts` 37, caller options reject the three run facts with `never`, 105 unit files / 2,116 passed / 11 skipped, 478 browser passed / 8 skipped, 92 tarball entries, `dist/index.js` 365,512 B (+1,098 B / +0.301 % over 364,414 B), `dist/index.d.ts` byte-identical, report and CLI bytes unchanged) | 2026-11-26 user scope decision for 0.7, one change at a time: the feature bundle is done, then CLI plan/execute, then the report pipeline seam, then the redesign last; status vocabulary only if cheap; sidecar reader, input pipeline, filter seam and ICU message parser deferred. Never bundle a refactor with a behaviour or markup change; fold small cleanups into the change that touches the area. | - |
| B-058 | Security | P2 | A Playwright path attachment can embed any regular file under the input file's folder or the process working directory, because the report input controls the path; 0.6.1 documents the trust model and keeps the boundaries, and the audit rates it P1 | When report input can come from an untrusted source (a shared artifact, a fork PR) or a user asks for an attachment root allowlist; then add an explicit root/allowlist option as a 0.7 feature, never as a silent patch change. The 0.6.1 docs state the consequence. | - |
| B-065 | CLI | P3 | An `--out` file inside a scanned input directory with a supported extension is picked up as an input on the next run and blocks it | When the path policy is revisited with B-058; then exclude the explicit output paths from the input scan or fail early with a clear message, and add a directory-scan test. | - |
| B-066 | Report | P3 | `src/render/html.ts:65-84` emits the German layout block for every non-English locale (`lang.split('-')[0] !== 'en'`), so a third locale would inherit German-only rules | When a third locale is added; then move language layout into the stylesheet pipeline and gate it by `:lang(de)` only, with a locale-CSS test for a non-English, non-German locale. | - |
| B-067 | Security | P3 | The display-URI guarantee is one decode pass and a fixed home-segment rule, so a double-encoded separator or home segment, a `..` that cancels the home root, an encoded authority, an adjacent `home/home` pair (the second segment is taken for the user) or a Windows trailing space/dot after `Users` can keep a name-like segment on the Messages surfaces; a path of many malformed `%` segments costs about 0.8 s per MB per `displayUri` call (still linear, bounded by the 100 MB input cap) | When a producer emits double-encoded or Windows-canonicalised URIs, or a user/CI reports a name inside a display URI; then decode with a bounded loop and a cap, compare canonical Windows home names, and add the producer fixture. HTML keeps attachment and log bodies verbatim as evidence (never scrub); the compat sidecar keeps raw URIs because the old reporter needs them. | - |
| B-068 | Security | P3 | Producer-written text is shown and copied without redaction (except the Playwright adapter's documented error-text path scrub), so a local user name or absolute path can reach the HTML failure block and `data-search`, the `--json` step message, the CI Markdown and the copied text (Cucumber-js failure stack), and the HTML attachment body and copy button (nine PetClinic `system-out` lines; not `--json` or CI). Both cases also exist in the 0.5.1 reports and the display URIs stay clean. Approved limit for 0.6.1 on 2026-11-25, documented in `SECURITY.md` and `docs/LIMITATIONS.md`. | When reports are shared with an untrusted audience by default, a user asks for scrubbing, or a CI provider flags the path; then offer an opt-in redaction mode (home and absolute-path shapes in failure/log text) with a before/after fixture and a documented default, not a silent change. Keep the raw text available as evidence and out of the default change. | - |
| B-069 | Report | P2 | A Messages input without a Gherkin feature document renders 0 features in the HTML while the JSON summary carries the scenario; the feature row needs a feature document to be built | When the next Messages or report-model change touches feature grouping; then build the feature row from the scenario's display URI and name fallback, and add a featureless-Messages fixture that asserts one feature in HTML and JSON. | - |
| B-070 | Report | P3 | The native tag `<select>` clips a long selected label at 320 px with 200 % text zoom, so the active tag is unreadable in the control | When the next shell or 320 px change touches the tag filter; then let the selected label wrap or shorten with a `title`, and add a 320 px / 200 % browser assertion. | - |
| B-072 | Tooling | P3 | The build is esbuild for the CLI and library plus two tsc declaration passes and a copy script; tsdown (Rolldown/Oxc, the tsup successor, shipped by Vite+) emits ESM/CJS, bundled declarations and package exports in one config | 0.7: replace the build with tsdown behind a separate OpenSpec change; acceptance: byte-identical public declarations and exports, same bin and shebang, same tarball file set, CLI smoke, e2e green, no report byte change. Revert is the old three scripts. | - |
| B-073 | Verification | P3 | Release/CI hardening leaves verification work for 0.7: no CodeQL default setup for JS/TS (taint analysis for the HTML sinks), no dependency-review-action, no OpenSSF Scorecard, no property tests for the legacy JSON, Messages and JUnit XML parsers, no mutation run, and no knip MCP/LSP or repo skills | 0.7, in this order: CodeQL default setup, dependency-review-action for licence and diff policy, Scorecard; then `fast-check` 4.11 with `@fast-check/vitest` 0.6 property tests for the three parsers as a separate change (it will find bugs); StrykerJS when its Vitest 5 runner works upstream, on nightly/changed files only, never the PR gate; knip MCP/LSP and repo skills for the release and a new input adapter. No new weekly job: Dependabot keeps its existing weekly schedule and the signature/SBOM checks stay release-only. | - |
| B-074 | Release | P2 | The token-bearing publish job also runs `npm ci` and stages in the same job, so a compromised dev dependency can replace the checked tarball after the digest; tag protection and a required-release environment are not enforced by the workflow | Before the next tag. Then split into a non-privileged package job (build, `package:check`, smoke, upload tarball + digest) and a token-only publish job (download, verify digest, stage); protect `v*` tags with a ruleset and require a reviewer on the release environment. | - |
| B-075 | Legal | P2 | The client bundle includes `@cucumber/tag-expressions` 11.2.0 (MIT, Copyright (c) 2016 Cucumber Ltd and contributors), but `legalComments: 'none'` strips the notice; the SBOM covers external runtime dependencies only | Before the next publish. Then add the MIT notice to the shipped report/package (or preserve it in the bundle) and decide whether the SBOM lists bundled components; report bytes change, so use a separate change with the report gate. | - |
| B-076 | Report | P3 | A retried Messages scenario shows the raw zero-based final attempt (`Attempt: 1`) next to `Earlier attempts (2)`, so the two labels use different numbering | When the next retry or attempt-label change touches the scenario meta; then label the final row positionally or print `Final attempt` and keep the earlier rows readable, with a report test. | - |
| B-077 | Agent | P3 | A run leaves no linked Markdown index for an artifact folder; `--ci markdown --ci-out` writes the body but no links to the report, PDF, email or manifest | When an agent or user asks for a browsable artifact index; then add `--index` with the Markdown CI body, relative RFC 3986-encoded links and a pre-write cross-volume check, as drafted in the 0.7-agent-surface review history. | - |
| B-078 | Security | P3 | The 2 MB logo cap is a pre-`stat` check and `readFile` is unbounded, so a FIFO, device node, symlink swap or growth between `stat` and read can block or exhaust memory; today's contract keeps the pre-split behaviour | The first time report input or logo paths can be attacker-influenced, or when B-058's untrusted-input work starts; then open the file, read at most `MAX_LOGO_BYTES + 1` bytes from the handle and reject the extra byte. | - |
| B-079 | Quality | P3 | `src/cli/plan.ts` is 427 lines because it was compacted to meet a soft budget, not split at a seam; `planOptions` is synchronous and could move to `src/cli/options.ts` if the planner grows or a second consumer appears. The 430-line cap is a soft budget, not a gate. | The next substantive addition to `plan.ts` or any second caller of `planOptions`; then move the options and action block to `src/cli/options.ts` and keep the plan tests green. | - |

#13 is closed after #13a–#13c shipped; the #13 links above are provenance, not
open issue work. The remaining rows are trigger-based backlog items.

**PDF slice (2026-11-20).** The optional Chromium engine is done (#13c):
`--pdf <file>`, `--pdf-timeout <ms>`, `renderPdf(html, options)`, the A4/12 mm
archive, the report → PDF → email order, path validation and the install error.
The default install and runtime dependency surface, report, JSON, CI and email
bytes are unchanged; the package gains the PDF docs. Page identity and page
numbers are B-021/B-022, tagged PDF/accessibility is B-027, a size
cap/streaming is B-028, the Chromium OS sandbox is B-029 and Letter/custom paper
is B-030; landscape is unscheduled. See [`PDF.md`](PDF.md) and
[ADR 0007](adr/0007-optional-pdf-engine.md).

**Print slice (2026-11-20).** The browser print slice is done: by default it
prints the complete report, while an active search or filter still narrows the
Report view, so clear the filter for the whole run. The failed-only filter plus
print is the failures-only archival print, not the concise summary. Without
JavaScript the active Report prints with closed details unchanged; see
[`LIMITATIONS.md`](LIMITATIONS.md). The email summary (#13b) now covers the
concise mail body; the PDF engine (#13c) now covers headless print.

**History window slice (2026-11-23).** Done and recorded under Resolved as
B-044; see [`AGENT-INTERFACE.md`](AGENT-INTERFACE.md#run-history).

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

- **B-059 Tag overview** — resolved on 2026-11-26 in `0.7-tag-overview`: the
  Details view renders a server-rendered tag table with executed scenario,
  failed and skipped counts, failing tags first, a 50-row cap with the complete
  tag count, default/static/print forms and no reaction to the toolbar filter.
- **B-062 Capabilities document** — resolved on 2026-11-26 in
  `0.7-agent-surface`: `tolkira --capabilities` prints one deterministic schema-1
  JSON document under 4,096 bytes with the version, Node range, inputs, outputs,
  summary schema, locales, limits, defaults and exit codes, each sourced from its
  single source.
- **B-063 Run manifest** — resolved on 2026-11-26 in `0.7-agent-surface`: opt-in
  `--manifest <file>` writes a schema-1 manifest with status, counts,
  attachments, warnings, artifacts in write order and the first 10 failures, last
  before stdout, atomically as `0600`, alone satisfying the at-least-one-output
  rule; the linked Markdown index stays B-077.
- **B-064 Agent snippet** — resolved on 2026-11-26 in `0.7-agent-surface`:
  `docs/AGENT-SNIPPET.md` ships in the package and is linked from `llms.txt`,
  `docs/README.md` and the agent interface.
- **B-060 Absolute scenario start** — resolved on 2026-11-26: the scenario
  detail already renders `Started: DD.MM.YYYY, HH:MM UTC` from the Messages
  `testCaseStarted.timestamp` and Playwright start times (`report.startedMeta`
  in `src/render/report.ts`). Legacy JSON and JUnit ship no per-scenario
  timestamp, so nothing is synthesized and the JSON summary stays schema 2 with
  no start field. Reopen only with a producer format that ships a scenario
  timestamp.
- **B-061 Messages retries in Earlier attempts** — resolved on 2026-11-26: the
  input index keeps every `testCaseStarted` and the collapsed `Earlier
  attempts` block renders up to three executed earlier Messages starts
  (`d5fdebe`, `test/messages-retry-evidence.test.ts`); final-attempt counts, the
  summary totals and the schema are unchanged.
- **B-071 Release tarball drift** — resolved on 2026-11-26 in the
  `release-ci-hardening` change: npm 12.2.3 packs 80 entries and omits
  `docs/README.md` because it was not listed explicitly in `files`; npm 10
  included the nested README implicitly. `docs/README.md` is now explicit in
  `files`, so both npm versions pack 81.
  `npm run package:check` packs once and checks that exact tarball (manifest,
  `publint --strict`, `attw`); and the release installs the pinned npm 12.2.3,
  smokes the same `tolkira-<version>.tgz`, records and verifies its SHA-256 and
  passes it to `npm stage publish`. The version stays 0.6.1.
- **B-055 Quality gate** - done on 2026-11-26 in `0.6.2-tooling` (issue #30):
  eleven strict TypeScript checks in two programs (88 errors fixed in 22
  files), the maximal type-aware oxlint gate (335 findings: 314 fixed and 21
  pinned per line; 26 inline directives with reasons, exact-pinned by the
  tooling test), Oxfmt 0.80.0, the 93/86/95/95 coverage floor with
  `passWithNoTests` removed, and the LF policy. Unit 1,796 passed / 10 skipped,
  e2e 454 / 8 on three engines; report bytes, public declarations and the
  package surface unchanged. Version stays 0.6.1.
- **B-054 Visual evidence for green e2e runs** — resolved on 2026-11-24 in the
  `0.6.1-quality-pass` change, commit `cd44010`: one e2e test renders the default
  and `--static` report from `test/fixtures/messages/screenshot.ndjson` at
  1440 px, 390 px and 320 px with 200 % text, writing six PNGs per engine under
  `test-results/visual/<engine>/`; the existing `playwright-visual-*` CI
  artifacts pick them up. There are no pixel assertions, no committed image and
  no new dependency, and each form asserts its title before capture.
- **B-049 BOM before the history sidecar** — resolved on 2026-11-24 in the
  `0.6.1-quality-pass` change, commit `cd44010`, follow-up `1fea073`: the shared
  bounded sidecar read strips exactly one leading U+FEFF, so `readHistory` and
  the schema peek behind `writeHistory` accept a BOM-prefixed file, and a read
  never rewrites it. A BOM-only file and a BOM followed by invalid JSON keep
  the existing `not valid JSON` error. The writer emits no BOM, so its next
  successful write replaces a BOM-prefixed file with BOM-free bytes and keeps
  every run the append would keep.
- **B-048 One main landmark around the report views** — resolved on 2026-11-24 in
  the `0.6.1-quality-pass` change, commit `cd44010`, follow-up `1fea073` and the
  landmark-wrapper follow-up: both report forms render exactly one `<main>` that
  starts before `#report-view` and closes after the last present panel, wrapping
  Report, Details and (when present) Trends. The site header is the only banner
  and each view's run header sits inside main. All panels keep the `tabPanel`
  class, `role="tabpanel"`, `aria-labelledby`, `tabindex`, `hidden` and the
  `report-view`/`analysis-view`/`trends-view` IDs; the static panels keep the
  class, IDs and the `#analysis-view, #trends-view` print page break without tab
  roles. Heading order and tab roles are unchanged, and apart from the B-039
  metadata rule the gate-viewport layout is unchanged.
- **B-039 Details metadata at 320 px and 200 % text** — resolved on 2026-11-24
  in the `0.6.1-quality-pass` change, commit `cd44010`, follow-up `1fea073`: a
  narrow container query stacks each Details metadata label above a start-aligned
  value when the shell is 10 rem or narrower, with a German override because its
  selector outranks the generic rule. A long unbroken URL wraps inside the
  stacked value column and the page does not scroll horizontally. At 100 % text
  from 320 px and at 768 px and wider the two-column, right-aligned layout is
  unchanged.
- **B-052 README report preview** — resolved on 2026-11-24: `README.md` now
  shows `docs/comparison/tolkira-0.6.0-report.png` (1440×900, 47,441 bytes),
  captured from the default English report of
  `test/fixtures/messages/screenshot.ndjson` in Playwright Chromium with a
  failed scenario, its error and an inline screenshot visible; viewport-only,
  no browser chrome, and neither the HTML nor the PNG carries a local path,
  user name, email or token. The preview shows the default report on purpose;
  a baseline-panel capture needs a second input and waits for a dedicated
  baseline section or another announcement asset. The `new-shell-*` captures
  stay as they are; the preview supersedes none of them.
- **B-040 Early input warning** — resolved on 2026-11-24 in the
  `0.6-early-size-warning` change: after path validation and before parsing, the
  CLI resolves and stats the inputs once and warns on stderr when they total at
  least 50 MiB (52,428,800 bytes); the same resolved list feeds the scan and the
  loader. Advisory only: no exit code, cap or output byte changes; the 100 MiB
  input cap and the post-render `--max-size` warning stay. The scan counts paths
  at scan time (identical content under two paths counts twice), while the
  post-render `input` value is content-deduped.
- **B-042 Static no-JS mode** — resolved on 2026-11-24 in the
  `0.6-static-no-js` change: `--static` (with `--out` or `--pdf`) renders one
  expanded, script-free report: no `<script>`, `script-src 'none'`, every
  `<details>` open, the tab bar, lightbox, copy controls and search/filter
  toolbar removed, exactly one `<main>`, and server-rendered Details and Trends.
  It is a report form, not a CSP fix; in 0.6.0 the default report without
  Trends kept its bytes and its pre-existing three `<main>` elements (B-048),
  which 0.6.1 replaced with one.
- **B-044 Configurable history window** — resolved on 2026-11-23 in the
  `0.6-history-window` change: `--history-limit <n>` (needs `--history`) keeps
  the newest 1 to 365 aggregate runs, default 30, and bounds read, append, write
  and Trends. A window above 30 writes sidecar schema 2 (never downgraded); the
  writer validates every run, rejects an id longer than 128 UTF-16 code units
  and a serialized file above 1,048,576 bytes, and prunes to the cap while
  keeping the newest entry; a 0.5 reader rejects schema 2 without rewriting it.
  Lowering the window is destructive on the next successful write. See
  [`AGENT-INTERFACE.md`](AGENT-INTERFACE.md#run-history).
- **B-047 Zero-test JUnit document in a directory** — resolved on 2026-11-23 in
  the `junit-empty-documents` change: a zero-test JUnit document (well-formed
  XML with no `<testcase>`) is skipped when it comes from a directory scan, so
  one skipped Maven suite no longer hides the rest of the run. The skip needs
  exactly one recognised `<testsuites>`, `<testsuite>` or `<testcase>` root and
  no `<testcase>` anywhere; a wrapper root, a multi-root document and malformed
  XML still fail. A document named explicitly still fails with
  `Unsupported JUnit XML ... expected ...`; DTD and entity declarations still
  fail; a directory whose JUnit documents are all zero-test fails with
  `No supported report files found.` The skipped file stays in the
  `inputFiles` count, and a directory without a zero-test document renders the
  same bytes as before.
- **B-045 Numeric `format.bytes` counts** — resolved on 2026-11-23 in the
  `size-details-followups` change: `sizeLabel`, `exactSizeLabel` and the
  attachment size row pass the raw numeric byte count to `format.bytes` instead
  of a pre-formatted `t.number()` string, so a target catalog with a plural
  branch selects the category from the number and never parses a grouped string
  such as `1.048.576`. The default English and German byte text is unchanged,
  and no catalog key or message changed; only the `en.json` description now says
  the count is a raw number. `format.megabytes` keeps the same latent
  pre-formatted-string pattern and stays deferred, because fixing it needs a
  precision-aware design. Revisit when a target catalog adds a plural branch to
  `format.megabytes`, or with the next size-formatting change.
- **B-046 German Details stacking** — resolved on 2026-11-23 in the
  `size-details-followups` change: one narrow-only German override
  (`@media (max-width:560px){:lang(de) .sizeMeta{grid-template-columns:minmax(0,1fr)}}`)
  stacks the Details Run panel at 560 px and below, so the exact byte count no
  longer splits mid-number at 320 px and 200 % text. Above 560 px and in A4
  print (the CLI `--pdf` path) the German two-column layout is unchanged;
  narrower print page boxes follow the stacked layout, as English already does.
  The other metaLists (metadata, custom metadata, environment) were untouched at
  100 % text. 0.6.1 (B-039) adds a container-query stack for the metadata list
  at 320 px and 200 % text, so for that viewport the "other metaLists" sentence
  no longer applies.
  The E2E test pins one used track at 560 px with no horizontal overflow, the
  2fr/3fr share at 561 px, 1440 px and A4 print, two tracks on another metaList
  at 560 px, and an unbroken grouped count with no horizontal overflow at
  320 px.
- **B-041 Report-size unit consistency** — implemented on 2026-11-23 in the
  `report-size-units` change: the Details Report HTML row leads with the exact
  locale-formatted byte count and, at 1 MiB and above, adds one-decimal MB in
  parentheses with a non-breaking space between number and unit; below 1 MiB it
  stays the exact count alone. The leading count still equals the final
  document's UTF-8 byte length. The same non-breaking join reaches the
  neighbouring MB rows through `sizeLabel`. No schema, catalog, CSS, golden,
  email or dependency change.
- **B-043 Earlier-attempt evidence** — implemented on 2026-11-22 in the
  `retry-evidence` change: a retried scenario shows a collapsed `Earlier
  attempts` block with up to three earlier starts (status, duration and the
  first failure message) in the HTML only. A single-input Playwright report
  embeds at most one marked earlier image under a 10 MB evidence budget after
  final attachments; multi-input Playwright reports and Messages inputs show no
  earlier image. Summary schema 2, `--json`, CI, email, history, attachment
  counts/bytes and the dependency surface stay final-attempt-only. Legacy JSON
  has no earlier data.
- **B-036 JUnit nested test classes** — resolved on 2026-11-22 in the
  `host-parity-fixes` change: a `<testsuite>` with a nested-class shape (at least
  two distinct non-empty testcase classnames plus a `$` classname or a dotted
  outer prefix) becomes one feature per classname, using the classname alone as
  the feature name. A one-class suite keeps its suite feature, unclassed
  testcases stay in a suite-named feature, and classname-template suites such as
  jest-junit's `"{classname} {title}"` keep one suite feature. Every testcase,
  status, duration and the source file is preserved. The 2026-11-22 Spring host
  run confirms 15 features / 59 scenarios / 59 passed, an exact match to
  Surefire's 15 class rows. The JSON summary schema, CI, email and dependency
  surface are unchanged; the feature total and `scenarios[].feature` names
  change.
- **B-034 Legacy JSON hook output** — resolved on 2026-11-22 in the
  `host-parity-fixes` change: a `before`/`after` hook with a non-null string or
  string-array `output` becomes a `text/plain` attachment named
  `Before hook output` or `After hook output`, with lines joined by `\n`; null,
  empty strings/arrays and non-hook output add none. The existing hook renderer
  shows it and the summary, CI and email attachment totals count it normally. No
  schema, locale or dependency change. This is better than
  cucumber-html-reporter 7.2.0, which ignores hook output. The real 8.1.0 host
  fixture covers single-line outputs; the `\n` array join is covered by the
  synthetic hook-output test.
- **B-035 Playwright JSON scenario source line** — implemented on 2026-11-22 in
  the `playwright-source-line` change: `ReportScenario` carries the Pickle
  location line (positive integer only), and the scenario summary shows
  `displayUri(uri):line`. `featureSourceLabel` appends a line only when a feature
  has one file and every scenario agrees on one line; mixed or absent lines keep
  the file, multiple files keep `N spec files`, and no trailing colon is rendered.
  The line is not in the summary, `--json`, CI or email, and no locale or
  dependency changed.
- **B-038 Synthetic adapter source lines** — fixed on 2026-11-22 in the
  `playwright-source-line` change: Playwright run-error pseudo-pickles use an
  unknown line 0, and a missing or zero `spec.line`, a JUnit scenario and a
  legacy scenario without a line also stay unknown, so no `:1` is invented. AST
  placeholders are unchanged. Covered by the unit render tests for `errors.json`,
  `junit/basic.xml`, a line-less Playwright spec and legacy input.
- **B-032 Compatibility merged JSON sidecar** — implemented on 2026-11-21 in the
  `compat-merged-json` change: a `jsonDir` run without `jsonFile` writes the
  legacy merged array to `<output>.json` after the HTML. Features merge by
  `uri` (fallback `Feature: URI Not Present`), duplicate features concatenate
  their `elements`, every element gets `retried: 0` and the file is two-space
  indented. Atomic write, parent creation, unique-source collision refusal and
  no sidecar for `jsonFile`. A second same-directory run excludes and replaces
  its own previous sidecar when every feature URI is represented by the other
  inputs; on the strict path, invalid, unparsable or unique-source files at that
  path are refused before the HTML, while `ignoreBadJsonFile: true` skips an
  invalid reserved-path file and replaces the sidecar. No core CLI/API,
  report-byte or dependency change.
- **B-037 JUnit duration semantics** — documented on 2026-11-22 in
  `docs/JUNIT-XML.md`: `Test time` is the sum of `<testcase time>` values; suite
  wall time (Spring context and a Surefire total) is not included. No schema
  change; compare the two numbers with that difference in mind.
- **B-010 Email HTML summary (#13b)** — implemented on 2026-11-20 in the
  `add-email-summary` change: opt-in `--email <file>`, a 600 px inline HTML body
  with the attempted pass rate, all non-zero statuses plus unexecuted, counts,
  duration, inline attachments and the first five failed scenarios in summary
  order; localized `email.*` keys, `renderEmail(summary, options)`, path
  validation and the pinned write order. No sending, SMTP, network, logo or new
  dependency. The report, JSON and CI bytes are unchanged. `.eml`, a logo,
  metadata/snippets and a configurable cap are recorded as B-023 to B-026. The
  print and email slices are done; the PDF engine is resolved as B-019 below.
- **B-019 PDF engine (#13c)** — implemented on 2026-11-20 in the
  `add-pdf-export` change: opt-in `--pdf <file>`, `--pdf-timeout <ms>` and
  `renderPdf(html, options)`, mandatory `page.setContent` (no temporary report),
  eager lazy images, aborted HTTP(S) subresources, A4/12 mm print CSS, one
  optional `playwright-core` peer imported dynamically (with the cwd
  `createRequire` fallback) and external in the bundle, atomic binary write,
  report → PDF → email → history → `--ci-out` → stdout order, path validation,
  missing-engine exit 1 and the Chromium-only limits. The default install and
  runtime dependency surface, report, JSON, CI and email bytes are unchanged; the
  package gains the PDF docs. Page identity/page numbers, tagged PDF, a size cap,
  the Chromium OS sandbox and Letter/custom paper are B-021/B-022, B-027, B-028,
  B-029 and B-030; landscape is unscheduled. The #13a–#13c slices are complete;
  #13 is closed and these remain trigger-based backlog entries.
- **B-009 German UI and localisation** — implemented on 2026-11-20 in the
  `add-report-localisation` change: `--locale en|de` (default `en`, `de-AT` uses
  `de` and keeps its tag), ICU JSON catalogs with a generated typed module,
  German numbers/dates/durations via `Intl`, a localized report shell and
  client messages, and an English/German agent guide. One locale per build; no
  switcher, RTL or CLI/CI translation. The one-file default is unchanged.
  [#12](https://github.com/Silasoa/tolkira/issues/12) is resolved.
- **B-007 Optional history file and trends** - implemented in `main` on
  2026-11-19 in the `add-history-trends` change: opt-in `--history <file>`,
  aggregate-only `schemaVersion: 1` sidecar with a 30-run default window
  (configurable 1 to 365 since 0.6), dedupe,
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
  and the HTML-writing CLI warn about skipped path attachments; summary v2 has
  no warning field. Trigger: an agent or CI consumer needs the signal in the
  summary or annotations, including when HTML is also written.
- **Flaky status and broader retry history.** The report shows a display-only
  `flaky` badge and a tag-only run-metadata count; the history sidecar records an
  optional per-run `flaky` count that Trends renders as `Flaky` and `Flaky share`
  (a flagged share, not a probability). A per-scenario flaky status, filter,
  summary field or retry trend would still need a schema decision. Earlier
  evidence now ships as a report-only HTML block (up to three starts, one image,
  single-input Playwright, 10 MB). Deferred: every earlier attachment or
  screenshot, an earlier Messages image, an earlier multi-input image, a
  searchable earlier message, and special handling for expected-failure retries,
  which currently show their raw earlier failures. Trigger: a user asks for flake
  forensics, a group needs more than one earlier image, or an expected-failure
  retry misleads a reader.
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
- **MB label for 1024² units.** `format.megabytes` divides by 1 MiB but labels
  the value `MB`; Allure labels the same binary unit `MiB`. The default en/de
  text is frozen by 0.5.1, and a rename changes every size string. Trigger: a
  user reports the mismatch, or a units/vocabulary pass touches the size labels;
  then decide between `MiB` and decimal `MB`, including the exact-byte row.
- **Zero-byte attachments.** An attachment whose inline body is empty is
  dropped instead of rendered as an empty image or file; the byte total is
  unchanged and no skip notice is emitted. The Playwright earlier-image path
  filters an empty body by design, and an empty attachment carries no content.
  Trigger: a user reports a missing empty attachment, or an attachment-count
  parity claim needs the raw producer count.
- **Compat `jsonDir` read before a guard.** With `ignoreBadJsonFile: false`,
  the compat shim reads a file in its sidecar pass before any per-file size
  guard, so a very large `.json` can be read before the core loader's 100 MB cap
  applies; the flag's own pre-read accounting is separate. Trigger: the compat
  shim is next touched or a user reports a large-directory/OOM scan; then stat
  before `readFeatures`.
- **GitHub annotation text sanitising.** The GitHub error title/message and
  notice text do not strip ANSI/OSC-8/bidi controls, unlike Azure, Markdown and
  report text; the consequence is display spoofing only. Trigger: CI output
  consumes untrusted fork/PR data or the CI surface is next touched.
- **Directory scan read budget.** Directory scans have no aggregate read budget
  after audit 2; skipped files are read and hashed but not counted. Trigger:
  artifact directories with hundreds of MB of unrelated JSON; then add a
  separate scan/read budget without changing the loaded-file accounting.
- **Attachment selector cost.** The rendered-attachment selector runs twice per
  HTML report, once for the model and once for the summary, about 11 ms at
  10,000 scenarios. Trigger: the 0.7 performance pass or attachment-heavy
  reports.
- **Earlier-retry image input count.** Earlier-retry images use
  `ordered.length === 1`, so one Playwright report plus a skipped empty shard
  loses the earlier-retry image although `inputFiles` is 1. Trigger: retry
  evidence is reported missing in a single-report directory with skipped
  files; then base the budget on loaded groups.
- **Synthetic 1970 finish time.** A Playwright run without timing and with a
  duration of at least 1 s synthesizes a 1970 `testRunFinished` (`finishedAt`)
  while `startedAt` is unknown; it is not rendered today. Trigger: `finishedAt`
  is exposed in any output; then guard it like `startedAt`.
- **`Attempt: 1` label.** The report prints `Attempt: 1` for single-attempt
  Messages runs while the summary stores 0 and the official formatter prints no
  attempt. Because the final result is the last array element on a missing or
  equal `retry`, a synthetic Playwright input that repeats `retry` 0 shows the
  earlier row and the scenario meta as `Attempt 1` / `Attempt: 1`. Trigger: the
  0.7 parity bundle, a user reports the label, or a real report with duplicate
  retry values appears; then hide the label for a single attempt.
- **Incident panel UX follow-ups.** The contract keeps the panel above the
  triage and through toolbar filters, reuses the scenario detail (error box and
  metadata included) and keeps the triage for a single incident. Four review
  findings would change that behaviour and are deferred, not silently applied:
  a no-match filter leaves the panel and its "N more incidents" line on screen
  while the empty copy lands below the fold; the panel repeats the step error
  and the feature/attempt/started meta of the reused detail; a one-incident run
  shows the same scenario three times (panel, triage, row); the duplicate block
  costs about 70 px of the first viewport. Trigger: 0.7.1, or a user reports the
  panel as noisy or the empty state as missing; then decide the four together
  in one report-rendering change, with the empty-state placement first.
- **Incident copy and helper nits.** The source-grep test that pinned the copy
  scope was replaced by the row-copy e2e; a negative "copy log ignores the
  scope" check returns with the next copy change. `firstLine` exists in
  `report.ts` and `triage.ts`, and the two incident test files each build their
  own `incidentSection` slice; fold both into the B-057 test-helper pass.
- **Narrow print page at 200 % text.** On a 320 px print page with 200 % text
  the German status pill wraps; the gated A4 print and the whole screen
  viewport matrix (including 320 px at 200 %) are clean. Trigger: the next
  print or status-pill change; then give the pill a print rule or drop the
  label beside the dot.
- **RTL `text-align`.** The new one-column `.metaList` rule uses
  `text-align:left`; switch to `start` when an RTL locale is added (fits
  B-066's locale trigger).
- **Test-helper duplication.** Shared test-helper work (view slices,
  attempt/tie streams, `cssBlocks`, the two CLI write wrappers) belongs to
  B-057; fold it into that refactor rather than opening a 0.6.1 finding.
- **Residual test nits from the 0.6.1 review.** Small uncovered edge classes:
  `attempt: null` or boolean on a Messages start, a `--out` permission failure
  on Windows, a surrogate pair in the CI feature/URI/`--title` fields, and a
  `--title` cut beside a Markdown special character. Each runs through a shared
  path that already has a representative test. The targeted SCR re-review also
  notes two test-strength limits: the equal-attempt acceptance test puts the
  later timestamp on the later envelope, so a regression to "always last
  envelope" would still pass, and the explicit-empty-first dedupe test is an
  order control, not a pre-fix falsifier. Trigger: the next change to attempt
  selection or input dedupe, or 0.7 retry parity; then add the
  later-timestamp-first case rather than a separate change.

## Review follow-ups (2026-11-18)

- **Playwright adapter structure.** Keep one adapter until about 1,800 lines or
  a second JSON shape; then split validation at the existing `validate*` seam.
  A shared millisecond time helper waits for a third adapter.
- **Playwright retry artifacts.** The earlier-attempt block shows status,
  duration and the first failure, and a single-input report embeds at most one
  marked earlier image under 10 MB. All other earlier attachments, the trace
  viewer, search over earlier errors and expected-failure nuance remain
  deferred. Revisit if flake forensics needs more.
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
