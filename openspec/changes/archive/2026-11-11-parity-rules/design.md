# Design

## Context

See `proposal.md`. `buildReportModel` keeps a flat `ReportScenario` list and
already records `ruleName`; feature tags exist on `ReportFeature` but are not
rendered. Background headings/descriptions and rule descriptions/tags are
lost. The renderer groups scenarios by severity and, for outlines, by outline.

## Goals / Non-Goals

**Goals:**

- Add rule/background metadata without nesting the scenario model.
- Render feature tags, rule sections and background headings/descriptions.
- Keep counts, triage, search, matrix and summary on the flat list.

**Non-Goals:**

- G7 empty runs, G8 Markdown, G10 tag expressions, G11 `meta.ci`, G12
  attachment polish, G14/G15, themes, summary schema changes.

## Decisions

### Optional rule/background metadata on the flat model

Add an optional `rule` object to `ReportScenario`: id, keyword, name,
description and tags. Add `ownTags` to `ReportScenario` from the AST scenario
tags; for outline rows use the examples-block tags. Keep `tags` as the full
pickle tag set for filtering/search. Add `backgrounds` to `ReportFeature` and
to the rule metadata: id, keyword, name, description and a synthetic flag.

Walk the Gherkin tree once, including rule children, and attach the rule
metadata to each scenario. Collect feature and rule backgrounds separately.
Legacy normalisation synthesizes a Background node; mark it synthetic and skip
it in the report model. Keep `ReportFeature.scenarios` flat.

### Group by rule at render time

`renderFeature` builds render items as before (standalone scenario or outline
group), then groups them by `scenario.rule?.id`. Feature-level items and rule
blocks are ordered by severity, then first input index; items never move across
rule boundaries. Rule sections render with tags, heading, description and
background heading/description, and carry `data-rule`. Items without a rule
render at feature level.

Outline groups stay inside their rule. Counts, triage, matrix and search keep
reading the flat list. The client-side filter hides a rule section with no
visible descendant.

### Render feature tags and background headings once

Feature tags render in the feature header. Rule tags render once in the rule
section. Scenario rows display only `ownTags`; `tags` remains on `data-tags`
and in search. Background headings/descriptions render once per feature/rule
only when the name or description is non-empty; the existing background steps
remain in the scenario step lists and are not duplicated.

### Legacy and JUnit fallbacks

Legacy JSON has no reliable rule/background structure; only feature/scenario
tags are used and synthetic backgrounds are skipped. JUnit has neither. No
rule or background is invented. The summary remains HTML-only for rule and
background structure; `scenarios[].tags` stays the inherited tag set.

## Risks / Trade-offs

- **Outline-in-rule nesting** → rule grouping wraps existing outline groups;
  test a rule with an outline.
- **Tag duplication** → feature/rule tags render at their section only; rows
  keep inherited tags for filtering but do not display them.
- **Counts drift** → grouping is presentation-only; assert model and summary
  counts.
- **Legacy expectations** → no invented structure; document.
- **Large rule sets** → rule sections add static wrappers only; re-run stress.

## Migration Plan

No schema, CLI or API change. HTML output changes for Messages rules and
backgrounds. Rollback is a revert.

## Open Questions

None.
