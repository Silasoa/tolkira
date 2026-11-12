# Spec Delta

## ADDED Requirements

### Requirement: Render safe GFM descriptions

The report SHALL render feature, rule, background, scenario and examples
descriptions as a safe GFM subset inside a block container: headings, emphasis,
code, links, lists, tables and blockquotes. Raw HTML SHALL NOT be rendered and
images SHALL be omitted without becoming links.

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
- **THEN** only http(s)/mailto links become anchors with
  `rel="noopener noreferrer nofollow"`
- **AND** images render as alt text only, including reference and linked images
- **AND** the report makes no network request

#### Scenario: Legacy and JUnit descriptions

- **WHEN** legacy JSON or JUnit supplies a description
- **THEN** the same safe Markdown rendering applies
- **AND** no external asset is loaded

### Requirement: Support tag-expression search

The search box SHALL accept the official tag-expression grammar (`not` before
`and` before `or`, parentheses, escaped tags, lowercase operators) when the
whole query is tag-shaped. Otherwise it uses substring search; mixed text and
tag input is text. Status filters and the tag dropdown combine with a valid
expression using AND.

#### Scenario: Tag expression

- **WHEN** the user enters `@a and not @b`
- **THEN** only scenarios whose tags satisfy the expression remain visible
- **AND** features, rules and examples with no match are hidden
- **AND** at most 20 newly opened rows are expanded

#### Scenario: Invalid expression

- **WHEN** the input is not a valid tag expression
- **THEN** the report falls back to the existing substring search
- **AND** no error is shown

#### Scenario: Mixed text and tags

- **WHEN** the query contains text and tag tokens together
- **THEN** the whole query is treated as substring text
- **AND** the visible count and empty state are accurate

### Requirement: Persist search and filters in the URL

The report SHALL restore `?query=`, repeated lowercase `?hide=` and `?tag=` on
load and update them with `replaceState` when the user changes search or
filters. Restore SHALL synchronize the inputs, select and status buttons and
preserve the hash and unrelated URL parameters.

#### Scenario: Share a filtered view

- **WHEN** the user searches, hides a status or selects a tag
- **THEN** the URL contains the corresponding parameters
- **AND** opening that URL restores the same view

#### Scenario: Restore controls

- **WHEN** a URL contains query, hide and tag parameters
- **THEN** the search box, status buttons and tag select reflect them
- **AND** the search cap and empty state stay consistent

#### Scenario: URL update fails

- **WHEN** `replaceState` is unavailable or throws on `file://`
- **THEN** filtering still works
- **AND** the report does not throw

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
