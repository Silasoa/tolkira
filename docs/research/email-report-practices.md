# Email report practices: what comparable tools ship

Research note, 2026-11-20. What does a test reporter's "email" option produce,
what does it contain, and how do CI users send it? Compared: MCHR 4.6, Allure
2/3, Playwright, Cucumber, pytest-html, CI mail. Tolkira context:
one offline file, no server, no telemetry (`docs/PRODUCT.md`).

## What the tools actually do

| Tool | Artifact | Content | Sending | Locale |
| --- | --- | --- | --- | --- |
| MCHR 4.6 | `email-report.html` | KPIs, statistics, top 5 slowest | Writes file | Follows `language`, incl. RTL |
| Allure 3 `mail` | `mail.html` | Status, counts, duration, report link, CI info, failed/broken + short errors | Writes file | None |
| Allure 2 `MailPlugin` | `mail.html` | Stub ("Mail body") | None | None |
| Playwright | No official email | Third-party SMTP reporter | SMTP | English |
| Cucumber / pytest-html | No email option | Attach report or CI mail | External | English |
| CI mail steps | Body + attachments | `subject`, HTML body, report | SMTP | User |

MCHR's `emailReport` / `--email` generates `email-report.html` next to the main
report; the source renders a Liquid template and writes the file. [1][2][3] It
shows KPIs, pass percentages, a features/scenarios statistics table and the top
five slowest scenarios; there is no failed list, and the test asserts no link
back to `index.html`. [4][5] It follows `language`, including RTL. [1][5] The
template uses a 960 px container, embedded Tailwind and CDN Font Awesome: a
summary page to attach or paste, not an email-safe template. [4][17]

Allure 3's `@allurereport/plugin-mail` generates `mail.html` from MJML and does
not send: "Sending it is up to you (for example, with your CI mail step)." [6]
It shows status, pass rate, totals, duration, per-status counts, a report link,
CI build/branch/PR, and failed/broken names with short errors; `maxFailed`
defaults to 20. [6] The 640 px render has a `<mj-preview>` preheader. [7]

Allure 2's `MailPlugin` also writes `mail.html`, but its template is a stub
whose body is literally "Mail body". [8][9]

Playwright has no official email reporter; its docs link a third-party
`playwright-mail-reporter` that sends through SMTP with a default subject of
"Playwright Test Results" and optional result link/error details. [10][11]
The official Cucumber HTML formatter and pytest-html document no email option;
users attach the HTML or add a CI mail step. [12][13]

GitHub's `dawidd6/action-send-mail` requires `subject`, reads an HTML body from
a file (`html_body: file://...`) and takes `attachments`; it sends over SMTP. [14]
Jenkins `emailext` takes `subject`, `body`, `mimeType` and
`attachmentsPattern`. [15] GitLab has no per-job report mail: pipeline
notifications go to the creator at user level. [16]

## Format: HTML body, `.eml`, or report only?

The common artifact is a standalone `.html` body, not `.eml`. Both reporters
with an email artifact emit `.html`, and the CI steps consume a body (file or
string) plus attachments. [2][6][14][15] It opens in a browser for preview and
copy/paste. An `.eml` would add a real subject and open directly, but no
reviewed tool emits one and no reviewed CI step accepts one as the message
body; defer it. Attaching only the report loses the at-a-glance summary.
Recommend a summary body plus the report as a separate attachment.

## Content: aggregate plus failures, not aggregate only

The mature tools are not aggregate-only: Allure lists failed/broken tests,
MCHR lists the five slowest. [4][6] A status-only mail says "did it pass?" but
not "what do I open first?". Recommend aggregate + top five failed: title,
status, pass rate, non-zero statuses + unexecuted, executed total, features,
steps, duration, report basename, top-five (feature/scenario/status/duration)
and "and N more". Omit step bodies and errors in v1: the report has them, and
snippets add privacy, size and content rules. Five is enough because the report
is attached; Allure's 20 fits a mail that may be the only artifact. Keep the
cap constant; attachment totals only if the line stays compact.

## Recommendation

### Format

One `.html` email body. No `.eml`, SMTP, network, logo or hidden preheader in
v1. The email is the body; the report is the attachment.

### Content

As above. Use a 600 px table layout with inline styles, no scripts and no
remote images or fonts; keep it under 100 KB. Gmail clips mail HTML at about
102 KB, and clipping can break table layouts; images are often blocked. [17][18]

### CLI

Treat `--email <file>` as another output, not a mode. It works alone or with
`--out`, and composes with `--json`/`--ci`: file writes and stdout are
independent. Keep machine stdout unchanged; print "Email written to ..." only
when stdout is free. Write order: report, email, history, `--ci-out`, stdout;
reject collisions with inputs, logo, `--out`, `--ci-out`, `--history`. Accept
`--locale` with `--email`; JSON/CI-only locale stays an error. Standalone is a
real use case; its note says no report, and docs recommend `--out` first.

