# TDD-Red record

Date: 2026-11-22
Scope: `attachment-skip-reasons` tasks 2.1–2.4.
No `src/`, docs, config or production code was changed. Only tests and the
shared test copy helper were edited; no fixture file was added.

## Command and result

```text
npx tsc --noEmit
(no output; tests compile against the current source)

npx vitest run test/i18n-catalog.test.ts test/playwright.test.ts \
  test/attachment-diagnostics.test.ts test/render-attachments.test.ts \
  test/render-print.test.ts test/cli-edge.test.ts \
  test/compat-attachments.test.ts --reporter=default

Test Files  7 failed (7)
     Tests  26 failed | 101 passed | 3 skipped (130)
```

The full unit suite adds three failures from an unrelated in-flight change
(`report-css-minify`): two in the untracked `test/styles.test.ts` and one in
the modified `test/dom-contract.test.ts`. Those files are not part of this
change and were left untouched. Full suite: `29 failed | 1145 passed |
5 skipped (1179)`.

## Test map

| File | RED tests | Pins |
| --- | --- | --- |
| `test/playwright.test.ts` | outside entries; final-attempt outside; missing; directory; non-local; relative-outside once; entry cap; name sanitization; 120/fallback; report-level counts | Nine of the ten Red tests: entries absent, missing/directory/non-local uncounted |
| `test/attachment-diagnostics.test.ts` | scenario notice with entries; two-scenario entries; missing counts; 3-of-5 list + more-line; mixed reasons; escaped name | Model copy, list markup, cap, more-line, escaping |
| `test/render-attachments.test.ts` | singular; plural; footer | Generic run notice + where-line, list entries |
| `test/render-print.test.ts` | print list | `.attachmentSkipList` styled and not hidden in print |
| `test/cli-edge.test.ts` | singular; plural | Reason-neutral count, no names, hint kept |
| `test/compat-attachments.test.ts` | warnings | Same warning as the CLI |
| `test/i18n-catalog.test.ts` | key set; English copy; German translation | New en/de keys, old notice key removed |

Updated because they encoded the old "outside roots only" semantics:

- `test/playwright.test.ts`: the old "does not count missing, directory,
  URL-scheme or UNC" and "does not count a symlinked path" expectations became
  counting expectations; the old report-level outside test now expects the
  full count.
- `test/attachment-diagnostics.test.ts`: the old "does not count trace, inline
  or missing" test now expects the missing path to count.
- `test/attachments.ts`: notice copy replaced by `skipNotice`, `SKIP_WHERE`,
  `SKIP_REASON`, `skipMore` and a reason-neutral `attachmentWarning`.
- `test/e2e/attachments.spec.ts`: shell text, scenario list and a print check;
  not run in this Red (browser gate runs after implementation).

## Exact RED failures

Every failure is one of: entries are absent, missing/unreadable/non-regular/
non-local are still uncounted, the notice is still outside-specific, or the new
catalog keys are absent.

