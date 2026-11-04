# Spec Delta

## ADDED Requirements

### Requirement: Order results exception-first

The Report view SHALL list features and, inside each feature, scenarios with
non-passing status before passed ones. Non-passing statuses SHALL use the
existing Cucumber severity order, worst first: failed, ambiguous, undefined,
pending, skipped, unknown. Input order SHALL be preserved within equal status.

#### Scenario: Mixed statuses in one feature

- **WHEN** a feature contains failed, pending and passed scenarios in that input
  order
- **THEN** the rendered order is failed, pending, passed
- **AND** the counts and content of each scenario are unchanged

#### Scenario: Stable order within a status

- **WHEN** two features share the same worst status
- **THEN** they keep their input order relative to each other

#### Scenario: All scenarios passed

- **WHEN** every scenario passed
- **THEN** the report keeps input order
- **AND** the Details view and the JSON summary keep input order in every case

### Requirement: Show a needs-attention index

When at least one scenario is not passed, the Report view SHALL render a
"Needs attention" index above the feature list. It SHALL list one row per
non-passing feature that has at least one scenario, with its worst status, its
non-passing scenario counts and up to three links to its non-passing scenarios.
It SHALL NOT render when every scenario passed.

#### Scenario: Index lists non-passing features

- **WHEN** a run has one failed and one pending feature
- **THEN** the index lists both before any passed feature
- **AND** each row shows the status as text and the failures per status

#### Scenario: Scenario links are capped

- **WHEN** a feature has five non-passing scenarios
- **THEN** the index renders three scenario links
- **AND** a "2 more" note points to the report list without extra links

#### Scenario: Feature rows are capped

- **WHEN** more than 20 features need attention
- **THEN** the index renders 20 feature rows
- **AND** states how many further features are listed below

#### Scenario: Nothing to triage

- **WHEN** every scenario passed
- **THEN** no needs-attention index is rendered
- **AND** the feature list is unchanged apart from ordering

### Requirement: Jump from the index to a result

Index entries SHALL be ordinary links to stable anchors on the feature and
scenario rows. Following a link SHALL expand the target and its collapsed
ancestors so the scenario and its steps are visible.

#### Scenario: Link to a collapsed pending scenario

- **WHEN** the user follows a scenario link whose feature and scenario are
  collapsed
- **THEN** both open, the URL hash names the target and the browser scrolls to
  it
- **AND** no other scenario is opened

#### Scenario: Link without scripting

- **WHEN** the inline script does not run
- **THEN** the links still name an existing anchor and the report remains
  readable

#### Scenario: Keyboard use

- **WHEN** the index is reached by keyboard
- **THEN** every entry is focusable and follows the link order of the rows

### Requirement: Show the shape of each feature

The Report view SHALL show on every feature row the passed/total scenario count
and a segmented proportion bar using the run's status colours. The non-passing
counts SHALL also be named as text.

#### Scenario: Mixed feature

- **WHEN** a feature has passed, failed and pending scenarios
- **THEN** its row states the passed/total count and the failed and pending
  counts as text
- **AND** the bar has one segment per present status in severity order

#### Scenario: Feature without scenarios

- **WHEN** a feature contains no scenarios
- **THEN** the row states "0 scenarios" and renders no proportion bar

### Requirement: Compare features in the Details matrix

The Details view SHALL present one row per feature with the total scenario
count, one count column per status present in the run, and the duration. Status
columns SHALL be ordered worst first. Zero counts SHALL be rendered as a muted
zero, not an empty cell.

#### Scenario: Mixed run

- **WHEN** the run contains failed, pending and passed scenarios
- **THEN** the matrix has failed, pending and passed columns
- **AND** every row's cells match the summary counts for that feature

#### Scenario: Clean run

- **WHEN** every scenario passed
- **THEN** the matrix has only the passed status column

#### Scenario: Narrow viewport

- **WHEN** the matrix is wider than its container
- **THEN** it scrolls inside its labelled region
- **AND** the page itself does not scroll horizontally

### Requirement: Group by input source only with real provenance

When the run has more than one input file and every feature URI belongs to
exactly one input, the Report view SHALL render a source group level above the
feature rows, carrying the input file name and that group's aggregates.
Otherwise it SHALL render a flat list. The report SHALL NOT infer a group from
a feature URI, tag, directory or name.

#### Scenario: Two input files

- **WHEN** two files are merged into one report
- **THEN** the overview shows one group per file
- **AND** groups are ordered by worst status, then input order

#### Scenario: One input file

- **WHEN** a single file contains several features
- **THEN** no source group level is rendered

#### Scenario: Shared or missing provenance

- **WHEN** a feature URI appears in two inputs, or a Messages stream has no
  file boundary
- **THEN** the report renders a flat feature list
- **AND** no group name is derived from the URI

### Requirement: Keep the triage index offline and safe

The index SHALL be rendered server-side from `ReportModel` with escaped names,
SHALL add no network request, inline data store or new dependency, and SHALL
keep the existing content security policy.

#### Scenario: Untrusted names in the index

- **WHEN** a feature or scenario name contains HTML or a script payload
- **THEN** the index shows it as text and executes nothing

#### Scenario: Self-contained file

- **WHEN** the report is opened offline
- **THEN** the index, its links and the reveal behaviour work without a server

#### Scenario: Status without colour

- **WHEN** colour is unavailable
- **THEN** every index row still names its status as text
