# Hierarchical report overview

Status: research note for 0.2; the shipped design is in
`openspec/changes/triage-first-report/`.

## Problem

The current Report view answers the run-level question ("100%, 7 of 8 passed")
and shows a status chip on each feature, scenario and step. It does not give a
single overview of the **whole hierarchy**: Run → Feature/Story → Scenario →
Step, including groups where the input has them. A reader who wants to know
"which feature is unhealthy, and which part of it?" has to scan the report
instead of seeing the shape first.

`cucumber-html-reporter` and `multiple-cucumber-html-reporter` answer this with
status panels and counts at several levels. The 0.2 overview should do the same
without becoming a dashboard product, losing the one-file/offline baseline, or
turning the report into a wall of colour.

## Available model

- Run: one merged report; source, duration, counts, environment.
- Feature: scenarios, aggregate status, URI, description, tags.
- Rule: available from Messages as a scenario property; not available from
  legacy JSON.
- Scenario: status, steps, tags, attempts (currently only the latest attempt),
  rule name, duration, attachments.
- Step: status, duration, message, doc string, data table, attachments.
- JUnit: suite → feature, test case → scenario, one synthetic step; no steps
  or screenshots.
- Groups: multiple inputs merge into one run. There is no first-class group
  entity; a group can only be inferred from the input source, URI, a tag or a
  feature naming convention. This is a product decision, not a rendering one.

## Evaluation criteria

A prototype is viable when it:

- shows aggregate status at run, feature and scenario level (step counts may be
  enough; step-level detail can stay in the disclosure);
- is readable at 100s of scenarios, not only on the three fixtures;
- works at 320, 390, 768, 1024 and 1440 px, and at 200% text zoom;
- never relies on colour alone; text labels and accessible names remain;
- can be generated server-side from the existing model, without a client-side
  data store or a second copy of every scenario;
- keeps the one-file, no-network, no-framework baseline;
- makes the failed path faster to reach than the current scan;
- does not duplicate the Details tab's feature table and environment block.

## Open questions

- Are groups the input files, tags, or an explicit suite concept? The current
  model has no group entity.
- Should the overview include every scenario, or a feature-level summary with
  drill-down to the existing scenario rows?
- Is a separate Overview section/tab acceptable, or must it stay inline above
  the feature list?
- How do we keep a 5,000-scenario report small and fast when every level has
  counts and status?
- Does the hierarchy need matrix/treemap visuals, or is a dense outline with
  bars enough?

## Prototype observations

2026-11-04, from the first three prototype families:

- **Inline summary** scales predictably: one aggregate row per feature, with a
  proportion bar and counts, above the existing failed-first list.
- **Inline map** is the only variant that shows every scenario at a glance, but
  it becomes a wall of squares on a 500-scenario run. It works best for the
  failed/pending subset, not all scenarios.
- **Dashboard scorecard** is the strongest failed-path variant: group strip,
  failed-first feature cards, open failed scenario and inline error. Its passed
  features fall below the fold and it reads as a separate dashboard.
- **Split index** scales best to many features/groups, but adds a selection
  step before any scenario is visible; it is a browsing mode, not the default.
- **Treemap** shows where the test mass is, not what failed; area encoding is
  weak for small features and needs the parallel table.
- **Compact/tree** exposes the failed step inline and the full hierarchy, but
  costs vertical space and needs sticky feature headers to survive long runs.
- **Dashboard groups** only have an honest group level when the report models
  one. Multiple input files/URIs are the only current source of a group; status
  sections and tags are presentation choices, not hierarchy.
- The current feature order follows input order, not failed-first. The report
  opens failed features but does not move them above passed ones. Decide
  whether the overview sorts/groups independently while the list keeps input
  order, or whether the whole report becomes failed-first.
- The current model has no explicit group or suite entity; JUnit suite maps to
  feature. A group level therefore needs a product decision before a renderer
  change.

Draft direction: an inline **run overview** with source groups, failed-first
feature rows (counts + proportion bars), and only failed/pending scenario chips
linking into the existing details. Keep the existing failed-first list for
scenario/step depth. Upgrade the Details feature table to the matrix. Treat the
split index and compact tree as optional modes for large runs, and the treemap
as a secondary distribution view. Confirm with the user before production
work.
