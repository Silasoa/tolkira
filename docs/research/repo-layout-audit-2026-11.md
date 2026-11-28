# Tolkira repository-layout audit, November 2026

Status: research note. Read-only audit of the repository layout at commit
`96a9475` on `main` (0.7.0, clean tree). No source, test, config, fixture,
script, package or spec file was changed; the only file written is this note.

Question: what did 0.7 actually change architecturally, what clutter is
genuinely left, and what would a real cleanup be? Method: measured inventory
(file counts and bytes via directory walks), knip, the npm scripts and test
configs, a basename-level fixture-reference scan, and the module map. The
prior passes (`architecture-2026-11.md`, `architecture-session-2026-11.md`,
`audit-2026-11.md`) are not restated; Section 3 lists only which of their
findings are still open. Commands are in Appendix A.

---

## 1. What 0.7 actually shipped structurally

0.7.0 contains 158 commits over 0.6.1 (`v0.6.1..HEAD`). Three of the four
B-057 structure slices landed; the fourth (feature-bundle redesign) shipped as
the incident review. Per the 2026-11-26 scope decision, the sidecar reader,
input pipeline, filter seam, ICU leaf and status vocabulary were deferred.

### 1.1 CLI plan/execute seam (`2026-11-26-0.7-cli-plan-execute`)

- Files: `src/cli.ts` (94 lines, was 779), new `src/cli/plan.ts` (428),
  `src/cli/execute.ts` (337), `src/cli/args.ts` (104), `src/cli/paths.ts` (61),
  `src/cli/logo.ts` (58) — 1,076 lines across 6 files, all CLI-observable
  bytes unchanged.
- Boundary: `planCli` turns argv + cwd into a validated `CliPlan` without
  writing; `executePlan` owns all reads, writes, warnings and stdout. The
  layout supports it: `src/cli/` is one directory with one responsibility per
  file, and the CLI tests were split to match (`cli-plan*.test.ts`,
  `cli-execute.test.ts`, `cli-equivalence.test.ts`).
- Residue: `plan.ts` was compacted to fit the 430-line soft budget instead of
  split at a seam — recorded as B-079. The path-identity helpers moved to
  `src/cli/paths.ts` but three other implementations remain (Section 3).

### 1.2 Report pipeline seam (`2026-11-26-report-pipeline-seam`)

- Files: new `src/loaded-run.ts` (96 lines), `src/render/html.ts` (100 lines,
  owns `renderRun`), `src/stream.ts` (38), `src/run.ts` (130).
- Boundary: `LoadedRun` is a branded type built only by `buildLoadedRun`;
  `renderRun` trusts it and never re-sanitises, re-indexes or re-summarises.
  `comparison`, `inputFiles` and `inputBytes` flow from the run, and caller
  options reject them with `never`. The layout supports it: the seam sits in
  the root of `src/` where the load and render layers already meet, and
  `test/loaded-run.test.ts` pins it.
- Residue: the public `renderHtml` remains the test seam for 30+ render tests;
  `LoadedRun` itself is tested through one dedicated file.

### 1.3 Incident review redesign (`2026-11-27-report-incident-review`)

- Files: `src/render/report.ts` (now 1,076 lines), `src/render/report.css`,
  `src/render/report-client.ts`, `src/render/tags.ts` (new tag overview,
  75 lines), e2e `incident.spec.ts`.
- Boundary: the incident panel reuses the shared `scenarioBody` detail builder
  (`src/render/report.ts:507`) instead of rendering the detail twice; the
  tokens live in the existing stylesheet pipeline, no new module.
- The folder layout supports it but the module no longer does: `report.ts`
  grew from 839 to 1,076 lines and now owns header, toolbar, incident panel,
  `scenarioBody`, features, scenarios, steps and hooks. The backlog decision
  says to keep `report.ts` under about 800 lines and extract
  `scenarios.ts`/`steps.ts` when it exceeds that — the trigger has fired.

