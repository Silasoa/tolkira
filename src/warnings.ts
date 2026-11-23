/**
 * 50 MiB. Advisory only: half the 100 MB hard input cap, high enough that
 * ordinary medium runs stay quiet. Written as bytes so the attachment cap stays
 * the only multiplication-form declaration.
 */
export const INPUT_WARN_BYTES = 52_428_800;

/** One-decimal MiB value, labelled MB by every size warning. */
export function formatMegabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

export function earlyInputWarning(bytes: number): string {
  return (
    `tolkira: warning: input files total ${formatMegabytes(bytes)} MB, ` +
    'at or above the 50 MB early-warning threshold; parsing and rendering may take a while.\n'
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
