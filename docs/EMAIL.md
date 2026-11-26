# Email summary

`--email <file>` writes one self-contained HTML email summary from the same
result files and the same locale as the report. It is opt-in: without the flag
no email file is created and the one-file report default is unchanged.

The email is a small at-a-glance body for a status mail, a chat message or a CI
mail step. The full report stays the detailed artifact and, when one is written,
is attached or shared separately. Tolkira never sends mail, opens a connection or
talks to a mail server; it writes one HTML file.

```shell
# Email next to the report; the email names report.html
tolkira test-results/ --out report.html --email email.html

# Email as the only output; it states that no full report is attached
tolkira test-results/ --email email.html

# Email plus machine output; stdout stays JSON only
tolkira test-results/ --out report.html --email email.html --json > summary.json

# PDF first, then the email that names it; no report HTML
tolkira test-results/ --pdf report.pdf --email email.html

# German email without a report
tolkira test-results/ --email email.html --locale de
```

## CLI and API

`--email` is an output like `--out`, not a mode. It composes with `--out`,
`--json`, `--ci`, `--ci-out`, `--manifest` and `--pdf`, alone or together;
`--ci-out` still requires `--ci markdown`. At least one input and a non-empty email path are
required. The
CLI confirms the file with `Email written to <path>` only when stdout is free
(the email alone or with `--out`); with `--json` or `--ci` on stdout, the machine
output is unchanged and no extra line is printed. With `--ci-out`, the CI text
goes to the file, so stdout is free for the normal report and email
confirmations unless `--json` also uses stdout.

`--title` sets the heading and the suggested subject; `--accent` sets the top
border colour even when no report is written. A title that carries a branch or
build name therefore carries it into the email.

`--locale` applies to the email as well as the report and is accepted with
`--email` even without `--out`; `--pdf` is the other report-like output that
accepts `--locale`. With only `--json` or `--ci`, it remains a usage
error, and the CLI, JSON and CI text stay English.

The email path is validated like the other outputs. It must not be empty, must
not collide with an input, the logo, `--out`, `--ci-out`, `--history`, `--pdf` or
`--manifest` (resolved and case-aware on Windows and macOS), and must not be
written inside an input directory, even when the target does not exist yet or is
reached through a junction or symlink. It is written atomically after the report
and the PDF. The order is
report, PDF, email, history, `--ci-out`, manifest, stdout. On an email write
failure the CLI exits 1, names the email path, keeps an already written report,
skips the history, `--ci-out` and `--manifest`, prints no JSON/CI stdout and
leaves no temporary file behind. The
`Email written to` confirmation strips control characters from the path.

With `--pdf` the email note names the full artifact that exists: the `--out`
report when one is written, otherwise the PDF. The PDF is always written before
the email, so a PDF failure skips the email instead of naming a missing file.

Library use returns exactly the same HTML for the same summary, options and
clock:

```ts
import { renderEmail, summarizeReport } from 'tolkira';

const summary = await summarizeReport(['test-results/']);
const html = renderEmail(summary, {
  title: 'Nightly run',
  locale: 'de',
  reportName: 'report.html',
  accent: '#1b5e20',
  now: new Date('2026-11-20T09:30:00.000Z'),
});
```

| Option | Meaning |
| --- | --- |
| `title` | Suggested subject and visible heading text after escaping; default `Tolkira report` |
| `locale` | Catalog and formatting language; default `en`; unsupported tags throw |
| `reportName` | Full report name; only the basename reaches the note |
| `accent` | Hex colour validated with the report rule; invalid values are ignored |
| `now` | Generation time, labelled `Generated`; default current time |

`renderEmail` writes nothing, sends nothing and makes no request. An unrecognised
summary status falls back to the localized `Unknown` label and colour, an invalid
`now` omits the generated date instead of throwing, and `reportName` is always
reduced to its basename. There is no logo option: a report logo can be megabytes
and mail clients clip or strip it.

## What the email contains

