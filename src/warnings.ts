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
