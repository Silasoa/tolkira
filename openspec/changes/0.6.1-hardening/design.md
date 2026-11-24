# Design

## Context

0.6.0 shipped the second audit's defects on top of the first audit's fixes. The
first patch change, `0.6.1-quality-pass`, owns B-048/B-039/B-049/B-054 and audit
findings 1-12, including the model rule that a zero timestamp is unknown. This
change is the second patch, `0.6.1-hardening`: nine hardening fixes, one
attempt-tie rule inherited from the quality pass, and one documentation decision
for the owner-only output mode. It adds no feature, option, dependency or public
API.

The fixes share no new module. One tiny comparator helper lives in the existing
`src/text.ts`; every other seam changes an existing function or one call site.
The release-gate fix is already implemented by commit `31dd112` and is verified
by a test, not by workflow code.

## Seams

### 1. Display URI privacy

Current behaviour:

- `displayUri` (`src/summary.ts`) does
  `uri.replace(/\\/g, '/').replace(/^file:\/\/+/i, '')`. For
  `file:///home/<user>/proj/login.feature` the prefix removal consumes all three
  slashes, yielding `home/<user>/proj/login.feature`; the relative early return
  then returns it unchanged. The home-directory drop below is unreachable.
  `/mnt/c/Users/<user>/proj/login.feature` is absolute, but its first segment is
  `mnt`, so the last-three fallback returns `<user>/proj/login.feature`.
- `normalizeUri` (`src/input/legacy.ts`) has the same prefix removal and returns
  `home/<user>/...` for a POSIX file URL. For an absolute path without
  `/features/` it returns the last segment only.
- `buildReportModel` (`src/report/model.ts`) sets
  `featureName: feature?.name ?? pickle.uri`, so a feature without an AST name
  can carry the raw file URL into the report, summary and copied text.

Change:

- Strip `file://` as scheme plus empty authority, not as three slashes:
  `file:///home/<user>/...` becomes `/home/<user>/...`, and
  `file:///C:/Users/<user>/...` becomes `/C:/Users/<user>/...`, then `C:/Users/...`.
  A `file://` URL without a leading slash keeps one.
- After removing a drive (`C:`) or an `/mnt/<drive>` mount, drop a leading
  `Users`, `home` or `Documents and Settings` segment plus the next segment.
  This covers `/home/<user>/...`, `/mnt/c/Users/<user>/...` and
  `file:///C:/Users/<user>/...`. A path whose home segment is not leading is not
  the target of this fix; the last-three fallback still applies.
- `displayUri` keeps its `/features/` marker and last-three fallback. Relative
  URIs stay unchanged.
- `normalizeUri` keeps its `./` removal, `/features/` marker and last-segment
  fallback; relative URIs stay unchanged. It gets the same prefix and
  home-segment handling.
- The model fallback becomes `featureName: feature?.name ?? displayUri(pickle.uri)`
  (including the empty-URI case). The summary already uses `displayUri` for its
  `uri` field; its `feature` field stays `feature?.name ?? ''`, so a featureless
  scenario has an empty `feature` and no user name. The model fallback and the
  copied failure text use the same function. No second path-shortening rule is
  added.

The contract is the absence of a local user name from a display URI on the named
surfaces, not one particular shortened string. Existing `/features/`-based
outputs stay stable.

### 2. Media attachment with a lone surrogate

Current behaviour (`toAttachment`, `src/report/model.ts`):

```ts
dataUri: isBase64
  ? `data:${mediaType};base64,${body}`
  : `data:${mediaType};charset=utf-8,${encodeURIComponent(body)}`,
```

`encodeURIComponent` throws `URIError: URI malformed` on an unpaired UTF-16
surrogate (JSON `\ud800`). The throw escapes the attachment mapper and the whole
report fails.

Change:

```ts
function mediaDataUri(mediaType: string, body: string): string {
  try {
    return `data:${mediaType};charset=utf-8,${encodeURIComponent(body)}`;
  } catch {
    return `data:${mediaType};base64,${Buffer.from(body, 'utf8').toString('base64')}`;
  }
}
```

- Normal media bodies keep their readable percent-encoded data URI byte for
  byte.
