/**
 * 50 MiB. Advisory only: half the 100 MB hard input cap, high enough that
 * ordinary medium runs stay quiet. Spelled in bytes because the 50 MB
 * attachment cap is the only multiplication-form declaration the attachment
 * ownership test allows.
 */
export const INPUT_WARN_BYTES = 52_428_800;

/** `--max-size` default in MB; the capabilities document reports it. */
export const DEFAULT_MAX_SIZE_MB = 10;

/** One-decimal MiB value, labelled MB by every size warning. */
export function formatMegabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

/** Warning body without the `tolkira: warning: ` prefix or trailing newline. */
export function earlyInputWarning(bytes: number): string {
  return (
    `input files total ${formatMegabytes(bytes)} MB, at or above the ` +
    `${INPUT_WARN_BYTES / 1024 / 1024} MB early-warning threshold; ` +
    'parsing and rendering may take a while.'
  );
}

/**
 * Copy for the skipped path attachment count. Shared by the CLI stderr warning
 * and the compat shim so the wording stays one string. Names stay out of both:
 * the report owns the per-attachment reason.
 */
export const ATTACHMENT_HINT =
  'Run from the folder that contains the referenced files, or regenerate the JSON where the files live.';

export function attachmentWarning(count: number): string {
  if (count === 1) {
    return '1 path attachment was skipped. It may be outside the allowed roots, missing, unreadable, not a regular file or non-local. The report may be missing screenshots or files.';
  }
  return `${count} path attachments were skipped. They may be outside the allowed roots, missing, unreadable, not a regular file or non-local. The report may be missing screenshots or files.`;
}
