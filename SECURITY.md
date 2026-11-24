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

## Owner-only output files

Tolkira creates its report, email, PDF, CI Markdown (`--ci-out`), history
sidecar and compat sidecar through an atomic temporary-file rename with mode
`0600`. On POSIX the final file is readable and writable only by the account
that ran Tolkira. Windows ignores the POSIX mode; there the inherited
destination ACL decides, so a shared folder that already grants read exposes
the file without any permission change.

Reports can contain tokens, private paths and screenshots, so owner-only is the
safe default. On POSIX, the trade-off is that a shared CI artifact, a service
account or another user cannot read the file until the mode or ACL is changed
explicitly. There is no option to select another mode: copy the file or run
`chmod` after generation when a broader POSIX reader is intended. On Windows,
change the destination ACL before generation if the inherited one is too broad.

### Playwright attachment paths

The report input controls a path attachment, while the allowed roots come from
the process, never from report data: the input file's folder and
`process.cwd()`. Any regular file under either root, not only the referenced
screenshots, can therefore be embedded in the report by an input that names it.
Keep the input folder and the working directory, and everything under them,
trusted, or run the generation in a container that limits what those roots
contain. An opt-in attachment root or allowlist is tracked as B-058 and is not
part of the current behaviour.

Tolkira does not send telemetry and does not make network requests. A report
should remain fully offline.
