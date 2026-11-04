# Decisions and remaining work

2026-11-04. The earlier open questions are resolved. This is a decision log,
not a backlog of questions.

## Resolved

1. **Compatibility shim.** The `cucumber-html-reporter` helper shipped
   (`22b85f7`) and stays experimental. No `multiple-cucumber-html-reporter`
   helper or CLI `compat` unless real demand appears. In an AI-assisted
   workflow, rewriting an integration script is cheap; the shim is a
   migration aid, not the moat.
2. **Framework breadth.** The cheap breadth shipped: a **basic JUnit XML
   mode** for non-Cucumber frameworks. No Playwright JSON, CTRF, Allure-results
   or TRX adapters now. Cucumber-native depth remains the product.
3. **Analysis tab.** Rename to **Details** in v0.1; add an environment block
   (producer, runtime, OS, CPU, protocol, user metadata). Charts, trends,
   history and flaky analytics stay Advanced. Within-run retry flakiness is
   cheap because Messages keep the attempts; cross-run flakiness needs the
   history file and stays out of 0.2.
4. **UI direction.** A is the base. The lead record is removed; thumbnails are
   in the rows (also mobile); search opens matching features and scenarios; the
   mobile feature header is fixed. The A refinement is implemented in
   production, including the screenshot lightbox and a verified 200 % text-zoom
   pass.
5. **Product facts.** Allure 3 supports single-file through the Awesome plugin;
   `multiple-cucumber-html-reporter` 4.x reads Messages. `PRODUCT.md` is
   corrected. The wedge is the combination, not single-file alone.
6. **Styling.** No Tailwind. The report is one HTML string with inline CSS,
   ~20 components and a 15 KB stylesheet; Tailwind would add a build step,
   content scanning of TypeScript template strings and safelists for dynamic
   status classes. Plain CSS tokens plus `DESIGN.md` are easier for agents.
7. **Cucumber versions.** Legacy JSON from cucumber-js 2.3.1, 3.2.1, 4.2.1,
   5.1.0, 6.0.7, 7.3.2 and 13.3.0 is tested with real producer output. Behave
   1.3.3 is tested with a real run; seconds are normalised. cucumber-jvm 7.22.1 and cucumber-ruby 12.0.1
   are tested with real runs. 1.x/0.x are best effort.
8. **Behave.** A real Behave 1.3.3 fixture and the seconds-to-milliseconds fix
   are in. A real run with attachments and doc strings is still outstanding.
9. **Release.** v0.1.0 was published on npm with provenance on 2026-11-04. A
   staged publish requires a maintainer 2FA approval; the workflow stages, the
   maintainer approves. The npm README is refreshed by 0.1.1.
10. **0.1.1 hardening.** Tag filter, search highlighting, “copy failure”, CI
    screenshot artifacts and JUnit XML edge cases are in. v0.1.1 was published
    on npm with provenance. v0.1.2 is published with the Linux/macOS npm bin
    symlink fix, numeric XML-entity decoding and the 320 px tag-filter fix.
    Deprecating 0.1.1 needs a 2FA-gated npm action. Visual pixel baselines
    remain a follow-up.

## Remaining work

- Real Behave run with attachments/doc strings.
- Real-world large report (10k scenarios or a sanitized team report) and a
  browser search/filter timing check.
- Visual regression baselines after the shell is stable; CI screenshot
  artifacts are in place.
- Pixel baselines for the new tag filter, search highlight and copy action.
- 0.1.3 candidate: CLI edge fixes (logo without `--out`, non-finite/negative
  Messages durations, empty Messages diagnostics) once they are batched with
  another user-facing fix.
- Hierarchical overview: inline run/source/feature/scenario summary with
  failed/pending first, optional map/compact lenses, matrix in Details. See
  `docs/research/hierarchy-overview.md` and `docs/research/report-ui-patterns.md`.
- AI-first exports: per-scenario JSON, multi-select and a visible action menu.
