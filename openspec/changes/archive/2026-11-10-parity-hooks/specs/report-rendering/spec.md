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

#### Scenario: Non-passing hooks keep their place among steps

- **WHEN** a scenario has before, step and after hooks
- **THEN** non-passing hooks render inline in their test-case order among the steps
- **AND** the ordinary steps keep their order
- **AND** a failed before hook is visible before the step it affected

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
- **AND** the triage reason and copied failure can use the failed hook when no
  step failed

#### Scenario: Hook attachment

- **WHEN** a hook has an image or text attachment
- **THEN** the attachment is rendered with that hook
- **AND** it is not duplicated on another hook or in the run attachments

#### Scenario: Durations include hook time

- **WHEN** a scenario has hooks and steps
- **THEN** its duration includes both
- **AND** the feature and run durations include the hook time

### Requirement: Collapse passed hooks

Passed per-scenario hooks SHALL be collapsed behind a disclosure labelled with
the number of hooks. Failed and other non-passing hooks SHALL remain inline.

#### Scenario: Passed hooks are collapsed

- **WHEN** a scenario has two passed hooks and no failed hook
- **THEN** the scenario shows one `2 hooks` disclosure
- **AND** the hook rows are hidden until the disclosure is opened

#### Scenario: Non-passing hooks stay visible

- **WHEN** a scenario has one passed and one failed hook
- **THEN** the failed hook is visible inline
- **AND** the passed hook remains behind the hooks disclosure

#### Scenario: Skipped hooks are kept

- **WHEN** a hook is skipped
- **THEN** it remains visible inline because it explains the skipped result
- **AND** this deliberate difference from the official step filter is
  documented

### Requirement: Show test-run hooks

Tolkira SHALL render test-run hooks in a separate Hooks section below the
feature list. Each row SHALL show the hook name when present, otherwise
BeforeAll/AfterAll, plus status, duration, error message and attachments. The
section SHALL be omitted when the run has no test-run hooks.

#### Scenario: BeforeAll and AfterAll

- **WHEN** the input contains a BeforeAll and an AfterAll hook
- **THEN** the Hooks section lists both with their status and duration
- **AND** a named run hook shows its name
- **AND** a failed test-run hook shows its error and attachments

#### Scenario: No test-run hooks

- **WHEN** the input has only per-scenario hooks
- **THEN** no test-run Hooks section is rendered
- **AND** the scenario hook groups are unchanged
- **AND** this omission is a documented deliberate difference from the
  official empty Hooks section

#### Scenario: Missing hook metadata

- **WHEN** a test-run hook start or finish has no matching Hook envelope
- **THEN** the row falls back to the hook type or a generic hook label
- **AND** the report still renders without an error

#### Scenario: Run-hook attachments are counted once

- **WHEN** a test-run hook has an attachment
- **THEN** the attachment is rendered in the Hooks section
- **AND** it is not repeated in the run attachments list
- **AND** the attachment totals count it once

### Requirement: Keep hook data searchable and safe

Hook names and error messages SHALL be searchable with their scenario. All hook
names, type labels, messages and attachment names SHALL be escaped, and the
report SHALL remain a single offline file with no new network request.

#### Scenario: Search finds a hook name

- **WHEN** the user searches for a hook name or a hook error
- **THEN** the matching scenario is visible and opened
- **AND** a matching passed-hook group opens so the hook row is visible
- **AND** the 20-match expansion cap still applies

#### Scenario: Untrusted hook text

- **WHEN** a hook name, type label or message contains HTML or script text
- **THEN** it is displayed as text and no markup or script executes

#### Scenario: Keyboard and no-JS

- **WHEN** the report is used by keyboard or without JavaScript
- **THEN** the hooks disclosure is operable and the run-hook rows remain
  readable
- **AND** no external asset or request is introduced

### Requirement: Preserve the summary and fallback contracts

The JSON summary SHALL keep its version-1 shape: hooks remain entries in
`scenarios[].steps` with `keyword: "Hook"`, and an optional hook `name` is
added additively. A failed test-run hook SHALL make the summary status failed.
The HTML report SHALL separate hooks and label its step counts as excluding
them.

#### Scenario: Summary stays version 1

- **WHEN** a Messages run with hooks is summarised
- **THEN** `schemaVersion` remains 1
- **AND** hook entries keep `keyword: "Hook"`
- **AND** a named hook carries its name
- **AND** the HTML report still separates hooks from steps

#### Scenario: Failed run hook fails the summary

- **WHEN** a BeforeAll or AfterAll hook fails after otherwise passing scenarios
- **THEN** the JSON summary status is failed
- **AND** CI can detect the failure from the documented interface

#### Scenario: Two step totals are labelled

- **WHEN** the Details view shows the model step count and the embedded summary
- **THEN** the HTML count is labelled as excluding hooks
- **AND** the summary count is labelled as including hook entries
- **AND** a Hooks count is shown separately

#### Scenario: Legacy hooks

- **WHEN** the input is legacy Cucumber JSON with before/after hooks
- **THEN** the hooks render as per-scenario hook rows with status, duration,
  error and attachments
- **AND** no test-run Hooks section is invented
- **AND** the compatibility shim still returns the summary

#### Scenario: JUnit without hooks

- **WHEN** the input is JUnit XML
- **THEN** no hook rows or Hooks section are rendered
