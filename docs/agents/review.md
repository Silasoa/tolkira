# Review & Audit Protocol (Tolkira)

Purpose: independent verification of every code change before it is pushed. No
worker is trusted on its own report, and no single agent (including the
coordinator) is the only adversarial check.

## Gates at a glance

| Stage | Gate | Shape |
| --- | --- | --- |
| Issue draft | IR — Issue Review | one independent subagent, before posting |
| Spec/design | PIR + DXR | parallel, before code |
| Implementation | SCR + CR + DAR (+ triggered) | parallel, blind |
| User-facing report feature | CMP | before merge |

## Rule: docs-only skips review, everything else is reviewed

- **Docs/comments only** (markdown, comments, changelog, specs, ADRs): no
  review. The coordinator reviews and the gate runs.
- **Anything else** (code, config, prompts, generated assets, fixtures):
  the standard reviewer set runs before push. There is no “small code change”
  exemption.

## Principle: blind review

Reviewers receive the SPEC (or change intent) and the DIFF only — never the
implementer's self-report. The coordinator assembles the inputs (spec + `git
diff`) and spawns the reviewers. Reviewers are read-only.

## Issue review gate (before posting)

The coordinator or a worker drafts the issue, then one independent subagent
runs a short **IR — Issue Review**. This is not the full spec swarm. It applies
to maintainer- and agent-created issues; incoming community issues get the same
checks at triage.

IR checks:

- **Real and durable.** The work is not already fixed, duplicated by another
  issue, or decided in `docs/BACKLOG.md`, and it is not better kept as an
  intake item; it has value beyond the current session.
- **One coherent change.** It is not an umbrella mixing unrelated work. A
  batch uses a meta issue with a checklist or separate sub-issues.
- **Agent-actionable.** A fresh agent can act from the body alone: context,
  scope, non-goals, testable acceptance criteria, verification, spec/change
  link and the file surface.
- **Public-safe.** No secrets, tokens, private paths, customer data, personal
  contact data, internal-only working rules, or security-sensitive
  reproduction details that should not be public.
- **Consistent.** Title prefix, one `area:*`, one `priority:*` and one
  readiness label match `triage-labels.md`; the issue does not claim
  `ready-for-agent` without a spec.

The reviewer returns blockers and optional improvements. The coordinator fixes
blockers before posting and never posts with an open blocker. A material edit
to a posted issue re-runs the check.

## Standard reviewer set (parallel, blind)

- **SCR — Spec-Compliance.** Every acceptance criterion is met AND actually
  exercised by a test; no scope creep; nothing “weg-refactored”. Audits the
  tests: they must fail when the behaviour is wrong.
- **CR — Code Review.** Correctness, type-safety, error handling, dead code,
  repo standards. Uses the `code-review` skill.
- **DAR — Documentation & Agent-Readability.** Docs are accurate and current
  after the change, and a fresh agent could pick the change up from the repo:
  README, AGENTS, GLOSSARY, specs, ADRs, changelog, code comments.

## Pre-implementation spec gate (parallel, before code)

Run this small swarm over the proposal, spec delta and design before
implementation starts. It is a quick pass, not the full post-implementation
review.

- **PIR — Parity & Vision.** Compare the planned behavior with the official
  Cucumber HTML formatter first, then the legacy reporter, MCHR, Allure and
  Playwright. Check feature/vision parity, over-promises, missing edge cases
  and scope that should wait.
- **DXR — Developer Experience & Integration.** Check how teams actually use
  the tool: CLI, ESM API, CI artifacts, the compatibility shim and Seed-Test
  2.0. Check the summary contract, integration tests and docs an integrator
  needs.

Blockers are fixed in the spec before code. The post-implementation CMP review
still runs for every user-facing report feature.

## Triggered reviewers

- **SEC — Security.** Always for input parsing, attachment handling, HTML
  injection, file output, path handling or dependency changes. Checks XSS,
  MIME/size handling, HTML/SVG execution, traversal, no network/telemetry.
- **UXR — UI/UX.** Report shell, empty/error states, screenshot viewing,
  keyboard/contrast, mobile/print.
- **CMP — Competitor/Parity.** Always for a user-facing report feature.
  Compare the shipped slice with the official Cucumber HTML formatter first,
  then MCHR, Allure and Playwright on the same fixture. Use
  `docs/research/cucumber-html-parity.md`; report concrete gaps, regressions
  and what not to copy.
- **ILA — i18n/Localization.** UI strings, user-facing text, translations and
  key parity. Not relevant until localisation ships.
- **STR — Structure/Test-Health.** Checks module and folder logic, agent- and
  human-friendly layout, and whether the test suite is sufficient without
  being bloated. Runs at least once per change.
- **MKT — Market/Drop-in.** Checks whether Tolkira is publicly positioned as an
  open drop-in alternative for AI agents and teams migrating from legacy HTML
  reporters. Findings inform README/positioning, not the OpenSpec contract.
  Runs before a release, not as a merge blocker.
- **PCA — Performance/Complexity.** At least every third merged code change,
  and always for hot paths, large-report handling, streaming or memory.
- **PSA — Prompt/Skill Auditor.** When prompts, LLM-facing instructions or
  generated agent/skill logic are touched.

## Rules

- The gate (`npm run hygiene` + typecheck + lint + test + build + e2e) must be
  green before review; reviewers re-run what they can.
- A reviewer reports findings; the coordinator decides. No finding may be
  dropped silently: it is fixed, filed as a GitHub issue, or recorded as a
  decision with a trigger in `docs/BACKLOG.md`.
- A finding that is deferred or rejected without an issue needs a written
  reason in `docs/BACKLOG.md`; “not now” alone is not a decision.
- Rejection loop: a failing review spawns a fixer worker (not the coordinator,
  not the implementer of record), who inherits the findings; then re-review.
- Keep a small running counter of code changes since the last PCA run; when it
  reaches 3, PCA runs regardless.
- The user approves the merge/archive/release. Workers never archive.
- Docs-only work stays cheap; code review is not optional.
