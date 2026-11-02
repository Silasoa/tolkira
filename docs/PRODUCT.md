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

- **Official Cucumber HTML formatter** — modern, Messages-only, single-file,
  good attachments/search/filter, but no dashboard, metadata, history,
  branding or legacy JSON.
- **multiple-cucumber-html-reporter** — active, dashboard, metadata, trends,
  i18n, multi-run, but legacy JSON only, heavier and folder-based.
- **Allure 3** — powerful history/trends/retries/quality gates, but a heavier
  static-site workflow, not a single embeddable HTML file.

There is a gap for a **lightweight, Cucumber-native, single-file report that
accepts both JSON and Messages and preserves screenshots**.

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
- Legacy JSON and Messages input, auto-detected.
- Multiple inputs/directories merged into one report.
- Legacy JSON → Messages normalisation with attachments preserved.
- Single self-contained HTML, no CDN, no network requests.
- Official Cucumber rendering components for Gherkin, steps, errors and
  attachments.
- Shell: title, metadata, summary, dark mode, logo, brand colours, basic CSS.
- Machine-readable JSON summary with a versioned schema for agents and CI.
- Search, status filters, tag filters.
- Security baseline: escaping, safe attachments, no telemetry.
- Tests with fixtures from several Cucumber implementations.

### v0.2 and later

- External attachments / split-assets mode for large media.
- History/trends via an optional history file.
- PDF/email summary.
- German UI/localisation.
- JUnit XML and Playwright JSON adapters.
- CI annotations/PR summary.
- Deeper dashboard and custom themes.

### Non-goals

- Test management, live server, trace viewer, screenshot diffing, AI analysis.
- A plugin marketplace or a SaaS.
- A 1:1 visual clone of the old Bootstrap themes.
- Owning a Gherkin renderer. The official React components are the renderer.

## Principles

- **Single file, offline, no CDN.**
- **Screenshots are first-class.**
- **Few dependencies; prefer Node built-ins and official Cucumber packages.**
- **Adapters and shell are ours; rendering is upstream.**
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
USPTO/WIPO clearance and an attorney review are required before a public
release. Tolkira is not affiliated with Cucumber or SmartBear.
