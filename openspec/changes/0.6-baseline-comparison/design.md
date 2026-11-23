# Design

## Seam and data flow

The comparison is one pure module, `src/baseline.ts`, used by the summary
builder and the renderer. The CLI owns file reading and validation, as it does
for the history sidecar:

```
inputs ──► loadRun ──► indexRun ──► summarizeIndex(index, comparison) ──┐
                                                                       ├─► ReportSummary
baseline.json ──► readBaseline ──► BaselineSummary ──► compareBaseline ┘
                                                          │
                                    ┌─────────────────────┼─────────────────────┐
                                    ▼                     ▼                     ▼
                          summary `baseline` block   report panel + badges   Markdown CI line
                          + per-scenario `change`
```

`readBaseline(file)` validates the file and returns a `BaselineSummary`
projection: the schema version, the overall status and the scenario identity,
status and `executed` fields. The CLI passes that object to `generateReport`,
`renderReport` or `summarizeReport` as `options.baseline`; the API accepts the
projection, never a path.

`compareBaseline(current, baseline)` runs once and returns one comparison: the
summary `baseline` block and a change map keyed by the report model's pickle id.
The summary builder reads the block and looks up each pickle id for `change`; the
renderer receives the same map and joins each row by `ReportScenario.id` (the
pickle id). Neither re-derives a match, and the summary gains no `id` field
(D11).

`displayUri` stays in `src/summary.ts` and is imported by `baseline.ts` (D19).
`summary.ts` takes the comparison as an argument and only type-imports the
comparison type, so there is no runtime cycle. There is no leaf-module move.

A small `src/render/baseline.ts` owns the panel and badge markup; `report.ts`
calls it as a lower-layer view module, next to the triage and matrix modules.
The comparison itself stays in `src/baseline.ts`; the render module only reads
the summary block and the per-row change map.

## Baseline file contract

- Read once, read-only, never rewritten. The report and summary never embed the
  path.
- Regular file, checked on the descriptor; maximum 10 MiB (10,485,760 bytes).
  The cap is 10 MiB rather than the 100 MiB input cap because a summary is one
  JSON document and this is a new trust boundary. A summary larger than 10 MiB
  cannot be a baseline; that is a documented limit (D13).
- Strip a UTF-8 BOM before parsing. A `..` segment in a baseline `uri` is passed
  through `displayUri` like today and is never resolved against the file system.
- UTF-8 JSON object with `schemaVersion: 2` and a `scenarios` array. Only
  `status`, and per scenario `feature`, `name`, `uri`, `status`, `executed` and
  the optional `example` are trusted. Steps, tags, counts, attachments and a
  nested `baseline` block are ignored.
- Reject rather than coerce: missing file, invalid JSON, wrong schema, missing
  or malformed `scenarios`, a non-object scenario entry, a missing `executed`, a
  non-string identity field, a non-boolean `executed`, a status outside the
  seven documented values, a document nested deeper than 64 levels, a
  non-regular file (including a directory or a symlink to a directory) and an
  oversized file all exit 1 with a message naming the file. A `__proto__`,
  `constructor` or `prototype` own key on the document or a scenario entry is
  rejected the same way. No output is written.
- Apply `displayUri` to every baseline `uri`, so a hand-made absolute path
  cannot reach the new summary or the report.
- The baseline is untrusted text. Names are escaped exactly like current-run
  names; the panel adds no links and reads no file from the baseline.

## Path rules

The baseline owns the full collision matrix: it must not name an input, the
logo, `--out`, `--pdf`, `--email`, `--history`, `--ci-out`, or a path inside an
input directory, even when the file does not exist (D15). The collision is a
usage error (2) before any read. The history change adds `--baseline` to its own
list; this change owns the matrix.

## Identity

Match in this order; the order is part of the contract (D7).

1. **Base key:** feature name + scenario name (`feature`, `name`).
2. A base key with exactly one row on each side matches.
3. If every row in the group on both sides carries `example`, pair by the
   coordinate `#<examples>.<example>` with 1-based numbers. The coordinate is
   positional: inserting or reordering an Examples row can mispair a later row;
   that is a documented limit.
4. Remaining rows in a repeated group pair by display URI when exactly one
   unmatched row on each side carries that URI.
