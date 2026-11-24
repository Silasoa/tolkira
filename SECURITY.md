# Security Policy

## Supported versions

Tolkira is pre-1.0. Security fixes are applied to the latest released version.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub’s private
vulnerability reporting / Security Advisories for this repository, or contact
the maintainers privately.

Include:

- affected version or commit;
- a minimal reproduction;
- impact and suggested fix, if known.

## Scope

Tolkira processes untrusted test output. Security-relevant areas include:

- HTML/JS injection through test names, metadata, titles and attachment names;
- active HTML/SVG attachments;
- path handling for output and attachments;
- denial of service through very large reports or attachments;
- dependency vulnerabilities.

HTML attachments are always escaped text, and SVG attachments are only used as
`<img>` data-URI sources; neither is injected as markup or a document.

### Playwright attachment paths

The report input controls a path attachment, while the allowed roots come from
the process, never from report data: the input file's folder and
`process.cwd()`. Any regular file under either root can therefore be embedded in
the report by an input that names it. Keep the input and its attachment tree
trusted, or run the generation in a container that limits what those roots
contain. An opt-in attachment root or allowlist is tracked as B-058 and is not
part of the current behaviour.

Tolkira does not send telemetry and does not make network requests. A report
should remain fully offline.
