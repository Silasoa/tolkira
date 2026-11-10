# Spec Delta

## ADDED Requirements

### Requirement: Separate per-scenario hooks from steps

Tolkira SHALL render per-scenario hooks separately from steps. The scenario
subtitle SHALL count steps and hooks independently, and the report's step counts
SHALL NOT include hooks.

#### Scenario: Passed hooks do not inflate the step count

- **WHEN** a scenario has one step and two passed hooks
- **THEN** the scenario subtitle states one step and two hooks
- **AND** the step count for the run excludes both hooks

#### Scenario: Hook order is preserved

- **WHEN** a scenario has before, step and after hooks
- **THEN** the hook rows keep their test-case order within the hook group
- **AND** the ordinary steps keep their order in the steps list

### Requirement: Show hook identity and outcome

Each per-scenario hook SHALL show its type, name when available, status,
duration, error message and attachments. A named hook SHALL be labelled with
its type and name, such as `Before: name`.

#### Scenario: Named hook

- **WHEN** a Messages hook has type `BEFORE_TEST_CASE` and name `seed database`
- **THEN** the hook row is labelled `Before: seed database`
- **AND** it shows its status and duration

#### Scenario: Unnamed hook

- **WHEN** a hook has a type but no name
- **THEN** the row falls back to the type label, such as `Before`

#### Scenario: Failed hook

- **WHEN** a hook fails with a message
- **THEN** the row is visible inline in the scenario
- **AND** it shows the error message
- **AND** the scenario remains non-passing and in the triage index

#### Scenario: Hook attachment

- **WHEN** a hook has an image or text attachment
- **THEN** the attachment is rendered with that hook
- **AND** it is not duplicated on another hook or on the scenario-level
  attachments

### Requirement: Collapse passed hooks

Passed per-scenario hooks SHALL be collapsed behind a disclosure labelled with
the number of hooks. Failed and other non-passing hooks SHALL remain inline.

#### Scenario: Passed hooks are collapsed

- **WHEN** a scenario has two passed hooks and no failed hook
- **THEN** the scenario shows a `2 hooks` disclosure
- **AND** the hook rows are hidden until the disclosure is opened

#### Scenario: Non-passing hooks stay visible

- **WHEN** a scenario has one passed and one failed hook
- **THEN** the failed hook is visible inline
- **AND** the passed hook remains behind the hooks disclosure

### Requirement: Show test-run hooks

Tolkira SHALL render test-run hooks in a separate Hooks section above the
feature list. Each row SHALL show BeforeAll/AfterAll type or name, status,
duration, error message and attachments. The section SHALL be omitted when the
run has no test-run hooks.

#### Scenario: BeforeAll and AfterAll

- **WHEN** the input contains a BeforeAll and an AfterAll hook
- **THEN** the Hooks section lists both with their status and duration
- **AND** a failed test-run hook shows its error and attachments

#### Scenario: No test-run hooks

- **WHEN** the input has only per-scenario hooks
- **THEN** no test-run Hooks section is rendered
- **AND** the scenario hook groups are unchanged

#### Scenario: Missing hook metadata

- **WHEN** a test-run hook start or finish has no matching Hook envelope
- **THEN** the row falls back to the hook type or a generic hook label
- **AND** the report still renders without an error

### Requirement: Keep hook data searchable and safe

Hook names and error messages SHALL be searchable with their scenario. All hook
names, type labels, messages and attachment names SHALL be escaped, and the
report SHALL remain a single offline file with no new network request.

#### Scenario: Search finds a hook name

- **WHEN** the user searches for a hook name or a hook error
- **THEN** the matching scenario is visible and opened
- **AND** its hook row remains visible after the search

#### Scenario: Untrusted hook text

- **WHEN** a hook name, type label or message contains HTML or script text
- **THEN** it is displayed as text and no markup or script executes

#### Scenario: Keyboard and no-JS

- **WHEN** the report is used by keyboard or without JavaScript
- **THEN** the hooks disclosure is operable and the run-hook rows remain
  readable
- **AND** no external asset or request is introduced

### Requirement: Preserve the summary and fallback contracts

The JSON summary SHALL keep its version-1 contract in this slice: hooks remain
entries in `scenarios[].steps` with `keyword: "Hook"`. The HTML report SHALL
separate them. Legacy JSON SHALL keep its per-scenario hooks as best effort and
has no test-run hooks; JUnit has no hooks.

#### Scenario: Summary stays stable

- **WHEN** a Messages run with hooks is summarised
- **THEN** `schemaVersion` remains 1
- **AND** hook entries keep `keyword: "Hook"`
- **AND** the HTML report still separates hooks from steps

#### Scenario: Legacy hooks

- **WHEN** the input is legacy Cucumber JSON with before/after hooks
- **THEN** the hooks render as per-scenario hook rows with status, duration,
  error and attachments
- **AND** no test-run Hooks section is invented

#### Scenario: JUnit without hooks

- **WHEN** the input is JUnit XML
- **THEN** no hook rows or Hooks section are rendered
