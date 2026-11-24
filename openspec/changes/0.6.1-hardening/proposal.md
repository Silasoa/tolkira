# 0.6.1-hardening

## Why

A second external audit of the 0.6.0 code found nine findings that the first
audit and its `0.6.1-quality-pass` change do not cover. One further finding, an
attempt and timestamp tie that selects the first start, is fixed by
`0.6.1-quality-pass` because its missing/equal-retry rule needs the same model
selection; this change does not duplicate it. No remote issue exists; this
change is the tracking record. The first audit's twelve defects,
B-048/B-039/B-049/B-054 and the path trust-model note remain in the separate
quality-pass change.

- **Privacy:** `file:///home/<user>/proj/login.feature` and
  `/mnt/c/Users/<user>/...` leak the local user name because the display-URI rule
  strips `file://` by removing the slashes and returns a relative path before
  the home-directory removal. The raw `pickle.uri` also becomes the feature-name
  fallback.
- **Crashes:** a lone UTF-16 surrogate in a non-base64 image, video or audio
  body makes `encodeURIComponent` throw and aborts the whole report. A compat
  merge of about 70,000 duplicate elements throws `RangeError` from a spread.
- **Determinism:** four sorts use `localeCompare`, so the same input produces
  different `--json`, CI Markdown and report order on a `sv_SE` or `de_DE` host.
- **Performance:** a 10-100 MB one-line Playwright report is parsed twice,
  once as a candidate Messages line and once as a Playwright document.
- **Wrong output:** legacy JSON without `options.startedAt` invents the
  generation time as the run start.
- **Input compatibility:** valid ISO 8601 offsets such as
  `2026-11-19T08:00:00+02:00` are rejected by the history reader. JUnit's
  `htmlEntities: true` is unreachable because the entity checker rejects every
  named entity outside the five XML ones.
- **Process:** the release workflow used to run only `npm run check`, so a tag
  could stage without `npm run hygiene` or the browser suite. Commit `31dd112`
  already adds the two gates and the tag/version and main checks; this change
  records and verifies the requirement.
- **Decision:** `writeAtomic` creates owner-only files (`0600`). The mode stays
  as the safe default for reports and attachments that may contain secrets; it
  is documented, not changed.

The patch hardens the 0.6.0 surface. It adds no feature, option, dependency,
public API or schema change.

## What Changes

**Privacy and crashes**

- **Display URIs:** `displayUri` and the legacy `normalizeUri` preserve the
  leading slash when removing a `file://` prefix, handle the Windows
  `/C:/Users/...` form, and drop a leading `Users`, `home` or
  `Documents and Settings` segment plus the next segment on an absolute path or
  file URL. The report model uses `displayUri` for its feature-name fallback.
  Relative URIs stay unchanged and the existing `/features/` marker and
  last-three-segments fallback stay where they apply. For an absolute path or
  file URL, no local user name appears in a display URI in the HTML, the
  `--json` `uri` field or copied failure text; a relative path that starts with
  a home segment stays unchanged and is outside this rule. The summary `feature`
  field keeps its current empty fallback.
- **Surrogate media:** a non-base64 image, video or audio body that cannot be
  percent-encoded falls back to a base64 data URI built from its UTF-8 bytes.
  A normal UTF-8 body keeps its readable data URI, a BASE64 body stays
  byte-identical, and an empty body renders no data URI. A media body with an
  unpaired surrogate no longer aborts the report.
- **Compat merge:** duplicate features merge their elements with an element-by-
  element append instead of a spread, so about 130,000 elements neither throw
  `RangeError` nor lose order.

**Determinism and performance**

- **Fixed comparator:** one shared UTF-16 code-unit comparator replaces every
  `localeCompare` in a deterministic sort: summary scenarios, resolved input
  files, baseline not-in-this-run rows and report tag order. Report feature order
  follows the fixed resolved-input order. The same inputs produce byte-identical
  `--json`, CI Markdown and report order under different host locales. The
  visible order for non-ASCII names changes; the changelog says so. No
  dependency is added.
- **Single parse:** before parsing a candidate first line as a Messages
  envelope, the detector checks that the trimmed line starts with `{` and that
  its first key is a known envelope key. Only then does it parse and confirm.
  A one-line Playwright report is classified as Playwright with one parse of the
  file; Messages, legacy, JUnit and malformed JSON classification is unchanged.