### 1.4 Current module map

Measured 2026-11-28 (`src/` = 72 files, 691,369 bytes, 17,541 lines).

| Directory | Files | Bytes | Responsibility | Surface |
|---|---:|---:|---|---|
| `src/` (root) | 23 | 118,503 | Run assembly (`run`, `loaded-run`), public API (`index`, `version`), outputs (`summary`, `ci`, `email`, `pdf`, `history`, `baseline`, `artifacts`, `capabilities`), shared leaves (`attachment`, `text`, `output`, `warnings`, `validation`) | mixed |
| `src/cli/` | 5 | 31,682 | CLI plan/execute split; `cli.ts` (root) is the entry | internal |
| `src/compat/` | 3 | 13,007 | `cucumber-html-reporter` drop-in shim + CJS wrapper | public (export map) |
| `src/i18n/` | 3 | 78,858 | Generated catalog module + `en`/`de` JSON sources | internal |
| `src/input/` | 9 | 127,279 | Detect, resolve, load; legacy, messages, JUnit, Playwright adapters; sanitize | internal |
| `src/render/` | 26 | 278,850 | Server-rendered views, client script, CSS, i18n runtime, generated bundles | internal |
| `src/report/` | 3 | 43,190 | View model, run index, status type | internal |

Public surface: only `src/index.ts`, `src/cli.ts` (bin) and `src/compat/` are
reachable from the package exports; everything else is internal and the
`exports` map blocks deep imports. The map is honest: directory = layer, and
the two seams added in 0.7 have real homes.

### 1.5 What was deferred, and where that leaves the architecture

Deferred from B-057 (per the 2026-11-26 decision, none started):

- **Sidecar reader unification** — `excerpt` and `readBounded` are still
  duplicated in `src/baseline.ts` and `src/history.ts` with different UTF-8/BOM
  policies.
- **Input pipeline / adapter registry** — `src/input/load.ts` still re-parses
  validation-only kinds; unchanged since the first audit.
- **Filter seam** — server and browser still derive visibility independently;
  `UNEXECUTED_HIDE` still pulls the tag parser into the server graph.
- **One ICU message parser** — still parsed three times.
- **Status vocabulary** — 12 status-list declaration sites remain (first audit
  said "at least 8").

Net: 0.7 fixed the two widest *interfaces* (CLI argv, render options) but left
the duplicated *vocabularies* untouched. The architecture is now: two strong
new seams, five known duplications still open, and one module (`report.ts`)
that has crossed its own size trigger.

---

## 2. Measured clutter inventory

### 2.1 Repository root

Tracked root content: 26 files + 8 directories (`.github`, `docs`, `openspec`,
`scripts`, `src`, plus 3 config dirs). Every tracked root file has a
conventional role:

| Entry | Role | Must live at root? | Proposal |
|---|---|---|---|
| `package.json`, `package-lock.json`, `tsconfig*.json` (4), `vitest.config.ts`, `playwright.config.ts`, `esbuild.mjs`, `knip.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `.attw.json`, `.nvmrc`, `.git*` (3), `.editorconfig` | toolchain | yes (tooling convention) | keep |
| `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `THIRD-PARTY-NOTICES.md`, `llms.txt` | repo/package standard files | yes | keep |
| `AGENTS.md`, `GLOSSARY.md`, `DESIGN.md` | agent/design docs; `DESIGN.md` and `GLOSSARY.md` ship in the package `files` list | yes (package contract) | keep |
| `PRODUCT.md` | impeccable product-schema input (`<!-- impeccable:product-schema 1 -->`), 3,110 B, updated 2026-11-27 | questionable | keep, but see the naming collision below |
| `.impeccable/surfaces/report.md` | skill surface note, 2,571 B | no | 0.7.1-safe: move under `docs/agents/` or leave; 1 file |

