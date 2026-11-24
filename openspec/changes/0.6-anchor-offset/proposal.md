# 0.6-anchor-offset

## Why

`0.6-static-no-js` wraps the Trends tab strip onto its own topbar row. At 320 px
and 200 % text the bar can then take three rows, which is taller than the fixed
CSS `scroll-padding-top` reserve. An anchored scenario link lands behind the
bar. The live report-rendering requirement "an anchored scenario is not hidden
behind the sticky bar" already covers this state, so the fix is a contract fix,
not a new feature.

The Linux browser gate caught the failure after the four 0.6.0 changes were
archived. The fix landed as `dc15812` and measures the rendered bar in the
client. That grows every default report by 170 B, so the archived
"byte-identical to before" promises no longer describe the shipped document.
This change records the corrected contract and the budget. It adds no option,
API or dependency.

## What Changes

- The report client measures `.topbar` on load and on hash changes and sets
  `scroll-padding-top` to the measured height plus 8 px before it scrolls an
  anchored target into view. The static CSS reserve stays as the no-JS
  fallback.
- The default report without `--static` keeps its content, markup and CSS; the
  only document delta against 0.5.1 is the measured-offset script. The client
  bundle grows from 15,268 B to 15,438 B (budget 16,000 B), so a default
  document grows by 170 B.
- The committed characterization hashes and golden HTML include that script.
- Four archived byte claims are restated so a reader can tell the release-level
  delta from a flag delta: the static default, the baseline no-baseline HTML,
  the baseline JSON no-baseline HTML and the early-warning "no new surface"
  scenario.

## Impact

- Affected specs: `report-rendering`, `cli-api`.
- Affected code: `src/render/report-client.ts` (landed in `dc15812`), the
  generated client bundle, the golden and characterization fixtures, and the
  Trends e2e calibration.
- Users: every default report is 170 B larger than in 0.5.1, and an anchored
  scenario now clears a wrapped topbar at any text zoom. No CLI, API,
  output-format or dependency change.
- Hosts: the five required 0.6.0 host rows were re-run on the release tarball;
  counts and statuses are unchanged.

## Out of Scope

- No redesign of the topbar or the tab strip.
- No new scroll option, no scroll-spy, no smooth-scroll change.
- No change to the no-JS reading behaviour; the CSS fallback is unchanged.
- No retroactive edit of the archived change directories; this change is the
  correction of record.
