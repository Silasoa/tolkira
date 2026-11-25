# Tasks

## 1. Gate

- [x] 1.1 PIR + DXR over this proposal, the five spec deltas and the design.
  Check every base requirement that mentions display URIs, attachments,
  deterministic merge/order, Playwright detection, attempt selection (owned by
  the quality pass), legacy timestamps, history schema/timestamps, JUnit
  entities, the compat sidecar and the release workflow for a contradiction.
  Fold blockers into the contract before Red.
- [x] 1.2 Confirm the seams: `src/display-path.ts` (new shared
  `analyzePath`), `src/summary.ts` (`displayUri`, scenario sort),
  `src/input/legacy.ts` (`normalizeUri`, `startedAt`/`clock`),
  `src/report/model.ts` (raw URIs, unnamed-feature fallback, `toAttachment`),
  `src/text.ts` (new comparator), `src/input/load.ts`, `src/baseline.ts`,
  `src/render/report.ts` (sort sites), `src/input/detect.ts`
  (`looksLikeMessages`/`sniffPlaywright`/escaped first key),
  `src/input/messages.ts` (shared envelope key set), `src/history.ts`
  (`isIsoTime`), `src/input/junit.ts` (entity scan, `XML_ENTITIES`,
  `xmlEntityDecoder`), `src/compat/cucumber-html-reporter.ts` (merged element
  append) and `.github/workflows/release.yml` (gates in `31dd112`, full fetch in
  `f448f60`). Confirm no new dependency, option or public API.
  `src/report/index-run.ts` is not touched.
- [x] 1.3 Record the decisions before Red: the URI rule (a home segment
  anywhere in an absolute path plus the segment after it, no raw fallback, and
  raw model URIs with display at every output site) and its relative-path
  boundary, the single UTF-16 comparator, the try/catch base64
  media fallback with `audio/*` outside the allowlist, the first-key parse
  check, the legacy zero timestamp with its dependency on the
  `0.6.1-quality-pass` zero-is-unknown model rule, the ISO 8601 forms, the
  `xmlEntityDecoder` entity rule, the compat loop, the legacy-date re-pin and
  the `0600` docs decision. The attempt tie is inherited from the quality pass
  and is not re-implemented here.
- [x] 1.4 Confirm the sequencing: land after `0.6.1-quality-pass`, rebase on
  its re-pinned characterization/goldens, its zero-timestamp rule and its
  later-start tie rule, and do not edit that change. `31dd112` adds the release
  gates, the `needs` entry and the tag/version and main-ancestor checks;
  `f448f60` replaces its shallow `--depth=1` fetch with the full
  `git fetch origin main` that the ancestor check and
  `test/release-workflow.test.ts` require.
- [x] 1.5 Confirm the second audit is the tracking record and no remote issue
  exists; do not open an issue for this change without the user's direction.

## 2. TDD-Red

- [x] 2.1 URI privacy: in `test/summary.test.ts` and `test/model.test.ts`,
  cover POSIX `file:///home/<user>/...`, one-slash `file:/home/<user>/...`,
  localhost, remote file URL (`file://server/...`) and UNC
  (`//server/share/...`), WSL `/mnt/c/Users/<user>/...`, Windows
  `file:///C:/Users/<user>/...`, percent-encoded `%2F`/`%5C` separators
  including a leading one, percent-encoded home segments (`%68ome`, `%55sers`,
  `Documents%20and%20Settings`), dot and parent segments (plain and
  `%2e`/`%2e%2e`), authority userinfo, a home segment below another directory,
  a drive before `Users`, a home-only path that displays empty, an absolute path
  without `/features/`, a deeper path, a relative path, a missing URI, display
  idempotency, a repeated-home linear-time case and the model feature-name
  fallback with a raw model `uri`. In `test/legacy.test.ts` cover the adapter's
  URI table with its last-segment and `features/legacy-N.feature` fallbacks. In
  `test/render-source-strip.test.ts` assert provenance still matches absolute
  and file-URL feature URIs, and in `test/render-report.test.ts` the
  unnamed-feature heading. In
  `test/cli-edge.test.ts` assert the `--json` `uri` field is free of the marker
  user name and the `feature` field keeps its empty fallback, and in
  `test/e2e/clipboard.spec.ts` the copied failure text, all free of the marker
  user name. ISTQB: equivalence classes of scheme/drive/mount/marker/relative
  forms; a boundary path with one segment before the home segment and a
  home-only path with no remaining segment.
