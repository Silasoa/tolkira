# Spec Delta

## ADDED Requirements

### Requirement: Highlight matched step parameters

When a test step has exactly one `stepMatchArgumentsLists` entry, the report
SHALL split the step text at the matched argument groups and wrap each matched
fragment in a `span.param` element that exposes its parameter type. All plain
and matched fragments SHALL be escaped. A missing parameter type SHALL be
reported as `anonymous`. Multiple match lists, absent lists, empty argument
lists and invalid or overlapping ranges SHALL fall back to the full escaped
step text without parameter spans. Parameter highlighting SHALL NOT change the
step's plain text, the JSON summary or the search/copy text.

#### Scenario: Typed parameters

- **WHEN** a step matches `I have 12 cucumbers` with an `int` argument for `12`
- **THEN** the report renders `12` inside `span.param` with parameter type `int`
- **AND** the surrounding words remain plain escaped text

#### Scenario: Unsafe parameter text

- **WHEN** a matched argument contains `<`, `>`, `&`, quotes or a script-like
  string
- **THEN** the characters render escaped inside `span.param`
- **AND** no markup or script executes

#### Scenario: No single match list

- **WHEN** a step has no match arguments, an empty argument list or more than
  one match list
- **THEN** the report renders the full escaped step text without `span.param`
- **AND** the step's `data-search` text still contains the original step text

#### Scenario: Invalid argument range

- **WHEN** an argument start is finite but out of range, truncated, does not
  match the step text or overlaps an earlier argument
- **THEN** the report renders the full escaped step text without `span.param`
- **AND** the original step text is emitted exactly once
