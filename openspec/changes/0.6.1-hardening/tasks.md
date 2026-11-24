# Tasks

## 1. Gate

- [ ] 1.1 PIR + DXR over this proposal, the five spec deltas and the design.
  Check every base requirement that mentions display URIs, attachments,
  deterministic merge/order, Playwright detection, attempt selection (owned by
  the quality pass), legacy timestamps, history schema/timestamps, JUnit
  entities, the compat sidecar and the release workflow for a contradiction.
  Fold blockers into the contract before Red.
- [ ] 1.2 Confirm the seams: `src/summary.ts` (`displayUri`, scenario sort),
  `src/input/legacy.ts` (`normalizeUri`, `startedAt`/`clock`),
  `src/report/model.ts` (`toAttachment`, feature-name fallback),
  `src/text.ts` (new comparator), `src/input/load.ts`, `src/baseline.ts`,
  `src/render/report.ts` (sort sites), `src/input/detect.ts`
  (`looksLikeMessages`/`sniffPlaywright`), `src/input/messages.ts` (shared
  envelope key set), `src/history.ts` (`isIsoTime`), `src/input/junit.ts`
  (`htmlEntities` and `checkEntityReferences`),
  `src/compat/cucumber-html-reporter.ts` (merged element append) and
  `.github/workflows/release.yml` (already fixed by `31dd112`). Confirm no new
  dependency, option or public API. `src/report/index-run.ts` is not touched.
- [ ] 1.3 Record the decisions before Red: the URI root/home rule and its
  relative-path boundary, the single UTF-16 comparator, the try/catch base64
  media fallback, the first-key parse check, the legacy zero timestamp with its
  dependency on the `0.6.1-quality-pass` zero-is-unknown model rule, the ISO 8601
  forms, the XML-only entity rule, the compat loop, the legacy-date re-pin and
  the `0600` docs decision. The attempt tie is inherited from the quality pass
  and is not re-implemented here.
- [ ] 1.4 Confirm the sequencing: land after `0.6.1-quality-pass`, rebase on
  its re-pinned characterization/goldens, its zero-timestamp rule and its
  later-start tie rule, and do not edit that change. Confirm the release
  workflow contract at commit `31dd112`, including the full main fetch used by
  the ancestor check.
- [ ] 1.5 Confirm the second audit is the tracking record and no remote issue
  exists; do not open an issue for this change without the user's direction.

## 2. TDD-Red

- [ ] 2.1 URI privacy: in `test/summary.test.ts` and `test/model.test.ts`,
  cover POSIX `file:///home/<user>/...`, WSL `/mnt/c/Users/<user>/...`, Windows
  `file:///C:/Users/<user>/...`, an absolute path without `/features/`, a deeper
  path, a relative path, a missing URI and the model feature-name fallback. In
  `test/cli-edge.test.ts` assert the `--json` `uri` field is free of the marker user name and
  the `feature` field keeps its empty fallback, and in
  `test/e2e/clipboard.spec.ts` the copied failure text, all free of the marker user name.
  ISTQB: equivalence classes of scheme/drive/mount/marker/relative forms; a
  boundary path with one segment before the home segment.
- [ ] 2.2 Surrogate media: in `test/render-attachments.test.ts` and
  `test/model.test.ts`, cover an unpaired high and low surrogate in an image,
  video and audio body, a normal UTF-8 body, a BASE64 body, an empty body and a
  valid surrogate pair. Assert no throw, the base64 fallback prefix, unchanged
  normal/BASE64 output and a complete report. ISTQB: decision table over
  encoding × kind × surrogate pair validity; boundary at the pair split.
- [ ] 2.3 Comparator: in `test/summary.test.ts`,
  `test/input-resolve-scan.test.ts`, `test/baseline-matcher.test.ts` and
  `test/render-report.test.ts`, cover the four sort sites. A child process runs
  the same input with `LANG=sv_SE` and `LANG=de_DE` (plus `LC_ALL`) and asserts
  byte-identical JSON, CI Markdown and report feature/tag order for `apple`,
  `Zebra`, `Äpfel`. ISTQB: equivalence classes of ASCII case, non-ASCII and
  equal/prefix strings; boundary around UTF-16 code units. Fall back to a
  locale-sensitive `localeCompare` stub if the host ignores the locale
  variables.
