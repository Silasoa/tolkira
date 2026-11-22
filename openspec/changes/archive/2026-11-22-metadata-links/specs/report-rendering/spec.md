# Spec Delta

## ADDED Requirements

### Requirement: Link safe metadata URLs

When a custom metadata value passes the report's metadata link rule, the report
SHALL render it as a link in the Report header and in the Details custom
metadata list. The label SHALL be the value trimmed and stripped of the report's
bidi-control set (U+202A–202E, U+2066–2069), escaped, and the anchor SHALL carry
`rel="noopener noreferrer"`.

#### Scenario: Safe metadata URL

- **WHEN** metadata contains `CI run=https://github.com/acme/tolkira/actions/runs/42`
- **THEN** the header and Details show `CI run` with a link to that URL
- **AND** the link label is the URL

#### Scenario: Empty metadata

- **WHEN** a metadata key or value is empty
- **THEN** the entry is omitted as today

### Requirement: Reject ambiguous metadata URLs

The metadata link rule SHALL use the existing `safeHttpUrl` oracle, which
removes surrounding whitespace and the report's bidi-control set
(U+202A–202E, U+2066–2069) and accepts only absolute `http` or `https` URLs
normalized by the URL parser, and SHALL additionally reject a value with an
internal tab, line feed or carriage return. `safeHttpUrl` itself SHALL stay
unchanged for CI and attachment links. Rejected values SHALL stay escaped text
and SHALL NOT create an anchor.

#### Scenario: Normalized URL forms

- **WHEN** a value is `http:example.com`, `https:\\example.com` or
  `https://example.com/a b`
- **THEN** the report links the normalized destination
  (`http://example.com/`, `https://example.com/` and
  `https://example.com/a%20b`)
- **AND** the label stays the trimmed input

#### Scenario: Control-character URL

- **WHEN** a value contains an internal tab, line feed or carriage return
- **THEN** the value remains escaped text
- **AND** no anchor is created, so the label cannot misstate the destination

#### Scenario: Non-http value

- **WHEN** a metadata value is `javascript:alert(1)`, `data:text/html,...`,
  `ftp://example.com`, `www.example.com`, a malformed URL or plain text
- **THEN** the value remains escaped text
- **AND** no anchor is created

### Requirement: Keep metadata links and their surfaces consistent

The same link rule SHALL apply to `--meta` and the compatibility shim's
`metadata` object. Every other value SHALL stay escaped text. The JSON summary
and email SHALL keep their current bytes, and no locale key or dependency SHALL
be added.

#### Scenario: CLI and shim

- **WHEN** a run is rendered through `--meta` and through the compatibility shim
  with a URL metadata value
- **THEN** both reports show the link
- **AND** a numeric shim value still renders as text

### Requirement: Keep long metadata links readable and local

A long metadata URL SHALL wrap in the header and Details without horizontal
overflow at 320 px and 200 % text zoom. The report SHALL NOT fetch the URL or
add a network request when it is rendered.

#### Scenario: Long URL at 320 px

- **WHEN** a metadata value is a long Actions URL at 320 px and 200 % zoom
- **THEN** the header and Details wrap it without horizontal overflow
- **AND** no request is made until the user follows the link