### Locale

Follow `--locale`. MCHR localizes its email with the same `language`, including
RTL; Allure's mail plugin has no locale option. [1][5][6] Tolkira has catalogs,
so following the report is cheap. Set `lang`/`dir`; keep test data verbatim.
The CLI, JSON and CI text stay English.

### Subject, preheader, report note

Use `{title} — {status}` for the `<title>` and visible heading, localized. An
HTML file cannot set a mail subject: document the heading for copy, and let CI
pass its own `subject` (repository plus build). Only a `.eml`/SMTP follow-up
can ship a real subject.

No hidden preheader in v1: a pasted or attached HTML body does not deliver it.
Make the first visible line the compact result; clients use the first lines as
preview when no preheader exists. [19] Add one with the `.eml`/SMTP follow-up.
With `--out`, name the report basename and say "attach or share"; without it,
say no full report was generated. No path or URL: MCHR removes links back to
`index.html`, matching Tolkira's offline promise. [5]

### Smallest first slice and follow-ups

Ship `src/email.ts` (`renderEmail`), `--email`, catalog keys, path/write safety,
unit/CLI/e2e tests and `docs/EMAIL.md` with GitHub/Jenkins recipes and the
GitLab limitation. Skip `.eml`, SMTP, logo, preheader, metadata, error snippets
and a configurable cap.

```sh
npx tolkira results/ --out report.html --email email.html --json > summary.json
```

Then use `dawidd6/action-send-mail` with `html_body: file://email.html` and
`attachments: report.html,summary.json`. [14] On Jenkins, pass the file contents
as `body`, set `mimeType: 'text/html'` and `attachmentsPattern: 'report.html'`.
[15] GitLab has no equivalent job-level step; document that limitation. [16]

Follow-ups, in order: `.eml` with a real subject; CI-native SMTP examples;
build/branch/PR metadata; a CID logo; a configurable cap or error snippets; RTL
when a locale needs it.

## Open questions

1. Is standalone `--email` a real workflow, or should the first slice require
   `--out` to avoid a mail that names no report?
2. Is five right, or configurable / closer to Allure's 20?
3. Is the first visible line enough, or add a hidden preheader for CI bodies?
4. Is `.eml` / a real subject needed sooner than a follow-up?
5. Error snippets or CI metadata: include or stay names-only?
6. Follow `--locale` for external readers, or default to English? (Recommend
   follow.) Is a GitLab recipe worth it without a native step?

## Sources

All accessed 2026-11-20.

1. MCHR options: https://multiple-cucumber-html-reporter.com/docs/options
2. MCHR CLI: https://multiple-cucumber-html-reporter.com/docs/cli
3. MCHR `generate-report.ts`, `EMAIL_REPORT_HTML` and file write: https://github.com/WasiqB/multiple-cucumber-html-reporter/blob/main/reporter/src/generate-report.ts
4. MCHR `email.liquid` template: https://github.com/WasiqB/multiple-cucumber-html-reporter/blob/main/reporter/src/templates/email.liquid
5. MCHR email test (content, top 5 slowest, no `index.html` link, RTL): https://github.com/WasiqB/multiple-cucumber-html-reporter/blob/main/reporter/src/test/unit/email-report.spec.ts
6. Allure 3 `plugin-mail` README: https://github.com/allure-framework/allure3/blob/main/packages/plugin-mail/README.md
7. Allure 3 mail renderer: https://github.com/allure-framework/allure3/blob/main/packages/plugin-mail/src/render.ts
8. Allure 2 `MailPlugin`: https://github.com/allure-framework/allure2/blob/main/allure-generator/src/main/java/io/qameta/allure/mail/MailPlugin.java
9. Allure 2 `mail.html.ftl` stub: https://github.com/allure-framework/allure2/blob/main/allure-generator/src/main/resources/tpl/mail.html.ftl
10. Playwright reporters: https://playwright.dev/docs/test-reporters
11. `playwright-mail-reporter`: https://github.com/estruyf/playwright-mail-reporter
12. Cucumber HTML formatter: https://github.com/cucumber/html-formatter
13. pytest-html user guide: https://pytest-html.readthedocs.io/en/latest/user_guide.html
14. `dawidd6/action-send-mail`: https://github.com/dawidd6/action-send-mail
15. Jenkins `emailext`: https://www.jenkins.io/doc/pipeline/steps/email-ext/
16. GitLab pipeline notifications: https://docs.gitlab.com/user/profile/notifications/#cicd-pipeline-events
17. Mailchimp HTML Email Basics: https://templates.mailchimp.com/getting-started/html-email-basics/
18. Litmus, Gmail clipping at 102 KB: https://www.litmus.com/blog/how-to-keep-gmail-from-clipping-your-emails
19. Litmus, preview text: https://www.litmus.com/blog/the-ultimate-guide-to-preview-text-support
