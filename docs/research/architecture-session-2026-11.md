# Tolkira architecture session review, November 2026

A second, independent architecture pass on the 0.6.0 tree, produced by a
separate session on 2026-11-24. The first pass is
`docs/research/architecture-2026-11.md`; this note records the second pass's
findings and where each one landed. Source: a 47 KB HTML report in the session
temp folder, based on a static read of `docs/ARCHITECTURE.md`, `GLOSSARY.md`,
ADR 0001-0007, `docs/BACKLOG.md`, churn over three months and an import graph.
It did not run the test suite, a profiler or coverage; the coverage table is an
import scan, not line coverage.

Scale at the time: 57 files, 14,745 lines in `src/`, 364 commits.

## Candidates

1. **Status: one language, one rollup.** Seven status values are declared in six
   modules (`model`, `summary`, `history`, `baseline`, `format`, `trends`,
   plus `matrix`/`email`/`ci` readers); two normalisers and three "which status
   is present" derivations. Proposal: `report/status.ts` owns the list, check,
   counts, severity, worst status and attempted pass rate; labels, CSS classes
   and markup stay in the views. Same as first pass 3.5.
2. **Filter decision once, two adapters.** Server (`scenarioVisible`,
   auto-expansion, preset fit) and browser (`apply()`, hidden/open state,
   preset UI) derive visibility independently; the preset rule exists three
   times. `UNEXECUTED_HIDE` lives in `search.ts` and pulls the tag parser into
   the server graph; `@cucumber/tag-expressions` is a devDependency. Proposal:
   one deep filter decision returns visible/open/preset-active; the server
   template and browser client are two adapters; the sentinel becomes a leaf.
   **New versus the first pass** (its 3.7 is the feature layout planner). The
   packaging risk is already in first pass 3.8.
3. **Output paths as a plan.** Six blocks check output paths against each other,
   with two "does this overwrite an input?" implementations
   (`output.ts:8-33`, `cli.ts:181-192`); the `--email` error does not name
   `--history`/`--baseline`; `output.ts` has no direct unit test.
   Proposal: `validateOutputPaths(options) -> Plan | { slot, reason, peer }`
   from a table, with `output.ts` remaining the identity leaf. Same area as
   first pass 3.1/3.10. The session's top recommendation.
4. **Render context instead of flag passing.** `RenderOptions` repeats six
   fields of `RenderReportOptions`; `static` travels as a positional value
   through about 58 sites in `src/render`; `email.ts` imports the report graph
   only for a label. Proposal: `html.ts` builds one `RenderContext` and views
   take `(model, ctx)`; internal precomputation becomes an input object;
   `displayUri`/`positiveLine` move to a leaf. Same as first pass 3.3.
5. **Attachment ledger.** Five overlapping maps in the run index, three
   re-filters in the model and a separate summary sum; equality is held by
   `model-summary-cross-check.test.ts` after the fact. Proposal: one ledger
   resolves ownership once and returns totals, bytes and conversion; model and
   summary render the same facts; retry/earlier-evidence cases stay in the
   ledger. Refines first pass 3.9 (run facts projection).
6. **One ICU formatter.** The same message subset is parsed three times
   (`i18n.ts` AST, `client-i18n.ts` regex, `i18n-catalog.test.ts` scanner), with
   different behaviour for a missing or non-numeric plural parameter (server
   throws, client uses 0/empty), so the catalog check can accept what the
   runtime rejects. Proposal: one `message-format` leaf with
   `compile`/`format`; `Translator` and `ClientFormatter` become thin `Intl`
   adapters; the catalog check imports the same validator. **New versus the
   first pass.**
7. **Input adapter registry (speculative).** `detectInput` returns nine kinds,
   four of which exist so the loader can parse a second time; the loader also
   encodes each adapter's option policy. Proposal: ordered registry with
   `matches`/`parse`; the loader becomes a loop; validation-only variants
   disappear. Same as first pass 3.2. The report itself marks the registry as
   the speculative part; the double-parse path is fixed separately in
   `0.6.1-hardening`.

## Smaller findings

- `src/render/html.ts:65-84` emits the German layout block for every
  non-English locale (`lang.split('-')[0] !== 'en'`), so a third locale would
  receive German-only rules. Latent today (only `en` and `de` ship). Recorded
  as B-066.
- `client-bundle.ts` has no rebuild-and-compare test, unlike `styles.ts` and
  the catalogs; `npm test` regenerates it first, so staleness stays invisible.
  Covered by first pass 2.12.
- `report.ts` is 807 lines against the noted "under about 800" decision. A size
  trigger, not a depth finding; covered by first pass 2.10.
- The outline coordinate is duplicated in `summary.ts` and
  `report/model.ts`; already B-051, no new finding.

## Where it landed

- Structure candidates stay in B-057. The filter seam and the ICU formatter are
  added to that row; the attachment ledger refines the run-facts projection; the
  output-path plan is the CLI step already in B-057's order.
- B-066 records the `:lang(de)` leak with the third-locale trigger.
- Nothing here is a 0.6.1 fix: all candidates are refactors and none corrects
  released output. The two 0.6.1 changes stay fix-only.