- [ ] 2.4 Single parse: in `test/input-detect.test.ts`, spy on `JSON.parse` and
  assert one call for a one-line Playwright report and one for a one-line
  Messages envelope. Cover multi-line Playwright, legacy, JUnit, malformed JSON,
  BOM/blank lines, a non-envelope first key and an envelope-like first key with
  an invalid body. ISTQB: decision table over first key × document shape ×
  parse validity; boundary at the first non-empty line.
- [ ] 2.5 Legacy run time: in `test/legacy.test.ts`, `test/model.test.ts` and
  `test/render-report.test.ts`, cover no `options.startedAt`, an explicit pin, a
  real Messages run and zero/non-zero durations. Assert no report date, no
  `1970`, the pinned date and an unchanged summary shape. Assert the two legacy
  characterization fixtures and `minimal.html` change only by the removed date.
  Pre-flight: confirm the `0.6.1-quality-pass` zero-is-unknown rule is present;
  the later-start tie rule is quality-pass work, not this change. ISTQB:
  equivalence classes of absent/present explicit time and zero/non-zero
  duration; boundary at the explicit epoch timestamp, which follows the
  zero-is-unknown rule.
- [ ] 2.6 ISO 8601 history: in `test/history.test.ts` and
  `test/cli-history.test.ts`, cover the writer form, `Z` without milliseconds,
  `+02:00`, a negative offset, optional seconds, 1/3/9 fraction digits, no zone,
  free text, an invalid offset and a byte-identical read. Assert the original
  string is kept and the error text is unchanged. ISTQB: equivalence classes of
  zone forms and optional components; boundary at missing seconds/fraction.
- [ ] 2.7 JUnit entities: in `test/junit.test.ts`, cover `&amp;`, `&lt;`,
  `&gt;`, `&quot;`, `&apos;`, `&#160;`, `&#xA0;`, `&nbsp;`, an unknown named
  entity, an unknown named entity longer than 32 characters, an out-of-range
  numeric reference, CDATA declaration text, explicit and directory input, and
  no partial report. ISTQB: equivalence classes of named/numeric/invalid
  references; boundary at XML character ranges and at the 32-character entity
  pattern.
- [ ] 2.8 Compat merge: in `test/compat-sidecar.test.ts`, cover two same-URI
  features with about 65,000 elements each (130,000 total), one element, an
  empty feature, order stability, `retried: 0` and valid JSON. Assert no
  `RangeError`. ISTQB: boundary around the engine argument limit; equivalence
  classes of duplicate/single/empty features.
- [ ] 2.9 Release gate: add `test/release-workflow.test.ts` and assert the
  Linux gate runs `hygiene`, `check` and `e2e`, the macOS gate runs `e2e`, the
  publish job needs both, the tag/version check and the main-ancestor check
  exist, the main fetch is not shallow, and a green path reaches the package
  smoke and stage step. No workflow code is changed beyond the full-fetch fix;
  the test goes RED only on a contract regression. ISTQB: decision table over
  tag match × main membership × gate result.
- [ ] 2.10 Confirm RED for 2.1-2.9. No existing test is deleted, skipped or
  weakened. Any assertion that encoded the old behaviour (for example a
  `home/<user>` display URI or an invented legacy date) is updated in place and
  named in the change record. The attempt-tie assertions belong to the quality
  pass and are not duplicated here.

## 3. Implement

- [ ] 3.1 URI privacy: fix `displayUri` and `normalizeUri` to preserve the path
  root, handle `/C:/...` and drop the home segment plus the next on an absolute
  path or file URL; use `displayUri` for the model feature-name fallback. Keep
  relative URIs, the summary `feature` empty fallback, the `/features/` marker
  and the last-three/last-segment fallbacks. No user name in HTML display URIs,
  the JSON `uri` or copied text.
- [ ] 3.2 Surrogate media: in `toAttachment`, keep `encodeURIComponent` for
  normal media and catch its failure to build a base64 data URI from
  `Buffer.from(body, 'utf8')`. Leave BASE64 and empty bodies unchanged.
- [ ] 3.3 Comparator: add the UTF-16 code-unit comparator to `src/text.ts` and
  replace the four `localeCompare` call sites in `src/summary.ts`,
  `src/input/load.ts`, `src/baseline.ts` and `src/render/report.ts`. No
  dependency, no `Intl`.
- [ ] 3.4 Single parse: in `src/input/detect.ts`, check the trimmed first line
  starts with `{` and its first key is a known `ENVELOPE_KEYS` member before
  `JSON.parse`; keep `isEnvelopeLike` as the shape confirmation. Reuse the
  existing key set.
