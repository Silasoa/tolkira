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

Tolkira does not send telemetry and does not make network requests. A report
should remain fully offline.
