# Spec Delta

## MODIFIED Requirements

### Requirement: Keep German layout usable

German labels SHALL not clip or overflow at the gate viewports. Long status
labels SHALL wrap; this change does not introduce a short form. The page SHALL
not scroll horizontally at 320 px, including at 200 % text zoom. The Details Run
panel SHALL stack its label and value rows in one column at 560 px and below,
including in German, without splitting the exact byte count mid-number. Above
560 px and in A4 print (the CLI `--pdf` path) the German two-column Run panel
SHALL stay unchanged; narrower print page boxes SHALL follow the stacked layout,
as English already does.

#### Scenario: Narrow German report

- **WHEN** the German report is opened at 320 px and 200 % text zoom
- **THEN** the tabs, filters, status chips and Trends table stay usable
- **AND** the page has no horizontal overflow
- **AND** an anchored scenario is not hidden behind the sticky bar

#### Scenario: Stacked German Details rows

- **WHEN** the German Details Run panel is opened at 560 px or narrower
- **THEN** each label and value pair stacks in one column
- **AND** the exact byte count is not split mid-number
- **AND** the page has no horizontal overflow

#### Scenario: Wide German Details rows

- **WHEN** the German Details Run panel is opened above 560 px or rendered for
  A4 print (the CLI `--pdf` path)
- **THEN** the Run panel keeps its two-column label/value layout
- **AND** the first track keeps the German 2fr/3fr share
