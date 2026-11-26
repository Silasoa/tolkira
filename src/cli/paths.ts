import { stat } from 'node:fs/promises';
import path from 'node:path';
import { samePath } from '../output.js';

/** True when `file` names `parent` or sits inside it, even when `file` is missing. */
export function isInside(parent: string, file: string): boolean {
  let current = path.resolve(file);
  for (;;) {
    if (samePath(current, parent)) return true;
    const next = path.dirname(current);
    if (next === current) return false;
    current = next;
  }
}

/** True when `file` would replace or join any input, file or directory. */
export async function conflictsWithInputs(
  file: string,
  inputs: string[],
): Promise<boolean> {
  for (const input of inputs) {
    if (samePath(file, input)) return true;
    const info = await stat(input).catch(() => undefined);
    if (info?.isDirectory() && isInside(input, file)) return true;
  }
  return false;
}

export function pathConflicts(
  file: string,
  inputs: string[],
  logo: string | undefined,
  output: string | undefined,
  pdfPath: string | undefined,
  ciOut: string | undefined,
  email: string | undefined,
  peer: string | undefined,
): Promise<boolean> {
  if (output && samePath(file, output)) return Promise.resolve(true);
  if (pdfPath && samePath(file, pdfPath)) return Promise.resolve(true);
  if (ciOut && samePath(file, ciOut)) return Promise.resolve(true);
  if (email && samePath(file, email)) return Promise.resolve(true);
  if (peer && samePath(file, peer)) return Promise.resolve(true);
  if (logo && samePath(file, logo)) return Promise.resolve(true);
  return conflictsWithInputs(file, inputs);
}

/** A relative artifact path with no form relative to the manifest directory. */
export function cannotExpressRelative(
  manifestFile: string,
  artifact: string,
): boolean {
  if (path.isAbsolute(artifact)) return false;
  return path.isAbsolute(
    path.relative(
      path.dirname(path.resolve(manifestFile)),
      path.resolve(artifact),
    ),
  );
}
