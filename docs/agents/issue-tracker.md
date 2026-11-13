# Issue tracker: GitHub

Durable, actionable work lives in GitHub issues; `docs/BACKLOG.md` is the local
intake ledger. Specs live in `openspec/`. Use the `gh` CLI for issue operations.

## Issue or local backlog?

`docs/BACKLOG.md` is for intake: ideas, small chores, research questions,
review and architecture findings that are not yet actionable, and decisions
with a revisit trigger. A backlog item has a `B-` ID but no spec, owner or
promise yet. Every review finding gets an ID before it is fixed, filed or
deferred.

A GitHub issue is for durable, actionable, testable work with user or
contributor value, a spec/acceptance path, or ownership across sessions. A
review note becomes an issue only when it will be worked on or needs a durable
owner; do not create an issue for every note.

Promote a backlog item when all of these are true:

1. The value is clear and not already covered by another item.
2. It is actionable now or in the next release.
3. It has testable acceptance criteria or will get them through an OpenSpec
   change.
4. It needs to survive the session, or needs an owner beyond the current one.
5. It is not a decision that was deliberately deferred.

Decision tree:

```
finding or idea
  -> can it be fixed inside the current approved slice?  fix it, note it in the backlog
  -> reject or defer?                                    decision + trigger in the backlog, no issue
  -> actionable, testable, durable?                      GitHub issue + backlog ID + spec path
  -> none of the above?                                  keep it in the backlog with a trigger
```

Examples:

| Item | Where it goes | Why |
| --- | --- | --- |
| Report crashes on empty legacy JSON | Issue (bug template) | Reproducible, testable, user-facing |
| "Maybe support PDF export" | Backlog only | Product idea without an approved scope |
| Reviewer notes a stale ARIA label | Fix in the slice, or backlog chore | Small enough to fix now; issue only if deferred |
| `html.ts` view seams (B-004) | Issue + OpenSpec change | Durable architecture work |
| Ten small chores from one review | One meta issue with a checklist | One owner for a batch; each chore stays a small sub-task |
| A single docs typo | PR directly | Too small for an issue or a spec |

## Granularity

- One issue per OpenSpec change. Split unrelated work into separate issues or
  sub-issues; a change may ship in several small slices.
- A batch of related items may use one meta/tracking issue with a checklist and
  sub-issues. Do not mix unrelated work in an umbrella issue.
- An issue that cannot name a verification method is not ready.

## Issue quality

Title: `<type>: <imperative outcome>`, for example
`fix: preserve png attachments from legacy json`. Use `bug`, `feat`, `task`,
`docs`, `perf`, `build` or `ci`. The area label carries the area; do not encode
it twice.

Body:

- **Context and evidence** — what is wrong or missing, how it was found, the
  backlog ID or review finding, and any reproduction.
- **Scope** — what is in scope.
- **Non-goals** — what this issue deliberately does not change.
- **Acceptance criteria** — testable, observable statements. A
  `ready-for-agent` issue needs at least one, and each criterion needs a test
  or a named manual check.
- **Verification** — commands, fixtures and browser coverage.
- **Links** — spec/OpenSpec change and related issue or backlog ID.

`ready-for-agent` requires all of: testable acceptance criteria, a linked
spec/change (or a stated docs-only exemption), a known file surface, and no
open product decision. Labels route the work; they never replace the body.

## Templates

Use the Task template for scoped work with a spec, the Bug template for
defects, and the Feature template for intake. Blank issues are disabled.

## Labels

Use the vocabulary in [`triage-labels.md`](triage-labels.md): once triaged, one
`area:*`, one `priority:*` and one readiness label. Default GitHub labels are
optional; do not duplicate their meaning.

## Change <-> issue

One OpenSpec change per issue. The issue references the change directory and
the spec; the spec is the contract, the issue is the work item. The issue may
exist before the spec, but it cannot become `ready-for-agent` without one.

## Lifecycle

1. A new issue starts with `needs-triage`.
2. Triage sets one area, one priority and one of `needs-info`,
   `ready-for-human`, `ready-for-agent` or `wontfix`.
3. A `ready-for-agent` issue has an approved spec and testable acceptance
   criteria; the implementer runs the gate and review.
4. The coordinator closes only after the change is merged, with a comment
   linking the commit or PR and, when applicable, the archived change.

## OpenSpec version note

The workflow uses whatever OpenSpec CLI the repository currently uses; the
maintainer is upgrading to 2.0. The change directory and spec files are the
contract, independent of the CLI version. Do not hardcode CLI command names,
flags or generated paths in issues, specs or scripts; refer to the change
directory and the spec instead. If the CLI changes, the contract stays valid.

## Commands

- **Create an issue**: `gh issue create --title "..." --body "..."`.
- **Read an issue**: `gh issue view <number> --comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels`.
- **Comment**: `gh issue comment <number> --body "..."`.
- **Labels**: `gh issue edit <number> --add-label "..."`.
- **Close**: `gh issue close <number> --comment "..."`.

Infer the repo from `git remote -v`; `gh` does this automatically inside a
clone.

## Pull requests as a request surface

**No.** External PRs are welcome as code contributions after the spec exists,
but they do not replace the issue/spec workflow.
