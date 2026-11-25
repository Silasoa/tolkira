# Design

## Context

0.6.0 shipped the second audit's defects on top of the first audit's fixes. The
first patch change, `0.6.1-quality-pass`, owns B-048/B-039/B-049/B-054 and audit
findings 1-12, including the model rule that a zero timestamp is unknown. This
change is the second patch, `0.6.1-hardening`: nine hardening fixes, one
attempt-tie rule inherited from the quality pass, and one documentation decision
for the owner-only output mode. It adds no feature, option, dependency or public
API.

The fixes add one small leaf module, `src/display-path.ts` (`analyzePath`), so
`displayUri` and `normalizeUri` cannot drift. One tiny comparator helper lives
in the existing `src/text.ts`; every other seam changes an existing function or
one call site. The release gate is already implemented by `31dd112`, with the
prior full-fetch correction `f448f60`; this change verifies it by a test.

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
  `featureName: feature?.name ?? pickle.uri`, so a featureless scenario (no AST
  feature) can carry the raw file URL into the report, summary and copied text.

Change:

- Add `src/display-path.ts` with `analyzePath(uri)`. It normalises backslashes,
  removes a `file:` scheme, treats an empty or `localhost` authority as local
  and turns a remote authority into the first path segment, ignoring authority
  userinfo, strips an optional drive token and a `/mnt/<drive>` mount, treats
  `%2F`/`%5C` as separators for this analysis (including a leading one), decodes
  each segment once for the home comparison, and resolves `.`/`..` and their
  percent-encoded forms for the analysis only. It then drops every `Users`,
  `home` or `Documents and Settings` segment plus the next segment anywhere in
  the absolute parts, repeatedly, including a trailing home segment. Display
  segments keep their original encoding apart from `%2F`/`%5C`, which are
  separators. The one-pass decode is the limit: a double-encoded home segment
  (`%2568ome`) is not treated as home.
- `displayUri` keeps its `/features/` marker and last-three fallback, joins the
  remaining segments with `/`, never shows a drive prefix, and returns `''` when
  no segment remains instead of the raw URI. Relative URIs stay unchanged.
- `normalizeUri` keeps its `./` removal, `/features/` marker and last-segment
  fallback plus the `features/legacy-N.feature` fallback; relative URIs stay
  unchanged. It uses the same `analyzePath`, so an absolute path without a
  `features` segment becomes its last segment, and a missing URI or a path with
  no remaining segment becomes `features/legacy-N.feature`.
- `ReportScenario.uri` and `ReportFeature.uri` stay raw because provenance keys
  and lookups use the raw URI. Every render and summary site applies
  `displayUri`: summary `uri`, baseline identities, the per-feature source label
  (`featureSourceLabel`), definition sources, copied failure text and the
  feature heading. The model fallback becomes
  `featureName: feature?.name ?? displayUri(pickle.uri ?? '')` and the
  feature-row name uses `displayUri(scenarios[0]?.uri ?? '')`. Because the
  fallback is `??`, a present-but-blank AST name leaves `featureName` empty;
  only the feature-row heading trims a blank name and falls back. The summary
  `feature` field stays `feature?.name ?? ''`, so a featureless scenario has an
  empty `feature` and no user name. No second path-shortening rule is added.

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
  unpaired code unit; the guarantee is no crash and a valid inline image or
  video source.
- An empty body still renders no data URI.
- The fallback is one branch with one test pair (image/video); no option and no
  dependency. `audio/*` is not in the media allowlist: it normalises to
  `application/octet-stream`, kind `binary`, and no inline player is produced.
  Adding an `audio/*` MIME is a separate change.

### 3. Host-locale-independent order

Current behaviour: four deterministic sorts call `localeCompare` under the
process default locale:

- `src/summary.ts`: summary scenarios by URI then name;
- `src/input/load.ts`: resolved input files;
- `src/baseline.ts`: baseline not-in-this-run rows by feature, name, example,
  URI;
- `src/render/report.ts`: tag list order.

The report model's feature order is insertion order, fed by the resolved input
order; that is the Details matrix order and the tie-break inside the Report's
status-first feature grouping (`orderFeatures`), not the top-level Report order.
Fixing the input sort keeps that order stable. Scenario and matrix ordering by
status/order is numeric and unchanged.

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

Change: accept an ISO 8601-shaped timestamp with a zone, optional seconds and
optional fraction digits:

```text
YYYY-MM-DDTHH:mm[:ss[.fraction]] (Z | ±HH:MM)
```

