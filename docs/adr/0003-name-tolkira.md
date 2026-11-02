# ADR 0003 — Name: Tolkira

- Status: accepted (working name; formal clearance pending)
- Date: 2026-11-02

## Context

The name should be easy to pronounce for international users, not tied to
Cucumber/Gherkin, and not already a software product or company. Earlier
candidates (`Silta`, `Hokoku`, `Annai`, `Tulkki`, `Klarspur`, `Wegspur`,
`Guidra` and others) were rejected because they are existing companies,
software products or trademarks.

## Decision

Use **Tolkira** as the product and package name. It is a coined name from the
Scandinavian word **“tolk”** (interpreter): a report interprets what happened
and bridges raw test events and the people who need to understand them.

Preliminary checks on 2026-11-02:

- npm package `tolkira`: free.
- GitHub user/repository `tolkira`: not found.
- Domains `tolkira.com/.de/.io/.dev/.app/.eu/.report/.net`: no resolution.
- Web search: only a dormant LiveJournal/nickname page; no software company.
- Trademark search: no results in the public web search.

This is not legal advice. Before a public release, run a formal search in
EUIPO, DPMA, USPTO and WIPO for classes 9 and 42 and obtain an attorney’s
opinion. If a conflict appears, rename before the first public release.

## Consequences

- The name is easy to say (approx. TOL-kee-rah) and not framework-specific.
- We do not intend to build a trademark moat; the goal is to avoid confusion.
- The README records the name origin and the non-affiliation with Cucumber.
