# Tolkira placement research

Research note, 2026-11-23. Read-only: no comment, issue, discussion, PR or post
was made. The question: where can Tolkira be mentioned without spam, and what
is the actual state of `gkushang/cucumber-html-reporter`?

## Short answer

- **Do not comment in #265.** It is a 2023 maintainer-handover thread, not an
  "is this project maintained?" thread. The maintainer replied in it, granted
  collaborator access, and the thread died on a publish-access and dependency
  dispute. A tool mention there is off-topic and easy to read as opportunistic.
- **The only defensible GitHub thread is #296, "Is this project still alive?"**
  It has zero comments since 2024-08-08 and its title matches the maintenance
  question people search for. Even there: one short, factual comment at most,
  after 0.5.1, with disclosure, and no bumping.
- **#303, #254, #167 and #259 are evidence for the README, not venues.** Each
  asks this project for a fix; "use my tool" does not answer the request and
  reads as an advert in someone else's bug tracker.
- **Reddit is not a launch venue here.** r/QualityAssurance rule 1 is "No
  product advertising. This includes tools, courses, etc". r/softwaretesting
  restricts direct and indirect promotion. A linkless answer in a matching
  question is the only safe use.
- **Show HN is rejected.** Hacker News explicitly forbids generated text in
  posts and comments. An AI-generated submission with an AI-generated first
  comment violates the venue, regardless of disclosure.
- **Best external venues by section fit are awesome lists**, in this order:
  `atinfo/awesome-test-automation` (its JavaScript `## Reporting` section
  already lists `cucumber-html-reporter`), then `TheJambo/awesome-testing`
  (`### Test Report Diagnostics`), then `virajkulkarni14/Awesome-Cucumber`
  (topical but stale since 2021). One PR per list, never a batch. TheJambo has
  the faster queue; atinfo has the better section.

The brief's instinct is right: answer the maintenance question where it is
actually asked. The thread is #296, not #265, and the correct number of
third-party comments is one, not one per gap thread.

## Positioning in one paragraph

Tolkira is the offline, one-file report for teams that already have Cucumber
results and cannot or will not run a report server. It is strongest exactly
where the old reporter is weakest: legacy JSON that still has to work, delivery
without a CDN, screenshots and attachments that survive the file move, and a
stable JSON summary for CI and agents. It is not a dashboard, not a theme
clone, and not an unqualified drop-in: the compatibility shim is asynchronous,
ignores `theme`, and requires Node.js 22+. Place it as the migration path for
legacy-JSON teams that need one portable artifact, not as a replacement for
`multiple-cucumber-html-reporter`'s dashboard or the official formatter's
Messages-only workflow. The honest sentence is: "Same input, one offline file,
plus Messages/JUnit/Playwright and a machine-readable summary; here is exactly
what the shim does not reproduce."

## 1. The actual state of `gkushang/cucumber-html-reporter`

Facts checked 2026-11-23 through the GitHub API and npm:

| Item | Value |
| --- | --- |
| Repository | `gkushang/cucumber-html-reporter`, MIT, not archived, default branch `develop` |
| Stars / forks | 239 / 157 |
| Open items | 92 total: 88 issues + 4 pull requests |
| Last push | 2024-11-20 |
| Last commit on `develop` | 2024-11-04 (merge of a Dependabot `es5-ext` bump) |
| Last GitHub release / tag | `6.0.0`, 2023-03-03 |
| Last npm publish | `7.2.0`, 2024-10-01 |
| npm downloads, last 30 days | 2,310,946 (2026-10-24 to 2026-11-22) |
| GitHub Discussions | Not enabled (`has_discussions: false`) |
| Local contribution rules | No `CONTRIBUTING.md` or `CODE_OF_CONDUCT.md`; `.github/` contains only workflows |

The figures are a snapshot; re-check stars and downloads before quoting them in
a public comment. The dates and the #265/#296 contents are stable.

**Correction to the brief:** 6.0.0 is the last *GitHub release and tag*, not the
last release overall. npm has 7.2.0 from 2024-10-01, published without a GitHub
release and without a CHANGELOG entry; the CHANGELOG's newest entry is 6.0.0
(March 2023). Do not write "no release since 2023" in a public comment. Write
"last npm publish October 2024; last GitHub release March 2023". The README's
"unmaintained since October 2024" refers to the npm publish, and is defensible;
the 2023 claim is not.

### #265 "Maintainer of Project"

- Opened 2023-01-23 by `larryg01`, 9 comments, last comment 2023-03-16, still
  open.
- The body asks for control of the project because "nothing has been done with
  this project for a year".
- `gkushang` replied, sent a collaborator invite, published 5.5.1, then 6.0.0
  after `larryg01` asked for npm publish access.