plus a finite `Date.parse`. Keep the original string in `recordedAt`; do not
normalise it to `toISOString()`. Reject a zone-less value and free text with the
existing `recordedAt must be an ISO timestamp` error. The CLI's newly recorded
run keeps `toISOString()` (`...000Z`); `writeHistory` keeps an accepted stored
string as given. A read never rewrites.

### 8. JUnit XML entities

Current behaviour (`src/input/junit.ts`, before the fix):

- `checkEntityReferences` accepts only `amp`, `lt`, `gt`, `quot`, `apos` and
  numeric references whose code point is an XML character. Its pattern had a
  32-character name limit, so an unknown name longer than 32 characters escaped
  the checker entirely, and a bare `&` before a later entity was not rejected.
- The parser was configured with `htmlEntities: true`, which the checker made
  unreachable for named entities, but fast-xml-parser v5 also gates numeric
  character references behind that option.

Change (kept as a deliberate design deviation, not dead code):

- Remove `htmlEntities: true` and replace it with an internal `xmlEntityDecoder`
  because v5 gates numeric references behind `htmlEntities`; the decoder decodes
  only the five XML names and numeric character references, so `&nbsp;` still
  has no decode path.
- Move the five names into one `XML_ENTITIES` map shared by the checker and the
  decoder, so the accepted set cannot drift.
- Scan forward from every `&` to the next `&` or `;`. A second `&` or the
  fragment end before a `;` is a bare ampersand and fails, so `a & b &amp; c`
  is rejected in text and in a quoted attribute as well as in an unterminated
  tail. One pass reaches each character once, so a long bare-`&` run stays
  linear.
- There is no name-length cap: an unknown named entity of any length, including
  a 33-character name, is rejected. Decimal (`&#...;`) and hex (`&#x...;`)
  references must denote an XML character.
- The error echoes at most the first 64 characters of the entity name plus
  `...`, so a huge name cannot inflate stderr; the full name is not printed.
- `&#160;` and `&#xA0;` stay accepted as numeric references; `&nbsp;` remains
  rejected and no partial report is written. `docs/JUNIT-XML.md` states the rule.

This answers STR's N2: the option is removed with a replacement, not left as
dead code.

### 9. Compat merge spread

Current behaviour (`src/compat/cucumber-html-reporter.ts`):

```ts
existing.elements.push(...elements);
```

A duplicate feature with about 70,000 elements does not exceed the argument
limit, because the spread receives only that feature's own elements. The real
boundary is a one-element first feature plus a 200,000-element duplicate, which
throws `RangeError: Maximum call stack size exceeded` around the engine's
roughly 130,000-argument limit. A 200k-element feature is under the 100 MB cap,
so a valid input can fail. The 65,000 + 65,000 test is the 130,000-element shape
and order case.

Change:

```ts
for (const element of elements) existing.elements.push(element);
```

Small-input sidecar bytes, order and `retried: 0` stay identical. The 200,000
element test is bounded by memory and JSON serialization, not by the call stack.

### 10. Release gate

Current behaviour (`31dd112`, `.github/workflows/release.yml`):

- `gate-linux` runs `npm audit`, `npm run hygiene`, `npm run check` and
  `npm run test:e2e`;
- `gate-macos` runs `npm run test:e2e`;
- `publish` needs `[gate-linux, gate-macos]`, checks
  `"v$(node -p "require('./package.json').version")" = "$GITHUB_REF_NAME"`,
  fetches `origin/main` and checks `git merge-base --is-ancestor HEAD FETCH_HEAD`,
  then packs, installs, smokes and runs `npm stage publish --provenance`.

`31dd112` added the gates, the `needs` entry, and the tag/version and
main-ancestor checks, but fetched `origin/main` with `--depth=1`. `f448f60`
replaced that with the full fetch, which the ancestor check needs and which
`test/release-workflow.test.ts` pins. This change edits no workflow file.

Change: add `test/release-workflow.test.ts`, which reads active `run:` lines and
asserts the two gates, their commands, the `needs` entry, the tag/version check,
the main-ancestor check and the full (unshallow) fetch. A regression in the
workflow fails the unit gate; a green tag follows the recorded path to the
package smoke and stage step. This is verification of the prior commits; no
workflow edit is part of this change.

### 11. Owner-only output (decision)

Current behaviour (`writeAtomic`, `src/output.ts`): the temporary file is created
with `mode: 0o600` and renamed into place, so a POSIX report, email, PDF, CI
Markdown (`--ci-out`), history sidecar or compat sidecar is owner-only. Windows
ignores the mode and inherits the destination ACL.

