# attachment-skip-reasons

## Why

Path attachments are the largest user-request cluster in the research. Tolkira
already counts path attachments skipped outside the allowed roots and repeats
the count on the affected scenario, but a user cannot see which file was lost
or why. Missing, unreadable and non-regular files inside a root stay completely
silent today. A screenshot called `checkout.png` is more useful than a bare
count.

This is a separate change from the archived `attachment-diagnostics` slice,
which added the per-scenario count; this change adds the display names and
reasons. No remote issue exists; the trigger is the research row and the
existing backlog entry.

## What Changes

- A skipped Playwright path attachment records its display name and one reason:
  outside the allowed roots, missing, unreadable, not a regular file, or
  non-local. The count still includes every skipped attachment; the report
  keeps up to three entries per scenario and says how many more exist. The
  run-level count therefore grows to include missing, unreadable, non-regular
  and non-local paths, which were silent before; this public number change is
  stated in the changelog and docs.
- The scenario detail shows a generic skip notice with the names and reasons;
  the run-level notice stays a count and points to the affected scenarios.
- The CLI warning becomes reason-neutral instead of claiming every skip is
  outside the roots. The report and CLI never show absolute paths, only a
  sanitized attachment name.
- No JSON summary, CI, email or schema change; no new dependency, no new file
  read outside the existing roots and caps, no attachment-budget change.
- Earlier attempts and trace/no-body omissions stay out of scope.

## Impact

- Capabilities: `input-formats`, `report-rendering`.
- Code: `src/attempt-diagnostics.ts`, `src/input/playwright.ts`,
  `src/report/model.ts`, `src/render/html.ts`, `src/render/report.ts`,
  `src/render/report.css`, `src/warnings.ts`, locale catalogs.
- Tests and docs: Playwright adapter, model/render, CLI/compat warning,
  LIMITATIONS, AGENT-INTERFACE, CHANGELOG.
- Host: report-shell change; re-run the Playwright and Seed-Test report rows.

## Non-goals

- Reading outside the allowed roots or changing the 50 MB/100 MB caps.
- Earlier-attempt attachments (the `retry-evidence` change).
- Trace zips or attachments with neither body nor path.
- Per-attachment paths, a summary/JSON/CI/email field or a new dependency.
