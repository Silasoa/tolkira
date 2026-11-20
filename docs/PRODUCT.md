# Tolkira — Product Context

## Vision

One embeddable, offline HTML report for every test result that matters —
starting with the two Cucumber formats teams actually have: legacy JSON and
modern Messages.

A good report answers five questions in under thirty seconds:

1. Did everything pass?
2. What failed, and why?
3. What did it look like? (screenshot, video, log)
4. Can I find the relevant scenario quickly?
5. Can I share one file with someone else?

Everything else is secondary.

## The problem

The de-facto open-source report for Cucumber JSON,
`cucumber-html-reporter`, is effectively unmaintained:

- last release October 2024;
- 92 open issues;
- old runtime dependencies, including a second copy of Cucumber 9;
- Bootstrap 3/jQuery/Google Charts loaded from CDNs;
- legacy JSON only.

The alternatives each solve one part:

- **Official Cucumber HTML formatter** - modern, Messages-only, single-file,
  good attachments/search/filter, but no legacy JSON, dashboard, metadata,
  history or branding.
- **multiple-cucumber-html-reporter** - active, dashboard, metadata, trends,
  i18n, multi-run; reads Messages in 4.x, but still folder-based, with
  single-file support only planned.
- **Allure 3** - powerful history/trends/retries/quality gates; can produce a
  single file through the Awesome plugin, but the default workflow is a heavier
  static site.

There is a gap for a **lightweight, Cucumber-native, one-small-file report that
accepts both legacy JSON and Messages, preserves screenshots, and adds an
agent-readable summary without a server or telemetry**. Single-file output alone
is no longer a differentiator - the official formatter and Allure both offer
it. The gap is the combination.

## Audience

- Teams with existing cucumber-js, cucumber-jvm, cucumber-ruby, Behave, Behat,
  Reqnroll or Karate pipelines.
- Consultancies and platforms that embed reports in their own UI (iframe,
  `srcdoc`, CI artefact).
- CI engineers who need one offline file and no server.
- Teams migrating from legacy JSON to Messages at their own pace.
- AI agents and CI tools that need the test outcome as structured data, not only
  as a human-readable page.

## Jobs to be done

- “Show me the failed scenario and its screenshot without opening five tools.”
- “Give me one HTML file I can attach to a ticket or CI run.”
- “Keep our old JSON reports working while we move to Messages.”
- “Add our logo, title and environment metadata without forking a UI.”
- "Do not send our test data to a third party."
- "Give my agent a stable summary it can read without scraping HTML."

## Scope

### v0.1 — hybrid report core

- CLI and API.
- Legacy JSON, Messages and JUnit XML (basic) input, auto-detected.
- Multiple inputs/directories merged into one report.
- Legacy JSON → Messages normalisation with attachments preserved.
- Single self-contained HTML, no CDN, no network requests.
- Official Cucumber Messages as the data model; Tolkira owns the report shell
  and the simple Gherkin/step presentation.
- Shell: title, metadata, summary, dark mode, logo, brand colours, basic CSS.
- Machine-readable JSON summary with a versioned schema for agents and CI.
- Search, status filters, tag filters.
- Security baseline: escaping, safe attachments, no telemetry.
- Tests with fixtures from several Cucumber implementations.

### v0.2 — triage overview

- Exception-first Report list: non-passing features and scenarios first.
- A "Needs attention" index with counts and links into the collapsed detail.
- Feature rows with passed/attempted counts and proportion bars.
- Feature-by-status matrix in Details.
- Source strip for multi-file runs with real provenance.
- Batched CLI edge fixes from the 0.1.2 audit.

### v0.4 — Playwright input (in main)

- Native Playwright JSON adapter: projects, file/describe rules, retries with
  the final attempt visible, nested steps, expected/unexpected outcomes,
  attachments and run-level errors.

### CI output (in main)

- `--ci github` annotations and `--ci markdown` summary text for stdout,
  `$GITHUB_STEP_SUMMARY`, a PR step or `--ci-out`; see [`CI.md`](CI.md).

### History and trends (in main)

- Opt-in `--history <file>` sidecar with up to 30 aggregate runs and a Trends
  tab from the second run; aggregate-only data, one CLI writer, no server and no
  scenario-level history.

### Localisation (in main)

