/**
 * Copy for the skipped path attachment notice. Shared by the HTML report, the
 * CLI stderr warning and the compat shim so the wording stays one string.
 */
export const ATTACHMENT_HINT =
  'Run from the folder that contains the referenced files, or regenerate the JSON where the files live.';

export function attachmentWarning(count: number): string {
  if (count === 1) {
    return "1 path attachment was skipped: it is outside the allowed roots (its input file's folder and Tolkira's working directory). The report may be missing screenshots or files.";
  }
  return `${count} path attachments were skipped: they are outside the allowed roots (each input file's folder and Tolkira's working directory). The report may be missing screenshots or files.`;
}
