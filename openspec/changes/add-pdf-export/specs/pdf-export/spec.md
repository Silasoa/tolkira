# Spec Delta

## ADDED Requirements

### Requirement: Generate an opt-in PDF

The CLI SHALL accept `--pdf <file>` and `renderPdf(html, options)` SHALL return
the PDF bytes. Without the flag no PDF SHALL be created and the one-file HTML
default SHALL stay unchanged. The PDF SHALL be the complete archive: all present
views and details, screenshots, the light palette, fitted tables, A4 with 12 mm
margins and no header/footer.

#### Scenario: PDF next to a report

- **WHEN** `--pdf run.pdf` is used with `--out report.html`
- **THEN** the report and the PDF are written
- **AND** the PDF contains Report, Details and Trends as present and every detail

#### Scenario: PDF alone

- **WHEN** `--pdf run.pdf` is the only report output
- **THEN** the report HTML is rendered in memory for the PDF without being written
- **AND** the PDF is written
- **AND** no report file is left behind

### Requirement: State the PDF content limits

The PDF SHALL be generated from a fresh report page; no CLI search/filter state
SHALL apply, and the browser print SHALL remain the filtered route. Video/audio
SHALL be documented as not printable; an unusually wide matrix MAY need the
browser print's landscape.

#### Scenario: Complete archive

- **WHEN** a report has screenshots and a wide matrix
- **THEN** the PDF contains the screenshots and fits the standard matrix at A4
- **AND** video/audio are documented as not printable

#### Scenario: No CLI filter

- **WHEN** the browser report has an active filter and the PDF is generated
- **THEN** the PDF contains the complete archive
- **AND** the browser print remains the filtered route

### Requirement: Use an optional Chromium engine

The PDF SHALL use Playwright Chromium through an optional `playwright-core`
peer, imported dynamically and excluded from the default bundle. The default
install, runtime dependencies and package tarball SHALL stay unchanged. A
missing engine SHALL exit 1 with install instructions. The PDF SHALL make no
network request; the Chromium render is local.

#### Scenario: Missing engine

- **WHEN** `--pdf` runs without `playwright-core` or a Chromium browser
- **THEN** the CLI exits 1 with the install guidance
- **AND** no partial PDF remains

#### Scenario: Default install

- **WHEN** Tolkira is installed without the PDF peer
- **THEN** the default install and the HTML report work as before
- **AND** the PDF feature is unavailable until the peer is installed

### Requirement: Render the print state

The PDF engine SHALL load the report HTML with `page.setContent` (no temporary
file), wait for fonts and images, and print with the print stylesheet and the
native `beforeprint` lifecycle. The default print timeout SHALL be five minutes
and API-overridable; no manual event dispatch SHALL be required.

#### Scenario: Screenshots and dark palette

- **WHEN** a report with screenshots is exported from a dark screen
- **THEN** the PDF contains the screenshots and the light print palette

#### Scenario: No temporary file

- **WHEN** `renderPdf` renders the HTML
- **THEN** the report content is set directly on the page
- **AND** no report/temp file is written by the function

#### Scenario: Large report timeout

- **WHEN** a large report is printed beyond the browser's 30 s default
- **THEN** the five-minute default (or the API timeout) applies
- **AND** the print does not fail early

### Requirement: Keep the PDF A4 and header-free

The PDF SHALL be A4 with the print CSS 12 mm `@page` margins, `printBackground`,
`preferCSSPageSize` and no header/footer/URL/page number. The first slice SHALL
be Chromium-only; the browser print SHALL remain the landscape route.

#### Scenario: A4 and margins

- **WHEN** the PDF is generated
- **THEN** the A4 MediaBox and 12 mm @page inset are asserted in the PDF test
- **AND** no browser header, footer, URL or page number is added

#### Scenario: Chromium-only

- **WHEN** the first slice exports a PDF
- **THEN** the engine is Chromium
- **AND** the documentation names the Chromium-only/landscape limits

### Requirement: Write the PDF safely

The PDF path SHALL NOT equal an input, the logo, `--out`, `--ci-out`, `--history`
or `--email`, or lie inside an input directory (canonicalized, case-aware). The
PDF SHALL be written atomically after the report/PDF and before the email,
history, `--ci-out` and stdout. A PDF failure SHALL exit 1 with the PDF path,
keep the report and skip the email/history/`--ci-out`/stdout and leave no
partial PDF.

#### Scenario: Path collision

- **WHEN** `--pdf` resolves to an input, the logo, `--out`, `--ci-out`,
  `--history`, `--email` or a path inside an input directory
- **THEN** the CLI exits 2
- **AND** nothing is written

#### Scenario: PDF failure

- **WHEN** the PDF cannot be written or rendered
- **THEN** the CLI exits 1 and names the PDF path
- **AND** the report stays
- **AND** the email, history, `--ci-out` and stdout outputs are skipped
- **AND** no partial PDF remains

### Requirement: Keep the PDF API small

`renderPdf(html, options)` SHALL return the PDF bytes for the given report HTML,
SHALL NOT write an output file or launch a server, and SHALL use the same
optional engine. The options SHALL include an optional print timeout. The CLI
and API SHALL produce equivalent PDFs for the same HTML.

#### Scenario: Library use

- **WHEN** a caller passes rendered report HTML
- **THEN** it receives the PDF bytes
- **AND** no output file is written by the function
