import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