- `--locale en|de` localizes the report shell, labels and accessibility text;
  English is the default. Test data, Gherkin keywords, attachment content and
  names, metadata and URIs render unchanged in every locale; the JSON summary
  and CI text stay English. `de-AT` uses the German catalog and keeps its `lang`
  tag. One report is one locale: no detection, switcher or RTL layout.

### Print (in main)

- Browser print/Save as PDF for the complete text and screenshot archive: all
  present views and every detail with JavaScript, a light palette from dark
  mode, fitted tables and page breaks. An active filter still narrows the Report
  view, so clear it for the whole run. Without JavaScript the active Report
  prints with closed details unchanged. The failed-only filter plus print is the
  failures-only archival print. Browser headers/footers and page numbers stay
  user-controlled; video/audio do not print and unusually wide matrices may need
  landscape. No PDF engine, print button or custom page numbers.

### Email summary (in main)

- Opt-in `--email <file>` writes one self-contained HTML mail body from the
  summary: title/status, attempted pass rate (percentage with a full-sentence
  note), every non-zero status plus unexecuted, counts, duration, inline
  attachments and the first five failed scenarios in summary order. It follows
  `--locale`, names the report basename or states that no full report is attached, has no image,
  script, link or remote asset, keeps a standard summary under 100 KB and never
  sends mail. The full report, when generated, is attached or shared separately.

### v0.3 and later

- External attachments / split-assets mode for large media (ADR 0006).
- A PDF engine (#13c); the print slice covers the browser route meanwhile.
- An `.eml` draft with a real subject (B-023), a capped logo (B-024), optional
  metadata or error snippets (B-025) and a configurable failed-scenario cap
  (B-026).
- Deeper dashboard and custom themes.

### Non-goals

- Test management, live server, trace viewer, screenshot diffing, AI analysis.
- Sending mail: SMTP, recipients or scheduling are outside the local file
  baseline; Tolkira writes the summary and the user's mail step sends it. A
  local `.eml` draft is a follow-up (B-023), not a sending feature.
- A plugin marketplace or a SaaS.
- Posting PR comments or calling a CI provider API on the user's behalf.
- A 1:1 visual clone of the old Bootstrap themes.
- Owning a Gherkin parser. Messages remain the model; the report shell and
  presentation are ours.

## Principles

- **Single file, offline, no CDN.**
- **Screenshots are first-class.**
- **Few dependencies; prefer Node built-ins and official Cucumber packages.**
- **Adapters, view model and shell are ours; the input model is official
  Cucumber Messages.**
- **Security and privacy at the boundary.**
- **Spec first, tests first, small vertical slices.**
- **MIT; no telemetry; no lock-in.**

## Market evidence

- `cucumber-html-reporter`: ~2.1M downloads/month despite being effectively
  unmaintained. Demand for single-file reports with screenshots is real.
- `multiple-cucumber-html-reporter`: ~815k downloads/month and active. Demand
  for dashboards, metadata, multi-run and branding is real.
- `@cucumber/html-formatter`: ~10.8M downloads/month, bundled into official
  Cucumber implementations. Messages and standalone HTML are the standard.
- Playwright and pytest-html set the UX bar: self-contained reports,
  environment metadata, filters, retries, attachments and CSP awareness.
- Godog (official Cucumber for Go) points users to the old reporter for HTML —
  evidence that the gap is not limited to JavaScript.

## Success signals

- A user can generate a report from a real legacy JSON file in one command.
- Screenshots survive the legacy adapter.
- A report contains no external asset requests and no telemetry.
- An agent can read the JSON summary and identify every failing scenario
  without parsing HTML.
- A group report can merge multiple runs without losing scenarios.
- The first external user can generate a report without reading the source.
- The package stays small and the dependency count stays low.

## Name

**Tolkira** is a coined name from the Scandinavian word **“tolk”**
(interpreter). A report interprets what happened; it bridges raw test events
and the people who need to understand them.

Preliminary checks (not legal advice): npm name free, GitHub user/repo not
found, domains not resolving, no trademark search results. Formal EUIPO/DPMA/
USPTO/WIPO clearance and an attorney review have not been completed. Do not
treat the name as trademark-cleared. Tolkira is not affiliated with Cucumber or
SmartBear.
