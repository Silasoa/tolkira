# Spec Delta

## ADDED Requirements

### Requirement: Stream Cucumber Messages into a report

The package SHALL export `CucumberHtmlStream`, a Node `Transform` that accepts
Cucumber Messages `Envelope` objects in object mode. It SHALL collect the
envelopes, render one HTML document on flush and emit it as a string chunk. It
SHALL accept the same `RenderReportOptions` as `renderReport` and SHALL
produce the same HTML for the same envelopes and options. It SHALL NOT write
files.

#### Scenario: Stream output matches the file API

- **WHEN** a caller pipes the envelopes of one Messages input through
  `CucumberHtmlStream` with a title
- **THEN** the collected output equals `renderReport` for that input and title

#### Scenario: Stream options

- **WHEN** a caller passes title, metadata, logo or accent to the constructor
- **THEN** the rendered HTML contains the same escaped values as the file API
- **AND** missing options use the API defaults

#### Scenario: Streaming error

- **WHEN** rendering fails during flush
- **THEN** the stream emits that error
- **AND** no partial HTML is presented as a complete report
