---
version: 1
slug: "report"
primary_target: "report"
related_targets: []
---

# Report shell

Scope: the Report view of the generated HTML report; Details, Trends, static
mode and print inherit the same tokens and density. Visitor mode: Operate.

Audience: developers and QA opening a red CI run, CI engineers embedding the
single file, and agents reading the JSON summary. Job: know what failed, at
which step, with what error and evidence, within one viewport; then scan the
index, open Details/Trends, or share the file.

Chosen direction: Incident review. The first non-passing scenario is resolved
as an incident above the feature index: status, step timeline, error and
attachments. The feature list becomes the index of everything else. Memorable
moment: the failure reads as a finished investigation, not a row to expand.

First viewport note: the toolbar sits above the panel (reviewed deviation from
the mockup) so search and filters stay reachable with a long detail; the panel
is the first content object after the controls.

## Direction contract

THESIS: The report opens with the failure resolved as an incident — step,
error, evidence — before it shows the index; it refuses the category default
where the failure is only the first row under a header.

OWN-WORLD: Warm chart-neutral paper, ink, one signal red and one pass green;
one system sans for UI, mono for measurements, error text and paths; compact
one-pixel rules, no cards, no shadows; the incident panel is a full-border
tinted block around the reused scenario detail.

STORY: Within one viewport the visitor knows what failed, where, why and what
passed; then scans the index, opens Details/Trends, or shares the file.

FIRST VIEWPORT: Top bar with brand and Report/Details/Trends; run header with
path, title, meta and score/counts; toolbar; a full-width "What happened"
panel for the first incident with the reused scenario detail; baseline; the
feature index with the incident row marked as shown above.

FORM: Incident review; position 1 on the grounded list; seed:d030051c8c358c72
(the pick won by user choice over the assigned Run trace).

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.

## Unresolved

- Run-level BeforeAll/AfterAll failures stay in the existing run hooks section;
  an incident panel for them is deferred.
- Folding the triage list into the panel for several failures is deferred.
- A per-failure selector without a client script is deferred.
