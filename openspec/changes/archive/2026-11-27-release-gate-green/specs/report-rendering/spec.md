# Spec Delta

## ADDED Requirements

### Requirement: Keep the toolbar controls inside the shell

At 320 px with 200 % text the toolbar expand and collapse controls SHALL wrap
inside the toolbar, and the page SHALL NOT overflow horizontally. At 1440 px
both controls SHALL stay on the toolbar line, end-aligned. The existing
sub-900 px layout is unchanged.

#### Scenario: Narrow screen with 200 % text

- **WHEN** the report is viewed at 320 px with 200 % text
- **THEN** the expand block's left and right edges stay inside the toolbar's
  content box
- **AND** the document's scroll width does not exceed the window width by more
  than one pixel

#### Scenario: Desktop layout unchanged

- **WHEN** the report is viewed at 1440 px with 100 % text
- **THEN** both controls stay on one line at the end of the toolbar
- **AND** their top edges are equal and the last control's right edge aligns
  with the toolbar's right edge

#### Scenario: Static report

- **WHEN** the report is rendered with `--static`
- **THEN** no toolbar or expand markup is rendered
- **AND** the only expected byte change is in the inlined stylesheet