**Correctness and input compatibility**

- **Legacy run time:** legacy JSON uses `options.startedAt` as the only date
  source. Without it, the adapter emits a zero timestamp and never calls
  `new Date()`. The zero-timestamp-is-unknown model rule added by
  `0.6.1-quality-pass` keeps the report date and scenario `1970` dates out of
  the output. The JSON summary has no date field and does not change; a real
  Messages run is unchanged. The two legacy characterization hashes and the
  `minimal.html` golden are re-pinned for the removed date; that re-pin is part
  of this change.
- **History ISO 8601:** the reader accepts a strict timestamp with a zone (`Z`
  or `±HH:MM`), optional seconds and optional fractional seconds, and a finite
  `Date.parse`. It keeps the original string, rejects a zone-less or free-text
  value, and never rewrites on read. The CLI's new-run writer keeps emitting
  `YYYY-MM-DDTHH:mm:ss.sssZ`.
- **JUnit entities:** only the five XML named entities and numeric character
  references are accepted. The dead `htmlEntities: true` option is removed;
  `&nbsp;` keeps the existing invalid-entity error. `docs/JUNIT-XML.md` states
  the rule. No behaviour change beyond the dead option removal.

**Process and decision**

- **Release gate:** the release workflow runs a Linux gate (`hygiene`, `check`,
  `e2e`), a macOS gate (`e2e`), and a publish job that needs both, requires the
  tag to match `package.json` and requires the tag to be on `main`. Commit
  `31dd112` implements it; this change adds a regression test and no workflow
  code.
- **Owner-only output:** the existing `0600` mode stays. `SECURITY.md` and
  `docs/LIMITATIONS.md` state that Tolkira-written files are owner-only on
  POSIX and inherit Windows ACLs. No code change and no requirement delta.
- `docs/CHANGELOG.md` extends the existing `0.6.1` Unreleased section. The
  package version stays 0.6.0 and this change creates no tag, stage or publish.

## Impact

- **Capabilities:** `report-rendering`, `input-formats`, `cli-api`,
  `compatibility` and `test-infrastructure`.
- **Code:** `src/summary.ts` (display URI and comparator), `src/input/legacy.ts`
  (URI and run time), `src/report/model.ts` (attachment fallback and feature
  name), `src/text.ts` (shared comparator), `src/input/load.ts`,
  `src/baseline.ts`, `src/render/report.ts` (comparator call sites),
  `src/input/detect.ts` (single parse), `src/input/messages.ts` (shared envelope
  key set), `src/history.ts` (ISO 8601), `src/input/junit.ts` (dead option) and
  `src/compat/cucumber-html-reporter.ts` (merge loop). `src/report/index-run.ts`
  is not touched; the attempt tie belongs to the quality pass. `src/output.ts`
  and `.github/workflows/release.yml` do not change.
- **Tests:** `test/summary.test.ts`, `test/model.test.ts`,
  `test/render-attachments.test.ts`, `test/input-resolve-scan.test.ts`,
  `test/baseline-matcher.test.ts`, `test/render-report.test.ts`,
  `test/input-detect.test.ts`, `test/model-summary-cross-check.test.ts`,
  `test/legacy.test.ts`, `test/history.test.ts`, `test/cli-history.test.ts`,
  `test/junit.test.ts`, `test/compat-sidecar.test.ts`, `test/cli-edge.test.ts`
  and a new `test/release-workflow.test.ts`. One browser clipboard assertion
  covers the copied failure text.
- **Docs:** `SECURITY.md`, `docs/LIMITATIONS.md`, `docs/JUNIT-XML.md`,
  `docs/AGENT-INTERFACE.md`, `docs/ARCHITECTURE.md`,
  `docs/DROP-IN-VALIDATION.md` and `docs/CHANGELOG.md`.
- **Output:** HTML display URIs, feature-name fallbacks, media data URIs,
  feature/tag order and legacy run dates change where the defects apply. `--json`
  `uri` values and scenario order change the same way; the `feature` field keeps
  its empty fallback. The summary schema stays version 2, the history schema
  keeps versions 1 and 2, and no field is added. The JUnit dead-option removal is
  byte-neutral for valid input. The legacy date removal re-pins the two legacy
  characterization hashes and `test/fixtures/render-golden/minimal.html`; no
  other golden or hash is re-pinned. The release workflow bytes do not change in
  this change.
