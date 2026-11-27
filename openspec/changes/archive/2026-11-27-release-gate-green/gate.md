# Gate — release gate green

## 1. Contract and pre-implementation review

- Contract: `proposal.md`, `design.md`, the `report-rendering` and `release`
  deltas, `tasks.md`; `openspec validate release-gate-green --strict` is green.
- PIR: **PASS** after two rounds. Round 1 blocked the guard location (it read
  only `release.yml`), the quote-unaware pattern that would flag the four
  legitimate quoted lines, the untestable static scenario, and the missing
  attribution of the 63 e2e failures. Round 2 blocked the missing test for the
  `shellcheck --version` step. All were folded into the contract.
- DXR: **PASS** after two rounds. The blocker was the self-comparing e2e
  assertion (`scrollWidth <= clientWidth` is green before the fix); it now
  measures the block against the toolbar box. Should-fixes folded: quote-aware
  guard, 1440 assertion, B-075 ordering, row-2 scope, shellcheck visibility.
- Baseline: Linux CI run `45922069336` on `ad5b4c8` failed `e2e` with 63
  overflows (21 tests × 3 engines, all 320 px / 200 %, all 12 px) and
  `workflows` with actionlint/shellcheck `SC2086` on the unquoted
  `/tmp/pack/tolkira-$TOLKIRA_VERSION.tgz` in `ci.yml` and the release package
  job. Windows measurements at 320/200 %: `.expand` 268.03 px in a 241 px
  toolbar (32 → 273), document 320 px / scroll 305 px.

## 2. Implementation

Commits on `main`:

| Commit | Subject |
| --- | --- |
| `a31d38b` | `fix(report): keep the toolbar inside 320 px and quote workflow paths (B-057, B-074)` |
| `9f3d5c6` | `docs(openspec): record the gate fix and correct its measurements (B-057, B-074)` |
| `35f37cf` | `test(ci): measure 1440 at normal text and widen the path guard (B-057, B-074)` |
| `aad1feb` | `docs(openspec): record the release gate fix (B-057, B-074)` |
| `abc20a6` | `test(ci): drop the redundant regex escape (B-057, B-074)` |

`.expand` gains `flex-wrap: wrap; justify-content: flex-end;`; the minified
stylesheet grows by 40 bytes. The tarball path is quoted in both workflows and
the CI `workflows` job prints `shellcheck --version` before actionlint.

## 3. Verification

### Gates

- `npm run check`: 108 files, **2,188 passed / 11 skipped / 0 failed of
  2,199**; coverage unchanged (95.13 / 88.51 / 97.09 / 96.52); typecheck,
  lint, knip, format and build green.
- Focused workflow tests: **34 passed** (was 30 before this change).
- `npm run test:e2e` on Chromium, Firefox and WebKit: **518 passed / 10
  skipped**.
- `npm run hygiene`: green.
- `npm run package:check`: **94 entries**, **707,008 B**, SHA-256
  `DC4C0DBC…12F2`.

### Report bytes

The differential is exact: every pinned report differs only by the 40 CSS bytes
plus the derived "Report HTML" size label (+40). Undoing the one declaration
reproduces the B-075 HTML byte-for-byte. Two goldens, ten characterization
hashes and the static hash were re-pinned; the notice change (B-075) was
already committed, so the delta isolates the CSS.

### Host row 2

Host row 2 on the package above (`DC4C0DBC…12F2`, HEAD `6bd74fb`, clean
install, CLI `0.6.1`): cucumber-js 13.3.0 legacy JSON and Messages NDJSON,
Chromium, print emulated. **PASS**.

| Input | Default | Static | German |
| --- | ---: | ---: | ---: |
| legacy `out.json` | 79,318 B (+40) | 58,418 B (+40) | 81,202 B |
| Messages `out.ndjson` | 79,636 B (+40) | 58,736 B (+40) | 81,545 B |

At 320/200 % the toolbar and expand block share 32 → 273 px; both buttons
241 × 72 px, stacked, no clipping (English and German). At 1440 × 900 both
controls share one line at the right edge; page overflow −15 px. Counts,
attachments, one `<main>`, incident/triage/detail, the row link
83.23 × 28 px at 1440/390 and 164.47 × 56 px at 320/200 %, 0 px² status
overlap, print and static forms, notice counts (1 scripted / 0 static) and the
installed notice file are unchanged; zero console/page/http errors.

### Pushed CI

Run `46006450649` on `6bd74fb` (the commit that contains the CSS fix, the
quoted paths and the shellcheck step): **all jobs green** — `hygiene`,
`check` (22/24/26), `check-windows`, `package`, `e2e`, `e2e-macos` and
`workflows`. The green Linux `e2e` job is the proof for the 320 px / 200 %
font-metric overflow, and the green `workflows` job is the proof for `SC2086`
with shellcheck on `PATH`.

Run `46007604929` on `aad1feb` (this gate record, the spec scope note and the
positive bare-path guard case) stopped at `lint`: oxlint flagged the escaped
slash in the new guard's character class (`Unnecessary escape character '/'`).
`abc20a6` drops the escape.

Run **`46007782898` on `abc20a6`: all eight jobs green** on the final tree —
`hygiene`, `check` (22/24/26), `check-windows`, `package`, `e2e`, `e2e-macos`
and `workflows`.

## 4. Reviews

SCR **PASS**, CR **PASS**, UXR **PASS**, DAR **FAIL** on docs only. The delta
re-checks on `35f37cf` returned PASS for SCR and CR.

- SCR: all acceptance criteria and scenarios hold; the 1440 scope is now stated
  explicitly and the sub-900 layout is recorded as unchanged.
- CR: goldens, static hash and stylesheet are exact; three minors fixed in
  `35f37cf` (1440 measured at 100 % text, wider bare-path guard, accurate
  min-content wording).
- UXR: the wrap is readable at 320/390/768/1024/1440, German included, print
  hides the toolbar, Details and static stay clean. The sub-900 left-aligned
  expand block is a pre-existing media-query layout, not a regression; the spec
  now scopes the end-aligned requirement to 1440 and records it.
- DAR: the six doc findings (changelog entry, actionlint wording, push matrix,
  measurement consistency, archived "fixed" claims, B-075 package state) were
  fixed in `9f3d5c6`; the delta re-check on `35f37cf` asked for the 1440 px
  text-size scope and the 21-test attribution, both corrected before the gate
  record commit. PASS.

## 5. Exceptions

None. No version bump, tag, stage or publish happened.
