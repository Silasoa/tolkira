# Issue tracker: GitHub

Issues and specs live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`.
- **Read an issue**: `gh issue view <number> --comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels`.
- **Comment**: `gh issue comment <number> --body "..."`.
- **Labels**: `gh issue edit <number> --add-label "..."`.
- **Close**: `gh issue close <number> --comment "..."`.

Infer the repo from `git remote -v`; `gh` does this automatically inside a
clone.

## Change <-> issue

One OpenSpec change per issue. The issue references the change directory and
the spec; the spec is the contract, the issue is the work item.

## Pull requests as a request surface

**No.** External PRs are welcome as code contributions after the spec exists,
but they do not replace the issue/spec workflow.

## No GitHub remote yet

The repository is local until the user creates the remote. Until then, use the
OpenSpec change as the contract and record a placeholder issue reference in the
proposal.