- **Dependency and API surface:** no runtime dependency, CLI option, public API
  signature or schema version changes.
- **Release:** lands in 0.6.1 after `0.6.1-quality-pass`. This change does not
  bump the version.

## Out of scope

- The `0.6.1-quality-pass` items: B-048, B-039, B-049, B-054, audit findings
  1-12, and its path trust-model documentation.
- B-058 (attachment root allowlist) and B-065 (output inside a scanned input
  directory).
- B-057 (structure work), B-055 (strict type/lint work) and every other backlog
  row.
- New features, options, public API, summary fields, history fields, schema
  versions, adapters or redesigns.
- A behaviour change to the Playwright adapter. Its classification stays the
  same; only the redundant parse is removed.
- Changing the `0600` mode, adding a mode option or documenting Windows ACL
  changes.
- A version bump, release preparation, tag, stage or publish. The release
  remains a separate user decision after both 0.6.1 changes.

## Decisions

- **URI rule.** Strip the `file://` scheme and authority without removing the
  path root, map `/C:/...` to the Windows drive form, then drop a leading home
  segment (`Users`, `home`, `Documents and Settings`) plus the next segment on
  an absolute path, including after a drive or `/mnt/<drive>` mount.
  `displayUri` supplies the model feature-name fallback. Relative URIs stay
  unchanged; existing `/features/` and last-three behaviour stay. The privacy
  promise is the absence of the user name from a display URI on the named
  surfaces, not one particular shortened path; a relative path that happens to
  start with a home segment is not covered.
- **Comparator.** One shared comparator orders by UTF-16 code units
  (`a < b ? -1 : a > b ? 1 : 0`) for every deterministic sort. Host locale and
  ICU collation do not participate. The non-ASCII visible order change is
  documented in the changelog. No dependency.
- **Surrogate fallback.** Keep `encodeURIComponent` for normal media bodies and
  fall back to a base64 data URI only when it throws. Unconditional base64 is
  rejected because it would change every existing media data URI and report
  byte for no correction.
- **Single parse.** Reuse the existing envelope-key set. Parse the first line
  only after the `{` and first-key pre-check; `isEnvelopeLike` still confirms
  the parsed shape. A first key outside the set is left to the Playwright
  sniffer.
- **Attempt tie.** Covered by `0.6.1-quality-pass`, which needs the same model
  selection for its missing/equal-retry rule. This change does not edit
  `latestAttempt` or restate the requirement.
- **Legacy zero date.** `options.startedAt` is the only date pin. Without it the
  adapter emits zero timestamps and never reads the clock. An explicit non-zero
  pin still shows its date; an explicit epoch is zero and unknown. This depends
  on the `0.6.1-quality-pass` rule that a zero timestamp is unknown; the change
  lands after that rule and rebases on it. The removed legacy date re-pins the
  two legacy characterization hashes and `minimal.html`, and no other hash.
- **Re-pin scope.** Only the legacy date re-pin from this change may alter
  committed report bytes; the URI, comparator and other fixes change output only
  for affected input. Any other changed hash or golden is a defect, not a re-pin.
- **ISO 8601 forms.** Accept a zone (`Z` or `±HH:MM`), optional seconds and
  optional fractional seconds, with finite `Date.parse`. Preserve the original
  string; reject zone-less and free-text values; never rewrite on read.
- **XML-only entities.** Keep the existing checker and remove the dead
  `htmlEntities: true`. Only the five XML named entities and numeric references
  are valid; `&nbsp;` remains an error. The documentation states it.
- **Compat merge.** Replace the spread with a loop. Small-input output is
  byte-identical; the 130k case is bounded by memory, not the call stack.
- **0600.** Keep owner-only files as the safe default because reports and
  attachments can contain secrets. Document the POSIX mode and the Windows ACL
  inheritance in `SECURITY.md` and `docs/LIMITATIONS.md`; no option and no code
  change.
- **Release gate.** Record the workflow at commit `31dd112` as the contract and
  add a regression test. No workflow code is changed in this change.
- **Release boundary.** 0.6.1 is released after both changes, with the full
  release gate and host matrix; this change performs no version bump, tag, stage
  or publish.