- The title and overall status as the visible heading and suggested subject, for
  example `Nightly run — Failed`.
- The generation time (UTC, locale-formatted), labelled `Generated`. It is the
  time the email was rendered, not the run start.
- The attempted pass rate as a percentage, with a full-sentence note
  (`The pass rate counts only executed (non-skipped) scenarios.`). An
  all-unexecuted run shows
  `No scenarios attempted`, its unexecuted count and `0 scenarios with results`;
  an empty run (no scenario rows) shows `0 / 0 passed`, displays the empty state
  and omits the failed-scenarios section. The attempted-only note is hidden only
  for the empty run.
- Every non-zero scenario status with its localized label, the unexecuted count,
  and the total labelled as scenarios with results.
- Feature, step, duration and inline-attachment totals, including the raw
  attachment byte count; the attachment count is labelled `Attachments in the
  run`. English digits are grouped (`8,509 bytes`) and durations are human
  (`12 ms`, `12.3 s`, `1 min 5 s`, `1 h 2 min`); the report helpers and the JSON
  summary keep their existing numbers.
- The first five failed scenarios in summary order, with feature, scenario name,
  status and duration. The heading, note and failed names wrap anywhere, and
  displayed feature, scenario and report-name strings are capped at 200
  characters with an ellipsis, so one hostile name cannot break the layout or the
  size budget. The report has the steps, errors, tags and attachments, so the
  email omits them. More failures are a count such as `3 more failed scenarios`.
- A no-failure line keyed off the overall status: a passed run says
  `No failed scenarios.`, while a pending, undefined or unknown run names its
  status and is never called successful. An empty run shows
  `No scenarios in this run.`
- A report note and the footer.

The **top-five rule** keeps the body small and stable: the report carries the
detail when it is attached, so five rows are enough to decide what to open first.
The rows are the first five failed scenarios in summary order, not the five
slowest and not a per-feature table. The cap is fixed in this slice; it is not a
CLI option.

Allure 3's `mail` plugin takes a different trade-off: it links the hosted report,
lists up to 20 failed or broken scenarios and adds short errors. Tolkira has no
link (the email is offline and carries no URL), caps the list at five to keep the
mail small, and keeps error text out to avoid leaking failure messages and
secret material. A configurable cap and short snippets are B-026 and B-025.

With `--out`, the report note names only the basename (`report.html`) and asks
the recipient to attach or share it separately. No directory, absolute path or
URL is included. Without `--out`, the note says `No full report is attached.`;
the usage examples show the report and email pair, which is the recommended
workflow.

## Opening, copying and attaching

Open the `.html` file in a browser to preview it. To send a short mail, copy the
rendered page from the browser into the mail body; the inline styles survive in
most clients. For a complete artifact, attach `email.html` as the message body
source or attach `report.html` beside a short text body.

The HTML file has no mail headers, so it cannot set a subject by itself. The
heading is `{title} — {status}`; copy it into the subject line as the suggested
subject, or let the CI mail step derive one from the summary. A pasted body does
not carry the `<title>` element, so the visible heading is the reliable subject
text.

## Privacy and test data

The email contains feature and scenario names, statuses, counts and durations,
the title (which may carry a branch or build name) and, with `--out`, the report
basename. It does not contain step bodies, error messages, tags, attachment
content or filesystem paths. There is no redaction mode: if names are sensitive,
do not generate the email, or treat the file like the report. The footer states
that the file makes no network requests and has no tracking. Tolkira adds no
tracking pixel, remote image, font or stylesheet.

The email is inline-only by design. It counts inline attachments from the
summary, but does not embed screenshots, videos or logs. Attach the full report
for the evidence.

## Localisation and formatting