```text
Playwright JSON input > skips missing, outside-tree and non-regular attachment paths
  expected 2 to be 4
Playwright JSON input > counts a final-attempt path attachment outside the input folder and cwd
  expected [] to deeply equal [ { name: 'absolute-outside', …(1) } ]
Playwright JSON input > records a missing final-attempt attachment with the missing reason
  expected +0 to be 1
Playwright JSON input > records a directory as not a regular file
  expected +0 to be 1
Playwright JSON input > records URL, file, UNC and device paths as non-local
  expected +0 to be 5
Playwright JSON input > records one entry for a relative path that resolves only outside
  expected [] to deeply equal [ { name: 'relative-outside', …(1) } ]
Playwright JSON input > caps recorded entries at three while the count includes every skip
  expected 1 to be 5
Playwright JSON input > sanitizes OSC-8, directory, ANSI and bidi names before recording
  expected [] to deeply equal [ Array(3) ]
Playwright JSON input > caps a long name at 120 code points and falls back to attachment
  expected [] to deeply equal [ { …(2) }, …(1) ]
Playwright JSON input > skips URL, device and UNC attachment paths without reading them
  expected +0 to be 5

attachment diagnostics > shows a per-scenario notice with the final-attempt skip count
  expected [] to deeply equal [ { name: 'first', …(1) }, …(1) ]
  (soft) expected '<details class="scenario" …' to contain 'class="attachmentSkipList"'
  (soft) expected +0 to be 1
  (soft) expected '<details …' to contain '<li><code>first</code> - outside the …'
  (soft) expected +0 to be 2
attachment diagnostics > marks only the scenario whose final attempt skipped an attachment
  expected [] to deeply equal [ { name: 'outside', …(1) } ]
attachment diagnostics > counts a missing attachment but not trace or inline attachments
  expected +0 to be 1
attachment diagnostics > lists three of five skips with their own reasons and counts the rest
  expected 1 to be 5
attachment diagnostics > lists a mixed outside, missing and non-local reason
  expected [] to deeply equal [ { name: 'outside.png', …(1) }, …(2) ]
attachment diagnostics > escapes a skipped name that looks like HTML
  expected '<details class="scenario" …' to contain '&lt;img src=x onerror=alert(1)&gt;.pn…'

skipped attachment notice > renders the singular notice in the shared shell on both tabs
  expected '1 path attachment was skipped: it is …' to be '1 path attachment was skipped. See th…'
skipped attachment notice > renders the plural notice with the summed count
  expected '2 path attachments were skipped: they…' to be '2 path attachments were skipped. See …'
skipped attachment notice > keeps the neutral footer when the notice is shown
  expected '<!doctype html>…' to contain '1 path attachment was skipped.'
print stylesheet > keeps the skipped-attachment list styled and visible in print
  expected ':root {…' to contain '.attachmentSkipList'

CLI > warns once on stderr with a reason-neutral count and no names
  expected 'tolkira: warning: 1 path attachment w…' to be 'tolkira: warning: 1 path attachment w…'
CLI > warns with the plural count and still keeps names off stderr
  expected 'tolkira: warning: 2 path attachments …' to be 'tolkira: warning: 2 path attachments …'
compat > adds the skipped-attachment notice to warnings
  expected [ Array(1) ] to deeply equal [ Array(1) ]

attachment skip keys > ships every attachment skip key in English and German
  expected { …(181) } to not have property "report.attachmentNotice"
attachment skip keys > pins the generic English notice, where-line, reasons and more-line
  expected undefined to be '{count, plural, one {# path attachmen…'
attachment skip keys > keeps the notice and every reason translated in German
  de: report.attachmentSkipMissing: expected undefined not to be undefined
```

Skipped in this run (platform-gated, must pass on Linux/macOS):

- `records an unreadable file inside a root as unreadable` (POSIX `chmod 000`;
  skipped on Windows and for uid 0).
- Two symlink tests (`process.platform === 'win32'`).

## Why each Red is correct

- `specs/input-formats/spec.md` "Record skipped path-attachment names and
  reasons" requires one entry per skipped attachment and a count that includes
  every skip. The adapter currently returns only a number and counts only
  outside-root paths, so entries are `[]` and missing/directory/non-local
  skips stay at 0.
- "Bound and sanitize skip entries" requires an entry cap of three in
  attachment order; the cap tests expect five counted but three retained.
- "Path privacy" requires ANSI/OSC stripping before the attachment name is
  reduced to its last segment. The OSC-8 test's payload contains
  `file:///home/secret/evil.png`; the expected entry is only `checkout.png`.
- `specs/report-rendering/spec.md` "Show skipped attachment names and reasons"
  requires `name - reason` entries, the remainder line, escaping and print.
  `ReportScenario` has no entries field and `scenarioBody` has no list.
- The modified run-notice requirement forbids an outside-only claim; the old
  catalog string says every skip is outside the roots, so the new copy fails
  now.
- The CLI/compat requirement is a reason-neutral count with the hint and no
  names; the old `attachmentWarning` still claims outside roots.
- The i18n test fails because the new keys do not exist and the old key is
  still shipped.

## Spec/design discrepancy to resolve before implementation

The design's classification list says "symlink or non-file -> not-regular
candidate", and the spec's "Not a regular file" scenario names a directory.
The design's test bullet instead says "unreadable (directory)". The Red tests
follow the spec: a directory asserts `not-regular`; `unreadable` is covered by
a real permission-denied file on POSIX. Resolve the bullet in favour of the
spec, or amend both spec and tests before coding.

## Expected implementation effect

Tasks 3.1–3.4 should turn these green without weakening any assertion:
store `{count, entries}` in the diagnostics WeakMap, classify and sanitize
Playwright candidates, copy entries to `ReportScenario`, render the generic
run notice plus the escaped scenario list, and replace the CLI/compat copy.
Summary, CI, email, history, caps and schema stay unchanged; their existing
tests already pass.
