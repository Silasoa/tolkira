# Gate — report incident review

## 1. Contract and pre-implementation review

- Contract: `proposal.md`, `design.md`, `specs/report-rendering/spec.md`,
  `tasks.md`; `openspec validate report-incident-review --strict` is green.
- PIR: **PASS** after three rounds. Round 1 blocked the duplicated evidence,
  the lost diagnostics, the dead filter link, the hook ordering and the status
  vocabulary; round 2 blocked the empty copy scope; round 3 passed with only
  implementation-level notes, all folded into the contract (triage link
  parameter, dark `--accent-text`, shared `scenarioLabel`, AC formatting).
- DXR: **PASS** after five rounds. Blockers fixed: the layer map (no new
  circular module), the generated `styles.ts`, the severity/order selection,
  the filter link, the copy scope, the pending and muted contrast, the client
  tasks and the `incidentId` threading.
- Baseline (2026-11-27, before any code):

  | Artefact | Bytes | SHA-256 (first 16) |
  | --- | ---: | --- |
  | `legacy/failed.json` report | 89,842 | `038a120f0ef89331` |
  | `messages/screenshot.ndjson` report | 94,795 | `0274ca21df90c09e` |
  | `legacy/failed` summary JSON | 5,239 | `ecd6bc26330272d2` |
  | `src/render/report.css` | 47,446 | `01a1c46a2a2ac36c` |

- Current scenario order (`orderFeatures` / `statusSeverity`): unknown,
  passed, skipped, pending, undefined, ambiguous, failed — ascending severity,
  worst first; incident set is failed, undefined, ambiguous, pending.
- Characterization hashes and the JSON/CI/email/manifest/history bytes are
  pinned by the existing suites; this record is the comparison point.

## 2. Implementation

Eight commits on `main`, none pushed at the time of this record:

| Commit | Subject |
| --- | --- |
| `991b291` | style(report): apply incident review tokens |
| `b7521a4` | feat(report): lead the report with the first incident |
| `5654f8f` | test(report): correct incident row ids and no-JS detail counts |
| `c14f2eb` | test(e2e): migrate incident copy and baseline selectors |
| `02b81d6` | fix(report): correct incident row link and status presentation |
| `0e05698` | docs(report): refresh incident rasters and record review fixes |
| `be22ae3` | fix(report): keep the incident link and leads readable at 320 px |
| `91411e8` | docs(backlog): record incident review follow-ups |

The change adds no module, no public API field and no version bump. The four
client changes are named in the proposal, design and delta spec: failure copy
scope, scenario-scoped expand/collapse, list-scoped empty copy and the row
highlight guard (behaviour preserved; the incident row is no longer an open
`<details>`).

## 3. Verification

### Unit, types, lint, coverage

`npm run check` on the final tree: i18n, assets, typecheck, lint, knip, format
and build green; **2,163 passed / 11 skipped / 0 failed of 2,174** unit tests.
Coverage: statements 95.13 %, branches 88.51 %, functions 97.09 %, lines
96.52 %.

### Browser matrix

`npm run test:e2e` on the final tree: **515 passed / 10 skipped** across
Chromium, Firefox and WebKit; viewports 320, 390, 768, 1024 and 1440 px plus
320 px at 200 % text zoom. The incident suite adds the 60 × 40 px row-link box,
the 1440/390/320 containment and the no-overlap rectangle check in English and
German, the failed-only/tag-filter survival and the print copy-control check.

### Report size

Measured with `--title "Incident review size"` and no other options; the
baseline rows in section 1 are the same reports without the title (36 B
smaller).

| Report | Baseline | Final | Delta |
| --- | ---: | ---: | ---: |
| `legacy/failed.json` | 89,878 B | 95,711 B | +5,833 B (+6.5 %) |
| `messages/screenshot.ndjson` | 94,831 B | 100,558 B | +5,727 B (+6.0 %) |

The stylesheet is 52,032 B source and 45,270 B minified. The added bytes are
the token and per-status rules, the panel and the row link; the per-report
growth is one row `aria-label`, so the cost stays fixed (PCA measured +0.06 %
at 5,000 scenarios before the review fix; the fix adds about 1.4 kB of fixed
CSS and no per-scenario rule). The inline client moved 15,438 → 15,812 B
(+374 B) for the four named changes. Summary JSON, CI, email, manifest and
history bytes are unchanged and pinned.

### Package

