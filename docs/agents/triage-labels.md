# Triage Labels

Labels route work. They are not a spec and never replace the issue body: the
body must stand alone. Once triaged, apply exactly one area, one priority and
one readiness label. Readiness labels are exclusive; remove the previous one
when it changes, and use `wontfix` instead of a readiness label when an issue is
rejected.

## Area (one)

| Label | Use for |
|---|---|
| `area:input` | Legacy JSON, Messages, JUnit parsing, detection, loading and attachments |
| `area:report` | Report shell, rendering, search/filter, viewport and accessibility |
| `area:cli-api` | CLI options, ESM API, JSON summary and result messages |
| `area:compat` | `cucumber-html-reporter` shim, producer support and migration |
| `area:test` | Test infrastructure, fixtures, coverage and the browser suite |
| `area:build-release` | Build, packaging, dependencies, CI and release |
| `area:docs` | README, docs, glossary, ADRs and agent instructions |
| `area:meta` | Issue/backlog workflow, governance and repository hygiene |

Pick the surface the change touches, not the backlog's historical heading.
Performance work takes the surface it affects and a `perf:` title.

## Priority (one)

| Label | Meaning |
|---|---|
| `priority:p1` | Blocks the next release or a supported workflow |
| `priority:p2` | Planned for the next meaningful batch |
| `priority:p3` | Later; revisit at the next release review |

## Readiness (one)

| Label | Meaning |
|---|---|
| `needs-triage` | Default; maintainer has not evaluated it yet |
| `needs-info` | Waiting on the reporter; remove when answered |
| `ready-for-agent` | Fully specified, ready for an agent |
| `ready-for-human` | Requires human judgement, access or visual review |

## Resolution (replaces readiness)

| Label | Meaning |
|---|---|
| `wontfix` | Will not be actioned; the reason is in the issue or backlog decision |

A change reaches `ready-for-agent` only after the spec is approved and the
acceptance criteria are testable. `wontfix` is a GitHub default label; do not
create a duplicate. The default `bug`, `enhancement` and `documentation` labels
are optional; the title prefix already carries the type.