Decision: keep `0600`. Reports and attachments can contain tokens, private
paths or screenshots. On POSIX, a shared CI artifact or multi-user host can copy
or `chmod` the file explicitly; no option is added. On Windows, the inherited
destination ACL decides, so a folder that already grants read exposes the file
without a permission change. `SECURITY.md` and `docs/LIMITATIONS.md` state the
POSIX mode, the Windows behaviour and the trade-off. No requirement delta and no
production code change.

## Data flow

```text
inputs
  -> detectInput (single-parse first-line check)
  -> adapters (legacy URI/home and run time, JUnit entities, compat merge)
  -> normalised Cucumber Messages
  -> indexRun (attempt selection; the full tie is fixed by the quality pass)
  -> ReportModel / summarizeIndex (raw model URIs, display at output, media
     data URI, comparator)
  -> renderHtml (tag order; status-first features with resolved-input order as
     tie-break; Details matrix in resolved-input order)
  -> writeAtomic (0600 on POSIX)
```

History is separate: `readHistory` (bounded read, ISO 8601 validation) →
returned runs; `writeHistory` (same validation, `toISOString()` writer form,
atomic write). The release path is tag → Linux gate → macOS gate → publish
checks → package smoke → `npm stage publish`.

## Hard parts and risks

- **URI prefix and home segment.** Removing `file:` must keep the path absolute:
  Windows `file:///C:/...` becomes `/C:/...`, not `C:/...` with a lost drive.
  `/mnt/c/Users/...` needs the mount removed before the home rule. The absolute
  analysis ignores authority userinfo, treats a leading `%2F`/`%5C` as a
  separator, decodes each segment once for the home comparison, and resolves
  `.`/`..` (also `%2e`/`%2e%2e`) before it, so `%68ome`, a dot segment after
  `/home/`, and a parent segment before the user name cannot hide a pair. The
  home rule is not leading-only: it drops a `Users`, `home` or
  `Documents and Settings` segment and the next segment anywhere in the absolute
  parts, repeatedly, including a trailing home segment. A relative path that
  begins with `home/...` stays outside the rule.
  When no part remains the display URI is `''`, never the raw path. Display
  segments keep their original encoding apart from `%2F`/`%5C`, which are
  separators. The comparison decodes once only: a double-encoded home segment is
  not treated as home and is outside the guarantee. Preserve relative paths and
  the `/features/` marker.
- **Surrogate fallback.** `Buffer.from(body, 'utf8')` substitutes U+FFFD for an
  unpaired surrogate; the original code unit cannot be represented in UTF-8.
  The test asserts a valid base64 data URI and no throw, not byte identity.
  Unconditional base64 would change every normal media data URI, so the
  try/catch branch is deliberate. Audio is not a reachable media kind: it is an
  octet-stream binary attachment.
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
  as written. Calendar-day validity is `Date.parse`'s: a nonexistent day such as
  `2026-02-30` is accepted (`Date.parse` rolls it forward), while the stored
  string is not rewritten. The pattern allows an offset up to `+23:59`;
  `+25:00` and an offset without a colon are rejected. No date normalisation is
  performed.
- **JUnit entity scan.** The checker runs before the parser. `htmlEntities` is
  replaced by the internal XML-only decoder, so numeric references still decode
  and HTML names stay rejected. One forward scan rejects a bare `&` before a
  later entity in text or a quoted attribute and an unknown name of any length;
  a 33-character unknown name is rejected like any other, and the echoed name is
  capped at 64 characters plus `...`. Numeric references outside the XML
  character ranges are rejected.
- **200k merge.** The loop avoids the argument limit but still holds 200,001
  elements and a JSON string; the test stays under the input cap and uses small
  element objects. The 100 MB input cap is unchanged.
- **Release gate.** The workflow checks are `31dd112`; the full fetch is
  `f448f60`. The test reads active `run:` lines, so a change to step order, job
  names, the fetch depth or a commented-out gate fails, and must be reviewed as
  a release-contract change, not silently re-recorded.
- **0600 trade-off.** Owner-only files are safer against local snooping. On
  POSIX they can block a service account or shared artifact reader until
  permissions change; on Windows the inherited destination ACL decides, so a
  folder that already grants read exposes the file. No option is added and
  Windows ACLs are not changed or emulated.

## Tests