- [x] 2.2 Surrogate media: in `test/render-attachments.test.ts` and
  `test/model.test.ts`, cover an unpaired high and low surrogate in an image and
  video body, a normal UTF-8 body, a BASE64 body, an empty body and a valid
  surrogate pair. Assert no throw, the base64 fallback prefix, unchanged
  normal/BASE64 output and a complete report. In `test/model.test.ts` assert
  that `audio/mpeg` is an `application/octet-stream` `binary` attachment with no
  inline source, because adding an `audio/*` MIME is a separate change. ISTQB:
  decision table over encoding × kind × surrogate pair validity; boundary at the
  pair split.
- [x] 2.3 Comparator: in `test/summary.test.ts`,
  `test/input-resolve-scan.test.ts`, `test/baseline-matcher.test.ts` and
  `test/render-report.test.ts`, cover the four sort sites. A child process runs
  the same input with `LANG=sv_SE` and `LANG=de_DE` (plus `LC_ALL`) and asserts
  byte-identical JSON, CI Markdown and report feature/tag order for `apple`,
  `Zebra`, `Äpfel`. ISTQB: equivalence classes of ASCII case, non-ASCII and
  equal/prefix strings; boundary around UTF-16 code units. Fall back to a
  locale-sensitive `localeCompare` stub if the host ignores the locale
  variables.
- [x] 2.4 Single parse: in `test/input-detect.test.ts`, spy on `JSON.parse` and
  assert one call for a one-line Playwright report and one for a one-line
  Messages envelope. Cover multi-line Playwright, legacy, JUnit, malformed JSON,
  BOM/blank lines, a non-envelope first key and an envelope-like first key with
  an invalid body. ISTQB: decision table over first key × document shape ×
  parse validity; boundary at the first non-empty line.
- [x] 2.5 Legacy run time: in `test/legacy.test.ts`, `test/model.test.ts` and
  `test/render-report.test.ts`, cover no `options.startedAt`, an explicit pin, a
  real Messages run and zero/non-zero durations. Assert no report date, no
  `1970`, the pinned date and an unchanged summary shape. Assert the two legacy
  characterization fixtures and `minimal.html` change only by the removed date.
  Pre-flight: confirm the `0.6.1-quality-pass` zero-is-unknown rule is present;
  the later-start tie rule is quality-pass work, not this change. ISTQB:
  equivalence classes of absent/present explicit time and zero/non-zero
  duration; boundary at the explicit epoch timestamp, which follows the
  zero-is-unknown rule.
- [x] 2.6 ISO 8601 history: in `test/history.test.ts` and
  `test/cli-history.test.ts`, cover the writer form, `Z` without milliseconds,
  `+02:00`, a negative offset, optional seconds, 1/3/9 fraction digits, no zone,
  free text, an invalid offset, the documented `2026-02-30` and `+23:59`
  boundaries and a byte-identical read. Assert the original string is kept and
  the error text is unchanged. ISTQB: equivalence classes of zone forms and
  optional components; boundary at missing seconds/fraction.
- [x] 2.7 JUnit entities: in `test/junit.test.ts`, cover `&amp;`, `&lt;`,
  `&gt;`, `&quot;`, `&apos;`, `&#160;`, `&#xA0;`, `&nbsp;`, an unknown named
  entity, unknown named entities at 32 and 33 characters, a bare `&` before a
  later entity in text and in an attribute, a 100-character entity name capped
  at 64 characters plus `...` in the error, an out-of-range numeric reference,
  CDATA declaration text, a long bare-`&` run, explicit and directory input, and
  no partial report. ISTQB: equivalence classes of named/numeric/invalid
  references; boundary at the old 32-character name cap, at the 64-character
  echo cap and at XML character ranges.
- [x] 2.8 Compat merge: in `test/compat-sidecar.test.ts`, cover two same-URI
  features with about 65,000 elements each (130,000 total, a shape and order
  case) and a one-element first feature plus a 200,000-element duplicate, which
  is the real spread-argument boundary of the old `push(...elements)`. Also cover
  an empty feature, order stability, `retried: 0` and valid JSON. Assert no
  `RangeError`. ISTQB: boundary above the engine argument limit; equivalence
  classes of duplicate/single/empty features.
