# Design

## Data flow

Playwright JSON -> `resolveAttachmentPath` -> per-final-attempt skip entries ->
`attempt-diagnostics` WeakMap keyed by the final `testCaseStarted` ->
`RunIndex` -> `ReportModel` -> HTML notice. The count continues to
`GeneratedReport.skippedAttachments` and the CLI warning. Summary, CI, email
and the history sidecar stay untouched.

## Skip reasons

`src/attempt-diagnostics.ts` gains:

```ts
export type AttachmentSkipReason =
  | 'outside'
  | 'missing'
  | 'unreadable'
  | 'not-regular'
  | 'non-local';
export interface SkippedAttachment {
  name: string;
  reason: AttachmentSkipReason;
}
```

The WeakMap value becomes `{ count: number; entries: SkippedAttachment[] }`.
`recordSkippedAttachments(started, count, entries = [])` keeps the existing
two-argument call sites working. `skippedAttachmentsOf` still returns the
count; a new `skippedAttachmentEntriesOf` returns a copy of the entries.

## Classification

`resolveAttachmentPath(file, context, onSkip)` first classifies `file:`/UNC/
device paths as `non-local` without attempting to read them. For local
candidates it classifies each one:

- `lstat` fails -> missing candidate.
- symlink or non-file -> not-regular candidate.
- `realpath` fails -> unreadable candidate.
- resolves outside every root -> outside candidate.
- inside a root -> `readAttachment`; an undefined result marks it unreadable.

One attachment is skipped at most once. Precedence after all candidates:
inside attempted but unreadable or `realpath` failed -> `unreadable`; otherwise
outside -> `outside`; otherwise not-regular -> `not-regular`; otherwise
`missing`. The existing `lstat`-before-`realpath` and root checks remain; no new
read path is opened.

`attachmentsForResult` passes `attachment.name` through
`displayAttachmentName`: strip ANSI/OSC, bidi and control characters first, then
replace `\` with `/`, take the last segment, collapse whitespace, trim, cap at
120 code points, fall back to the literal `attachment`. Stripping before the
split prevents an OSC-8 payload from surviving as a visible path. The record
guard checks `count > 0 || entries.length > 0`, so a count/entry mismatch cannot
drop the list.
`context.skippedAttachments` counts every skip. Trace zips and attachments with
neither body nor path keep their current silent handling. The 50 MB/100 MB caps
keep throwing.

`PlannedAttempt` gains `skippedEntries`; the envelope builder passes it to
`recordSkippedAttachments`. Only the final attempt is recorded; earlier
attempts stay out of scope.

## Model and render

`ReportScenario` gains `skippedAttachmentEntries?: SkippedAttachment[]`, copied
from the latest started attempt. `ReportModel` needs no aggregate field.

`src/render/html.ts` replaces the outside-root-specific run notice with the
generic `report.attachmentSkipNotice` plus `report.attachmentSkipWhere`
("See the affected scenarios on the Report tab."). `src/render/report.ts`
renders the same notice and, when entries exist, a
`<ul class="attachmentSkipList">` with
`<li><code>name</code> - reason</li>` and `report.attachmentSkipMore` for the
remainder. Names and reason labels are escaped. A small `.attachmentSkipList`
style keeps it readable at 320 px and in print; no client JS is involved.

New en/de keys: `report.attachmentSkipNotice`, `report.attachmentSkipWhere`,
`report.attachmentSkipOutside`, `report.attachmentSkipMissing`,
`report.attachmentSkipUnreadable`, `report.attachmentSkipNotRegular`,
`report.attachmentSkipNonLocal`, `report.attachmentSkipMore`. Remove the old
`report.attachmentNotice` key after
all call sites move.

## CLI

`attachmentWarning(count)` becomes reason-neutral: it names the possible
reasons and keeps `ATTACHMENT_HINT`. The CLI and compat shim keep one warning
for the aggregate count. No names go to stderr, avoiding terminal width and
control-character issues.

## Compatibility and security

The summary schema stays 2; history stays 1; no dependency. The WeakMap survives
`sanitizeEnvelopes` object identity. Only sanitized attachment names are stored;
no path, content or media payload. Existing caps and symlink/root checks are
unchanged.
Legacy and Messages attachments never enter this path.

## Tests and host

- Playwright: outside, missing, unreadable (POSIX chmod or an injected read
  failure; skipped on Windows), not-regular (directory), non-local, mixed,
  >3 cap, sanitized name, count includes all, caps still throw.
- Model/render: entries copied, list escaped, more-line, run notice, print.
- CLI/compat: generic warning, exact count, no names on stderr.
- i18n: en/de keys, `i18n:check`.
- Golden/characterization updates only for CSS/HTML changes.
- Host: Playwright movies-app artifact plus a local missing/unreadable fixture;
  Seed-Test report-shell row where available.

## Risks

- A directory may classify differently on Windows; the test uses a directory
  and a missing path rather than chmod.
- The generic CLI warning is less specific than "outside the roots"; the report
  carries the per-attachment reason.
- Earlier attempts remain silent here; `retry-evidence` owns them.
