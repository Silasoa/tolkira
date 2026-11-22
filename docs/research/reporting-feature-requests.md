# Reporting feature requests: what users actually ask for

Research note, 2026-11-21. Which repeated requests should shape Tolkira
0.4/0.5 beyond [`PRODUCT.md`](../PRODUCT.md)? Method: all 395 issue titles
in the two Cucumber HTML reporters plus targeted searches in Allure,
Playwright, Karate and cucumber-js, checked against current Tolkira docs.
Reddit (r/softwaretesting, r/QualityAssurance, r/Playwright) was blocked
(403/429); no Reddit evidence is used.

## What repeats

| Theme | Evidence | What users ask for | Tolkira today | Call |
| --- | --- | --- | --- | --- |
| Screenshots, attachments | [gk#232](https://github.com/gkushang/cucumber-html-reporter/issues/232), [gk#124](https://github.com/gkushang/cucumber-html-reporter/issues/124), [gk#145](https://github.com/gkushang/cucumber-html-reporter/issues/145), [wasiq#43](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/43), [cuke#233](https://github.com/cucumber/cucumber-js/issues/233) | Inline images, failed-step attachment, multiple images, text/video previews, names | Images, text, video and audio inline; caps; outside-root notice; final Playwright attempt only | small 0.5 |
| History, trends | [allure#813](https://github.com/allure-framework/allure2/issues/813), [allure#347](https://github.com/allure-framework/allure2/issues/347), [allure#3470](https://github.com/allure-framework/allure2/issues/3470) | Trends, configurable run window, history that survives CI | Opt-in 30-run aggregate sidecar with a Trends tab | already; small on request |
| Retries, flaky | [gk#237](https://github.com/gkushang/cucumber-html-reporter/issues/237), [wasiq#221](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/221), [allure#2361](https://github.com/allure-framework/allure2/issues/2361), [pw#30188](https://github.com/microsoft/playwright/issues/30188) | Flaky status, rerun-passed handling, first-attempt evidence, flake rate | Final attempt visible, `Attempt: n`, `@flaky` folded into passed | small 0.5 |
| Metadata, context | [gk#219](https://github.com/gkushang/cucumber-html-reporter/issues/219), [wasiq#82](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/82), [wasiq#18](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/18), [pw#35614](https://github.com/microsoft/playwright/issues/35614), [cuke#647](https://github.com/cucumber/cucumber-js/issues/647) | Browser, build/commit, per-feature data, custom values, hide fields | `--meta`, run environment, title/logo/accent | small 0.5 |
| Themes, branding, charts | [gk#127](https://github.com/gkushang/cucumber-html-reporter/issues/127), [gk#249](https://github.com/gkushang/cucumber-html-reporter/issues/249), [wasiq#570](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/570), [wasiq#559](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/559), [pw#29552](https://github.com/microsoft/playwright/issues/29552) | Bootstrap themes, logo, dark mode, pie charts, 3-4 columns | One shell; title, metadata, logo, accent, dark mode | non-goal |
| Email, PDF, print | [allure#127](https://github.com/allure-framework/allure2/issues/127), [allure#273](https://github.com/allure-framework/allure2/issues/273), [pw#9920](https://github.com/microsoft/playwright/issues/9920), [karate#2374](https://github.com/karatelabs/karate/issues/2374) | Mail body, PDF, offline share | Email, PDF, print in main | already |
| Performance, size | [gk#188](https://github.com/gkushang/cucumber-html-reporter/issues/188), [wasiq#595](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/595), [cuke#2406](https://github.com/cucumber/cucumber-js/issues/2406), [allure#877](https://github.com/allure-framework/allure2/issues/877) | Explain 80 MB reports, heap ceiling, 500 MB JSON, 600 GB artifacts | 100/50/100 MB caps, 10 MB warning, one file | small 0.5 |
| Search, filter | [allure#642](https://github.com/allure-framework/allure2/issues/642), [wasiq#558](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/558), [pw#14487](https://github.com/microsoft/playwright/issues/14487), [gk#154](https://github.com/gkushang/cucumber-html-reporter/issues/154) | Tag/domain filters, labels, failed-only view | Text/status/tag expressions, URL state, failed-only | already |
| Responsive, a11y | [gk#293](https://github.com/gkushang/cucumber-html-reporter/issues/293), [gk#294](https://github.com/gkushang/cucumber-html-reporter/issues/294), [wasiq#417](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/417), [wasiq#634](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/634) | Readable long text, mobile, zoom | 320-1440 px, 200% zoom, focus/labels, overflow handling | already |
| CI, parallel, sharding | [gk#238](https://github.com/gkushang/cucumber-html-reporter/issues/238), [gk#272](https://github.com/gkushang/cucumber-html-reporter/issues/272), [pw#10274](https://github.com/microsoft/playwright/issues/10274), [karate#1890](https://github.com/karatelabs/karate/issues/1890), [wasiq#216](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/216) | Jenkins HTML Publisher, Azure, GitLab, merged workers, annotations | Multi-input merge, GitHub annotations + Markdown, GitLab job/artifact docs; no full-report publishing recipe | small 0.5; large if Jenkins needs no-JS |
| Localisation, RTL | [wasiq#557](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/557), [wasiq#643](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/643) | More languages, RTL | en/de; no RTL or switcher | small 0.5; RTL non-goal |
| Docs | [wasiq#662](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/662), [wasiq#601](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/601) | Current examples, migration notes | README, compatibility, I18N and PDF docs | already |

Frequency: attachment-related titles are the largest cluster, 56 of 395 (14%);
metadata 25, theme/CSS 19, parallel 9, performance 8, flaky 4, CI 4. History,
search and email barely appear as issue titles; where MCHR
(multiple-cucumber-html-reporter) ships trends, email or filters they are table
stakes; Allure/Playwright set deeper expectations.

The old reporter's Bootstrap themes, pie charts and 3-4 column layout
([gk#127](https://github.com/gkushang/cucumber-html-reporter/issues/127),
[gk#249](https://github.com/gkushang/cucumber-html-reporter/issues/249),
[wasiq#570](https://github.com/WasiqB/multiple-cucumber-html-reporter/issues/570))
are functional expectations - summary, print, branding - not pixel goals.
Tolkira already answers them; a theme gallery would not.

## Top 5 for 0.4/0.5

1. **Attachment reliability, small 0.5.** Make path attachments skipped because
   they are outside Tolkira's allowed roots visible per scenario and step, and
   surface attachments recorded on a failed hook beside the failed step. Missing
   or unreadable files inside a root and per-attachment names remain separate
   deferred warnings. Keep one inline file (ADR 0006), no split assets. Largest
   cluster; mostly diagnostics.
2. **Flaky/retry visibility, small 0.5.** Add a flaky count/badge, a flake rate
   in Trends and a disclosure for the earlier attempt's error/screenshot; keep
   folded passed status until schema v2. `Attempt: n` and `@flaky` are a start.
3. **Metadata links, small 0.5.** Render safe `http(s)` metadata as links;
   document commit, CI run URL and browser/project keys. No new schema.
4. **CI publishing, small 0.5 plus a large fallback.** Validate Jenkins HTML
   Publisher (CSP, blocked scripts), add Azure/GitLab annotations or recipes,
   document `merge-reports` for shards. Build a static all-expanded no-JS mode
   only if Jenkins fails; that part is large.
5. **Size diagnostics, small 0.5.** Add a composition line (inputs, attachments,
   report bytes), largest contributors and an earlier warning. Keep the caps and
   one-file rule; the 80/500 MB reports are often input problems.

**Hold:** themes/charts, split assets, RTL. **Do not spend:** email/PDF,
search/filter, the history baseline, responsive/a11y and en/de already match or
beat the old tools.