- [x] 2.9 Release gate: add `test/release-workflow.test.ts` and assert the
  Linux gate runs `hygiene`, `check` and `e2e`, the macOS gate runs `e2e`, the
  publish job needs both, the tag/version check and the main-ancestor check
  exist, the main fetch is full (`f448f60`, no `--depth`, `fetch-depth: 0`), and
  only active `run:` lines count. A green path reaches the package smoke and
  stage step. No workflow code is changed; the full-fetch fix is the prior
  `f448f60`; the test goes RED only on a contract regression. ISTQB: decision
  table over tag match × main membership × gate result.
- [x] 2.10 Confirm RED for 2.1-2.9. No existing test is deleted, skipped or
  weakened. Any assertion that encoded the old behaviour is updated in place and
  named here: the `home/<user>` display URI and the raw-URI model feature
  fallback in `test/summary.test.ts`, `test/model.test.ts`, `test/cli-edge.test.ts`
  and the clipboard spec; the invented legacy date; the summary-order assertion
  in `test/summary.test.ts`, now asserting a fixed UTF-16 code-unit order
  instead of a `localeCompare` self-sort; and the privacy table extended for the
  broadened path forms. The attempt-tie assertions belong to the quality pass
  and are not duplicated here.

## 3. Implement

- [x] 3.1 URI privacy: add `src/display-path.ts` with the shared `analyzePath`;
  make `displayUri` and `normalizeUri` remove the `file:` scheme and authority,
  handle `/C:/...`, `/mnt/<drive>` and `%2F`/`%5C`, and drop a `Users`, `home` or
  `Documents and Settings` segment plus the next segment anywhere on an absolute
  path or file URL. Return `''` when no segment remains. Use `displayUri` at
  every render and summary output site and for the unnamed-feature fallback; keep
  the model URIs raw for provenance. Keep relative URIs, the summary `feature`
  empty fallback, the `/features/` marker and the last-three/last-segment
  fallbacks. No user name in HTML display URIs, the JSON `uri` or copied text.
- [x] 3.2 Surrogate media: in `toAttachment`, keep `encodeURIComponent` for
  normal media and catch its failure to build a base64 data URI from
  `Buffer.from(body, 'utf8')`. Leave BASE64 and empty bodies unchanged.
- [x] 3.3 Comparator: add the UTF-16 code-unit comparator to `src/text.ts` and
  replace the four `localeCompare` call sites in `src/summary.ts`,
  `src/input/load.ts`, `src/baseline.ts` and `src/render/report.ts`. No
  dependency, no `Intl`.
- [x] 3.4 Single parse: in `src/input/detect.ts`, check the trimmed first line
  starts with `{` and its first key is a known `ENVELOPE_KEYS` member before
  `JSON.parse`; keep `isEnvelopeLike` as the shape confirmation. Reuse the
  existing key set.
- [x] 3.5 Legacy run time: replace `options.startedAt ?? new Date()` with an
  explicit `options.startedAt` value or zero; do not read the clock. Keep the
  synthetic clock at zero without a pin so every scenario start is zero. Confirm
  the model treats zero as unknown.
- [x] 3.6 ISO 8601 history: replace the `toISOString()` round-trip in
  `isIsoTime` with the strict zone/optional-seconds regex plus finite
  `Date.parse`; keep the original string. The CLI's new-run writer keeps
  `...000Z`.
- [x] 3.7 JUnit entities: remove `htmlEntities: true` from the parser options
  and replace it with the internal `xmlEntityDecoder` that fast-xml-parser v5
  needs for numeric references; share the five names through one `XML_ENTITIES`
  map. Scan forward from each `&` to the next `&` or `;`, reject a bare `&`
  before a later entity in text and quoted attributes, reject unknown names of
  any length and require a numeric reference to denote an XML character. Cap
  the echoed entity name at 64 characters plus `...`. Keep
  `checkEntityReferences` and its error. Add the XML-only entity line to
  `docs/JUNIT-XML.md`.
