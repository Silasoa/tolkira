import { readdir } from 'node:fs/promises';
import path from 'node:path';

export const SUPPORTED_EXTENSIONS = new Set(['.json', '.jsonl', '.ndjson']);

const MAX_DIRECTORY_DEPTH = 20;
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', '.hg', '.svn']);

export async function collectReportFiles(
  directory: string,
  depth = 0,
): Promise<string[]> {
  if (depth > MAX_DIRECTORY_DEPTH) {
    throw new Error(
      `Input directory nesting exceeds ${MAX_DIRECTORY_DEPTH} levels: ${directory}`,
    );
  }
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    // Symlinks could loop or read outside the input tree.
    if (entry.isSymbolicLink()) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      files.push(...(await collectReportFiles(full, depth + 1)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    files.push(full);
  }
  return files;
}
