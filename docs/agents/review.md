# Review & Audit Protocol (Tolkira)

Purpose: independent verification of every code change before it is pushed. No
worker is trusted on its own report, and no single agent (including the
coordinator) is the only adversarial check.

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
- **PCA — Performance/Complexity.** At least every third merged code change,
  and always for hot paths, large-report handling, streaming or memory.
- **PSA — Prompt/Skill Auditor.** When prompts, LLM-facing instructions or
  generated agent/skill logic are touched.

## Rules

- The gate (`typecheck + lint + test + build + e2e`) must be green before
  review; reviewers re-run what they can.
- A reviewer reports findings; the coordinator decides. If the coordinator
  overrides a finding, the reason is logged in the issue or commit.
- Rejection loop: a failing review spawns a fixer worker (not the coordinator,
  not the implementer of record), who inherits the findings; then re-review.
- Keep a small running counter of code changes since the last PCA run; when it
  reaches 3, PCA runs regardless.
- The user approves the merge/archive/release. Workers never archive.
- Docs-only work stays cheap; code review is not optional.
