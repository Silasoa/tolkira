import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { collectReportFiles } from './input/files.js';

/** True when writing `output` would replace an input file or the logo. */
export async function outputOverwritesInput(
  inputs: string[],
  output: string,
  logo?: string,
): Promise<boolean> {
  const outputPath = path.resolve(output);
  const outputInfo = await stat(outputPath).catch(() => undefined);
  if (!outputInfo?.isFile()) return false;

  if (logo) {
    const logoInfo = await stat(logo).catch(() => undefined);
    if (logoInfo?.isFile() && samePath(logo, outputPath)) return true;
  }

  for (const input of inputs) {
    const inputInfo = await stat(input).catch(() => undefined);
    if (!inputInfo) continue;
    if (inputInfo.isFile() && samePath(input, outputPath)) return true;
    if (inputInfo.isDirectory()) {
      for (const file of await collectReportFiles(input)) {
        if (samePath(file, outputPath)) return true;
      }
    }
  }
  return false;
}

function foldCase(value: string): string {
  return process.platform === 'win32' || process.platform === 'darwin'
    ? value.toLowerCase()
    : value;
}

function existingRealPath(file: string): string | undefined {
  try {
    return realpathSync(file);
  } catch {
    return undefined;
  }
}

// Canonicalizes a path even when the file itself is missing: resolve the
// nearest existing ancestor through symlinks, keep the rest as given, then
// fold case on case-insensitive filesystems.
function canonicalPath(file: string): string {
  const resolved = path.resolve(file);
  let current = resolved;
  const tail: string[] = [];
  for (;;) {
    const real = existingRealPath(current);
    if (real !== undefined) return foldCase(path.join(real, ...tail));
    const parent = path.dirname(current);
    if (parent === current) return foldCase(resolved);
    tail.unshift(path.basename(current));
    current = parent;
  }
}

/**
 * True when both paths name the same file. Windows and macOS compare
 * case-insensitively; symlinked or junctioned parents resolve even when the
 * target file does not exist yet.
 */
export function samePath(a: string, b: string): boolean {
  return canonicalPath(a) === canonicalPath(b);
}

export async function writeAtomic(
  output: string,
  content: string | Uint8Array,
): Promise<void> {
  const directory = path.dirname(output);
  await mkdir(directory, { recursive: true });
  const temp = path.join(
    directory,
    `.${path.basename(output)}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temp, content, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    await rename(temp, output);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => undefined);
    throw error;
  }
}
