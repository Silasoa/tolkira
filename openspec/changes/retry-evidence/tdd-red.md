# TDD-Red record — retry-evidence

Worker: TDD-Red. No production code, docs outside the change, config or commits.
The tests were written from `proposal.md`, both spec deltas, `design.md` and
`tasks.md` (2.1–2.5).

## Added

- `test/fixtures/playwright/retry-evidence.json` — synthetic failed-then-passed
  retry with an inline PNG and an error (the checked-in real run only has
  `error-context` for its flaky pass). Provenance row added.
- `test/fixtures/messages/retry-evidence.ndjson` — repeated attempt `0`, one
  missing `attempt`, an unexecuted earlier start, a failed earlier start with an
  ANSI/bidi/HTML message and an inline image, then a passed final start.
- `test/retry-reports.ts` — synthetic Playwright builders and shared assertions.
- `test/playwright-retry-evidence.test.ts`
- `test/messages-retry-evidence.test.ts`
- `test/render-retry-evidence.test.ts`
- `test/e2e/retry-evidence.spec.ts`

## Commands and results

`npx vitest run test/playwright-retry-evidence.test.ts test/messages-retry-evidence.test.ts test/render-retry-evidence.test.ts`

- 3 files, 23 tests: 19 failed, 4 passed.
- `npx playwright test test/e2e/retry-evidence.spec.ts --project=chromium`:
  3 failed, all `details.earlierAttempts` not found.
- `npx tsc --noEmit`: clean.
- `npx oxlint <new files>`: clean.
- `npm run hygiene`: ok (tracked files; the new files are untracked).

## Exact failures and why they are correct

| Test | Current failure | Spec reason |
| --- | --- | --- |
| pins the 10 MB budget | `MAX_RETRY_EVIDENCE_BYTES` undefined | design exports the 10 MB seam |
| index every start | `allAttempts` undefined | index keeps every start per pickle |
| Playwright earlier attempt | `earlierAttempts` undefined | failed-then-passed model exposure |
| no image | `earlierAttempts` undefined | status/error/duration without an image |
| cap at three | `earlierAttempts` undefined | ordered, capped earlier attempts |
| one image per report | `[]` vs `['first.png']` | one image per report |
| first failed attempt image | `earlierAttempts` undefined | first failed displayed attempt |
| media type | attachment undefined | declared media type re-applied |
| 10 MB budget | `earlierAttempts` undefined | oversized image omitted, run valid |
| earlier skip | `earlierAttempts` undefined | earlier probe not counted; final skip stays authoritative |
| final counts/bytes | no "Earlier attempts (1)" | image + final-only counts |
| multi-input | zero earlier blocks | block without image for merged inputs |
| Messages order | `allAttempts` undefined | envelope order, display numbers |
| Messages unmarked image | `earlierAttempts` undefined | Messages image not embedded |
| Messages render | zero earlier blocks | escaped block, no image |
| render disclosure | zero earlier blocks | collapsed native `<details>` |
| 3 of 5 | zero earlier blocks | capped count text and first three items |
| escaping | earlier image envelope absent | escaped/sanitized message and name |
| German block | new catalog keys undefined | localized status/duration plus en/de keys |
| print CSS | `.earlierAttempts` absent | printable, break-inside avoided |
| e2e 320/200 %, no-JS, print | block not found | usable, native, printed |

## Guards green before implementation (must stay green)

- Summary schema 2, final attempt only, attachment counts/bytes 0, steps
  final-only.
- Legacy and single-start reports expose/render no earlier block.
- JSON (`--json`), GitHub/Azure/Markdown CI, email and history schema 1 contain
  no earlier-attempt field.

## Notes

- `allAttempts` is asserted to contain every start, including the chosen final
  start, per the contract; the model derives the earlier list by excluding that
  final start.
- The 10 MB retry budget is exercised with a sparse `budget + 1` path so the
  test stays bounded. The separate 10 MB reserve over the 100 MB cap has no
  injectable seam in the design; a faithful test needs a ~91 MB final fixture.
  Add a focused unit test if a helper seam appears, otherwise cover it in review.
- Characterization/golden hashes were not touched. Adding `.earlierAttempts`
  to the embedded stylesheet legitimately changes them; refresh only for that
  CSS/HTML change (design "Tests and host").