- [x] 3.8 Compat merge: replace `existing.elements.push(...elements)` with a
  `for...of` append; keep order and `retried: 0`.
- [x] 3.9 Release gate: this change edits no workflow file. `31dd112` contains
  the Linux and macOS gates, the `needs` entry, the tag/version check and the
  main-ancestor check; the prior `f448f60` replaces `git fetch origin main
  --depth=1` with the full fetch. Record both commits and keep the workflow test
  green.
- [x] 3.10 Re-pin the two legacy characterization hashes and
  `test/fixtures/render-golden/minimal.html` for the removed invented date.
  Inspect the diff: only the date removal is allowed. Update the stale comments
  in `test/render-characterization.test.ts` and `test/render-golden.test.ts`
  that describe the legacy `new Date()` fallback; keep a fake timer only where
  an unrelated output still needs it.
- [x] 3.11 Docs and changelog: `SECURITY.md` (owner-only 0600 on POSIX, Windows
  ACL inheritance, the shared-artifact trade-off), `docs/LIMITATIONS.md` (same,
  with the no-option boundary), `docs/AGENT-INTERFACE.md` (history ISO 8601
  forms, the display-URI analysis and the legacy adapter fallbacks),
  `docs/ARCHITECTURE.md` (one comparator, the input-order tie-break, the
  display-URI analysis and the JUnit entity check) and `docs/CHANGELOG.md`
  (extend the existing `0.6.1` Unreleased section with the nine fixes, the
  inherited tie rule, the non-ASCII order change and the 0600 note). Do not
  change `package.json` (`version` stays 0.6.0) and do not create a tag, stage or
  publish. The host rows are not part of this task.

## 4. Verification and review

- [x] 4.1 `npm run hygiene`, `npm run check` and `npm run test:e2e`
  (report-level change) are green; typecheck, lint, unit tests and build
  included. Record the exact counts, the client bundle size, the report byte
  delta and the legacy-date characterization/golden re-pin.
- [ ] 4.2 Independent reviewers in one batch: SCR (all five deltas), CR, DAR
  (including the 0600 and JUnit docs), SEC (URI privacy, surrogate bodies, JUnit
  entities, ISO 8601 history input), PCA (detection, surrogate and URI changes,
  comparator), STR (module/test health), UXR and CMP (report order and legacy
  date; only the intended order/date changes). A failing review spawns a fixer,
  not the implementer of record.
- [x] 4.3 Host rows in `docs/DROP-IN-VALIDATION.md`: official Cucumber-js host
  (legacy JSON and Messages), Seed-Test legacy JSON, Spring PetClinic JUnit, the
  `cucumber-html-reporter` shim (including the merged sidecar) and the Playwright
  JSON host (display URI/feature fallback and report order). Record host, pin,
  artifact and result; confirm no local user name in the report/JSON/copied
  text, no invented legacy date, stable order, the JUnit entity behaviour and
  the shim merge. The other release rows stay for the release pass. This task
  owns the `docs/DROP-IN-VALIDATION.md` rows that 3.11 deliberately does not
  write. Recorded on 2026-11-25: the display-URI rule is green on every row.
  Producer-written failure and log text is shown without redaction (except the
  Playwright error-text path scrub); the Cucumber-js failure
  stack and nine PetClinic `system-out` lines name the OS user. The maintainer
  approved that limit on 2026-11-25; it is recorded in the design Decisions,
  `SECURITY.md`, `docs/LIMITATIONS.md` and B-068.
- [x] 4.4 Gate record: commands, results, characterization/golden evidence with
  the date-only diff, the URI fixture table, the surrogate table, the comparator
  child-process output, the parse-count evidence, the ISO form table, the JUnit
  entity table, the 200k merge result, the release-workflow test output, the
  0600 POSIX mode check and the host rows. Deferred findings get a backlog
  trigger; nothing is dropped silently.
- [ ] 4.5 Fix every review finding or record a decision with a trigger; re-run
  the gate after fixes.

## 5. Release boundary

- [x] 5.1 Do not bump the version, tag, stage or publish. 0.6.1 preparation and
  approval remain a separate user decision after this change and
  `0.6.1-quality-pass` are complete and reviewed.

## Gate record (2026-11-25)

### Gate

