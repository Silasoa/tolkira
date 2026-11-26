# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three audiences are equally important:

- developers and QA opening a failed run from CI: find the failure, read the
  error, inspect the screenshot, share the file;
- CI engineers embedding the single HTML artifact in a build, iframe/`srcdoc`
  or an artefact store;
- AI agents and CI tools reading the versioned JSON summary instead of
  scraping HTML.

## Product Purpose

Tolkira turns Cucumber legacy JSON and modern Messages (plus JUnit and
Playwright inputs) into one self-contained HTML report and a stable JSON
summary. Success means five questions answered in under thirty seconds: did
everything pass, what failed and why, what did it look like, can I find the
scenario, can I share one file.

## Positioning

The lightweight Cucumber-native report that combines both input generations,
embedded screenshots, one offline file with no server, CDN or telemetry, and
an agent-readable summary. The official formatter and Allure each solve part
of that; the combination is the gap.

## Operating Context

Used after a CI run, in a browser, often offline or attached to a ticket or
chat. Opened on desktop and mobile; printed or exported to PDF for reviews;
embedded in dashboards via iframe or `srcdoc`. Teams migrate from legacy JSON
to Messages at their own pace. Full product context lives in
`docs/PRODUCT.md`.

## Capabilities and Constraints

- One self-contained HTML file; no network request, no CDN, no server, no
  telemetry.
- Legacy JSON, Messages, JUnit XML (basic) and Playwright JSON; auto-detected;
  multiple inputs merged.
- Attachments (screenshots, logs) inline; path attachments restricted to
  configured roots.
- Search, status/tag filters, triage overview, details, trends from a history
  sidecar, static no-JS mode, print/PDF/email.
- JSON summary with a versioned schema for agents and CI.
- i18n en/de; report chrome localized, test data always verbatim.
- Host matrix: Chromium, Firefox and WebKit; 320, 390, 768, 1024 and 1440 px,
  plus 320 px at 200 % text zoom.

## Brand Commitments

The name Tolkira and the existing report identity; no marketing look inside
the report; status is text and colour; no decoration that competes with the
evidence.

## Evidence on Hand

Real fixtures and demo reports under `test/` and `docs/comparison/`;
committed screenshots of the current shell; parity and benchmark research
under `docs/research/`. No commercial claims, customers or benchmarks may be
invented.

## Product Principles

- Evidence first: the failure, its screenshot and its error are part of the
  result, not decoration.
- One file, no network: portability and privacy are product features.
- Familiar over clever: the report is a work surface; the tool disappears into
  the task.
- Density with air: compact rows for comparison, never cramped.
- Accessible by default: WCAG 2.2 AA, keyboard, reduced motion, 200 % zoom.

## Accessibility & Inclusion

WCAG 2.2 AA; no colour-only status; keyboard focus; reduced motion; 200 %
page and text zoom; no horizontal page scroll; 320 px width.