**Found: two tracked `PRODUCT.md` files with different content.**
`PRODUCT.md` (root, 3,110 B, machine-readable product schema for the
impeccable skill) and `docs/PRODUCT.md` (13,985 B, the human product doc that
AGENTS.md, `docs/README.md` and the root README link). Same name, different
roles, drifted content (266 lines added to the docs copy that the root copy
lacks). This is exactly the "which PRODUCT.md is real" trap for an agent.
Renaming the root one (e.g. `.impeccable/product.md`, beside the existing
tracked `.impeccable/surfaces/report.md`) removes the collision.

**Untracked local clutter** (all gitignored, none in the tree): `.tmp/`
(23.0 MB), `test-results/` (6.6 MB), `coverage/` (4.2 MB), `dist/` (2.6 MB),
`tolkira-0.5.1.tgz` (581 KB), `.openchamber/`. The root *tree* is tidy; the
root *working directory* is not. `tolkira-0.5.1.tgz` is a stale local pack
output and can be deleted locally; nothing references it.

Verdict: **the root does not need a cleanup.** The complaint "too much sits in
the root" measures 26 tracked files — conventional for a published npm
package — plus five gitignored build-output directories.

### 2.2 Tests

`test/` = 311 files, 3,248,954 bytes, 69,991 lines.

| Area | Files | Bytes | Lines | Content |
|---|---:|---:|---:|---|
| `test/` (root) | 115 | 1,591,982 | — | 108 `*.test.ts` unit files + 7 shared helpers |
| `test/e2e/` | 33 | 338,604 | 10,338 | 32 `*.spec.ts` + one `helpers.ts` (14,892 B) |
| `test/fixtures/` | 163 | 1,318,368 | 10,539 | producer fixtures, goldens, history, i18n |

Separation is clean and conventional: unit tests are flat at `test/`, browser
tests in `test/e2e/` (exactly what `playwright.config.ts` `testDir` expects),
fixtures in `test/fixtures/`. Every `*.test.ts` is matched by the vitest
include (`test/**/*.test.ts`); every spec is matched by Playwright
(`test/e2e/**/*.spec.ts`). **No test file exists outside these globs and none
is never run.**

Largest unit files: `playwright.test.ts` 72,556 B, `model.test.ts` 55,564 B,
`ci.test.ts` 41,182 B, `history.test.ts` 36,360 B, `render-incident.test.ts`
35,419 B, `tooling-config.test.ts` 34,293 B. These mirror the largest source
modules; nothing is misfiled.

Helpers (7 files, 34,065 B): `baseline-helpers.ts`, `render-helpers.ts`,
`render-incident-fixtures.ts`, `retry-reports.ts`, `attachments.ts`,
`fixtures.ts`, `ansi-payload.ts`. Overlap check: `render-incident-fixtures.ts`
and `render-helpers.ts` both wrap `parseLegacyJson`/`parseMessages`, but the
incident file is a 0.7 addition building panel fixtures; merging them is
cosmetic, not structural. The e2e `helpers.ts` is separate by design (browser
context). No meaningful helper duplication.

Fixtures: the largest is `messages/attachments-large.ndjson` (527,066 B — 40%
of all fixture bytes; it is the size-diagnostics and stress fixture, used by
`size-diagnostics.test.ts`, `parity-metadata.test.ts` and e2e). `render-golden/`
holds 2 HTML goldens (148,658 B). The orphan scan (Appendix A) found **29
basename-unreferenced files, all explained**: 21 are `.feature` Gherkin sources
that document their sibling `.ndjson` per `test/fixtures/messages/README.md` (a
deliberate provenance convention), 7 `legacy/cucumber-js-*.json` are loaded via
the version-table template in `legacy-version.test.ts:23`, and
`cjs-types/require-compat.cts` is compiled via the tsconfig fixture used by
`compat-cjs.test.ts`. **Zero truly orphaned fixtures.**

### 2.3 scripts/, docs/, openspec/, .github/