| Check | Result |
| --- | --- |
| `npm run hygiene` | `hygiene: ok`, 850 tracked files / 417 commits |
| `npm run check` | catalog 203 keys / 2 locales; typecheck, lint and build green; 92 test files, 1,764 passed / 10 skipped (1,774) |
| `npm run test:e2e` | 454 passed / 8 skipped (462) on Chromium, Firefox and WebKit, 2.1 min |
| CI for `929ed97` | green: hygiene, check (22/24/26), check-windows, e2e, e2e-macos, package |
| Client bundle | `client-bundle.ts` 15,438 bytes (budget 16,000); styles 41,119 + 1,058 bytes |

Report byte delta on the fixed-clock goldens: `minimal.html` 66,458 -> 66,350
(-108), `attachments-presentation.html` 70,634 -> 70,634 (0). The -108 B is
exactly the three removed legacy date spans (report header, analysis header,
scenario `Started:` cell; 33 + 33 + 42 characters) plus the self-reported
`Report HTML` size line; the Messages golden keeps its real timestamp.
`minimal.html` was re-pinned in `ba6aca4`; `attachments-presentation.html` is
unchanged. No runtime dependency was added.

### Evidence

| Area | Evidence |
| --- | --- |
| URI table | 34 cases in `test/summary.test.ts` (`display URI privacy`): POSIX/single-slash/localhost/remote file URLs, UNC, `%2F`/`%5C` and encoded leading separators, encoded home/`Users`/`Documents and Settings` segments, plain and `%2e` dot/parent segments, userinfo, home below another directory, drive before `Users`, home-only (empty), trailing home, WSL mount, `features` marker above and after the home segment, absolute without marker, deeper path (last three), dotted filename, relative paths, missing URI, idempotency; plus the 64,000-segment linear case (41 ms against 2.4 s on the old code) and the raw-URI model fallback in `test/model.test.ts` |
| Surrogate table | `test/render-attachments.test.ts`: lone high/low surrogate in `image/png` and `video/mp4` (4 cases) keeps the report complete with a base64 data URI and no `URI malformed`; normal UTF-8 stays readable; `BASE64` stays byte-identical; an empty body renders no data URI; `audio/mpeg` is an `application/octet-stream` binary download |
| Parse count | `test/input-detect.test.ts` `first-line parse count`: one-line Playwright 1, one-line Messages 1, multi-line Playwright 1, legacy 1, JUnit 0 |
| Comparator | `test/render-report.test.ts` bundles the CLI and runs it under `sv_SE.UTF-8` and `de_DE.UTF-8`: JSON and Markdown byte-identical, summary/matrix/tag order `Zebra, apple, Äpfel` |
| ISO forms | `test/history.test.ts`: 10 accepted forms (writer form, `Z` without ms, positive/negative offset, 1/3/9 fraction digits, offset with seconds, `2026-02-30` via `Date.parse`, `+23:59`), each kept verbatim and read without rewriting the file; 6 rejected forms (no zone, no zone with ms, free text, local date, `+25:00`, `+0200`); a stored offset survives the writer |
| JUnit entities | `test/junit.test.ts` and the PetClinic host row: five named entities, `&#160;`, `&#xA0;`, `&#x1F600;` decode; a bare `&` in text or attribute, `&nbsp;` and 200 bare `&` exit 1 with a bounded label and write no report; DTD/entity declarations are rejected; the scan is a forward pass |
| 200k merge | `test/compat-sidecar.test.ts`: 1 + 200,000 duplicate features merge without `RangeError` (772 ms for the single-test run, including fixture write and parse); the 65,000 + 65,000 boundary keeps order and `retried: 0` |
| Release workflow | `test/release-workflow.test.ts`, 7 tests: active run lines only, Linux gate with hygiene/check/browser, macOS browser gate, publish after both gates, tag/version mismatch fails, tag not on main fails, package smoke and stage on a green tag |
| 0600 POSIX mode | `test/cli-edge.test.ts` owner-only test, skipped on Windows (one of the 10 skips), green in CI on Node 22/24/26 (run `45517045112`) |
| Host rows | the `0.6.1-hardening` block in `docs/DROP-IN-VALIDATION.md`: five rows, four clean and the approved producer-payload limit |
