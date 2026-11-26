# Spec Delta

## ADDED Requirements

### Requirement: Report capabilities as JSON

The CLI SHALL accept `--capabilities` without an input and print one schema-1
JSON document to stdout, exiting 0. `--capabilities` SHALL reject positional
inputs and every other option with exit 2 before any write; `--help` and
`--version` keep precedence.

#### Scenario: Capabilities alone

- **WHEN** `tolkira --capabilities` runs
- **THEN** stdout is one JSON document and the exit code is 0
- **AND** it carries `schemaVersion`, `name`, `version`, `node`, `inputs`,
  `outputs`, `summarySchemaVersion`, `locales`, `limits`, `defaults` and
  `exitCodes`

#### Scenario: Combined with anything else

- **WHEN** `--capabilities` is combined with an input, `--out`, `--json` or
  another option
- **THEN** the CLI exits 2, prints the usage text and writes no output

### Requirement: Source every capability value once

Every capability value SHALL come from its single source: the constant that
enforces a limit, the package metadata for the version and Node range, proven
equal by a test, or the type union that defines the CI kinds. Overridable
option defaults SHALL be grouped and named as defaults, not as limits. The exit
codes SHALL match the documented behaviour, proven by runs that produce each
code.

#### Scenario: Values match the installed runtime

- **WHEN** the document reports the version, summary schema, locales, limits,
  defaults and exit codes
- **THEN** each equals the value the runtime enforces
- **AND** a success run, a usage error and an input error return the documented
  codes
- **AND** two runs produce identical bytes

### Requirement: Keep capabilities stable and bounded

The document SHALL be deterministic, free of timestamps, local paths and
environment values, and under 4,096 bytes.

#### Scenario: Bounded and deterministic

- **WHEN** `--capabilities` runs twice
- **THEN** both runs print identical bytes under 4,096 bytes
- **AND** neither carries a timestamp, a local path or an environment value

### Requirement: Write a run manifest

The CLI SHALL accept `--manifest <file>` and write a deterministic schema-1
JSON document with the summary status, counts and attachments, the run's
skipped-attachment count, the files written before it, and the first 10 failed
rows with feature, name, outline `example` and display URI. The manifest SHALL
NOT contain a timestamp, an input path or duplicated rows, and it SHALL use the
same atomic `0600` writer as the other outputs. A write failure SHALL exit 1
and leave no partial file.

#### Scenario: Summary-only run

- **WHEN** `--json --manifest run.json` is used without a report file
- **THEN** the manifest has an empty `artifacts` array
- **AND** it still carries the status, counts and first failures

#### Scenario: Failure list

- **WHEN** 12 rows failed
- **THEN** `failures` has 10 rows in summary order
- **AND** `counts.scenarios.failed` is 12
- **AND** an outline row carries its `example` coordinate

#### Scenario: Hook-only failure

- **WHEN** a failed run hook leaves `status: failed` without a failed scenario
- **THEN** `failures` is an empty array
- **AND** the status and counts stay authoritative

#### Scenario: Collision and empty path

- **WHEN** `--manifest` names an input, the logo, another output, a path inside
  an input directory, or an empty path
- **THEN** the CLI exits 2 and nothing is written

#### Scenario: Write failure

- **WHEN** the manifest cannot be written after the report
- **THEN** the CLI exits 1 and names the manifest path
- **AND** the report stays and no partial manifest remains
- **AND** all later stdout, including `--json`/`--ci`, are skipped

#### Scenario: Machine stdout stays identical

- **WHEN** `--json` or `--ci` owns stdout and `--manifest` is also used
- **THEN** the machine bytes are unchanged

### Requirement: Order and path the manifest artifacts

Only `report`, `pdf`, `email`, `history` and `ci-markdown` files SHALL appear
in the manifest, in write order. Each `path` SHALL be relative to the manifest
file; an absolute artifact path SHALL be recorded as given only when no
relative path exists. A relative artifact path that cannot be expressed
relative to the manifest SHALL be a usage error before any write. The manifest
file itself SHALL be omitted. `--manifest` alone SHALL satisfy the
at-least-one-output requirement.

#### Scenario: Artifact list

- **WHEN** `--out`, `--pdf`, `--email`, `--history`, `--ci markdown
  --ci-out` and `--manifest` are used together
- **THEN** the manifest lists report, PDF, email, history and `ci-markdown`
  once each, in that order
- **AND** its status, counts and attachments equal the summary values
- **AND** its paths are relative to the manifest file

## MODIFIED Requirements

### Requirement: Generate a report from the CLI

The CLI SHALL accept one or more input files or directories and at least one
output surface, and SHALL produce the requested outputs. It SHALL also accept
`--help`, `--version` and `--capabilities` without an input or output. With
`--static`, the CLI SHALL require `--out` or `--pdf`; `--json` alone SHALL NOT
be a report surface.