`npm run package:check`: **92 entries**, tarball **702,942 B**, SHA-256
`1BFD0A65…EA95`, clean install, CLI `0.6.1`. `npm run hygiene` is green.

### Host rows 1-5

Final tarball, clean install (no repo link), CLI `0.6.1`, Chromium only:

| Row | Host (pin) | Default | Static | Result |
| --- | --- | ---: | ---: | --- |
| 1 | Seed-Test story (`ce2cad8`) | 96,246 B (+5,687) | 76,419 B (+5,247) | PASS |
| 1 | Seed-Test group (`ce2cad8`) | 114,945 B (+5,687) | 94,885 B (+5,247) | PASS |
| 2 | cucumber-js legacy (`13.3.0`) | 78,072 B (+5,661) | 58,378 B (+5,221) | PASS |
| 2 | cucumber-js Messages (`13.3.0`) | 78,390 B (+5,703) | 58,696 B (+5,263) | PASS |
| 3 | Playwright (`5d2cdf0`) | 288,424 B (+4,591) | 269,454 B (+4,151) | PASS |
| 4 | PetClinic (`500158f`) | 282,220 B (+4,591) | 263,617 B (+4,151) | PASS |
| 5 | Cucumber-JVM (`f71480f`) | 100,609 B (+4,592) | 81,617 B (+4,151) | PASS |

The delta is against `0.7-tag-overview`; the review fix costs a further
+1,371 to +1,410 B per host. The row link measures 83.23 × 28 px at 1440 and
390, 164.47 × 56 px at 320 px / 200 % and one line in print, with 0 px²
overlap against the status cell. Counts, statuses, attachments, the single
`<main>`, static script-free output, print incidents/baseline and the CJS
summary bytes (2,191 B, `D0DC05EA…`) are unchanged; no console, page or HTTP
error. Evidence: temp folder `tolkira-0.7-incident-hosts-final/`.

### Parity

CMP: **PASS**. Only the incident panel, the row link and the named client copy
differ; the rasters use `failed.json` (the real failed step), the group and
screenshot fixtures, the hero carries the inline screenshot, and `overview.png`
is marked as the 0.6-era capture it is.

## 4. Reviews

Round 1, on the implementation commits: SEC **PASS**, PCA **PASS**; CMP, CR,
STR, ILA, SCR, UXR and DAR **FAIL**, with Impeccable at two blockers. The
shared blocker was the row-link grid mismatch (`scenarioRowLink` on the outer
div, selectors on `.scenarioButton.scenarioRowLink`), measured at 20 × 167 px
at 1440/print and 61 × 233 px at 320/200 %. `02b81d6` fixed the class, the
track, the hover scope, the status tokens, the pending/undefined copy, the
triage suffix, the stress count, the row-copy e2e and the escaping test;
`0e05698` refreshed the rasters and the contract/doc records.

Delta round: STR, ILA and CMP **PASS**. CR, SCR, UXR, DAR and Impeccable found
two new defects: the 320/200 % overlap (the `8rem` cap against a 93/63.5 px
track) and the ambiguous lead at 4.23:1 on `--ambiguous-soft`. `be22ae3` gives
the link its own full-width row in the narrow container, moves the ambiguous
lead to `--ink-2` and adds a real no-overlap assertion plus a contrast test
over all four leads in light, dark and print. `91411e8` records the UX
follow-ups in the backlog.

Targeted confirmations after `be22ae3`: the 320/200 % row is **PASS** in
English and German (link 164.5 × 56 px, status 100/183.9 × 44 px, no rectangle
overlap, one line, print A4 clean), and the lead contrast is **PASS** in light,
dark and print (fail 5.29/5.69, pending 5.51/8.00, undefined 5.52/7.10,
ambiguous 10.34/11.77). Out-of-matrix note: on a 320 px *print page* at 200 %
text the German status pill wraps; the gated A4 print and the 320 px screen
matrix are clean, so this waits for the next print change.

The Impeccable detector reports three `side-tab` warnings on `.attachmentWarning`
and `.diagnostic`; both rules predate this change and stay as they are.

Deferred by the contract and not changed: a run-level hook incident, per-failure
selection, folding the triage into the panel, and Details/Trends layout. Four
UX findings that contradict the contract (filtered empty copy below the fold,
the duplicated error/meta block, triage 1-of-1 and the duplicated expanded
rasters) are recorded as decisions with a 0.7.1 trigger in `docs/BACKLOG.md`.

## 5. Exceptions

None. Every host row is green; no written exception is needed.
