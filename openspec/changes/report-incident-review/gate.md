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