#### Scenario: Single input

- **WHEN** the user runs the CLI with one supported input and an output path
- **THEN** the CLI writes the HTML report to that path

#### Scenario: Multiple inputs

- **WHEN** the user runs the CLI with multiple supported inputs
- **THEN** the CLI writes one report containing all results

#### Scenario: Directory input

- **WHEN** the user runs the CLI with a directory
- **THEN** the CLI includes every supported report file in that directory

#### Scenario: Static report surface

- **WHEN** `--static` is used with `--json` and without `--out` or `--pdf`
- **THEN** the CLI exits 2 and names `--out` or `--pdf`
- **AND** nothing is written

### Requirement: Support title, metadata and output options

The CLI SHALL support a report title, repeated metadata entries, a logo, an
accent colour, a size warning threshold, help, version and capabilities
output. The API SHALL support title, metadata, logo and accent. The CLI SHALL
require at least one of `--out`, `--pdf`, `--email`, `--json`, `--ci` or
`--manifest`. With `--static`, the CLI SHALL require `--out` or `--pdf` instead of accepting `--json` alone.

#### Scenario: Title and metadata

- **WHEN** the user supplies a title and metadata entries
- **THEN** the generated report contains the escaped title and metadata

#### Scenario: Help

- **WHEN** the user requests help
- **THEN** the CLI prints usage and exits successfully

#### Scenario: Static output surface

- **WHEN** `--static` is used with only `--json`
- **THEN** the CLI exits 2 and names `--out` or `--pdf`

### Requirement: Validate email paths and writes

The email path SHALL NOT equal an input, the logo, `--out`, `--ci-out`,
`--history` or `--manifest`, or be inside an input directory even
when the target does not exist. The CLI SHALL write in the order report, email,
history, `--ci-out`, manifest, stdout, with the PDF between report and
email when present. On an email write failure it SHALL exit 1 with the email
path (not the temporary name), keep an already written report, and SHALL NOT
write the history/`--ci-out`/manifest or print the JSON/CI stdout. No
partial email SHALL remain.

#### Scenario: Collision

- **WHEN** `--email` resolves to an input, the logo, `--out`, `--ci-out`, the
  history file, the manifest or a path inside an input directory
- **THEN** the CLI exits 2
- **AND** nothing is written

#### Scenario: Email write failure

- **WHEN** the email cannot be written after the report or summary
- **THEN** the CLI exits 1 and names the email path
- **AND** the report stays
- **AND** the history, `--ci-out` and manifest are not written and the
  JSON/CI stdout is not printed
- **AND** no partial email remains

### Requirement: Add the PDF output option

The CLI SHALL accept `--pdf <file>` as an output. It SHALL require a non-empty
path and at least one input. The PDF SHALL compose with `--out`, `--email`,
`--json`, `--ci`, `--history` and `--manifest`, and SHALL follow the
order report → PDF → email → history → `--ci-out` → manifest → stdout
(the PDF is written before the email that names it). A missing optional engine
SHALL exit 1 with install instructions; the report remains and the
email/later outputs are skipped.

#### Scenario: PDF alone

- **WHEN** `--pdf run.pdf` is the only output
- **THEN** the report HTML is rendered in memory for the PDF without being written
- **AND** the PDF is written and the process exits 0
- **AND** stdout says the PDF was written

#### Scenario: Composition

- **WHEN** `--out report.html --email summary.html --pdf run.pdf` is used
- **THEN** the report, PDF and email are written in that order
- **AND** a PDF failure keeps the report and skips email, history, `--ci-out`,
  manifest and stdout

#### Scenario: Missing engine

- **WHEN** the optional Playwright/Chromium engine is absent
- **THEN** the CLI exits 1 with the install instructions
- **AND** the report (if already written) stays
- **AND** no email/PDF is left partial

### Requirement: Validate PDF paths and writes

The PDF path SHALL NOT equal an input, the logo, `--out`, `--ci-out`,
`--history`, `--email` or `--manifest`, or lie inside an input
directory (canonicalized/case-aware). It SHALL be written atomically after the
report and before the email. A write or render failure SHALL exit 1 with the
PDF path, keep the report, skip the email, history, `--ci-out`, manifest and
stdout, and leave no partial PDF.

#### Scenario: Collision

- **WHEN** `--pdf` resolves to an input, the logo, `--out`, `--ci-out`,
  `--history`, `--email`, the manifest or a path inside an input directory
- **THEN** the CLI exits 2
- **AND** nothing is written

#### Scenario: Write or render failure

- **WHEN** the PDF cannot be written or rendered
- **THEN** the CLI exits 1 and names the PDF path
- **AND** the report stays
- **AND** the email/history/`--ci-out`/manifest/stdout outputs are skipped
- **AND** no partial PDF remains