- A BASE64 body keeps the existing `;base64,` data URI and is not re-encoded.
- A lone surrogate becomes the UTF-8 replacement bytes (U+FFFD), not the
  unpaired code unit; the guarantee is no crash and a valid inline image, video
  or audio source.
- An empty body still renders no data URI.
- The fallback is one branch with one test triple (image/video/audio); no option
  and no dependency.

### 3. Host-locale-independent order

Current behaviour: four deterministic sorts call `localeCompare` under the
process default locale:

- `src/summary.ts`: summary scenarios by URI then name;
- `src/input/load.ts`: resolved input files;
- `src/baseline.ts`: baseline not-in-this-run rows by feature, name, example,
  URI;
- `src/render/report.ts`: tag list order.

Report feature order is index insertion order, fed by the resolved input order,
so fixing the input sort fixes the report feature order. Scenario and matrix
ordering by status/order is numeric and unchanged.

Change: add one helper to `src/text.ts`:

```ts
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
```

Use it at every site above. No `Intl`, no `localeCompare`, no dependency. The
order for non-ASCII names changes visibly; `docs/CHANGELOG.md` records it and
`docs/AGENT-INTERFACE.md` keeps the URI-then-name contract. A characterization
change is re-pinned only when it is the named legacy-date removal; any other
hash or golden diff is inspected as a defect, not blindly re-recorded.

### 4. One-line Playwright report parsed twice

Current behaviour (`src/input/detect.ts`):

- `looksLikeMessages` takes the first non-empty line and always calls
  `JSON.parse` before `isEnvelopeLike`.
- For a one-line Playwright report, that line is the whole file; the parse
  succeeds but the shape is not an envelope, then `sniffPlaywright` parses the
  whole file again.
- For a multi-line Playwright report, the first line is `{`; the parse throws
  quickly, then `sniffPlaywright` parses once. The double parse is specific to a
  file whose first line is the whole document.

Change:

- Before `JSON.parse`, check that the trimmed first line starts with `{` and
  that its first JSON key (a leading `"key":` before any other key) is a member
  of the existing `ENVELOPE_KEYS` set. Only then parse and call
  `isEnvelopeLike`.
- A first key outside the set (`config`, `suites`, `stats`, `errors`, a legacy
  feature key) is not a Messages candidate; `sniffPlaywright` parses the file
  once.
- `isEnvelopeLike` still confirms the full shape after the parse, so a
  hand-written `{"meta": ...}` still needs a valid envelope body. Messages with
  a BOM, blank leading lines or whitespace are trimmed before the check.
- A one-line Playwright report now has exactly one `JSON.parse` call over the
  file; a one-line Messages report still has one. Legacy and JUnit detection are
  untouched.

The key set is the existing `ENVELOPE_KEYS` in `src/input/messages.ts`; it is
exported or shared rather than duplicated.

### 5. Full attempt tie (moved to the quality pass)

`0.6.1-quality-pass` now owns this rule: its missing/equal-retry acceptance test
needs `latestAttempt` to select the later start, not only the adapter's final
index. That change updates `src/report/index-run.ts` and states the requirement
under report rendering. This change does not edit `latestAttempt` and does not
restate the requirement; the pre-flight task confirms the quality-pass rule is
present before Red.

### 6. Legacy run time

Current behaviour (`src/input/legacy.ts`):

```ts
const startedAt = Math.floor((options.startedAt ?? new Date()).getTime() / 1000);
```

`testRunStarted` and every `testCaseStarted` use this value. A legacy report
generated a week after the test run shows the generation time as the run start.

Change:

```ts
const startedAt = options.startedAt
  ? Math.floor(options.startedAt.getTime() / 1000)
  : 0;
```

- No `new Date()` call. Without `options.startedAt` the run and scenario
  timestamps are zero and the synthetic clock SHALL stay at zero rather than
  advancing by step durations, so every `testCaseStarted` remains zero. A
  non-zero `testRunFinished` from a duration is not a run start; the start
  stays unknown.
- `0.6.1-quality-pass` adds the model rule that a zero timestamp is unknown: no
  header date and no scenario `1970` date. This change depends on that rule and
  lands after it. The pre-flight task confirms the rule before Red.
