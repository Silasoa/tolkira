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
   history and flaky analytics stay Advanced.
4. **UI direction.** A is the base. The lead record is removed; thumbnails are
   in the rows (also mobile); search opens matching features; the mobile
   feature header is fixed. The production shell still needs the A refinement.
5. **Product facts.** Allure 3 supports single-file through the Awesome plugin;
   `multiple-cucumber-html-reporter` 4.x reads Messages. `PRODUCT.md` is
   corrected. The wedge is the combination, not single-file alone.
6. **Styling.** No Tailwind. The report is one HTML string with inline CSS,
   ~20 components and a 15 KB stylesheet; Tailwind would add a build step,
   content scanning of TypeScript template strings and safelists for dynamic
   status classes. Plain CSS tokens plus `DESIGN.md` are easier for agents.
7. **Cucumber versions.** Legacy JSON from cucumber-js 2.3.1, 3.2.1, 4.2.1,
   5.1.0, 6.0.7, 7.3.2 and 13.3.0 is tested with real producer output. Behave
   1.3.3 is tested with a real run; seconds are normalised. cucumber-jvm/ruby
   still need real fixtures. 1.x/0.x are best effort.
8. **Behave.** A real Behave 1.3.3 fixture and the seconds-to-milliseconds fix
   are in. A real run with attachments and doc strings is still outstanding.

## Remaining work

- Real cucumber-jvm and cucumber-ruby fixtures; update the compatibility
  matrix.
- Real Behave run with attachments/doc strings.
- Production UI: implement the A refinement in `src/render` with unit and
  browser tests.
- AI-first exports: per-scenario JSON, “copy failure for agent”, multi-select,
  visible action menu.
- Release checklist and changelog before any npm publication.
