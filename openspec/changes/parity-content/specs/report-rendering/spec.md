# Spec Delta

## ADDED Requirements

### Requirement: Render safe GFM descriptions

The report SHALL render feature, rule, background, scenario and examples
descriptions as a safe GFM subset: headings, emphasis, code, links, lists,
tables and blockquotes. Raw HTML SHALL NOT be rendered and images SHALL be
omitted.

#### Scenario: Markdown description

- **WHEN** a description contains a heading, list, table or blockquote
- **THEN** the formatted structure renders
- **AND** the underlying text is escaped where Markdown does not format it

#### Scenario: Raw HTML in Markdown

- **WHEN** a description contains a script or an HTML tag
- **THEN** it is shown as text or omitted
- **AND** no markup or script executes

#### Scenario: Links and images

- **WHEN** a description contains a link or image
- **THEN** only http(s)/mailto links become anchors
- **AND** images are not rendered
- **AND** the report makes no network request

#### Scenario: Legacy and JUnit descriptions

- **WHEN** legacy JSON or JUnit supplies a description
- **THEN** the same safe Markdown rendering applies
- **AND** no external asset is loaded

### Requirement: Support tag-expression search

The search box SHALL accept tag expressions with tags, `and`, `or`, `not` and
parentheses, combined with the existing text search fallback.

#### Scenario: Tag expression

- **WHEN** the user enters `@a and not @b`
- **THEN** only scenarios whose tags satisfy the expression remain visible
- **AND** features, rules and examples with no match are hidden
- **AND** the 20-match auto-open cap still applies

#### Scenario: Invalid expression

- **WHEN** the input is not a valid tag expression
- **THEN** the report falls back to the existing substring search
- **AND** no error is shown

#### Scenario: Text and tags

- **WHEN** the query contains both text and a tag expression
- **THEN** the report applies the documented precedence
- **AND** the visible count and empty state are accurate

### Requirement: Persist search and filters in the URL

The report SHALL restore `?query=`, `?hide=` and `?tag=` on load and update
them when the user changes search or filters, without adding a history entry
per keystroke.

#### Scenario: Share a filtered view

- **WHEN** the user searches, hides a status or selects a tag
- **THEN** the URL contains the corresponding parameters
- **AND** opening that URL restores the same view

#### Scenario: Back and forward

- **WHEN** the user navigates browser history after changing filters
- **THEN** the view follows the URL state
- **AND** the search cap and empty state stay consistent

#### Scenario: No JavaScript

- **WHEN** the inline script does not run
- **THEN** the full static report remains readable
- **AND** URL state is not required

### Requirement: Keep counts, summary and offline behavior

Markdown rendering, tag expressions and URL state SHALL NOT change scenario,
step or attachment counts, the summary schema or the no-network baseline.

#### Scenario: Counts unchanged

- **WHEN** a Markdown/tag-expression report is rendered
- **THEN** its counts match the summary baseline
- **AND** the summary schema version is 2

#### Scenario: Offline

- **WHEN** the report is opened offline
- **THEN** Markdown, tag expressions and restored filters work without a
  server or external request