- **URI privacy:** `test/summary.test.ts` and `test/model.test.ts` cover POSIX
  `file:///home/<user>/...`, one-slash `file:/home/<user>/...`, localhost, a
  remote file URL and UNC, WSL `/mnt/c/Users/<user>/...`, Windows
  `file:///C:/Users/<user>/...`, percent-encoded `%2F`/`%5C` separators including
  a leading one, percent-encoded home segments (`%68ome`, `%55sers`,
  `Documents%20and%20Settings`), dot and parent segments (plain and
  `%2e`/`%2e%2e`), authority userinfo, a home segment below another directory, a
  drive before `Users`, a home-only path (empty display URI), an absolute path
  without `/features/`, a deeper path, a relative path, a missing URI,
  idempotency, a repeated-home linear-time case and the featureless model
  feature-name fallback. `test/legacy.test.ts` covers the adapter's URI table:
  one-slash, localhost, remote and UNC forms, percent-encoded separators and
  leading separators, a home segment below another directory, a drive before
  `Users`, a home-only path and its `features/legacy-N.feature` fallback, and a
  `features` marker above a home segment, all reduced to the last segment or
  marker path. `test/render-source-strip.test.ts` covers raw provenance with
  absolute and file-URL URIs; the strip shows the input basename, not
  `displayUri`. `test/render-report.test.ts` covers the unnamed-feature heading.
  `test/cli-edge.test.ts` checks the `--json` `uri` and `feature` fields;
  `test/e2e/clipboard.spec.ts` checks copied failure text. Every assertion names
  `<user>` as forbidden where the form is in scope.
- **Surrogate media:** `test/render-attachments.test.ts` and
  `test/model.test.ts` cover an unpaired high and low surrogate in an image and
  video body, a normal UTF-8 body, a BASE64 body, an empty body and a valid
  surrogate pair. Assert no throw, the base64 fallback prefix, readable normal
  output and unchanged BASE64 output. `test/model.test.ts` separately asserts
  that `audio/mpeg` becomes an `application/octet-stream` binary attachment with
  no inline source.
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
  seconds, 1/3/9 fraction digits, no zone, free text, an invalid offset, the
  documented `2026-02-30` and `+23:59` boundaries and a byte-identical read.
- **JUnit entities:** `test/junit.test.ts` covers the five XML named entities,
  `&#160;`, `&#xA0;`, `&nbsp;`, an unknown named entity at 32 and 33 characters,
  a bare `&` before a later entity in text and in an attribute, a 100-character
  entity name echoed with the 64-character cap plus `...`, an out-of-range
  numeric reference, CDATA declaration text, a long bare-`&` run, explicit and
  directory input, and no partial report.
- **Compat merge:** `test/compat-sidecar.test.ts` covers two same-URI features
  with about 65k elements each (130k total, a shape and order case), a one-
  element first feature plus a 200,000-element duplicate (the real spread
  boundary), an empty feature, order stability, `retried: 0` and valid JSON.
  Assert no `RangeError`.
- **Release gate:** `test/release-workflow.test.ts` covers tag/version
  match/mismatch, tag on/not on main, both gates present, active `run:` lines
  only and a green path to the package smoke and stage step. It pins the full
  `git fetch origin main` and `fetch-depth: 0` from `f448f60`.
- **0600 verification:** on POSIX, inspect the mode of a generated report, email,
  CI Markdown or history file and record `600`; on Windows, record that the mode
  is not meaningful and the ACL is inherited. This is a verification step, not a
  requirement delta.

## Decisions

1. **Home rule anywhere, no raw fallback.** The first design dropped a home
   segment only at the start of an absolute path and kept a last-resort raw URI
   for paths it could not shorten. Reviewers showed that this does not satisfy
   "no local user name on an absolute path or file URL": `/srv/home/<user>/...`
   and a server share can carry a user name below another directory, and a
   home-only path has no safe shortened form. The rule is therefore applied
   wherever a home segment occurs in the absolute parts, and `displayUri`
   returns `''` when nothing remains. Relative paths still stay unchanged.
2. **Raw model URIs, display at the edge.** `ReportScenario.uri` and
   `ReportFeature.uri` stay raw because provenance, baseline identity and the
   source strip key and merge by the URI the producer wrote. Shortening at the
   model boundary broke the all-or-nothing source lookup for absolute and
   file-URL inputs. Every render and summary output site applies `displayUri`
   instead, so the privacy promise holds where text is shown while internal
   keys remain exact.
3. **Producer text stays evidence (approved limit).** The privacy rule is
   scoped to the display URIs Tolkira renders itself. Failure messages, stack
   traces, `system-out`/`system-err` and attachment bodies are shown, copied and
   summarised verbatim, because they are the evidence a failure is debugged
   from and rewriting them would change what the producer reported. Both host
   runs that exercise failure and log text carry a local user name in that
   payload: Cucumber-js renders its own failure stack and PetClinic copies nine
   Spring Boot log lines. The same text is in their 0.5.1 reports; this change
   neither introduces nor removes it. The maintainer approved the limit for
   0.6.1 on 2026-11-25. It is documented in `SECURITY.md` and
   `docs/LIMITATIONS.md` and tracked as B-068.

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
