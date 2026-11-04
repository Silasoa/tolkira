# Proposal

## Why

The current report is the official Cucumber HTML formatter with a thin Tolkira
header. It is functional but visually indistinguishable from the upstream
formatter, and its permanent three-column shell is too heavy for the common
case. Teams want a simple, presentable report first, with deeper analysis only
when they ask for it.

## What Changes

- Replace the official formatter shell with a Tolkira-owned, server-rendered
  report:
  - simple single-column report as the default;
  - optional Analysis tab for run details and the stable agent JSON;
  - feature and scenario disclosures, failed-first open state, inline
    screenshots, doc strings, data tables and errors;
  - no React runtime and no `@cucumber/html-formatter` dependency.
- Keep the existing CLI/API, input adapters, security policy, attachment
  handling and JSON summary.
- Keep one accessible theme with logo/accent and system dark mode. Old reporter
  themes are explicitly out of scope; a theme system may come later.
- Add stress and browser coverage for the new shell.

## Capabilities

### Modified Capabilities

- `report-rendering`: replace the upstream formatter shell with a Tolkira-owned
  simple report and an Analysis tab.

## Impact

- Removes `@cucumber/html-formatter` from runtime dependencies.
- Adds a report view model between Messages and HTML.
- Updates generated HTML, unit tests, browser tests and the Seed-Test
  comparison screenshots.
- No change to input formats, legacy adapters, CLI flags or the JSON summary
  schema.
- Archive this change after `bootstrap-tolkira-core`; it modifies the
  `report-rendering` capability introduced there.