5. If any row in a repeated group remains unpaired, the whole base group is
   **ambiguous**: no row in it is paired, classified, counted in the tracked
   counts or listed as not in this run, and the group counts once in
   `ambiguous`.
6. A 0.5 baseline has no `example`: unique names match; repeated names in
   different URIs pair by URI; repeated names in the same URI are ambiguous.

Never use the pickle id, array position, line number, tags, step text or status
as identity, and never pair by order or "closest" name. A renamed `*.feature`
file keeps identity when the base key is unique, and for outlines whose
coordinate separates the group. A repeated non-outline name in a renamed file
becomes ambiguous, not a new failure; a renamed feature or scenario is an
unmatched baseline row plus an unmatched current row. There is no "modified"
claim.

The example coordinate is the report label `#<examples>.<example>` with 1-based
numbers, emitted for every Messages outline row (executed or unexecuted) as
`example`. The summary builder uses the same outline metadata and coordinate
helper as the report model (`examplesIndex`/`exampleIndex` from the run index),
so the label and the summary field cannot drift (DXR I2). A plain scenario, a
legacy JSON scenario and a JUnit scenario have no field (D12). The field is
additive, so `schemaVersion` stays 2 and appears after `attempt` in key order.

## Classification

`failed`, `undefined` and `ambiguous` are failing; `passed` is passing;
`skipped`, `pending` and `unknown` are other. A matched pair:

| Baseline | Current | Class |
| --- | --- | --- |
| any | unexecuted | no claim (`other`) |
| unexecuted | failing | new failure |
| unexecuted | passing or other | no claim (`other`) |
| failing | failing | still failing |
| failing | passing | fixed |
| failing | other | no claim (`other`) |
| passing | failing | new failure |
| passing | passing or other | no claim (`other`) |
| other | failing | new failure |
| other | passing or other | no claim (`other`) |

An unmatched current row that is executed and failing is a new failure; an
unmatched executed row that does not fail is **added**; an unmatched unexecuted
row makes no claim and is not a baseline row, so it does not enter the
reconciliation. Every unmatched baseline row is **not in this run**.

The comparison has one count set (D8): `newFailures`, `fixed`, `stillFailing`,
`other`, `notInThisRun`, `added` and `ambiguous`. For every baseline row outside
an ambiguous group, exactly one of new failure, fixed, still failing, `other` or
not in this run applies, so
`newFailures + fixed + stillFailing + other + notInThisRun` equals that row
count. `added` counts current rows and is not part of the baseline sum.
`ambiguous` counts base-key groups, not rows; its rows are outside the sum. The
JSON block exposes six counts; `other` is the derived no-claim residual and is
not a JSON field in 0.6.0.

## Summary shape

With a baseline, the block appears between `attachments` and `scenarios`. This
example is abridged; the rest of the summary is unchanged:

```json
{
  "schemaVersion": 2,
  "baseline": {
    "status": "failed",
    "counts": {
      "newFailures": 2,
      "fixed": 1,
      "stillFailing": 3,
      "notInThisRun": 1,
      "added": 4,
      "ambiguous": 0
    },
    "notInThisRun": [
      {
        "feature": "Checkout",
        "name": "pays by card",
        "uri": "features/checkout.feature",
        "status": "failed",
        "executed": true,
        "example": "#1.2"
      }
    ]
  },
  "scenarios": [
    { "name": "pays by card", "executed": true, "change": "new-failure" }
  ]
}
```

- `change` is `new-failure`, `fixed`, `still-failing` or `added`, appears after
  `executed`, and is present only for a classified current row. Unchanged,
  no-claim, unexecuted and ambiguous rows have no field.
- `notInThisRun` entries carry `feature`, `name`, `uri`, `status`, `executed`
  and the optional `example` (D9). The list is capped at 50 entries;
  `counts.notInThisRun` stays complete.
- `notInThisRun` is sorted by the example coordinate (examples then example,
  numeric, rows without `example` last), then feature, name and URI (D18). The
  coordinate is compared numerically, so `#1.10` sorts after `#1.2`.
- Without a baseline there is no `baseline` or `change` key and the Markdown CI
  bytes and HTML are byte-identical. The unconditional `example` field is the
  only summary delta.