- The last exchange is a dispute: `larryg01` says the dependency versions were
  rolled back, so "v6.0.0 is not v6.0.0 as per my upgrade"; no one replies
  after 2023-03-16.
- It is a **failed/partial handover thread**, not a maintenance-status poll.
  The maintainer is present in it. A third-party tool announcement here is
  off-topic under GitHub's acceptable-use rules and would be read as exploiting
  a stalled handover.

### #296 "Is this project still alive?"

- Opened 2024-08-08 by a community user; body: "Just checking if anyone is
  still supporting this project..."
- 0 comments, still open. This is the actual maintenance question, and it is
  the public thread whose title matches it.

### Gap threads: useful evidence, wrong venues

| Thread | State | What it asks | Why it is not a Tolkira venue |
| --- | --- | --- | --- |
| [#303](https://github.com/gkushang/cucumber-html-reporter/issues/303) "update dependencies cucumber 9.1.2 and uuid 3.3.3 to newer" | Open, 0 comments, 2025-01-24 | Update old `glob`, `inflight`, `uuid`, `reflect-metadata` and the Cucumber 9 dependency chain | It asks the maintainer to update *this* package. Tolkira having three modern runtime dependencies is not an answer to the request; a reply is an advert in a security thread. |
| [#254](https://github.com/gkushang/cucumber-html-reporter/issues/254) "Support 'Rule' Keyword and ndjson" | Open, 3 comments, last 2022-04-13 | Replace the JSON parser with NDJSON and add Gherkin `Rule` | The thread already points to the official React components; it is four years old and answered. Tolkira's Messages/Rule support is context, not a reply. |
| [#167](https://github.com/gkushang/cucumber-html-reporter/issues/167) "Offline report" | Open, 3 comments, last 2020-05-19 | Reports that do not rely on external resources behind a corporate proxy | It asks for this package to be fixed, not for a different package. A 2019 thread is the definition of necro-promotion. |
| [#259](https://github.com/gkushang/cucumber-html-reporter/issues/259) "VPN is blocking deprecated Bootstrap CDN" | Open, 0 comments, 2022-04-20 | Update the Bootstrap CDN URLs | Same: a fix request for this package, not a tool recommendation thread. Tolkira's no-CDN design is evidence for the README, not a comment here. |

There are newer open items too (for example #306, a 2025 CWE-506 heads-up about
`es5-ext`). None of them is a "what should I use instead?" thread. Do not turn a
security or dependency report into a product mention.

## 2. Adjacent projects: do not point at the wrong venue

`multiple-cucumber-html-reporter` is abbreviated MCHR below.

| Project | Activity on 2026-11-23 | Model | Why it is not a Tolkira venue |
| --- | --- | --- | --- |
| [`WasiqB/multiple-cucumber-html-reporter`](https://github.com/WasiqB/multiple-cucumber-html-reporter) | 287 stars, 124 forks, 4 open items, last release `4.7.0` on 2026-11-22, last commit 2026-11-22, 1.14M npm downloads last month, Discussions enabled | Active; dashboard, metadata, multi-run, report folder, i18n | It is an active competitor with its own roadmap and community. A Tolkira mention in its tracker or Discussions is competitor promotion and will be removed. Its users are also a different segment: they chose the dashboard/folder model. |
| [`cucumber/html-formatter`](https://github.com/cucumber/html-formatter) | 21 stars, 6 forks, 17 open items, last release `24.4.0` on 2026-11-15, last commit 2026-11-23, 16.6M npm downloads last month | Official Cucumber project; Messages-only, one file | Its issue tracker is for the official formatter. A third-party tool mention is off-topic and can look like trading on the official name. The right integration is Tolkira's own `CucumberHtmlStream` compatibility, documented in Tolkira, not a comment there. The low star count understates reach: the package ships through the official Cucumber implementations, which is why downloads are 16.6M/month. |
| [`Silasoa/tolkira`](https://github.com/Silasoa/tolkira) | 0 stars, 0 forks, 0 open issues, 1,383 npm downloads last month, `0.5.0` published 2026-11-23, Discussions not enabled | Active, one maintainer, AI-assisted | The only place a launch post is unambiguously welcome. It is also very new; external posts must not pretend there is a community or adoption yet. |

The takeaway: MCHR and the official formatter are the *wrong* venues precisely
because they are healthy, active projects. Do not frame Tolkira as a rival to
either; frame it as the offline/legacy-JSON path that neither covers.

## 3. Posting rules and etiquette

### GitHub issues and comments

Sources: [GitHub Acceptable Use Policies](https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies)
and [GitHub Community Guidelines](https://docs.github.com/en/site-policy/github-terms/github-community-guidelines).

- §2 forbids content that is "off-topic, or interacts with platform features in
  a way that significantly or repeatedly disrupts the experience of other
  users".
- §4 forbids "spamming", "bulk distribution of promotions and advertising", and
  "inauthentic interactions".
- §10 is explicit: "You may not advertise in other Users' Accounts, such as by
  posting monetized or excessive bulk content in issues." Promotional text is
  allowed in your own README/project description.
- `gkushang/cucumber-html-reporter` has no local `CONTRIBUTING.md` or
  `CODE_OF_CONDUCT.md`, so platform rules are the only written rules.

A single, free, on-topic answer in #296 is the most that fits. A comment in #265
or in the four gap threads does not. If a comment is removed, do not repost.

### GitHub Discussions

- `gkushang/cucumber-html-reporter`: **no Discussions tab**.
- `Silasoa/tolkira`: **no Discussions tab**.
- `WasiqB/multiple-cucumber-html-reporter`: Discussions exist, but it is a
  competitor's community.

There is no Discussions venue for this plan. Do not enable Discussions on
Tolkira just to announce 0.5.1; an empty Discussions tab is not a community.

### Reddit

Reddit's sitewide Reddiquette says: read the rules of a community before
posting, post to the most appropriate community, and "feel free to post links to
your own content (within reason). But if that's all you ever post... you just
might be a spammer. A widely used rule of thumb is the 9:1 ratio".

Subreddit-specific rules, checked through mirrors because Reddit returned 403
to this environment:

| Subreddit | Rule relevant to Tolkira | Verdict |
| --- | --- | --- |
| r/QualityAssurance | Rule 1: "No product advertising. This includes tools, courses, etc". Rules checked 2026-10-27 by the mirror. | **Reject as a venue.** A free open-source tool is still a tool; a launch post is product advertising. |
| r/softwaretesting | Public description: "No direct or indirect promotion for commercial software testing tool, services, training or…". The mirror marks self-promotion as restricted (last read 2026-08-17) and recommends answering without a link. | **No launch post.** A linkless answer in a matching question is defensible; a link only if the person asks. Do not post the draft as a standalone thread. |

Caveat: the Reddit pages themselves were blocked (403), so the quotes come from
third-party mirrors and a search snippet, not from Reddit directly. Verify the
sidebar while logged in before posting anything. If the rule is ambiguous, do
not post.

### Hacker News / Show HN

Sources: [Show HN guidelines](https://news.ycombinator.com/showhn.html) and
[HN guidelines](https://news.ycombinator.com/newsguidelines.html).

- Show HN is for something you made that people can try, ideally without
  signups. The project should be non-trivial and personal, and you should be
  around to discuss it.
- The guidelines are explicit: "Please don't put generated text in HN posts.
  Write your text yourself" and "Don't post generated text or AI-edited text."
  They also forbid soliciting upvotes or comments.
- Tolkira itself qualifies as a tryable project; the **AI-generated message does
  not**. A compliant Show HN would require the maintainer to write the title and
  first comment personally. The code being AI-generated can be disclosed; the
  text being AI-generated cannot be posted.

### Awesome lists

| List | Size / activity | Contribution rules | Fit |
| --- | --- | --- | --- |
| [`atinfo/awesome-test-automation`](https://github.com/atinfo/awesome-test-automation) | 7,232 stars, last push 2025-11-28, 129 open PRs | Fork; add/edit the section; add the section title to the TOC for a new section; search duplicates; format `* [project-name](url) - A short description ends with a dot.`; spelling and no trailing whitespace; send one PR. | **Best section fit, slow queue.** `javascript-test-automation.md` has a `## Reporting` section that already lists `cucumber-html-reporter`; Tolkira can sit beside it as the offline/legacy-JSON alternative. The 129-PR backlog and the last push in November 2025 mean slow review, not high rejection risk. |
| [`TheJambo/awesome-testing`](https://github.com/TheJambo/awesome-testing) | 2,428 stars, last push 2026-11-21, 2 open PRs | One PR per suggestion; description short, descriptive, ending with a full stop; search duplicates; contribution is public domain under CC0. | **Best active list.** The `### Test Report Diagnostics` section is a natural home. Active list, short queue; this is the faster first merge. |
| [`virajkulkarni14/Awesome-Cucumber`](https://github.com/virajkulkarni14/Awesome-Cucumber) | 46 stars, last push 2021-09-22, 3 open PRs | One PR per suggestion; title case; format `[List Name](link)`; add to the bottom of the relevant category; useful title and commit body with a repository link. | **Low.** Topical, but stale since 2021 and small. Worth one PR only after the first two; do not expect traffic. |
| [`mxschmitt/awesome-playwright`](https://github.com/mxschmitt/awesome-playwright) | 1,621 stars, last push 2026-11-17, 15 open PRs | `CONTRIBUTING.md` is a placeholder; README has a `## Reporters` section. | **Optional / likely reject.** Tolkira consumes Playwright JSON but is not a Playwright reporter. Listing it as a reporter is arguable; wait until a Playwright user asks. |

Every awesome-list PR must be one entry, in the existing format, at the bottom
of the right section. Disclose AI assistance in the PR body. Do not open PRs to
three lists on the same day, and do not ask the maintainers to hurry.

## 4. Ranked venues

Fit is how well the audience matches the legacy-JSON/offline job; effort is the
work to do it properly; risk is the chance of removal, a ban, or reputational
damage.

| Rank | Venue | Fit | Effort | Risk | Rule check | Exact target | Verdict |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Own GitHub release + npm + README | High | S | None | GitHub AUP §10 allows promotion in your own account | `v0.5.1` tag, release notes, npm page, README "Migrating" | **Do first.** This is the landing page every other venue links to. |
| 2 | `atinfo/awesome-test-automation`, `## Reporting` | High | S | Low | One PR, format with trailing period, no duplicates, TOC only for a new section | `javascript-test-automation.md`, after the `cucumber-html-reporter` line | **Primary external venue.** |
| 3 | `TheJambo/awesome-testing`, `### Test Report Diagnostics` | Medium | S | Low | One PR, short description ending with a period, CC0 | `README.md`, bottom of the section | **Second external venue.** |
| 4 | Issue #296 comment | Medium | S | Medium | GitHub AUP §10; one on-topic answer, no bulk, no bump | https://github.com/gkushang/cucumber-html-reporter/issues/296 | **Optional, once, after 0.5.1 and the own channels.** |
| 5 | `Awesome-Cucumber`, `## Tools, Libraries & Frameworks` | Low | S | Low | One PR, title case, bottom of category, link in commit body | `README.md` | **Optional last.** Stale list. |
| 6 | r/softwaretesting, direct answer only | Low | S | High | No direct or indirect promotion; restricted | Only a matching question thread; no standalone post | **Conditional, no launch.** |
| 7 | Issue #265 | Low | S | High | Off-topic in a handover thread; AUP §2/§10 | https://github.com/gkushang/cucumber-html-reporter/issues/265 | **Reject.** Do not post the requested draft. |
| 8 | #303, #254, #167, #259 | Low | S | High | Each is a fix/feature request for this package; a tool mention is not an answer | n/a | **Reject.** Use as README evidence only. |
| 9 | r/QualityAssurance | Low | S | High | Rule 1: no product advertising, including tools | n/a | **Reject.** |
| 10 | Show HN | Medium | M | High | No generated text; no vote solicitation | n/a | **Reject** for an AI-generated submission. |
| 11 | MCHR tracker / Discussions | Low | S | High | Competitor's community; off-topic | n/a | **Reject.** |
| 12 | Official `cucumber/html-formatter` issues | Low | S | High | Official tracker; third-party tool off-topic | n/a | **Reject.** |
| 13 | GitHub Discussions | n/a | n/a | n/a | No tab on the target repo or Tolkira; MCHR's tab is the competitor's | n/a | **Unavailable.** |

Rank is fit, not submission timing; the launch sequence below handles the queue.

## 5. Launch sequence

The brief proposed: 0.5.1, then the maintenance thread, then own channels, then
lists. One change: **own channels belong to the 0.5.1 release, before the
maintenance thread.** Otherwise the comment sends strangers to a version that
has not been announced anywhere.

### Step 0 — prepare 0.5.1 (no posts yet)

- Finish 0.5.1; confirm `npm view tolkira version` returns 0.5.1.
- Confirm the published package still exposes
  `tolkira/compat/cucumber-html-reporter` for both `import` and `require`.
- Re-run the migration snippet from the README against a real legacy JSON file
  and a CommonJS consumer. The README already says the shim exists; the release
  must not contradict it.
- Write release notes that lead with the user-visible change and link to the
  compatibility doc. Do not claim themes, dashboard parity or a full drop-in.
- Confirm the published tarball includes the compat files
  (`npm view tolkira exports`, then a clean install in a scratch project); do
  not publish with a dirty tree.
- Prepare a 60-second snippet for the posts:

  ```shell
  npm i -D tolkira
  npx tolkira reports/cucumber.json --out report.html --title "Checkout"
  ```

### Step 1 — own channels (release day)

- GitHub release `v0.5.1` with the notes and the snippet.
- npm page inherits the README; make sure the "Migrating from
  cucumber-html-reporter" section is visible and accurate.
- Optional: one pinned issue in Tolkira's own repo, "0.5.1 feedback", if you
  want a single thread for early users. Do not enable Discussions for this.
- No external comment yet. Let the release exist for a few days.

### Step 2 — the one maintenance-thread comment (after 0.6.1)

- Post **once** in #296, not #265.
- Re-check the three dates, and that the thread is still open and unlocked,
  immediately before posting.
- Use the #296 draft below. Disclosure first. State the dates, not a verdict.
- Do not bump, do not reply to yourself, do not post the same text in #303,
  #254, #167 or #259.
- If a maintainer asks you to remove it, remove it and do not repost.
- If the comment is removed by moderation, do not appeal in the thread; use
  GitHub support only if you believe it was a mistake.

### Step 3 — awesome lists (week 2 onward)

- Start with `atinfo/awesome-test-automation`: its `## Reporting` section is the
  exact fit, even though the 129-PR queue is slow.
- If there is no response after two weeks, submit the `TheJambo/awesome-testing`
  PR in parallel. The lists are independent and one entry each is not a batch.
- Then `Awesome-Cucumber` only if the first two went well. Skip
  `awesome-playwright` unless a Playwright user asks for it.
- Disclose AI assistance in each PR body. Keep the entry factual; no "best",
  "fastest", "revolutionary" or competitor comparisons.

### Step 4 — community answers (ongoing, reactive only)

- r/softwaretesting: answer a matching question without a link; add the link
  only if the person asks. Do not create a standalone post.
- r/QualityAssurance: no post; rule 1.
- Hacker News: no AI-generated submission. If the maintainer wants to write a
  Show HN personally, that is a separate decision; the title can be reused, but
  the text must be human-written.
- Any other community: do not improvise. Check the rules first; if in doubt,
  don't post.

### Step 5 — measure without telemetry

- npm downloads per week, GitHub stars/forks, issues opened, and which input
  format the issues mention.
- Do not add analytics, pixels or telemetry to the report. The product promise
  is stronger than the measurement.
- If an awesome-list PR is rejected for notability, do not argue; come back
  after real adoption.

## 6. Do not

1. Do not post the #265 draft. It exists only because the brief asked for it.
2. Do not comment in #303, #254, #167, #259 or any other bug/feature thread
   with a tool link. Those threads ask for fixes to this package.
3. Do not post in MCHR's tracker or Discussions. It is an active competitor's
   community.
4. Do not post in `cucumber/html-formatter` issues. It is the official project's
   tracker.
5. Do not post a launch post in r/QualityAssurance (rule 1) or r/softwaretesting
   (restricted). A linkless answer is the only safe Reddit use.
6. Do not post AI-generated text on Hacker News. HN forbids generated text in
   posts and comments.
7. Do not ask for upvotes, stars, boosts or "support". No vote rings, no
   friends-and-family upvotes.
8. Do not cross-post the same text or open awesome-list PRs in a batch. One
   venue at a time.
9. Do not say "drop-in replacement", "full parity" or "same themes". Say
   "compatibility shim: async `generate()`, `theme` ignored, Node 22+".
10. Do not say "no release since 2023". npm 7.2.0 was published in October
    2024; the last GitHub release is 6.0.0 from March 2023.
11. Do not call the old maintainer negligent or the project "dead" as a verdict
    in a public comment. State dates and let readers decide.
12. Do not imply affiliation with Cucumber, SmartBear or Seed-Test. The README
    already says Tolkira is independent.
13. Do not post before 0.5.1 is on npm; do not link to `main` docs that may
    change. Link the release tag or the npm page.
14. Do not include customer data, local paths, tokens, private fixtures or
    screenshots with browser chrome in any post or issue.
15. Do not DM maintainers, scrape email addresses or send unsolicited mail.
16. Do not enable Discussions just to announce; an empty tab is not a venue.
17. Do not bury the AI disclosure behind a link; keep it in the first paragraph.
18. Do not argue if a post is removed. One factual appeal at most, then stop.

## 7. Drafts

Every draft below discloses both the AI-generated code and the AI-generated
message. The README already has a "How this is built" section; the drafts repeat
the disclosure in the first paragraph so it is not buried behind a link. The
status line says whether the draft is safe to post.

### A. Comment for `gkushang/cucumber-html-reporter` #265

**Status: do not post.** This is the draft the brief asked for, kept for the
record. The thread is a 2023 handover dispute, not a maintenance-status poll;
the comment is off-topic there. If one GitHub comment is posted, use draft B in
#296 instead.

```text
**Disclosure:** I maintain Tolkira, an open-source alternative to this
reporter. Its code is largely AI-generated under my direction (I set the scope
and approve releases), and this comment was drafted with AI and reviewed by me
before posting. I am not asking for maintainer access, and this is not a
criticism of the people who maintain this project.

I found this thread while checking the project's status. For the record: the
last npm publish is 7.2.0 (October 2024), the last GitHub release is 6.0.0
(March 2023), and the last push to the repository was in November 2024. The
open threads about offline/CDN assets (#167, #259), Messages/ndjson and Rule
(#254) and old dependencies (#303) describe the gaps I kept hitting.

I built Tolkira for that gap. It reads the same legacy Cucumber JSON, plus
Messages, JUnit XML and Playwright JSON, and writes one self-contained HTML
file with inline CSS, JavaScript and attachments: no CDN, no server, no
telemetry. There is a compatibility subpath,
`tolkira/compat/cucumber-html-reporter`, with an async `generate()`. It is a
shim, not a drop-in replacement: `theme` is ignored with a warning, every call
returns a promise, and Node.js 22+ is required.

Repo: https://github.com/Silasoa/tolkira
npm: https://www.npmjs.com/package/tolkira

If it fits your pipeline, try it. If it does not, please open an issue with the
input shape that fails; a small sanitized fixture is the most useful thing to
attach. No reply is needed here.
```

### B. Comment for #296 "Is this project still alive?"

**Status: the only defensible GitHub comment.** Text final for 0.6.x. Post
once, after 0.6.1 is on npm, with no bump, and only after re-checking the
three dates in the text. If the thread is locked, the thread has gone
off-topic, or the maintainer objects, do not post.

```text
**Disclosure:** I maintain Tolkira, an open-source alternative to this
reporter. Its code is largely AI-generated under my direction (I set the scope
and approve releases), and this comment was drafted with AI and reviewed by me
before posting. I am not a maintainer of this project.

To answer the question factually: the last npm publish is 7.2.0 (October 2024),
the last GitHub release is 6.0.0 (March 2023), and the last push to the
repository was in November 2024. I cannot speak for the maintainer.

I built Tolkira for the gap this thread describes. It reads the same legacy
Cucumber JSON, plus Messages, JUnit XML and Playwright JSON, and writes one
self-contained HTML file with inline CSS, JavaScript and attachments: no CDN,
no server, no telemetry. It also has a static no-JS report form for email and
print, opt-in history trends, and a baseline comparison against a previous
`--json` summary. There is a compatibility subpath,
`tolkira/compat/cucumber-html-reporter`, with an async `generate()`. It is a
shim, not a drop-in replacement: `theme` is ignored with a warning, every call
returns a promise, and Node.js 22+ is required.

Repo: https://github.com/Silasoa/tolkira
npm: https://www.npmjs.com/package/tolkira

If you need a maintained path, try it. If it does not fit, open an issue with
the input shape that fails; a small sanitized fixture is the most useful thing
to attach. No reply is needed here.
```

### C. Reddit-style post

**Status: do not post as a standalone thread in r/QualityAssurance or
r/softwaretesting.** r/QualityAssurance bans product advertising and
r/softwaretesting restricts promotion. Use this only in a community whose rules
allow tool posts, or adapt it into a linkless answer in a matching question
thread. Do not post the same text in both subreddits.

Title:

```text
I maintain an offline, single-file HTML report for Cucumber, JUnit and Playwright results (open source, AI-assisted)
```

Body:

```text
Disclosure first: I maintain Tolkira. The code and docs are largely
AI-generated under my direction (I set the scope and approve releases), and
this post was drafted with AI and edited by me. Tolkira is MIT, free, and not
affiliated with Cucumber or SmartBear.

The problem I kept hitting: the common Cucumber HTML reporter loads Bootstrap,
jQuery and Google Charts from CDNs and only reads legacy JSON. Reports break
offline, behind a proxy, or in a CI viewer, and teams still on legacy JSON have
no maintained single-file path. The official formatter is excellent but
Messages-only; the dashboard reporters are a different shape.

Tolkira reads legacy Cucumber JSON, Messages (NDJSON), JUnit XML and Playwright
JSON, and writes one HTML file with inline CSS/JS/attachments. It has search,
status/tag filters, a failed-first view, a JSON summary for CI/agents, and a
compatibility subpath for `cucumber-html-reporter` (`generate()` is async and
`theme` is ignored; it is a shim, not a drop-in).

What it is not: a dashboard, a multi-run server, a theme gallery, or a full
parity clone. Node.js 22+; one report is one locale (en/de); JUnit is basic;
very large media still hits the one-file limits.

If you have a legacy JSON file, `npx tolkira results/ --out report.html` is the
whole setup. If it does not fit, please open an issue with the input shape that
fails.

Repo: https://github.com/Silasoa/tolkira
npm: https://www.npmjs.com/package/tolkira
```

### D. Show HN title and first comment

**Status: do not post.** HN forbids generated text in posts and comments. This
draft would violate the venue even with disclosure. A compliant Show HN
requires the maintainer to write the title and comment personally; the code
being AI-generated can still be disclosed. Keep this only as a structure for a
human-written version.

Title:

```text
Show HN: Tolkira - one offline HTML report for Cucumber, JUnit and Playwright results
```

First comment:

```text
Hi HN, I maintain Tolkira.

Disclosure: the code and documentation are largely AI-generated under my
direction (I set the scope and approve releases), and this comment was drafted
with AI and reviewed by me.

I built it after spending too long with Cucumber HTML reports that load
Bootstrap, jQuery and Google Charts from CDNs. The report looks fine on a
laptop and breaks in an offline runner, behind a proxy, or in a CI viewer. The
official formatter solves the Messages case but not legacy JSON; the dashboard
reporters solve a different problem.

Tolkira takes legacy Cucumber JSON, Messages, JUnit XML or Playwright JSON and
writes one self-contained HTML file: inline CSS/JS, inline attachments where
available, no CDN, no server, no telemetry. It also has a JSON summary for CI
and agents, and a compatibility subpath for `cucumber-html-reporter`
(async `generate()`, `theme` ignored, Node 22+).

Try it with `npx tolkira results/ --out report.html`; no signup. What I would
most like feedback on: offline/attachment edge cases, and whether the
legacy-JSON migration path is clear. What it does not do: dashboards, themes,
external attachment folders, full formatter parity.

Repo: https://github.com/Silasoa/tolkira
```

### E. Awesome-list entry and PR description

**Primary target:** `atinfo/awesome-test-automation`, file
`javascript-test-automation.md`, section `## Reporting`, after the
`cucumber-html-reporter` line. One entry, description ends with a period.

Entry:

```markdown
* [Tolkira](https://github.com/Silasoa/tolkira) - Offline single-file HTML reports for Cucumber legacy JSON, Messages, JUnit XML and Playwright JSON, with a stable JSON summary.
```

PR title:

```text
Add Tolkira to JavaScript reporting
```

PR body:

```text
Adds Tolkira, an MIT-licensed CLI/API that writes one self-contained HTML
report from Cucumber legacy JSON, Messages (NDJSON), JUnit XML and Playwright
JSON. It is a maintained offline path for teams still on legacy JSON, and it
ships a compatibility subpath for `cucumber-html-reporter`.

Disclosure: I maintain Tolkira. Its code and docs are largely AI-generated
under my direction (I set the scope and approve releases), and this PR
description was drafted with AI and reviewed by me.

It belongs in `## Reporting` beside `cucumber-html-reporter`, whose JSON it can
consume. It is not a dashboard or a replacement for the folder-based reporters.

Checklist: one entry, bottom of the section, short description ending with a
period, no trailing whitespace.
```

**Second target:** `TheJambo/awesome-testing`, `README.md`,
`### Test Report Diagnostics`. The list's contribution is public domain under
CC0; the PR body should state that agreement.

Entry:

```markdown
* [Tolkira](https://github.com/Silasoa/tolkira) - Offline single-file HTML reports for Cucumber legacy JSON, Messages, JUnit XML and Playwright JSON.
```

PR body addendum:

```text
This entry is one line under `### Test Report Diagnostics`, with a short
description ending in a full stop. I agree that the contribution is public
domain under the list's CC0 terms. Disclosure: I maintain Tolkira; the code is
largely AI-generated under my direction (I set the scope and approve releases),
and this description was drafted with AI and reviewed by me.
```

**Third target (optional):** `virajkulkarni14/Awesome-Cucumber`, `README.md`,
`## Tools, Libraries & Frameworks`, bottom of the category, title case.

Entry:

```markdown
- [Tolkira](https://github.com/Silasoa/tolkira) - Offline single-file HTML reports for Cucumber legacy JSON, Messages, JUnit XML and Playwright JSON.
```

PR body addendum:

```text
Adds one entry at the bottom of `## Tools, Libraries & Frameworks`. Disclosure:
I maintain Tolkira; the code is largely AI-generated under my direction (I set
the scope and approve releases), and this PR text was drafted with AI and
reviewed by me. The commit body contains the repository link as the
contribution guide asks.
```

## 8. Sources and proof

Local documents read on 2026-11-23:

- `README.md`
- `docs/COMPARISON.md`
- `docs/PRODUCT.md`
- `docs/research/reporter-users.md`
- `docs/research/reporting-feature-requests.md`
- `docs/research/0.5-scope.md`
- `GLOSSARY.md`
- `docs/CHANGELOG.md`
- `package.json`

Commands run (GitHub CLI 2.105.0, npm, PowerShell, 2026-11-23):

- `gh api repos/gkushang/cucumber-html-reporter --jq '{...}'`
- `gh api repos/gkushang/cucumber-html-reporter/releases --jq '.[] | {...}'`
- `gh api repos/gkushang/cucumber-html-reporter/issues/265`
- `gh api repos/gkushang/cucumber-html-reporter/issues/265/comments`
- `gh api repos/gkushang/cucumber-html-reporter/issues/296`
- `gh api repos/gkushang/cucumber-html-reporter/issues/303`
- `gh api repos/gkushang/cucumber-html-reporter/issues/254`
- `gh api repos/gkushang/cucumber-html-reporter/issues/167`
- `gh api repos/gkushang/cucumber-html-reporter/issues/259`
- `Invoke-RestMethod https://api.github.com/repos/gkushang/cucumber-html-reporter/issues?state=open`
  (88 non-PR issues, 4 PRs)
- `gh api 'repos/gkushang/cucumber-html-reporter/commits?sha=develop&per_page=5'`
- `gh api repos/gkushang/cucumber-html-reporter/contents/`
- `gh api repos/gkushang/cucumber-html-reporter/contents/.github`
- `git ls-remote --tags https://github.com/gkushang/cucumber-html-reporter.git`
- `gh api repos/WasiqB/multiple-cucumber-html-reporter --jq '{...}'`
- `gh api repos/WasiqB/multiple-cucumber-html-reporter/releases`
- `gh api 'repos/WasiqB/multiple-cucumber-html-reporter/commits?per_page=3'`
- `gh api repos/cucumber/html-formatter --jq '{...}'`
- `gh api repos/cucumber/html-formatter/releases`
- `gh api 'repos/cucumber/html-formatter/commits?per_page=3'`
- `gh api repos/Silasoa/tolkira --jq '{...}'`
- `gh api repos/Silasoa/tolkira/releases`
- `npm view cucumber-html-reporter version time.modified dist-tags maintainers repository --json`
- `npm view tolkira version exports dependencies peerDependencies --json`
- `Invoke-RestMethod https://api.npmjs.org/downloads/point/last-month/<package>`
  for all four packages
- `gh api repos/virajkulkarni14/Awesome-Cucumber/contents/CONTRIBUTING.md`
- `gh api repos/virajkulkarni14/Awesome-Cucumber/contents/README.md`
- `gh api repos/TheJambo/awesome-testing/contents/CONTRIBUTING.md`
- `gh api repos/TheJambo/awesome-testing/contents/README.md`
- `gh api repos/atinfo/awesome-test-automation/contents/CONTRIBUTING.md`
- `gh api repos/atinfo/awesome-test-automation/contents/javascript-test-automation.md`
- `gh api repos/mxschmitt/awesome-playwright/contents/README.md`
- `gh api repos/mxschmitt/awesome-playwright/contents/CONTRIBUTING.md`
- `gh api 'repos/.../pulls?state=open&per_page=100'` for the awesome-list
  queues
- `gh api 'search/issues?q=repo:<list>+is:pr+is:open'` for the exact open-PR
  totals (129 / 2 / 3 / 15)

URLs read:

- https://github.com/gkushang/cucumber-html-reporter
- https://github.com/gkushang/cucumber-html-reporter/issues/265
- https://github.com/gkushang/cucumber-html-reporter/issues/296
- https://github.com/gkushang/cucumber-html-reporter/issues/303
- https://github.com/gkushang/cucumber-html-reporter/issues/254
- https://github.com/gkushang/cucumber-html-reporter/issues/167
- https://github.com/gkushang/cucumber-html-reporter/issues/259
- https://github.com/WasiqB/multiple-cucumber-html-reporter
- https://github.com/WasiqB/multiple-cucumber-html-reporter/discussions
- https://github.com/cucumber/html-formatter
- https://github.com/cucumber/html-formatter/issues
- https://github.com/Silasoa/tolkira
- https://www.npmjs.com/package/cucumber-html-reporter
- https://www.npmjs.com/package/tolkira
- https://news.ycombinator.com/showhn.html
- https://news.ycombinator.com/newsguidelines.html
- https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies
- https://docs.github.com/en/site-policy/github-terms/github-community-guidelines
- https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette
- https://rankhog.com/subreddits/qualityassurance
- https://www.replyhey.com/subreddits/softwaretesting
- https://github.com/virajkulkarni14/Awesome-Cucumber
- https://github.com/TheJambo/awesome-testing
- https://github.com/atinfo/awesome-test-automation
- https://github.com/mxschmitt/awesome-playwright

Reddit caveat: direct requests to `reddit.com`, `old.reddit.com` and
`api.reddit.com` returned 403 or a login wall in this environment. The
subreddit rule text above comes from Rankhog, ReplyHey and a DuckDuckGo snippet,
not from Reddit itself. Re-check the sidebar while logged in before posting.

## 9. Open questions

- Will 0.5.1 contain anything that changes the migration snippet or the compat
  shim? Re-check before posting; the drafts link to the released version, not
  to `main`.
- Is one GitHub comment in #296 worth it for a 0-star project? It is on-topic
  and public, but the thread is old and quiet. If the answer is no, the correct
  fallback is own channels plus awesome lists, with no third-party tracker
  comment at all.
- Do the awesome-list maintainers accept a young project with 0 stars? The
  technical fit is real, but notability is their call. A rejection is not a
  signal to argue; wait for adoption.
- Does the maintainer want to write a human Show HN later? That is the only
  compliant HN path; do not use the AI draft.
