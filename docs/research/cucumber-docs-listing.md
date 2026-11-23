# Cucumber docs listing research

Research note, 2026-11-23. Read-only: no issue, comment, discussion, PR or post
was made. The question: the official Cucumber documentation used to link
`cucumber-html-reporter`; can Tolkira get linked there, and where exactly?

## Short verdict

**There is a real venue, but it is not a launch move.** The exact place is the
third-party list on
[`cucumber.io/docs/cucumber/reporting/#third-party-plugins`](https://cucumber.io/docs/cucumber/reporting/#third-party-plugins),
edited in [`cucumber/website`](https://github.com/cucumber/website), file
`docs/cucumber/reporting.md`. The smallest change is one bullet at the end of
that list.

The premise needs a correction. cucumber.io does **not** link
`cucumber-html-reporter` today, and the archived page and the archived docs repo
give no evidence that it ever did. The only current official link found is the
**Godog README**, added in 2018 and stale. The reporting page's bare
"Masterthought" entry is the Java `cucumber-reporting` project, a different
tool.

The mechanics are proven: the maintainer of Multiple Cucumber HTML Reporter
added one bullet in PR #478 and it was merged in three days with one LGTM. The
bar is not a formal rule; it is the page's own wording, "some common third-party
plugins". Tolkira is 19 days old, has 0 stars and 1,383 npm downloads last
month. Cucumber's org-wide AI policy also forbids AI-written PR descriptions and
requires disclosure. Submit after 0.5.1 has been public for a few weeks and after
at least one awesome-list listing, with a PR body the maintainer writes
personally.

Rank: **#3 overall, #2 external after `atinfo/awesome-test-automation`**. On pure
audience fit it is the best external venue; on expected value now, the awesome
list is safer and makes the docs PR more credible.

## 1. Official properties and what they list

Checked 2026-11-23. "Legacy reporter" means `gkushang/cucumber-html-reporter`.

| Property | URL | Section / what it lists | Legacy reporter linked? |
| --- | --- | --- | --- |
| Cucumber docs, Reporting | <https://cucumber.io/docs/cucumber/reporting/> | `## Third-party plugins`, a 19-entry bullet list of reporters/formatters | **No** |
| Cucumber docs, Related tools | <https://cucumber.io/docs/tools/related-tools> | A table of "known third-party tools that work together with Cucumber", including reporting tools `cucumber-json-2-pdf`, `features2`, `Gocure` and `Cluecumber` | **No** |
| Cucumber docs, Tools index | <https://cucumber.io/docs/tools/> | Editors, IDEs, build tools | No |
| Cucumber docs, JavaScript tools | <https://cucumber.io/docs/tools/javascript> | npm and Yarn only | No |
| Cucumber docs, Java tools | <https://cucumber.io/docs/tools/java> | IDEs, Maven, Gradle | No |
| Cucumber docs, Ruby tools | <https://cucumber.io/docs/tools/ruby> | IDEs, Rake, Rails | No |
| Cucumber community | <https://cucumber.io/community/> | Discord, GitHub Discussions, Stack Overflow, social accounts | No |
| cucumber-js README | <https://github.com/cucumber/cucumber-js> | Install, get started, docs index, support | No |
| cucumber-js formatters | <https://github.com/cucumber/cucumber-js/blob/main/docs/formatters.md> | Built-in formatters and how to write a custom one | No third-party list |
| cucumber-js publishing | <https://github.com/cucumber/cucumber-js/blob/main/docs/publishing.md> | The official Cucumber Reports service | No |
| cucumber-jvm README | <https://github.com/cucumber/cucumber-jvm> | Install, docs, help, contributing | No |
| cucumber-ruby README | <https://github.com/cucumber/cucumber-ruby> | Install, usage, docs, support | No |
| Godog README | <https://github.com/cucumber/godog> | `## References and Tutorials` | **Yes**, line 300 |
| Official HTML formatter | <https://github.com/cucumber/html-formatter> | Its own formatter and integrations | No alternatives list |

### The reporting page

The page's intro sets the scope:

> This page documents built-in formatter plugins, custom formatters and some
> common third-party plugins.

and then:

> ## Third-party plugins
> There are also many third-party plugins:

The 19 entries are: Masterthought, TeamCity, TextmateFormatter, SlowHandCuke,
timestamped-scenarios, Fivemat, Fuubar, cucumber_timing_presenter,
ReportPortal.io adapter, Bilgerat, cucumber_statistics, cucumber_characteristics,
allure-cucumber, Cluecumber, Cucelastic, cucumber-reporting-plugin, Serenity/JS,
Lippia Test Manager and Multiple Cucumber HTML Reporter. None is
`cucumber-html-reporter`.

The newest entry, added 2026-11-10 by PR #478, is:

> * [Multiple Cucumber HTML Reporter](https://multiple-cucumber-html-reporter.com/): Multiple Cucumber HTML reporter is a robust reporting module that transforms standard Cucumber Messages NDJSON output and JSON output into stunning, feature-rich HTML reports. ...

The page labels the list **third-party**, not "official", "community" or
"sponsored". It is curated by the Cucumber maintainers, but a listing is
descriptive, not an endorsement.

### The related-tools page

> People have written tools on top of Cucumber. These are the known third-party
> tools that work together with Cucumber:

Its table already contains reporting-adjacent, non-plugin tools:
`cucumber-json-2-pdf` ("generate PDF reports based on cucumber json reports"),
`features2` (HTML/PDF documentation from feature files), `Gocure` (HTML reports
from Cucumber JSON) and `Cluecumber` (Maven reporting plugin). This is the
fallback venue if a maintainer says Tolkira is not a reporter plugin.

### The one official link to the legacy reporter

The Godog README, in `## References and Tutorials` (lines 300-301):

```markdown
- [cucumber-html-reporter](https://github.com/gkushang/cucumber-html-reporter),
  may be used in order to generate **html** reports together with **cucumber** output formatter. See the [following docker image](https://github.com/myie/cucumber-html-reporter) for usage details.
```

Godog is an official Cucumber project: its README calls itself "the official
Cucumber BDD framework for Golang". The link was added on 2018-02-07 in commit
`8839248` ("reference cucumber html formatter in readme #103") and has not been
touched since. It is stale: the target repository's last push is 2024-11-20 and
its last npm publish is October 2024; the linked Docker helper
`myie/cucumber-html-reporter` was last pushed 2018-02-06 and the Docker Hub API
returned 404 for that image name on 2026-11-23.

## 2. Contribution path per venue

| Venue | Path | Written rule that applies | Label | Gate |
| --- | --- | --- | --- | --- |
| `cucumber/website`, `docs/cucumber/reporting.md` | Fork, one PR; no issue required | "Each pull request should only modify/add a single topic." "The title should explain which docs you are modifying/creating and why." "Use links to external sites sparingly." | "third-party plugins" | One maintainer approval; no CODEOWNERS, no CLA |
| `cucumber/website`, `docs/tools/related-tools.md` | Same repo, one PR | Same; table is alphabetical | "known third-party tools" | Same |
| `cucumber/godog`, `README.md` | PR to godog | Godog `CONTRIBUTING.md` plus the org guide | "References and Tutorials" | One maintainer approval |
| `cucumber/cucumber-js` | No third-party list exists | `docs/formatters.md` documents built-ins and custom formatter authoring; `docs/publishing.md` documents the official service | n/a | A new section would be a docs feature, not a listing; likely rejected |
| `cucumber/cucumber-jvm`, `cucumber-ruby` | No third-party list exists | READMEs only link the official docs | n/a | Do not PR |

The website repo's
[`CONTRIBUTING.md`](https://github.com/cucumber/website/blob/main/CONTRIBUTING.md)
says:

> You can make changes to the documentation by forking this repo and making a
> pull request. The title should explain which docs you are modifying/creating
> and why. Each pull request should only modify/add a single topic. Please don't
> lump many unrelated document changes into the same pull request.

and, under writing style:

> Use links to external sites sparingly

It also links the org-wide
[`cucumber/.github/CONTRIBUTING.md`](https://github.com/cucumber/.github/blob/main/CONTRIBUTING.md),
which contains the AI rule:

> **You may not use AI in issues, pull request descriptions or discussions**
>
> Cucumber is developed and maintained by people. We read every discussion,
> issue and pull request. As such we appreciate it, if you would take time to
> communicate with us as a person.
>
> When you use AI, we require that you do the following:
>
> * **All AI usage in any form must be disclosed**
> * **You must fully understand all code.**
> * **You must be in the loop**.

There is no CLA. `cucumber/website` is MIT. There is no `CODEOWNERS` in the
repo's `.github` directory (only `renovate.json` and `workflows`), so the gate is
a normal maintainer review, not a formal docs committee.

### The precedent that matters

| PR | Tool | Target | Opened | State | Review |
| --- | --- | --- | --- | --- | --- |
| [#478](https://github.com/cucumber/website/pull/478) | Multiple Cucumber HTML Reporter, opened by its maintainer `WasiqB` | `docs/cucumber/reporting.md`, +1 line | 2026-11-07 | **Merged 2026-11-10** | One review: `mpkorstanje` "APPROVED" - "LGTM. Cheer!" |
| [#474](https://github.com/cucumber/website/pull/474) | Qase reporters, opened by `pm-morten` | `docs/tools/related-tools.md` | 2026-11-03 | **Still open on 2026-11-23** | No reviews, no comments |

#478 is the exact template: a third-party maintainer appends one bullet to the
existing list, no issue, no prior discussion, merged in three days. #474 shows
the queue is not uniformly fast: a commercial vendor's listing has sat
unreviewed for 20 days.

## 3. The legacy reporter link: what is actually there

**cucumber.io: no link, and no removal event found.** The evidence:

- The live reporting page's 19-entry list does not contain it (2026-11-23).
- Wayback snapshots of `/docs/cucumber/reporting/` from 2019-07-16,
  2020-09-19, 2021-03-04, 2021-10-19, 2023-05-19 and 2024-02-26 all return no
  match for `cucumber-html-reporter`.
- The archived docs repo `cucumber/docs.cucumber.io` (archived, last push
  2026-05-17) has no code-search hit. Its `content/docs/cucumber/reporting.md`
  at commits `56036435` (2019-08), `6422e02f` (2019-12), `c2456eee` (2021-04),
  `4396cf7d` (2023-03) and `1fdbe35d` (2024-01) contains no match.
- The earliest version of that file in the repo (`3ba2f6f2`, 2019-04-21) has no
  match either.
- Pre-2019 snapshots of `cucumber.io/docs` (2017, 2018) contain no match.
- GitHub code search for the exact phrase in the `cucumber` org returns two
  hits: the Godog README and the website `reporting.md`. The website hit is the
  substring inside `multiple-cucumber-html-reporter`, not a separate link.
- The cucumber-js README has no match at tags v0.9.0 through v8.0.0; cucumber-jvm
  at v1.2.5, v2.0.0, v4.0.0 and v6.0.0; cucumber-ruby at v2.0.0, v4.0.0 and
  v6.0.0.

So there is no removal PR to cite. The current website page was created on
2024-12-08 (`71dec4e9`, "Cucumber and terminology docs (#31)") and has only
three commits: the creation, a broken-link fix on 2024-12-19, and the MCHR
addition on 2026-11-10. The old docs repo was archived in favour of
`cucumber/website`; the old page did not carry the link in any checked revision.

The one official link that does exist is the Godog README. It is stale, as
described above. If the memory is of a Java reporter, the reporting page's bare
"Masterthought" entry refers to `cucumber-reporting`, not to `gkushang`'s Node
tool.

## 4. Does Tolkira qualify today?

| Requirement | Status | Proof |
| --- | --- | --- |
| Cucumber legacy JSON | **Yes** | README's input table: cucumber-js 2.3.1-13.3.0, Behave 1.3.3, cucumber-jvm 7.22.1, cucumber-ruby 12.0.1 fixtures |
| Cucumber Messages (NDJSON) | **Yes** | cucumber-js 11.2, cucumber-jvm 7.22.1, cucumber-ruby 12.0.1 fixtures |
| One self-contained HTML file | **Yes** | Inline CSS, JavaScript and attachments; no network requests |
| No CDN, server or telemetry | **Yes** | README privacy section and the embedded CSP |
| License | **MIT** | `LICENSE` and `package.json` (`"license": "MIT"`) |
| npm package | `tolkira` | `npm view tolkira version` -> `0.5.0`, published 2026-11-23 |
| Node | 22+ | `package.json` `"engines": { "node": ">=22" }` |
| Runtime dependencies | 3 | `@cucumber/messages`, `fast-xml-parser`, `markdown-it` |
| Repository age | 19 days | Created 2026-11-04 |
| Adoption | 0 stars, 0 forks, 0 open issues | GitHub API, 2026-11-23 |
| npm downloads | 1,383 last month | `api.npmjs.org/downloads/point/last-month/tolkira`, 2026-11-23 |
| Project website | None | GitHub and npm only |
| Independent users | None visible | No issues, no discussions, no third-party mentions found |

The technical fit is real. The page's own bar is the problem: it says "some
**common** third-party plugins", and every other entry has years of use behind
it. MCHR, the newest entry, has 1.14M npm downloads/month and its own website.

### Gaps a maintainer would object to

1. **Notability.** 19 days old, 0 stars, 1,383 downloads/month, one maintainer.
   "Come back when it has users" is a defensible reply.
2. **Taxonomy.** The section is "plugins"; Tolkira is a post-processor that reads
   result files. MCHR is also a post-processor and is listed, so this is not a
   blocker, but a maintainer may prefer `related-tools.md`.
3. **AI-generated project.** The org policy does not ban listing an AI-generated
   tool, but it does ban AI-written PR text and requires disclosure. A
   maintainer may be wary of the project on principle.
4. **No project website.** The list mostly links product sites or long-lived
   repositories; Tolkira links a 19-day-old GitHub repo.
5. **Competitive tone.** Tolkira's README calls the legacy reporter effectively
   unmaintained and compares itself to it. The docs entry must be neutral and
   must not repeat that framing.
6. **One maintainer, no community.** No issues, no discussions, no independent
   reports.
7. **Node 22+.** Not a docs objection, but it narrows the audience.

No license, security or technical blocker was found. The `cucumber-html-reporter`
compatibility shim is a plus for migration, not a reason to list Tolkira as a
formatter plugin.

## 5. The smallest edit

**Target:** `cucumber/website`, file `docs/cucumber/reporting.md`, end of the
`## Third-party plugins` list, after the Multiple Cucumber HTML Reporter bullet
(line 74 in the current file).

**Format:** a single bullet, matching the existing `* [Name](url) - Description.`
style. The list is not alphabetical; new entries are appended (that is what
#478 did).

**Proposed line:**

```markdown
* [Tolkira](https://github.com/Silasoa/tolkira) - Generates one self-contained HTML file from Cucumber legacy JSON and Messages, with inline CSS, JavaScript and attachments, and no CDN, server or telemetry.
```

**Diff:**

```diff
 * [Multiple Cucumber HTML Reporter](https://multiple-cucumber-html-reporter.com/): ...
+* [Tolkira](https://github.com/Silasoa/tolkira) - Generates one self-contained HTML file from Cucumber legacy JSON and Messages, with inline CSS, JavaScript and attachments, and no CDN, server or telemetry.
```

**PR title (write it yourself):** something like `Add Tolkira to the third-party
reporting plugins`. The title must say which docs and why, per CONTRIBUTING.

**PR body (write it yourself; do not paste this note):** state what changed (one
line, after MCHR), why (maintained offline/legacy-JSON path that also reads
Messages; MIT; npm `tolkira`), and disclose that you maintain Tolkira and that
the project is largely AI-generated under your direction. Say you are not
affiliated with Cucumber or SmartBear. Keep it short and factual.

**Which repo:** `cucumber/website` only. **Not** `cucumber-js`, **not** both.
`cucumber-js` has no third-party list; its formatter docs cover built-ins and
custom formatter authoring. A PR there would be a new section, not a listing,
and would likely be rejected as off-topic. The same applies to cucumber-jvm and
cucumber-ruby.

**Fallback:** if a maintainer says Tolkira is not a plugin, add one row to
`docs/tools/related-tools.md` instead. The table is alphabetical; `Tolkira` goes
after `Shellkin` and before `VCR`:

```markdown
| [Tolkira](https://github.com/Silasoa/tolkira) | Generates one self-contained HTML file from Cucumber legacy JSON and Messages, with inline CSS, JavaScript and attachments, and no CDN, server or telemetry. |
```

Do not open both PRs. One venue, one line, one topic.

**Optional, lower value:** a PR to `cucumber/godog` to add Tolkira beside the
stale `cucumber-html-reporter` reference. The existing link is exactly a Node
tool used to render Godog's Cucumber JSON, so the fit is not absurd, but it is a
Go project's README and reads more like drive-by promotion. Do it only if a Go
user asks, and never as the first move.

## 6. Honest risk

**The written rules are passable; the practical bar is not yet met.**

- The AI rule is a hard constraint on the *contribution*, not on the listed
  project. An AI-generated Tolkira can be listed. An AI-written PR description
  cannot be submitted. The maintainer must write the PR body personally, edit
  the one-line entry, and disclose the project's AI assistance. Pasting this
  note or a generated PR body would violate the rule.
- There is no formal "core team uses it" requirement. #478 proves a third-party
  maintainer can self-list an established open-source tool and get a one-LGTM
  merge. The page is curated, but the curation is discretionary.
- There is no CLA, no CODEOWNERS and no docs committee. One maintainer approval
  is enough.
- The "common" wording is the real gate. A 19-day-old project with 0 stars is
  easy to decline without any rule being broken. #474 shows a commercial
  vendor's listing can sit for weeks; a new AI-generated tool is more likely to
  get silence or "not yet" than a fast merge.
- A rejection is not a signal to argue. The correct response is to wait for
  adoption and resubmit later, or leave the awesome-list listings as the
  external record.

**Would an official project accept a listing for a new, largely AI-generated
tool?** On the written rules, yes, if the PR is human-written and discloses AI
use. In practice, probably not yet. The honest expectation is a maintainer
comment asking for more adoption, or no response. The project is technically
eligible; it is not yet socially eligible.

## 7. Rank against the existing placement plan

| Rank | Venue | Fit | Effort | Risk | Verdict |
| ---: | --- | --- | --- | --- | --- |
| 1 | Own GitHub release + npm + README | High | S | None | Do first; unchanged |
| 2 | `atinfo/awesome-test-automation`, `## Reporting` | High | S | Low | Primary external; unchanged |
| 3 | **cucumber.io reporting page, third-party list** | **Highest** | **S** | **Medium** | **New; after 0.5.1 and one awesome list; human-written PR** |
| 4 | `TheJambo/awesome-testing`, `### Test Report Diagnostics` | Medium | S | Low | Unchanged |
| 5 | Issue #296 comment | Medium | S | Medium | Unchanged |
| 6 | `Awesome-Cucumber` | Low | S | Low | Unchanged |
| 7 | Godog README | Low | S | Medium | Optional; only if a Go user asks |
| 8 | cucumber-js README or docs | Low | S | High | Reject; no third-party list |

The official docs page is the highest-authority external listing and the best
audience match: people reading it are already choosing a Cucumber reporter. It
ranks below `atinfo` only because the awesome list is near-certain to merge and
gives the docs PR a public adoption signal to cite. If the maintainer is willing
to wait and write the PR personally, this is the single most valuable external
venue in the plan.

Sequence: own release -> `atinfo` -> official docs -> `TheJambo` -> #296 ->
`Awesome-Cucumber`. Do not submit the docs PR on launch day.

## 8. Proof

### URLs read (2026-11-23)

- <https://cucumber.io/docs/cucumber/reporting/>
- <https://cucumber.io/docs/tools/related-tools>
- <https://cucumber.io/docs/tools/>
- <https://cucumber.io/docs/tools/javascript>
- <https://cucumber.io/docs/tools/java>
- <https://cucumber.io/docs/tools/ruby>
- <https://cucumber.io/community/>
- <https://cucumber.io/docs/contributing>
- <https://github.com/cucumber/website/blob/main/docs/cucumber/reporting.md>
- <https://github.com/cucumber/website/blob/main/CONTRIBUTING.md>
- <https://github.com/cucumber/.github/blob/main/CONTRIBUTING.md>
- <https://github.com/cucumber/website/pull/478>
- <https://github.com/cucumber/website/pull/474>
- <https://github.com/cucumber/godog/blob/main/README.md>
- <https://github.com/cucumber/cucumber-js>
- <https://github.com/cucumber/cucumber-js/blob/main/docs/formatters.md>
- <https://github.com/cucumber/cucumber-js/blob/main/docs/publishing.md>
- <https://github.com/cucumber/cucumber-jvm>
- <https://github.com/cucumber/cucumber-ruby>
- <https://github.com/cucumber/html-formatter>
- <https://github.com/Silasoa/tolkira>
- <https://www.npmjs.com/package/tolkira>

### Commands run

GitHub CLI 2.105.0, Node.js 26.13.1, npm, PowerShell, 2026-11-23:

```text
gh api repos/cucumber/website/contents/docs/cucumber/reporting.md --jq .content
gh api 'repos/cucumber/website/commits?path=docs/cucumber/reporting.md&per_page=100'
gh api repos/cucumber/website/pulls/478
gh api repos/cucumber/website/pulls/478/files
gh api repos/cucumber/website/pulls/478/reviews
gh api repos/cucumber/website/pulls/474
gh api "search/code?q=%22cucumber-html-reporter%22%20org%3Acucumber"
gh api "search/code?q=html-reporter%20repo%3Acucumber%2Fdocs.cucumber.io"
gh api "search/code?q=html-reporter%20repo%3Acucumber%2Fcucumber-js"
git clone --filter=blob:none --no-checkout https://github.com/cucumber/godog.git
git log --oneline -S 'cucumber-html-reporter' -- README.md
git show 8839248 -- README.md
npm view tolkira version time license --json
Invoke-RestMethod https://api.npmjs.org/downloads/point/last-month/tolkira
gh api repos/Silasoa/tolkira
gh api repos/gkushang/cucumber-html-reporter
gh api repos/myie/cucumber-html-reporter
```

Wayback CDX and snapshots:

```text
http://web.archive.org/cdx/search/cdx?url=cucumber.io/docs/cucumber/reporting/&output=json&fl=timestamp,statuscode,digest&collapse=digest&from=2019&to=2024
```

Snapshots checked: `20190716181015`, `20200919121145`, `20210304180557`,
`20211019072612`, `20230519170002`, `20240226173630`. No match for
`cucumber-html-reporter`. Pre-2019 snapshots of `cucumber.io/docs` (2017, 2018)
also no match.

Raw file checks:

```text
https://raw.githubusercontent.com/cucumber/docs.cucumber.io/<sha>/content/docs/cucumber/reporting.md
  at 3ba2f6f2, 56036435, 6422e02f, c2456eee, 4396cf7d, 1fdbe35d
https://raw.githubusercontent.com/cucumber/cucumber-js/<tag>/README.md
  at v0.9.0, v1.3.3, v2.3.1, v3.2.1, v4.0.0, v4.2.1, v5.1.0, v6.0.5, v7.0.0, v8.0.0
https://raw.githubusercontent.com/cucumber/cucumber-jvm/<tag>/README.md
  at v1.2.5, v2.0.0, v4.0.0, v6.0.0
https://raw.githubusercontent.com/cucumber/cucumber-ruby/<tag>/README.md
  at v2.0.0, v4.0.0, v6.0.0
```

### Key results

- `cucumber/website` PR #478: one file, +1/-0, opened 2026-11-07, merged
  2026-11-10, one approval from `mpkorstanje` ("LGTM. Cheer!").
- `cucumber/website` PR #474: open since 2026-11-03, no reviews, no comments,
  one file (`docs/tools/related-tools.md`).
- `cucumber/docs.cucumber.io`: archived, last push 2026-05-17; code search for
  `html-reporter` returns 0.
- `cucumber/website` reporting page commits: 3 total (`71dec4e9` 2024-12-08,
  `30420c28` 2024-12-19, `7f51c33f` 2026-11-10).
- Godog commit `8839248`, 2018-02-07, adds the `cucumber-html-reporter`
  reference; the line is still present at README line 300.
- `gkushang/cucumber-html-reporter`: not archived, last push 2024-11-20, 239
  stars, 92 open items.
- `myie/cucumber-html-reporter`: last push 2018-02-06; Docker Hub API 404 on
  2026-11-23.
- `tolkira`: 0.5.0, MIT, npm created 2026-11-04, last publish 2026-11-23,
  1,383 downloads last month; GitHub 0 stars, 0 forks, 0 open issues, created
  2026-11-04.

## 9. Do not

1. Do not open the PR before 0.5.1 has been public for a few weeks and at least
   one awesome-list listing exists.
2. Do not paste AI-written text into the PR description or the issue. Cucumber's
   org guide forbids it. Write it yourself.
3. Do not hide the AI assistance in the project; disclose it in the first
   paragraph of the PR body.
4. Do not open PRs to `cucumber-js`, `cucumber-jvm` or `cucumber-ruby` for a
   listing; none has a third-party list.
5. Do not open both `reporting.md` and `related-tools.md` in parallel. One
   venue, one line.
6. Do not repeat the README's "unmaintained since October 2024" framing in the
   docs entry. Keep it neutral.
7. Do not claim "official", "sponsored" or "recommended by Cucumber". The list
   is explicitly third-party.
8. Do not ask for stars, upvotes or a fast review. Do not bump the PR.
9. Do not argue if the PR is declined. Wait for adoption and resubmit later.
10. Do not link a `main` branch doc that may change; link the repository or the
    npm page.