- An explicit non-zero `options.startedAt` still pins the date for tests and
  callers and keeps the advancing clock. An explicit epoch timestamp is zero and
  follows the zero-is-unknown rule.
- A real Messages run is unchanged. The JSON summary has no date field, so its
  bytes do not change from this fix.

### 7. ISO 8601 history timestamps

Current behaviour (`isIsoTime`, `src/history.ts`):

```ts
const time = Date.parse(value);
return Number.isFinite(time) && new Date(time).toISOString() === value;
```

The round-trip requires exactly the writer's `...000Z` form. A valid
`2026-11-19T08:00:00+02:00` or a `Z` value without milliseconds is rejected.

Change: accept a strict ISO 8601 timestamp with a zone, optional seconds and
optional fractional seconds:

```text
YYYY-MM-DDTHH:mm[:ss[.fraction]] (Z | ±HH:MM)
```

plus a finite `Date.parse`. Keep the original string in `recordedAt`; do not
normalise it to `toISOString()`. Reject a zone-less value and free text with the
existing `recordedAt must be an ISO timestamp` error. The CLI's newly recorded
run keeps `toISOString()` (`...000Z`); `writeHistory` keeps an accepted stored
string as given. A read never rewrites.

### 8. JUnit XML entities

Current behaviour (`src/input/junit.ts`):

- `checkEntityReferences` accepts only `amp`, `lt`, `gt`, `quot`, `apos` and
  numeric references whose code point is an XML character.
- The parser is configured with `htmlEntities: true` (line 389), but the checker
  runs before parsing and rejects `&nbsp;` with the invalid-entity error.
  `htmlEntities: true` therefore changes no accepted input and is dead.

Change: remove `htmlEntities: true`. Keep the checker and its error text. The
only accepted named entities stay the five XML ones; `&#160;` and `&#xA0;` are
accepted as numeric references; `&nbsp;` remains rejected and no partial report
is written. `docs/JUNIT-XML.md` states the rule. This is a dead-option removal,
not a behaviour change.

### 9. Compat merge spread

Current behaviour (`src/compat/cucumber-html-reporter.ts`):

```ts
existing.elements.push(...elements);
```

A duplicate feature with about 70,000 elements exceeds the engine's argument
limit and throws `RangeError: Maximum call stack size exceeded`. A 70k-element
feature is under the 100 MB cap, so a valid input can fail.

Change:

```ts
for (const element of elements) existing.elements.push(element);
```

Small-input sidecar bytes, order and `retried: 0` stay identical. The 130k test
is bounded by memory and JSON serialization, not by the call stack.

### 10. Release gate

Current behaviour after commit `31dd112` (`.github/workflows/release.yml`):

- `gate-linux` runs `npm audit`, `npm run hygiene`, `npm run check` and
  `npm run test:e2e`;
- `gate-macos` runs `npm run test:e2e`;
- `publish` needs `[gate-linux, gate-macos]`, checks
  `"v$(node -p "require('./package.json').version")" = "$GITHUB_REF_NAME"`,
  fetches `origin/main` and checks `git merge-base --is-ancestor HEAD FETCH_HEAD`,
  then packs, installs, smokes and runs `npm stage publish --provenance`.

Change: none to the workflow. Add `test/release-workflow.test.ts`, which reads
the workflow file and asserts the two gates, their commands, the `needs` entry,
the tag/version check and the main-ancestor check. A regression in the workflow
fails the unit gate; a green tag follows the recorded path to the package smoke
and stage step. This is verification only.

### 11. Owner-only output (decision)

Current behaviour (`writeAtomic`, `src/output.ts`): the temporary file is created
with `mode: 0o600` and renamed into place, so a POSIX report, email, PDF,
history sidecar or compat sidecar is owner-only. Windows ignores the mode and
inherits the destination ACL.

Decision: keep `0600`. Reports and attachments can contain tokens, private
paths or screenshots. A shared CI artifact or multi-user host can copy or
`chmod` the file explicitly; no option is added. `SECURITY.md` and
`docs/LIMITATIONS.md` state the POSIX mode and the Windows behaviour, and the
trade-off that a service account or another user cannot read the file until the
permissions are changed. No requirement delta and no production code change.