The email uses the active `--locale` catalog and sets `<html lang>` and `dir`.
Labels, counts, percentages and dates use the active locale; durations use an
email-local human form with the locale's decimal separator (`12.3 s` in English,
`12,3 s` in German). German uses `20.11.2026, 09:30 UTC`, comma decimals and
German labels, including `Vollständiger Bericht: …` and `Es ist kein vollständiger
Bericht angehängt.`. A test guards that the German report note stays fully German.
Test data and the default `Tolkira report` title render verbatim. The JSON
summary, CI text and CLI messages stay English. See [`I18N.md`](I18N.md) for the
catalog rules.

## Mail-client limits

- The template is a 600 px table (`width: 100%`, `max-width: 600px`) with inline
  styles plus a small `<style>` block that applies below 480 px. A 600 px view
  keeps the 2 by 2 metric grid; narrower views stack it. Real clients
  differ in CSS support; the table carries the layout when `<style>` is stripped.
- Gmail clips large HTML bodies at about 102 KB. A standard summary stays well
  under 100 KB because it lists five failures, not every scenario, and caps long
  names.
- Images are often blocked; this slice has no image at all, so the email renders
  completely without them.
- There is no hidden preheader in this slice. A pasted or attached body often
  drops one, so it is deferred to a sending or `.eml` follow-up rather than ruled
  out. The first visible line is the `Tolkira` eyebrow, then the heading and
  status.
- There is no automatic subject and no `.eml` draft in this slice.
- Very old clients may not support the media query, forced-colours fallback or
  system font stack; the content remains readable, the heading and note wrap
  anywhere, and names are capped at 200 characters.
- Browser preview is not a guarantee of a specific mail client's rendering.
  Check the actual client once if the mail is business-critical.

## CI mail-step example

Generate the body and the report in one step, then send them with a mail action.
The subject comes from `summary.json`, not from `job.status`: Tolkira exits 0
when tests fail, so a red run can still be a successful mail step. This GitHub
Actions sketch uses `dawidd6/action-send-mail`; the guard skips the send when the
body is missing or when a fork pull request has no mail secrets.

```yaml
- name: Generate report and email body
  if: always()
  run: >
    npx tolkira test-results/ --out report.html --email email.html
    --title "CI run" --json > summary.json

- name: Read test status
  id: status
  if: always() && hashFiles('summary.json') != ''
  run: echo "value=$(jq -r .status summary.json)" >> "$GITHUB_OUTPUT"

- name: Send status mail
  if: >-
    always() && hashFiles('email.html') != '' &&
    steps.status.outputs.value != '' &&
    (github.event_name != 'pull_request' || !github.event.pull_request.head.repo.fork)
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.example.com
    server_port: 587
    username: ${{ secrets.MAIL_USERNAME }}
    password: ${{ secrets.MAIL_PASSWORD }}
    subject: "CI run: ${{ steps.status.outputs.value }}"
    html_body: file://email.html
    attachments: report.html,summary.json
    to: qa@example.com
```

The SMTP settings and the send step belong to your CI. Tolkira only writes the
files. Jenkins `emailext` needs the HTML body as a string, the MIME type and an
attachment pattern:

```groovy
emailext(
  subject: "CI run: ${status}",
  body: readFile('email.html'),
  mimeType: 'text/html',
  attachmentsPattern: 'report.html',
  to: 'qa@example.com'
)
```

Read `${status}` from `summary.json` (`jq -r '.status'`) for the same reason.
GitLab has no job-level report mail action; use its pipeline notifications or a
generic SMTP step and attach the same files.

## Out of scope and follow-ups

- **Sending and SMTP:** never part of Tolkira. Use a CI mail step or your mail
  client.
- **`.eml`:** a real subject and a directly openable draft are a local follow-up
  (B-023); the first slice is an HTML body because that is what CI mail steps
  consume.
- **Logo or any image:** omitted; a small capped variant is B-024.
- **`--meta` in the email:** not included; build/branch/PR metadata or short
  error snippets are B-025.
- **Hidden preheader:** deferred with `.eml` or a sending path, not impossible.
- **Error snippets or a configurable failed-scenario cap:** B-026; the report has
  the detail.
