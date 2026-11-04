# Hierarchical report overview

Status: research note for 0.2, not an approved design.

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

## Prototype families

- Tree/outline: Run → Feature → Scenario, collapsible, aggregate counts.
- Dashboard: scorecards, feature map/treemap, split feature list/detail.
- Inline: compact hierarchy summary above the existing failed-first report.

The throwaway prototypes live under `docs/ui-loop/` (gitignored). The selected
direction is folded into an OpenSpec change before production work.
