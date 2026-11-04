# Tolkira — Agent Governance

Project: Tolkira — an open-source, embeddable HTML report generator for
Cucumber legacy JSON and modern Messages. The core promise: one self-contained
file, screenshots included, no CDN, no server, no telemetry.

## Read first (onboarding)

- `docs/PRODUCT.md` — vision, audience, scope, non-goals, market context.
- `docs/ARCHITECTURE.md` — system shape and key decisions.
- `docs/AGENT-INTERFACE.md` — JSON summary schema, CLI/API contract and limits.
- `docs/agents/review.md` — review and audit protocol.
- `docs/agents/issue-tracker.md` — GitHub issue conventions.
- `docs/agents/triage-labels.md` — label vocabulary.
- `GLOSSARY.md` — shared language.
- `openspec/config.yaml` — project context and artifact rules.
- The active `openspec/changes/<change>/` contract before touching code.

## Working mode

Spec first, tests first, small vertical slices.

- A change starts with an OpenSpec proposal, a spec delta with acceptance
  criteria, a design, and tasks.
- No production code before the user approves the spec.
- A task is implemented test-first (RED → GREEN) and ends with a working
  end-to-end slice, not a layer.
- Use ISTQB-inspired test design for edge cases: equivalence classes,
  boundary values, decision tables, state transitions, pairwise combinations.
- Keep the dependency surface small. Prefer Node built-ins and the official
  Cucumber packages. A new runtime dependency needs a written reason in the
  change.
- Performance and report size are product requirements, not polish.
- The user's creativity and judgement channel is the grilling pass. Product
  and scope questions are explicit user decisions; the coordinator decides only
  small, reversible things.

## Roles

- **Coordinator (root):** plans, decides small things, spawns workers,
  integrates, closes issues. Writes no production code.
- **Implementer:** TDD, one vertical slice per change.
- **Independent reviewers:** blind review, see `docs/agents/review.md`.
  Standard set: SCR (Spec-Compliance), CR (Code Review), DAR (Documentation &
  Agent-Readability). Triggered: SEC (security/attachments), UXR (report shell),
  ILA (i18n), PCA (performance/complexity), PSA (prompts/skills).
- **Fixer:** a separate worker for review findings, not the implementer of
  record.

## Orchestration

- One change per issue; one implementer per change.
- Spawn independent reviewers in one parallel batch; give concurrent workers
  disjoint file ownership.
- Workers never close issues, merge, archive changes or publish releases.
- Commit and push after every completed step.
- Long commands run in the foreground; never wait on a background command.
- Handoff at session end or when context fills.
- No giant swarm. The default is coordinator + one implementer + the required
  reviewers. Add roles only when the change justifies it.
- Model-agnostic: no model names in project files. The user configures models.

## Gate before merge

`npm run check` must be green:

- typecheck
- lint
- unit tests
- build
- browser test (`npm run test:e2e`) for report-level changes

Plus the reviewer set: docs-only changes skip review; every other change is
reviewed. A failing review spawns a fixer; the coordinator re-runs the gate.

## Release

- The user approves a release explicitly, **per version**. An approval for an
  earlier version is not authorization for a new tag, stage or publish.
- Prepare the release locally (version, changelog, gate, review) and present
  the result. Do not create a tag, stage a package or publish until the user
  says yes to that exact version.
- Batch patch releases. Do not cut a version for a single internal fix or a
  one-line change; fold it into the next meaningful patch or minor release.
- `npm publish`/`npm stage publish` runs from a tag with provenance. The
  maintainer approves staged packages with 2FA; never ask for an npm token in
  chat, use the private secret card.
- No release without a green gate, updated changelog and a final review.
- Never publish a name or package without the name/trademark check recorded in
  the ADR.

### Pre-release audit

Run this before every tag or stage:

- `git log --all --format='%an <%ae>' | sort -u`; only expected project
  identities and no private address.
- Scan the current tree and full history for tokens, private keys, `.env`/key
  files and personal email addresses. Print only categories, files and commit
  counts; never echo the matched value.
- `gh api repos/Silasoa/tolkira/secret-scanning/alerts` returns no open alerts.
- `gh secret list` contains only the expected names (currently `NPM_TOKEN`),
  never values.
- `npm view tolkira maintainers` uses the project address, not a private one.
- Check committed screenshots, comparison images and release notes for browser
  chrome, names, local paths or email addresses.

If a secret is found, rotate it first; rewriting history is secondary.

## Tooling policy

- **OKF:** deliberately not used. It adds ceremony without proven value here.
- **Codebase-memory MCP:** optional; skip until the codebase is large enough to
  need structural indexing.
- **Open Design:** optional for the report shell/visuals. If it does not work
  with the current OpenCode version, do not block on it.
- **OpenSpec:** required for change contracts and spec history.
- **Pocock skills:** use grilling, to-spec, to-tickets, code-review, tdd and
  domain-modeling as needed; they are tools, not ceremony.

## Communication

- User communication: German (or the user's current language), complete prose.
- Code, comments, documentation, commits and issues: English.
- Ponytail rules apply only to code. Human-facing reports, questions and
  explanations stay structured and complete.