- `scripts/`: 12 files, 77,684 B. 5 build/generate scripts, `check-hygiene`,
  `package-check`, `copy-compat-cjs`, 3 benchmark/stress scripts,
  `package-check.d.mts`. All referenced by package.json scripts or tests. Keep.
- `docs/` (tracked): 90 files, 4,148,306 B. `docs/comparison/` is 28 files,
  2,961,464 B — 71% of tracked doc bytes; kept by an explicit recorded decision
  ("revisit if the repo exceeds 10 MB"). `docs/research/` 32 files, 700,933 B.
  Untracked `docs/ui-loop/` is 390 files / 19.1 MB, gitignored — local design
  scratch, correctly out of the tree.
- `openspec/`: `openspec/changes/` is **100% archive**: 69 change directories,
  415 files, 1,863,724 bytes. No active change exists. `openspec/specs/` is 11
  files, 356,956 B. The archive is 26% of all tracked non-docs bytes and grows
  monotonically; specs are already synced per the archive commits, so the
  archive is history, not contract.
- `.github/`: 8 files, 20,092 B (2 workflows, 4 issue templates, 2 config).
  Fine.

### 2.4 Dead code

`npm run lint:dead` (knip 6.48.0) reports **zero unused files, exports,
dependencies or fixtures**; its only output is 7 configuration hints (entries
in `knip.json` that match nothing or are redundant — e.g. `test/fixtures/**`
in `ignore` has no effect because knip never imports fixtures anyway). The
0.7.0 tooling slice already removed the 17 exports knip found. There is
nothing to delete on knip's evidence.

---

## 3. Architecture judgement

### 3.1 Deep vs shallow

Deep (small interface, much hidden — do not touch):

- `src/run.ts` + `src/loaded-run.ts`: the `LoadedRun` brand plus four resolved
  entry points hide sanitise/index/compare/summarise/provenance behind 96 and
  130 lines. The best seam in the repo.
- `src/render/html.ts`: `renderRun` is 100 lines over a trusted run and owns
  shell, CSP hashing and assembly for 26 render files.
- `src/attachment.ts`, `src/text.ts`: shared leaves with real invariants
  (byte accounting without decoding; the measured ANSI fast path).
- `src/index.ts`: a 5-function public API over the whole pipeline.
- `src/cli/plan.ts` + `execute.ts`: deep despite the size residue — a caller
  needs argv and an io object, not the 6-slot output matrix.

Shallow pass-throughs (acceptable, small): `src/cli/args.ts`, `paths.ts`,
`logo.ts`, `src/stream.ts`, `src/version.ts`. These are thin by design; merging
them would save ~40 lines and cost clarity.

Shallow in the damaging sense (wide interface, mixed responsibilities):