- A baseline that itself contains a `baseline` block is accepted and the nested
  block is ignored.

## Report surface

The panel sits in the Report view after the toolbar and live region and before
the needs-attention index. It is server-rendered: heading, baseline status, the
four tracked counts, the ambiguous-group count when positive, and a "Not in this
run" list of at most 10 entries (feature, scenario, optional example, baseline
status) followed by one line that names the remaining count and points to the
JSON summary (`--json`). The count stays complete. No entry is a link. The panel
stays visible when a search or filter is active; its counts describe the whole
run.

New-failure and fixed rows carry a localized text badge in the scenario summary;
still-failing and added rows carry no badge (the failure chrome is already
there). Badges are text, escaped and readable without colour. Rows are joined by
the report model's pickle id.

The panel and badge CSS is a separate conditional string, not a rule in
`src/render/report.css`: `scripts/build-styles.mjs` minifies `report.css` into
the single `REPORT_CSS` constant used by every report (`src/render/html.ts:94`),
so a rule there would change every default report and fail the characterization
hashes. Put the rules in `src/render/baseline.css`, build a second
`BASELINE_CSS` constant, and append it only when a baseline is supplied (B3).

The panel works without JavaScript, in print/PDF and at 320 px and 200 % text
zoom. Baseline names, features and URIs are escaped; a baseline URI is
display-normalised, never a link or a file path. The panel never reads an
attachment or a file named by the baseline.

## CI line

Only `--ci markdown` changes. The line goes after the counts table's trailing
blank line and before the empty-run and zero-executed early returns, followed by
one blank line, so it appears for an empty or all-unexecuted current run (D14):

```
Baseline: 2 new failures · 1 fixed · 3 still failing · 1 not in this run
```

- The four counts always appear, including zeros; `1 new failure` is singular.
- ` · 1 ambiguous group` / ` · 2 ambiguous groups` is appended only when the
  count is positive.
- `added` is omitted from CI; it is informational and remains in JSON.
- Without a baseline there is no line and the bytes are unchanged. GitHub and
  Azure annotations keep their bytes and caps with or without a baseline.
- The line is English and contains no dynamic names.
- The Markdown formatter reads the counts from `summary.baseline.counts`; it
  does not run a second comparison.

## API surface

- The package SHALL export the `BaselineSummary` type.
- `generateReport` takes the history change's `GenerateReportOptions` extended
  with `baseline?: BaselineSummary`; `renderReport` takes a
  `BaselineRenderOptions extends RenderReportOptions` with the same field;
  `summarizeReport(inputs, options?)` accepts the same field.
- `renderHtml` and `CucumberHtmlStream` do not take a baseline in 0.6.0. The
  stream keeps `RenderReportOptions` and its same-input-same-HTML contract; this
  is a documented limit (D10/I2).
- The API accepts the projection, never a path. The CLI is the only reader.

## Failure modes

| Condition | Exit | Output |
| --- | --- | --- |
| `--baseline` with `--out`, `--pdf`, `--json` or `--ci markdown` | 0 | normal outputs plus comparison |
| `--baseline` with only `--email` or only `--ci github/azure` | 2 | usage error, nothing written |
| baseline path collision or inside an input directory | 2 | usage error, nothing written |
| baseline missing, unreadable or non-regular | 1 | message names the file, nothing written |
| baseline invalid JSON, wrong schema or a malformed entry | 1 | message names the file and the reason |
| baseline above 10 MiB | 1 | message names the file and limit |
| report/JSON/CI generation fails after a valid baseline | 1 | existing failure behaviour, no partial output |

## Trust and lifecycle

Baseline feature names, scenario names and URIs become part of the HTML and the
JSON block, escaped like current-run text; the baseline path is never embedded.
One baseline is used per suite and variant: comparing a mixed or different suite
produces spurious counts, not a crash. Sharded runs need the merged run on both
sides. The report becomes a two-run artifact (baseline + current); keep the
baseline in the CI cache or artifact store.

The CI recipe must not use `--json > summary.json` with the same path as
`--baseline`: the shell truncates the file before Tolkira starts. Document a
separate path and a copy/cache step. The CLI cannot detect a shell truncation.

The compat shim treats `baseline` as an unknown legacy option: it warns once and
ignores it, like every other unknown key.

## Tests