## Data flow

```text
inputs
  -> detectInput (single-parse first-line check)
  -> adapters (legacy URI/home and run time, JUnit entities, compat merge)
  -> normalised Cucumber Messages
  -> indexRun (attempt selection; the full tie is fixed by the quality pass)
  -> ReportModel / summarizeIndex (display URI, media data URI, comparator)
  -> renderHtml (tag order, feature order from resolved input order)
  -> writeAtomic (0600 on POSIX)
```

History is separate: `readHistory` (bounded read, ISO 8601 validation) →
returned runs; `writeHistory` (same validation, `toISOString()` writer form,
atomic write). The release path is tag → Linux gate → macOS gate → publish
checks → package smoke → `npm stage publish`.

## Hard parts and risks

- **URI prefix and home segment.** Removing `file://` must keep the third slash;
  Windows `file:///C:/...` becomes `/C:/...`, not `C:/...` with a lost drive.
  `/mnt/c/Users/...` needs the mount removed before the home segment. A relative
  path that begins with `home/...` or a path whose home segment is not leading is
  not covered; the privacy promise is about absolute paths and file URLs, and the
  last-three fallback still applies. Preserve relative paths and the
  `/features/` marker.
- **Surrogate fallback.** `Buffer.from(body, 'utf8')` substitutes U+FFFD for an
  unpaired surrogate; the original code unit cannot be represented in UTF-8.
  The test asserts a valid base64 data URI and no throw, not byte identity.
  Unconditional base64 would change every normal media data URI, so the
  try/catch branch is deliberate.
- **Comparator output change.** Non-ASCII order changes for summary, CI,
  baseline not-in-run rows and tags. Existing fixtures with such names may
  change bytes; re-pin only after inspecting that the diff is order-only. A
  child-process locale test must set both `LANG` and `LC_ALL` on POSIX; if the
  host ignores them, the test substitutes a locale-sensitive
  `localeCompare` to prove the comparator is not called.
- **Legacy date re-pin.** The removed invented date changes the two legacy
  characterization hashes and the `minimal.html` golden. The diff is a removed
  date only; the test comments that pin the clock must be updated, and the fake
  timer stays only if an unrelated output still depends on it. No other hash or
  golden is re-pinned.
- **Double-parse false negative.** A Messages envelope whose first key is not
  in `ENVELOPE_KEYS` would not be parsed as Messages. Messages envelopes are
  single-key objects, so the first key is the envelope key; the existing set is
  reused, not narrowed. `isEnvelopeLike` still confirms the parsed shape.
- **Tie order is inherited.** The quality pass owns the later-start rule and its
  tests; this change only asserts that the rule is present before Red. Do not
  duplicate it in `latestAttempt`.
- **Zero-date dependency.** Until `0.6.1-quality-pass` lands the zero-is-unknown
  model rule, a zero timestamp would render 1970. The pre-flight task confirms
  the rule; this change is sequenced after the quality pass and rebases on its
  contract and re-pinned hashes.
- **ISO regex.** The pattern accepts `T`, `Z` and `±HH:MM` with optional seconds
  and fraction; a zone-less, space-separated or free-text value is rejected.
  `Date.parse` is the finite check, not a round-trip, so valid offsets are kept
  as written. Invalid calendar dates are left to `Date.parse`; no date
  normalisation is performed.
- **JUnit dead option.** The checker runs before the parser; removing
  `htmlEntities: true` changes nothing for valid XML, and `&nbsp;` stays an
  error. Verify the parser does not decode HTML entities before the checker.
- **130k merge.** The loop avoids the argument limit but still holds 130k
  elements and a JSON string; the test stays under the input cap and uses small
  element objects. The 100 MB input cap is unchanged.
- **Release gate.** The workflow is already fixed; the test reads it as text.
  A change to step order or job names fails the test and must be reviewed as a
  release-contract change, not silently re-recorded.
- **0600 trade-off.** Owner-only files are safer against local snooping but can
  block a service account or shared artifact reader until permissions change.
  No option is added; the docs state the consequence. Windows ACLs are not
  changed or emulated.

## Tests

