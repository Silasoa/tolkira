# Design

## History field

`HistoryRun` gains `flaky?: number` (optional for API compatibility). New runs
set it; old files and user-supplied history without it read as absent.

`buildHistoryRun` computes the count from the summary:

```ts
function flakyCount(summary: ReportSummary): number {
  return summary.scenarios.filter(
    (scenario) =>
      scenario.executed &&
      scenario.status !== 'skipped' &&
      (scenario.tags.includes('@flaky') ||
        (scenario.attempt > 0 && scenario.status === 'passed')),
  ).length;
}
```

The tag branch counts an executed, non-skipped tagged scenario regardless of
its final status. The retry branch mirrors Playwright's flaky definition: at
least one retry and a final pass. A retried final failure is not counted through
the retry branch. Unexecuted and executed-skipped scenarios are excluded; they
are not attempted and may still be counted by the run-meta tagged count.

This is a per-run flagged share, not a measured flake probability. Legacy JSON
sets `attempt: 0`, so legacy runs are tag-only. The summary tags are the pickle
tags, so inherited and outline tags are included.

`parseRun` leaves `flaky` absent when the key is missing; a present value must
be a non-negative whole number no greater than attempted (total minus skipped),
and a violation rejects the file. Reading is pure; it does not materialize the
field. `writeHistory` preserves old entries without the field; only new runs
carry it. `buildHistoryRun` includes `flaky` in the aggregate hash, so the first
same-count run after upgrade is appended once with the new count; later
identical runs dedupe. The history schema version stays 1; old readers ignore
the unknown key but drop it if they rewrite the sidecar, so 0.5 should write the
file.

## Trends

`rowMarkup` adds two cells after the pass rate:

- `Flaky`: absent `flaky` -> `—`; otherwise `t.number(Math.min(whole(flaky),
  attempted))`.
- `Flaky share`: absent -> `—`; attempted 0 -> `—`; otherwise clamp the count
  to attempted and compute `Math.round((flaky / attempted) * 1000) / 10`, but
  compare the raw boundary `clamped * 1000 < attempted` so 1/1001 shows
  `trends.flakyShareBelow` with `t.percent(0.1)` (en `<0.1%`, de `<0,1 %`) and
  1/1000 shows `0.1%`; never `0%` while the count is above zero.
  Otherwise `t.percent(share)` (en `5%`, de `5 %`). Do not reuse `trends.round`
  (sparkline 2-decimal helper) for the share.

The header adds `trends.flaky`, `trends.flakyShare`; a `trends.flakyNote` hint
below the table explains: executed non-skipped tagged or passed-after-retry;
tagged final failure counts; retried final failure does not count unless tagged;
not a probability; run-meta can differ either way; legacy JSON is tag-only; runs
recorded before this field show `—`. Update `trends.tableHint` to mention the
columns.

New English/German keys: `trends.flaky`, `trends.flakyShare`,
`trends.flakyShareBelow`, `trends.flakyNote`. Use IPC style: German keeps
`Flaky`, `Flaky-Anteil`; `markiert` for tagged. Edit
`src/i18n/locales/*.json`, run the assets build.

## Layout

- Screen: raise `.trendsTable` `min-width` from 44rem to 72rem, use
  `table-layout: fixed` and widths 12% date, 22% title, 12% status and 6.75%
  for each of the 8 numeric columns, so 11 columns keep readable numeric cells
  at 390/320; `td.num` is nowrap on screen too and `.tableWrap` scrolls.
- Print: keep 7 pt but replace `table-layout: auto` with `fixed`; widths 13%
  date, 20% title, 14% status, 6.625% for each of the 8 numeric columns so the
  German `Fehlgeschlagen` chip fits. Allow `th` to wrap (no letter towers) and
  keep `td.num` nowrap so `12.5%`/`8.345 s` do not split. Keep
  `break-inside: avoid`.
- Rename the note class `flakeNote` to `flakyNote` and merge the duplicate
  `.sparkLead` rule: `.panel p.sparkLead, .panel p.flakyNote { ... }`.

## Parity

The official Cucumber HTML formatter has no flaky/retry rate; it shows the final
attempt only. Playwright's HTML report marks a test flaky when it passes after a
retry, which is the retry branch here. Allure shows retry history and a status;
MCHR has no retry model; legacy JSON has no attempts (`attempt: 0`). Tolkira's
tag-or-retry share is a display-only improvement over the old reporters, not a
parity claim, not a probability and not investigation support. The earlier
attempt's error/screenshot stays out of scope (B-043).

## Compatibility

- Summary schema 2, report header, JSON, CI and email do not change.
- The history sidecar is additive: absent `flaky` stays absent on read/append;
  new entries write it.
- A hand-written history with a non-whole, negative or above-attempted `flaky`
  is rejected by the existing `whole`/attempted validation.
- History dedupe: the new field is part of the id; the first post-upgrade run can
  append once even when its counts are unchanged; the next identical run
  dedupes.
- Older readers drop `flaky` on rewrite; document that 0.5 should write the file.

## Docs and backlog

- `docs/LIMITATIONS.md` History row: entries now include the optional `flaky`
  count; the Flaky row describes the share and its limits.
- `docs/AGENT-INTERFACE.md` Run history: the optional field, definition, absent
  old entries, above-attempted validation, old-reader rewrite; change
  "`@flaky` is report-only" to say the badge is report-only and the history
  count is separate; say "pass-rate and flaky-share history".
- `docs/ARCHITECTURE.md` and `DESIGN.md` Trends summaries: Flaky, Flaky share,
  note.
- README history, CHANGELOG; GLOSSARY/I18N terms.
- B-043 first-attempt evidence with the trigger "a user needs first-attempt
  evidence or a flake investigation"; the existing flaky backlog entry says the
  Trends share is display-only and a per-scenario status/filter/summary field/
  first-attempt history still needs a schema decision.
- Task 4.2 records that the Seed-Test compat shim has no `--history`; the
  Playwright `5d2cdf0` artifact is the Trends host check.

## Tests

- History: tag-only, retry-passed, retry-failed, tagged+retried+failed (tag
  branch), both-once, unexecuted/skipped excluded; old absent and append leaves
  old field-less; present round-trips; lower-bound `flaky: 0`; negative/
  fractional/above-attempted rejected; id changes with flaky; old last entry
  plus two identical runs appends once then dedupes.
- Trends: 2/40 -> 2 and 5%; 0/40 -> 0 and 0%; skipped/empty -> `—`; old history
  `—`; 1/2001 and 1/1001 -> `<0.1%`; 1/1000 -> `0.1%`; hostile above-attempted
  API history clamps both cells; note text; en/de keys; screen cell width/no
  one-character stacking at 320/390 with a 5-digit row; print title/status/
  duration widths and no letter towers.
- Summary/CI/email have no flaky field; `--history` writes the count; two
  different counts append.
- Legacy JSON tag-only; Playwright retry-passed counts; retry-failed does not.
- Trends e2e at 1440/390/320 + 200% and print/A4; host Playwright `5d2cdf0`
  with a two-run tagged fixture.

## Risks

- The share uses distinct attempted scenarios, not executions; the note calls it
  a share, not a probability.
- An above-attempted API history is clamped in both cells; parsed files are
  rejected earlier.
- The history field changes the id; one duplicate run after upgrade is possible.
- Older readers drop the field on rewrite; use 0.5 for writing.
- 7 pt stays the A4 print trade-off; the column policy is the fix.
