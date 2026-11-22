# Design

Add one independent job to `.github/workflows/ci.yml`:

```yaml
check-windows:
  runs-on: windows-latest
  timeout-minutes: 20
  steps:
    - uses: actions/checkout@v7
    - uses: actions/setup-node@v7
      with:
        node-version: 22
        cache: npm
    - run: npm ci
    - run: npm run check
```

It does not need `needs: check`, so it runs in parallel with the Linux matrix.
The default Windows shell is PowerShell; the script is a plain `npm` command
with no shell-specific syntax. The check gate already runs on the maintainer's
Windows machine, so the job is expected to pass; it is a regression guard.

No product code. Update the changelog and the DROP-IN-VALIDATION CI note. The
job is validated by the first CI run; if Windows exposes a real path/shell bug,
fix it in a separate change rather than weakening the job.
