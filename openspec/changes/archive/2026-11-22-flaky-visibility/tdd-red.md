# TDD-Red record — flaky-visibility

> Follow-up: the count moved out of the status `.counts` into run metadata
> (`report.flakySummary`, `1 tagged @flaky`). The RED record below is kept as
> history; see tasks 5.x for the current contract.

Command: `npx vitest run test/flaky-visibility.test.ts`

Result: 6 tests, **4 failed, 2 passed** (exit 1).

## Red failures

1. **Playwright retry pass** — `expected '…<span class="scenarioSub">…' to contain 'class="flakyBadge"'`.
   Correct: the adapter already emits `@flaky` (visible in the received
   summary), but `scenarioSummary` has no badge and `countPills` has no pill.
2. **Cucumber user `@flaky`** — same missing `<span class="flakyBadge">flaky</span>`.
   Correct: rendering is tag-driven; the legacy fixture proves the tag reaches
   the row unchanged.
3. **German catalog** — `expected undefined to deeply equal Any<String>` for
   `de.json:report.flaky`. Correct: both keys are absent from the shipped
   catalog. After the key is added the test also checks the rendered badge and
   `1 <de value>` pill, the German status label, and the verbatim `@flaky` tag.
4. **320/1440 contract** — counts block has only the `passed` pill.
   Correct: no flaky pill, and `REPORT_CSS` has no `.flaky`/`.flakyBadge`
   wrapping rules yet.

## Green guards (must stay green)

- **No flaky** — no badge, no pill.
- **JSON/CI/email unchanged** — the flaky summary deep-equals the non-flaky
  control after removing `@flaky` from `tags`; markdown and GitHub CI output
  and the rendered email are byte-identical. This pins status `passed`,
  `attempt: 1`, and no new schema field.

## Notes

- Existing tests and fixtures untouched.
- `npx oxlint test/flaky-visibility.test.ts` and `npx tsc --noEmit` pass.
- No production, catalog or docs change; nothing committed.