- Matcher: the classification table, pass/fail/undefined/ambiguous/skipped/
  pending/unknown/unexecuted, added and absent rows, duplicate names, outline
  rows with and without coordinates, a 0.5 baseline, renamed file, renamed
  feature/scenario, ambiguous group excluded, no order pairing. Pin retries as
  one row per pickle with the latest attempt. ISTQB decision table and state
  transitions.
- Reader: missing, empty, invalid JSON, wrong schema, non-regular, directory,
  symlink to a directory, symlink to a regular file, oversized, missing
  `executed`, non-object entry, wrong field types, unknown status, prototype
  keys rejected with no pollution, deep nesting, control/bidi names, absolute
  URI, `..` URI, BOM, nested `baseline` block, only identity/status fields
  trusted, no path becomes a link.
- Summary/JSON: block and `change` only with a baseline; schema 2; stable key
  order; `example` after `attempt` on Messages outline rows only; `change` after
  `executed`; `notInThisRun` cap and numeric sort; no absolute path; no-flag
  keys absent and only the additive `example`; no summary golden changes (I15);
  no-flag CI is byte-identical; no-flag HTML is byte-identical.
- CLI: each surface, email-only and GitHub/Azure-only rejection, collisions,
  missing baseline, 10 MiB boundary.
- Report: panel counts and list cap, the `--json` pointer line, badges, German
  labels, escaping, no-JS, print/PDF, 320 px and 200 % text, no horizontal
  overflow, filter-active panel.
- CI: exact line, zero counts, singular/plural, ambiguous suffix, empty and
  all-unexecuted runs, no line without a baseline, GitHub/Azure bytes unchanged.
- E2E: two real runs sharing one baseline, a renamed `*.feature` file, a fixed
  scenario, a new failure and a not-in-this-run scenario at 320 and 1440 px;
  print/PDF contains the panel; `--static --baseline` after the static change
  lands.
- Bytes: after all four changes land, one combined characterization proves the
  default report, CI and email bytes are unchanged and the default JSON differs
  only by the additive `example`.

## Risks and limits

- Identity is the hard part. The refinement order is deliberately name-first so
  a file rename keeps identity when the base key is unique or the coordinate
  separates the group; the cost is that a feature or scenario rename is a remove
  plus an add, never a "modified", and a repeated non-outline name in a renamed
  file is ambiguous. The tests pin the decision table.
- The positional example coordinate can mispair after an inserted or reordered
  Examples row; accepted and documented (D7.3).
- A baseline summary larger than 10 MiB cannot be a baseline (D13).
- `renderHtml` and `CucumberHtmlStream` do not take a baseline; only
  `generateReport`, `renderReport` and `summarizeReport` do (D10).
- The baseline lifecycle is the user's: one baseline per suite and variant,
  compare the merged run for shards, and keep a separate path from the current
  `--json` redirect. A wrong baseline produces spurious counts, not a crash.
- This is a new untrusted JSON reader and new report content; SEC, UXR, ILA and
  CMP reviews are triggered. No new dependency.
- The summary gains one additive field on Messages outline rows; no summary
  golden changes. The HTML stays byte-identical without the flag.

## ADRs

- [ADR 0002](../../../docs/adr/0002-single-package-esm-node22.md): one package,
  Node built-ins, no new runtime dependency.
- [ADR 0004](../../../docs/adr/0004-normalize-to-messages.md): the summary is
  built from the normalised Messages run.
- [ADR 0005](../../../docs/adr/0005-server-rendered-shell.md): the panel is
  server-rendered; no client data store.
- [ADR 0006](../../../docs/adr/0006-inline-attachments.md): the baseline is a
  read-only summary, not an attachment or a split asset.

## Open questions

None. The identity order, count set, `executed` field, API surface, panel
location and German copy are decided; ILA remains a later catalog review, not an
open question.

## Out of scope

- Automatic baseline capture, scenario-level history, a run store, first/last
  seen, fail streaks, flaky trends.
- GitHub/Azure annotation changes, email changes, PDF-specific work, a "new
  only" filter, stable deep links, a dashboard, server or telemetry.

## Rollout order

D1: early-size → history → static → baseline. This change lands last; it owns
the combined `--static --baseline` interaction and the final byte
characterization.
