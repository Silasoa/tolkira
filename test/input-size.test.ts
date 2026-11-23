import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadInputs,
  resolveInputFiles,
  scanInputBytes,
} from '../src/input/load.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(actual.readFile),
    realpath: vi.fn(actual.realpath),
  };
});

const LEGACY = JSON.stringify([
  {
    uri: 'features/size.feature',
    name: 'Input size',
    elements: [
      {
        keyword: 'Scenario',
        type: 'scenario',
        name: 'passes',
        steps: [
          {
            keyword: 'Given ',
            name: 'a step',
            result: { status: 'passed', duration: 1 },
          },
        ],
      },
    ],
  },
]);

const tempDirs: string[] = [];

afterEach(async () => {
  vi.mocked(readFile).mockClear();
  vi.mocked(realpath).mockClear();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-input-size-'));
  tempDirs.push(dir);
  return dir;
}

describe('resolveInputFiles', () => {
  it('resolves explicit files and a directory into one ordered list', async () => {
    const dir = await tempDir();
    const nested = path.join(dir, 'nested');
    await mkdir(nested);
    const explicit = path.join(dir, 'explicit.json');
    const scanned = path.join(nested, 'scanned.xml');
    await writeFile(explicit, LEGACY, 'utf8');
    await writeFile(scanned, '<testsuites/>', 'utf8');

    const { files } = await resolveInputFiles([explicit, dir]);

    expect(files.map((input) => path.basename(input.file))).toEqual([
      'explicit.json',
      'scanned.xml',
    ]);
    expect(files.map((input) => input.explicit)).toEqual([true, false]);
  });

  it('counts a repeated path once', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'twice.json');
    await writeFile(file, LEGACY, 'utf8');

    const resolved = await resolveInputFiles([file, file]);
    const scan = await scanInputBytes(resolved.files);

    expect(resolved.files).toHaveLength(1);
    expect(scan).toEqual({ files: 1, bytes: (await stat(file)).size });
  });

  it('rejects an empty input list', async () => {
    await expect(resolveInputFiles([])).rejects.toThrow(
      'No input files provided.',
    );
  });

  it('resolves an empty directory to an empty list', async () => {
    const dir = await tempDir();

    await expect(resolveInputFiles(dir)).resolves.toEqual({ files: [] });
  });
});

describe('scanInputBytes', () => {
  it('sums a directory of smaller files', async () => {
    const dir = await tempDir();
    const sizes = [10, 20, 30];
    for (const [index, bytes] of sizes.entries()) {
      await writeFile(path.join(dir, `part-${index}.json`), 'x'.repeat(bytes));
    }

    const scan = await scanInputBytes((await resolveInputFiles(dir)).files);

    expect(scan).toEqual({ files: 3, bytes: 60 });
  });

  it('stats a file without reading its content', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'content.json');
    await writeFile(file, 'x'.repeat(1024), 'utf8');
    const resolved = await resolveInputFiles(file);
    vi.mocked(readFile).mockClear();

    const scan = await scanInputBytes(resolved.files);

    expect(scan).toEqual({ files: 1, bytes: 1024 });
    expect(readFile).not.toHaveBeenCalled();
  });

  it('returns a stat size when a content read would fail', async () => {
    const dir = await tempDir();
    const scan = await scanInputBytes([{ file: dir, explicit: true }]);

    expect(scan).toEqual({ files: 1, bytes: (await stat(dir)).size });
    expect(readFile).not.toHaveBeenCalled();
  });

  it('overcounts identical content while the loader dedupes it', async () => {
    const dir = await tempDir();
    const first = path.join(dir, 'a.json');
    const second = path.join(dir, 'b.json');
    await writeFile(first, LEGACY, 'utf8');
    await writeFile(second, LEGACY, 'utf8');
    const resolved = await resolveInputFiles(dir);

    const scan = await scanInputBytes(resolved.files);
    const groups = await loadInputs(resolved);

    expect(scan).toEqual({
      files: 2,
      bytes: Buffer.byteLength(LEGACY) * 2,
    });
    expect(groups).toHaveLength(1);
  });
});

describe('resolved list identity', () => {
  it('loads a resolved list without resolving it again', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'report.json');
    await writeFile(file, LEGACY, 'utf8');
    const resolved = await resolveInputFiles(file);
    vi.mocked(realpath).mockClear();

    const groups = await loadInputs(resolved);

    expect(realpath).not.toHaveBeenCalled();
    expect(groups).toHaveLength(1);
    expect(groups[0]?.file).toBe(resolved.files[0]?.file);
  });
});
