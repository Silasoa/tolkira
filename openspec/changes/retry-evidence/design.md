# Design

## Input and index

The Playwright adapter already emits one `testCaseStarted` per attempt and
already keeps earlier steps and error messages. It currently drops earlier
attachments before reading (`playwright.ts:1155-1159`). This change keeps one
image from the first failed displayed earlier attempt.

`src/report/index-run.ts` adds `allAttempts: Map<string, TestCaseStarted[]>`,
filled for every start. `allAttempts` keeps envelope order and excludes the
chosen latest start rather than re-sorting by `attempt`, so repeated or missing
Messages numbers cannot reorder it. The existing `attempts` map still holds the
latest start, so summary, metrics and the rendered scenario stay
final-attempt-only.

## Budget and planning

`src/attachment.ts` exports `MAX_RETRY_EVIDENCE_BYTES = 10 * 1024 * 1024`.
`PlanContext` adds `retryEvidenceBytes`, `retryEvidenceImageUsed` and the total
final-attachment bytes (inline bodies counted with `attachmentBytes`, path reads
with their file size).

Attachment planning is two-phase inside one Playwright input:

1. Every scenario reads its final attachments first. The context accounts for
   inline bodies as well as path reads, so the 100 MB total cap is accurate.
2. After all scenarios are planned, if the input is the only input file and the
   final attachments leave at least 10 MB of the 100 MB cap, a second pass visits
   the first three earlier attempts per scenario in plan order. It finds the
   first failed attempt, reads at most one image for the whole report, and
   accepts it only when `retryEvidenceBytes + size <= 10 MB` and
   `totalAttachmentBytes + size <= 100 MB`; otherwise the image is omitted and
   the run stays valid. A path read that races past the cap is caught and
   omitted for this evidence only. The image is only read once across all
   scenarios.
3. The image is emitted as an `Attachment` envelope on that earlier
   `testCaseStarted`, so `sanitizeEnvelopes` applies the normal checks and the
   model can map it. The declared media type is re-applied after the path read
   (the generic reader returns `application/octet-stream`).

For a multi-input report, `parsePlaywrightJson` receives
`allowRetryImages: false` from the loader; earlier status/error/duration still
render, but no earlier image is read. This keeps the per-report byte budget
honest without a global pre-scan across inputs.

The earlier probe passes no `onSkip` callback. **Change**
`resolveAttachmentPath` so it increments the run-level skipped count only when
that callback is present (today it increments unconditionally, before the
optional callback). Final-attempt calls pass the callback; the earlier probe
does not, so an earlier outside-root probe cannot inflate the CLI warning.
Final-attempt skip diagnostics stay authoritative. Add a regression test that an
earlier-only outside-root path leaves `skippedAttachments` at 0.

Messages inputs need no adapter change: their earlier attachments are already
envelopes, but this slice does not embed an earlier Messages image. The block
shows status/error/duration only, so the model cannot add bytes after
`sanitizeEnvelopes` has applied the 100 MB cap.

## Model

`src/report/model.ts` gains:

```ts
export interface ReportEarlierAttempt {
  attempt: number;
  status: ReportStatus;
  durationMs: number;
  message?: string;
  attachments: ReportAttachment[];
}
```

`ReportScenario.earlierAttempts?: ReportEarlierAttempt[]` is filled from
`allAttempts` for starts older than the latest, with results, in envelope order
and capped at three. Display numbers come from that order (`1`, `2`, `3`), not
the raw `attempt` value, so repeated or missing Messages numbers stay readable.
Status uses the same worst-executed rule as a scenario; duration sums the
earlier results; the message is the first non-empty failed message, passed
through the existing `stripAnsi`/bidi handling. Attachments are the first image
from the first failed displayed attempt, mapped with `mapAttachments`; the model
keeps one aggregate 10 MB budget and one image across all scenarios and rejects
an image whose `bytes` would exceed it. Summary, history, counts and
`ReportScenario` attachment lists do not include earlier evidence.

Earlier attempts' images are marked with a non-protocol WeakSet in
`attempt-diagnostics` when the Playwright envelope is emitted. The model only
renders earlier attachments that carry the mark, so a Messages input with an
earlier image envelope cannot leak one into the block. This keeps the marker out
of Messages and the summary.

Earlier failure messages are not added to the search index; document this in
LIMITATIONS.

## Render

`src/render/report.ts` adds `renderEarlierAttempts(scenario, t)` after the steps
and before the detail metadata:

```html
<details class="earlierAttempts">
  <summary>Earlier attempts (3 of 5)</summary>
  <ol class="earlierAttemptList">
    <li>
      <div class="earlierAttemptHead">
        <span>Attempt 1</span><span class="statusText fail">Failed</span><span>1.2 s</span>
      </div>
      <pre class="earlierAttemptMessage">...</pre>
      <!-- existing attachment renderer, at most one image, alt text from the key -->
    </li>
  </ol>
</details>
```

The summary uses a plural key with `{shown}` and `{total}`; when equal it reads
`Earlier attempts (2)`. The block is native `<details>`, so it works without
JavaScript; the print script opens all details for browser print/PDF, and
without that script it stays collapsed like the other details. Escape names and
messages; use `statusLabel`/`durationLabel`. New en/de keys:
`report.earlierAttempts` (shown/total plural), `report.earlierAttempt` and
`report.earlierAttemptImage` for the image alt text. Add a compact
`.earlierAttempts` style (head/message stack at 320 px, `break-inside: avoid` in
print) and no client-bundle change.

## Compatibility and security

- Summary schema 2, history 1, JSON/CI/email bytes and dependencies unchanged.
- `Attempt: n` metadata stays as today; the block supplements it.
- Earlier attachments are sanitized like final ones; the single-input 10 MB
  budget and existing 100 MB cap bound the report. Earlier attachments are
  excluded from summary attachment counts and bytes.
- Legacy JSON exposes no earlier attempts.
- The report may grow by up to 10 MB; the exact report HTML row includes the
  evidence while the decoded-attachment row stays final-only. Document this in
  LIMITATIONS.
- Expected-failure retries can show earlier raw failures; they are documented
  and deferred rather than changing the final expected status.

## Tests and host

- Playwright: a synthetic failed-then-passed fixture with an inline image (the
  checked-in real fixture's flaky-pass attempt has only `error-context`); status,
  duration, error, no image, >3 earlier attempts, `3 of 5`, one image per
  report, multi-input no image, budget/cap omission, earlier skip not counted,
  final-first cap, unmarked Messages image ignored.
- Messages: multiple starts with repeated/missing attempt numbers, earlier
  error, no earlier image; final summary unchanged.
- Model: ordered/capped earlier attempts, display order, one image per report,
  no summary field; legacy none; history/`--json`/CI/email unchanged.
- Render: collapsed details, escaping, image alt/print/no-JS, 320 px.
- Characterization/golden hashes refresh only for the CSS/HTML change.
- Host: a local Playwright project with one retrying test and a screenshot
  (movies-app has no retries), plus the Playwright movies-app report-shell row;
  Seed-Test shell where available.

## Risks

- The checked-in real fixture's flaky-pass earlier attempt has no image, so the
  image test needs a small synthetic fixture.
- Multi-input Playwright reports intentionally omit earlier images; the block
  still carries error/status/duration.
- The 10 MB evidence budget is a new product limit; it is documented and
  bounded, not configurable in this slice.
- Earlier attachments are not counted in the summary; the exact report-size
  row and a docs note keep that honest.
- Expected-failure retries may show raw failed earlier attempts; documented.