- `src/render/report.ts` (1,076 lines): the only module that both grew past
  its recorded size trigger and mixes template with layout logic. The backlog
  decision ("extract `scenarios.ts`/`steps.ts` when it exceeds about 800
  lines") is now active.
- `src/input/playwright.ts` (1,835 lines, grew from 1,729): still validator +
  planner + attachment I/O + emitter over a shared mutable `PlanContext`.
- `src/report/model.ts` (963) and `src/input/legacy.ts` (1,002): large but
  single-purpose; length is not the defect here.

Missing seams (the deferred B-057 set, all still measurable):
status vocabulary (12 declaration sites), the sidecar reader
(`readBounded`/`excerpt` duplicated in `baseline.ts:85,101` and
`history.ts:77,309`), path identity (4 implementations: `cli/paths.ts:6`,
`input/load.ts:46`, `input/playwright.ts:614`, `output.ts:52,71`), the
server/browser filter decision, and the ICU parser (3 implementations).

Locality: good. Directory = layer, tests sit beside the layer they test,
generated artifacts are co-located with their build scripts. The only locality
smell is the `PRODUCT.md` naming collision (Section 2.1).

### 3.2 Ponytail view: delete / merge / split

| Action | Target | Risk × payoff | Proof |
|---|---|---|---|
| delete | nothing — knip and the fixture scan found zero orphans; `tolkira-0.5.1.tgz` is local-only | — | Section 2 |
| rename/merge | root `PRODUCT.md` into `.impeccable/` | low risk, medium payoff (removes an agent trap) | `git diff --no-index` shows 266-line drift |
| split | `src/render/report.ts` → extract `scenarios.ts`/`steps.ts` per the standing decision | medium risk (byte-pinned by characterisation hashes), high payoff (the trigger fired) | 1,076 > 800 |
| merge | `readBounded`/`excerpt` into one sidecar leaf | medium risk (security-sensitive readers), medium payoff | 4 duplicated functions |
| merge | status vocabulary into `src/report/status.ts` | low risk, high leverage — makes every later change cheaper | 12 sites |
| defer/skip | `report.ts` template-file nature, `report-client.ts` length, the two `ci.ts` names, goldens double-edgedness | renaming `ci.ts` breaks import-path history for zero behaviour gain; template length is natural | — |

### 3.3 Prior-audit findings still open

From `architecture-2026-11.md` (candidates 3.1–3.10): **done** — 3.1 (CLI
plan/execute), 3.3 (report pipeline seam). **Open** — 3.2 input pipeline,
3.4 sidecar reader, 3.5 status vocabulary, 3.6 Playwright internal seams,
3.7 feature layout planner, 3.8 package surface (`phase` still exported from
`src/index.ts:12`; version still duplicated in `src/version.ts`),
3.9 run-facts projection, 3.10 path identity (partially: only the CLI copy is
extracted).

From `architecture-session-2026-11.md`: **open** — the filter seam (candidate
2), the one ICU formatter (candidate 6), the attachment ledger (candidate 5).
Closed by 0.7: the output-path plan (candidate 3, done by `src/cli/plan.ts` +
`paths.ts`) and the render-context candidate 4 (done by `renderRun`/`LoadedRun`).

From the ponytail audit (`audit-2026-11.md`): findings 1–12 were correctness
findings; 1 (path attachment roots, B-058) and 3 (`writeHistory` malformed
target) remain open backlog rows — the other ten were fixed in 0.6.1-hardening
and the input-accounting fix (see `docs/CHANGELOG.md` 0.6.1). The `phase`
export and the copied sidecar helpers it flagged are still present.

---

## 4. Three-bucket cleanup plan

### (a) 0.7.1-safe: docs, local hygiene and zero-byte-impact changes

| # | What | Why | Risk | Size | Proof |
|---|---|---|---|---|---|
| a1 | Rename root `PRODUCT.md` to `.impeccable/product.md` and update the impeccable skill reference | removes the two-`PRODUCT.md` agent trap; neither copy ships in the package (`files` list checked) | near zero | 1 file + 1 reference | `npm pack --dry-run` file list unchanged; `git status` clean |
| a2 | Trim `knip.json` per its 7 hints (remove no-op `ignore` entries, redundant entry patterns) | config honesty; knip currently reports hints, not findings | near zero | config only | `npm run lint:dead` output changes from hints to clean; no source change |
| a3 | Delete local-only clutter (`tolkira-0.5.1.tgz`, stale `.tmp/`) — not a commit, a working-dir cleanup | 23.6 MB of ignored local files shadow the tidy tree | none | local only | `git status --ignored` before/after |
| a4 | Delete local `dist/`, `coverage/`, `test-results/` between releases | same | none | local only | regenerated by `npm run build` / tests |

None of these touches `src/`, the tarball, or any report byte; a1/a2 do not
affect the build, so no hash comparison is needed. (a3/a4 are not repo changes
at all.)

### (b) Next structure changes, one at a time (OpenSpec change each)

| # | Change | Scope | Acceptance | Must not touch |
|---|---|---|---|---|
| b1 | **Status vocabulary** (arch. 3.5) | `src/report/status.ts` exports `STATUSES`, `isStatus`, severity, label-key; the 12 declaration sites derive from it | exhaustive `Record<ReportStatus,T>` maps compile; both catalogs resolve every label key; report/summary/CI/email/history bytes unchanged on the fixture set | no new status, no schema-2 change, no catalog copy change |
| b2 | **Split `report.ts`** per the standing backlog decision | extract `scenarios.ts`/`steps.ts` (and optionally the incident panel) out of `src/render/report.ts` | all characterisation hashes and 2 goldens byte-identical; `render.ts` under the ~800-line target; one layer test still passes | no markup, CSS, class-name or client-script change; no incident-panel behaviour change |
| b3 | **Sidecar reader** (arch. 3.4) | one `readCappedText` leaf under `baseline.ts` + `history.ts` | shared contract test over both sidecars (missing/directory/symlink/over-cap/BOM/invalid UTF-8); module error messages unchanged | no cap or decoding-policy change; not bundled with any CLI change |
| b4 | **Path identity** (arch. 3.10) | fold the 4 path implementations into one module, home it inside b2 or the next CLI-adjacent change | symlink/junction/case/`..` table test on Windows and Linux | no standalone drive-by; never inside a behaviour change |

Order: b1 → b2 → b3 → b4 (the first audit's order, still correct). b1 and b2
are the only ones with a user-visible payoff trigger (b2's has already fired);
b3/b4 can wait for a change that touches those areas.

### (c) Leave as is

| What | Why |
|---|---|
| Root file set (26 files) | conventional for an npm package; every file has a recorded role |
| `docs/comparison/` (2.96 MB) | kept by decision with explicit revisit thresholds (repo > 10 MB) |
| `openspec/changes/archive/` (1.86 MB) | it is the project's decision history; OpenSpec's archive is the contract trail. If size ever matters, a one-way move to a branch or a `docs/` export is a separate decision — deleting it would orphan the B-xxx references in `docs/BACKLOG.md` |
| `test/` layout (flat unit + `e2e/` + `fixtures/`) | matches the tool configs exactly; nothing is misplaced, nothing unrun, zero orphan fixtures |
| `src/compat/`, `src/stream.ts`, small `src/cli/` files | thin by design; merging buys nothing |
| `report-client.ts` (730 lines) | a browser script; naturally long, pinned by a byte budget |
| Local gitignored dirs | working-directory state, not tree state |

---

## 5. Release follow-ups (B-074 … B-080)

Checked against `docs/BACKLOG.md` and the actual 0.7.0 package contents
(`npm pack --dry-run`: 94 files, 707.0 kB packed, 2.9 MB unpacked;
`THIRD-PARTY-NOTICES.md` 1.6 kB present; `dist/cli.js` 429.5 kB,
`dist/index.js` 379.1 kB).

| ID | State | Deadline |
|---|---|---|
| B-074 release token isolation | **Closed** 2026-11-27 (`release-token-isolation`): split package/publish jobs, tag ruleset, 30 workflow tests. Verified in the 0.7.0 release. | done |
| B-075 bundled MIT notice | **Closed** 2026-11-27 (`bundled-license-notice`): notice comment shipped, `THIRD-PARTY-NOTICES.md` required in tarball (verified present in the pack output), drift test in place. The SBOM still does not cover bundled code by design; the row is resolved, not reopened. | done |
| B-076 attempt numbering mismatch (`Attempt: 1` vs `Earlier attempts (2)`) | **Open** (backlog row, no issue) | trigger-based; not required for 0.7.1. Fix with the next retry/attempt-label change. |
| B-077 `--index` artifact index | **Open** | trigger-based; before any release that advertises agent artifact folders, otherwise no deadline |
| B-078 logo read not bounded after `stat` | **Open** | not required for 0.7.1; must close before any change that lets report input or logo paths become attacker-influenced (pair with B-058) |
| B-079 `plan.ts` compacted to the soft budget | **Open** | not required for 0.7.1; fold into the next `src/cli/` change or when a second `planOptions` caller appears |
| B-080 docs examples not pinned to the version | **Open**. Today the `docs/AGENT-INTERFACE.md` example says `"version": "0.7.0"` — aligned, but nothing pins it, so the next version bump can drift it silently. | **should close before the next release-prep change** (0.7.1 or the next tag): one checklist line or a small test, as the row itself says |

None of B-076–B-080 blocks 0.7.1 on correctness grounds; B-080 is the only
one whose trigger (the next release-prep change) fires immediately.

---

## Appendix A: commands and key output

All commands run 2026-11-28 at commit `96a9475`, clean tree.

```shell
# tree state
git status --porcelain                      # empty
git log --oneline -1                        # 96a9475

# tracked bytes per top-level path (git ls-files + stat)
#   src 72 files 691,369 B; test 311 files 3,248,954 B; openspec 427 files
#   2,224,860 B; docs 90 files 4,148,306 B; scripts 12 files 77,684 B;
#   .github 8 files 20,092 B

# per-directory walk (node readdirSync + statSync)
#   src/cli 5/31,682; src/compat 3/13,007; src/i18n 3/78,858; src/input 9/127,279;
#   src/render 26/278,850; src/report 3/43,190; src root 23/118,503
#   test root 115 (108 test + 7 helpers, 1,591,982 B); test/e2e 33/338,604;
#   test/fixtures 163/1,318,368 (messages 77/829,662, legacy 24/196,414,
#   render-golden 2/148,658, playwright 24/83,761)
#   docs/comparison 28/2,961,464; docs/research 32/700,933; docs/ui-loop
#   390/19,055,791 (gitignored, untracked)
#   openspec/changes 415/1,863,724 = 69 archive dirs + .gitkeep, 0 active;
#   openspec/specs 11/356,956

# dead code
npm run lint:dead
#   "Configuration hints (7)" — knip.json no-op entries; zero unused
#   files/exports/dependencies

# test-run coverage of test files
#   vitest.config.ts include: test/**/*.test.ts; playwright.config.ts
#   testDir ./test/e2e, testMatch **/*.spec.ts; glob found *.test.ts only
#   under test/ and *.spec.ts only under test/e2e -> no unrun test file

# fixture orphan scan (two passes; basename pass catches helper-built paths)
node <scan>   # 163 fixtures; 29 basename-unreferenced, all explained:
#   21 *.feature provenance companions (fixtures/messages/README.md),
#   7 legacy/cucumber-js-*.json via legacy-version.test.ts version table,
#   1 cjs-types/require-compat.cts via its tsconfig in compat-cjs.test.ts

# package contents
npm pack --dry-run    # 94 files, 707.0 kB / 2.9 MB unpacked;
#   THIRD-PARTY-NOTICES.md present, version 0.7.0

# duplication re-checks
Select-String -Path src\**\*.ts,src\*.ts -Pattern 'const VALID_STATUS|const STATUSES|...'  # 12 sites
Select-String -Path src\baseline.ts,src\history.ts -Pattern 'function readBounded|function excerpt' # 4 hits
Select-String -Pattern 'function canonicalPath|function isInside|function samePath' # 4 files

# files over 400 lines (src)
#   playwright.ts 1835; render/report.ts 1076; legacy.ts 1002; model.ts 963;
#   report-client.ts 730; baseline.ts 543; junit.ts 485; history.ts 483;
#   ci.ts 466; summary.ts 442; cli/plan.ts 428; render/i18n.ts 418
```

## Appendix B: limits

- No build, test suite or e2e run was executed (audit is read-only; the gate
  was not required for a docs-only note). Byte-identity proofs in bucket (a)
  are stated as commands, not executed.
- The fixture orphan scan is textual (basename match); a fixture referenced
  only through a name not appearing in any source would be missed, but the
  dynamic-path templates found (version table, tsconfig include) are the
  known patterns.
- I did not evaluate runtime behaviour, performance or the report UI; the
  incident-redesign judgement rests on file sizes and the recorded decisions.