- **URI privacy:** `test/summary.test.ts` and `test/model.test.ts` cover POSIX
  `file:///home/<user>/...`, WSL `/mnt/c/Users/<user>/...`, Windows
  `file:///C:/Users/<user>/...`, an absolute path without `/features/`, a deeper
  path, a relative path, a missing URI and the model feature-name fallback.
  `test/cli-edge.test.ts` checks the `--json` `uri` and `feature` fields;
  `test/e2e/clipboard.spec.ts` checks copied failure text. Every assertion names
  `<user>` as forbidden.
- **Surrogate media:** `test/render-attachments.test.ts` and
  `test/model.test.ts` cover an unpaired high and low surrogate in an image,
  video and audio body, a normal UTF-8 body, a BASE64 body, an empty body and a
  valid surrogate pair. Assert no throw, the base64 fallback prefix, readable
  normal output and unchanged BASE64 output.
- **Comparator:** `test/summary.test.ts`, `test/input-resolve-scan.test.ts`,
  `test/baseline-matcher.test.ts` and `test/render-report.test.ts` cover the
  four call sites. A child process runs the same directory input with
  `LANG=sv_SE` and `LANG=de_DE` (and `LC_ALL`) and asserts byte-identical JSON,
  CI Markdown and report feature/tag order for `apple`, `Zebra`, `Äpfel`.
- **Single parse:** `test/input-detect.test.ts` spies on `JSON.parse` and asserts
  one call for a one-line Playwright report, one for a one-line Messages
  envelope, and correct classification for multi-line Playwright, legacy,
  JUnit, malformed JSON, BOM/blank-line and non-envelope first-key inputs.
- **Legacy date:** `test/legacy.test.ts`, `test/model.test.ts` and
  `test/render-report.test.ts` cover no `options.startedAt`, an explicit pin, a
  real Messages run and zero/non-zero durations. Assert no date, no `1970`, the
  pinned date and an unchanged summary shape. The two legacy characterization
  hashes and `test/fixtures/render-golden/minimal.html` are re-pinned for the
  removed date, with the diff recorded; no other hash changes.
- **ISO 8601:** `test/history.test.ts` and `test/cli-history.test.ts` cover the
  writer form, `Z` without milliseconds, `+02:00`, a negative offset, optional
  seconds, 1/3/9 fraction digits, no zone, free text, an invalid offset and a
  byte-identical read.
- **JUnit entities:** `test/junit.test.ts` covers the five XML named entities,
  `&#160;`, `&#xA0;`, `&nbsp;`, an unknown named entity, an out-of-range
  numeric reference, CDATA declaration text, explicit and directory input, and
  no partial report.
- **Compat merge:** `test/compat-sidecar.test.ts` covers two same-URI features
  with about 65k elements each (130k total), one element, an empty feature,
  order stability, `retried: 0` and valid JSON. Assert no `RangeError`.
- **Release gate:** `test/release-workflow.test.ts` covers tag/version
  match/mismatch, tag on/not on main, both gates present and a green path to
  the package smoke and stage step. No workflow code is changed.
- **0600 verification:** on POSIX, inspect the mode of a generated report, email
  or history file and record `600`; on Windows, record that the mode is not
  meaningful and the ACL is inherited. This is a verification step, not a
  requirement delta.

## ADRs

- [ADR 0004](../../../docs/adr/0004-normalize-to-messages.md): legacy JSON and
  Messages keep one model and one renderer; the legacy URI and run-time rules
  live in the adapter, not in a second renderer.
- [ADR 0002](../../../docs/adr/0002-single-package-esm-node22.md): no new
  dependency; the comparator, ISO check, merge loop and base64 fallback use
  Node built-ins.
- [ADR 0006](../../../docs/adr/0006-inline-attachments.md): attachments stay
  inside the single HTML file; the base64 fallback keeps a malformed media body
  inline instead of dropping the attachment or splitting assets.

## Open questions

1. **User spec approval.** This contract requires the user's explicit approval
   before Red. The nine fixes, the inherited tie rule and the `0600` decision are
   fixed by the coordinator; no product question is open. If the quality-pass
   zero-date or tie rule changes while that change is being edited, this change
   rebases and re-checks the dependency before Red.
