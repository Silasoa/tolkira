# Spec Delta

## ADDED Requirements

### Requirement: Detect a one-line report without parsing it twice

Before parsing a candidate first line as a Messages envelope, the detector SHALL
check that the trimmed line starts with `{` and that its first key is a known
Messages envelope key. It SHALL parse and confirm the envelope only after that
check. A one-line Playwright report SHALL be classified as Playwright with one
parse of the file. Messages, legacy JSON, JUnit and malformed JSON SHALL keep
their existing classification.

#### Scenario: One-line Playwright report

- **WHEN** the input is a Playwright JSON document whose first line is the whole
  file
- **THEN** it is classified as Playwright
- **AND** `JSON.parse` runs once over the file

#### Scenario: One-line Messages envelope

- **WHEN** the input is one Messages envelope on one line
- **THEN** it is classified as Messages
- **AND** `JSON.parse` runs once for that line

#### Scenario: Multi-line Playwright report

- **WHEN** a Playwright JSON document starts with a line containing only `{`
- **THEN** the first line is not parsed as a Messages candidate
- **AND** the document is parsed once by the Playwright sniffer

#### Scenario: Legacy and JUnit are unchanged

- **WHEN** the input is a legacy Cucumber JSON array or a JUnit XML document
- **THEN** the existing adapter still handles it
- **AND** the new first-key check does not change the decision

#### Scenario: Malformed and non-envelope JSON

- **WHEN** the first line starts with `{` but its first key is not an envelope
  key, or the line is malformed JSON
- **THEN** the line is not parsed as a Messages candidate
- **AND** the existing unsupported or validation decision is unchanged

#### Scenario: BOM and blank leading lines

- **WHEN** a Messages or Playwright document has a UTF-8 BOM or blank lines
  before its first key
- **THEN** the first key is read after the BOM and blank lines are removed
- **AND** the classification and parse count are unchanged

### Requirement: Do not invent a legacy run time

When normalising legacy JSON, `options.startedAt` SHALL be the only timestamp
source. Without it the adapter SHALL emit a zero timestamp and SHALL NOT read
the clock. The `0.6.1-quality-pass` zero-timestamp-is-unknown rule SHALL keep the
report date and scenario `1970` dates out of the output. An explicit non-zero
`options.startedAt` SHALL still pin the date. The summary SHALL keep no date
field and a real Messages run SHALL be unchanged.

#### Scenario: No explicit run time

- **WHEN** a legacy JSON report is normalised without `options.startedAt`
- **THEN** its run and scenario start timestamps are zero
- **AND** the report shows no run date
- **AND** no scenario shows a `1970` date

#### Scenario: Explicit run time pin

- **WHEN** a legacy JSON report is normalised with an explicit non-zero
  `options.startedAt`
- **THEN** the report shows that date
- **AND** the timestamp is not replaced by the generation time

#### Scenario: Real Messages run is unchanged

- **WHEN** a real Cucumber Messages run with a valid timestamp is rendered
- **THEN** its date display is unchanged

#### Scenario: JSON summary has no date

- **WHEN** a legacy JSON report without `options.startedAt` is summarised
- **THEN** the summary has no date field
- **AND** its shape is unchanged

#### Scenario: Legacy screenshots and attachments are unchanged

- **WHEN** a legacy JSON report without `options.startedAt` contains a screenshot
  and a text embedding
- **THEN** both still render and count as before
- **AND** the zero timestamp does not change their data

### Requirement: Accept only XML entities in JUnit data

The JUnit adapter SHALL accept only the five XML named entities (`amp`, `lt`,
`gt`, `quot`, `apos`) and numeric character references. Any other named entity
SHALL fail with the existing invalid-entity error naming the file. The
unreachable `htmlEntities: true` parser option SHALL be removed. `&nbsp;` SHALL
keep failing. The JUnit documentation SHALL state the accepted entities.

#### Scenario: XML entities are accepted

- **WHEN** a JUnit document contains `&amp;`, `&lt;`, `&gt;`, `&quot;` or
  `&apos;` in text or an attribute
- **THEN** the document parses
- **AND** the readable text is preserved

#### Scenario: Numeric references are accepted

- **WHEN** a JUnit document contains `&#160;` or `&#xA0;`
- **THEN** the document parses
- **AND** the character is preserved as data

#### Scenario: HTML entities are rejected

- **WHEN** a JUnit document contains `&nbsp;` or another non-XML named entity
- **THEN** generation fails with the existing invalid-entity error naming the
  file
- **AND** no partial report is written

#### Scenario: Documentation states the rule

- **WHEN** `docs/JUNIT-XML.md` is inspected
- **THEN** it states that only the five XML named entities and numeric
  references are accepted
- **AND** it names `&nbsp;` as rejected

## MODIFIED Requirements

### Requirement: Merge multiple inputs deterministically

Tolkira SHALL accept more than one input file or directory and SHALL merge the
results into one report. The order of features and scenarios SHALL be stable
for the same inputs. Deterministic order SHALL NOT depend on the host or process
locale. Every deterministic sort — summary scenarios, resolved input files,
baseline not-in-this-run rows and report tag order — SHALL use one shared
comparator that orders strings by UTF-16 code units. The same inputs SHALL
produce byte-identical `--json`, CI Markdown and report order under different
host locales. The visible order for non-ASCII names changes and SHALL be
documented. No runtime dependency SHALL be added.

#### Scenario: Two reports become one

- **WHEN** the user passes two reports containing different features
- **THEN** the generated report contains both features

#### Scenario: Directory input is expanded

- **WHEN** the user passes a directory containing supported report files
- **THEN** Tolkira reads every supported file in a stable order

#### Scenario: Host locale does not change the output

- **WHEN** the same input with the names `apple`, `Zebra` and `Äpfel` is
  processed under a `sv_SE` locale and a `de_DE` locale
- **THEN** the `--json` bytes are identical
- **AND** the Markdown CI bytes are identical
- **AND** the scenario order is the fixed UTF-16 code-unit order

#### Scenario: Report feature and tag order

- **WHEN** a directory input and a run with tags are rendered under two fixed
  locales
- **THEN** the report feature order follows the fixed resolved-input order
- **AND** the tag order is identical

#### Scenario: Non-ASCII order is documented

- **WHEN** the change is released
- **THEN** the changelog states that the visible order for non-ASCII names
  changed
- **AND** no runtime dependency was added
