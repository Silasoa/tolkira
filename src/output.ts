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
  const outputReal = realpathSync(outputPath);

  if (logo) {
    const logoInfo = await stat(logo).catch(() => undefined);
    if (logoInfo?.isFile() && realpathSync(logo) === outputReal) return true;
  }

  for (const input of inputs) {
    const inputInfo = await stat(input).catch(() => undefined);
    if (!inputInfo) continue;
    if (inputInfo.isFile() && realpathSync(input) === outputReal) return true;
    if (inputInfo.isDirectory()) {
      const directory = realpathSync(input);
      for (const file of await collectReportFiles(directory)) {
        if (realpathSync(file) === outputReal) return true;
      }
    }
  }
  return false;
}

export async function writeAtomic(
  output: string,
  content: string,
): Promise<void> {
  const directory = path.dirname(output);
  await mkdir(directory, { recursive: true });
  const temp = path.join(
    directory,
    `.${path.basename(output)}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temp, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await rename(temp, output);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => undefined);
    throw error;
  }
}