- [ ] 3.5 Legacy run time: replace `options.startedAt ?? new Date()` with an
  explicit `options.startedAt` value or zero; do not read the clock. Keep the
  synthetic clock at zero without a pin so every scenario start is zero. Confirm
  the model treats zero as unknown.
- [ ] 3.6 ISO 8601 history: replace the `toISOString()` round-trip in
  `isIsoTime` with the strict zone/optional-seconds regex plus finite
  `Date.parse`; keep the original string. The CLI's new-run writer keeps
  `...000Z`.
- [ ] 3.7 JUnit entities: remove `htmlEntities: true` from the parser options;
  keep `checkEntityReferences` and its error; widen the entity pattern if an
  unknown named entity longer than 32 characters escapes it. Add the XML-only
  entity line to `docs/JUNIT-XML.md`.
- [ ] 3.8 Compat merge: replace `existing.elements.push(...elements)` with a
  `for...of` append; keep order and `retried: 0`.
- [ ] 3.9 Release gate: do not edit `.github/workflows/release.yml` beyond the
  full-fetch ancestor check fixed in this session. Verify commit `31dd112`
  contains the Linux and macOS gates, the `needs` entry, the tag/version check
  and the main-ancestor check without a shallow fetch; keep the workflow test
  green.
- [ ] 3.10 Re-pin the two legacy characterization hashes and
  `test/fixtures/render-golden/minimal.html` for the removed invented date.
  Inspect the diff: only the date removal is allowed. Update the stale comments
  in `test/render-characterization.test.ts` and `test/render-golden.test.ts`
  that describe the legacy `new Date()` fallback; keep a fake timer only where
  an unrelated output still needs it.
- [ ] 3.11 Docs and changelog: `SECURITY.md` (owner-only 0600 on POSIX, Windows
  ACL inheritance, the shared-artifact trade-off), `docs/LIMITATIONS.md` (same,
  with the no-option boundary), `docs/AGENT-INTERFACE.md` (history ISO 8601
  forms and the display-URI no-user-name rule), `docs/ARCHITECTURE.md` (one
  comparator and the display-URI home rule), `docs/DROP-IN-VALIDATION.md` (the
  host rows below) and `docs/CHANGELOG.md` (extend the existing `0.6.1`
  Unreleased section with the nine fixes, the inherited tie rule, the non-ASCII
  order change and the 0600 note). Do not change `package.json` (`version`
  stays 0.6.0) and do not create a tag, stage or publish.

## 4. Verification and review

- [ ] 4.1 `npm run hygiene`, `npm run check` and `npm run test:e2e`
  (report-level change) are green; typecheck, lint, unit tests and build
  included. Record the exact counts, the client bundle size, the report byte
  delta and the legacy-date characterization/golden re-pin.
- [ ] 4.2 Independent reviewers in one batch: SCR (all five deltas), CR, DAR
  (including the 0600 and JUnit docs), SEC (URI privacy, surrogate bodies, JUnit
  entities, ISO 8601 history input), PCA (detection, surrogate and URI changes,
  comparator), STR (module/test health), UXR and CMP (report order and legacy
  date; only the intended order/date changes). A failing review spawns a fixer,
  not the implementer of record.
- [ ] 4.3 Host rows in `docs/DROP-IN-VALIDATION.md`: official Cucumber-js host
  (legacy JSON and Messages), Seed-Test legacy JSON, Spring PetClinic JUnit, the
  `cucumber-html-reporter` shim (including the merged sidecar) and the Playwright
  JSON host (display URI/feature fallback and report order). Record host, pin,
  artifact and result; confirm no local user name in the report/JSON/copied
  text, no invented legacy date, stable order, the JUnit entity behaviour and
  the shim merge. The other release rows stay for the release pass.
- [ ] 4.4 Gate record: commands, results, characterization/golden evidence with
  the date-only diff, the URI fixture table, the surrogate table, the comparator
  child-process output, the parse-count evidence, the ISO form table, the JUnit
  entity table, the 130k merge result, the release-workflow test output, the
  0600 POSIX mode check and the host rows. Deferred findings get a backlog
  trigger; nothing is dropped silently.
- [ ] 4.5 Fix every review finding or record a decision with a trigger; re-run
  the gate after fixes.

## 5. Release boundary

- [ ] 5.1 Do not bump the version, tag, stage or publish. 0.6.1 preparation and
  approval remain a separate user decision after this change and
  `0.6.1-quality-pass` are complete and reviewed.
