import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadResolvedInputs,
  resolveInputFiles,
  scanInputBytes,
} from '../src/input/load.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn<typeof actual.readFile>(actual.readFile),
    realpath: vi.fn<typeof actual.realpath>(actual.realpath),
  };
});

const MIB = 1024 * 1024;

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

describe('Early input warning: input resolution', () => {
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
    expect(scan).toEqual({ bytes: (await stat(file)).size });
  });

  it('counts a symlinked directory and its target once', async (context) => {
    const dir = await tempDir();
    const real = path.join(dir, 'real');
    await mkdir(real);
    await writeFile(path.join(real, 'run.json'), LEGACY, 'utf8');
    const link = path.join(dir, 'link');
    try {
      await symlink(
        real,
        link,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch {
      // Some Windows hosts cannot create junctions without extra privileges.
      context.skip('directory symlinks are not supported here');
      return;
    }

    const resolved = await resolveInputFiles([real, link]);

    expect(resolved.files).toHaveLength(1);
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

describe('Early input warning: stat-only scan', () => {
  it('sums a directory of smaller files', async () => {
    const dir = await tempDir();
    const sizes = [10, 20, 30];
    for (const [index, bytes] of sizes.entries()) {
      await writeFile(path.join(dir, `part-${index}.json`), 'x'.repeat(bytes));
    }

    const scan = await scanInputBytes((await resolveInputFiles(dir)).files);

    expect(scan).toEqual({ bytes: 60 });
  });

  it('stats a file without reading its content', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'content.json');
    await writeFile(file, 'x'.repeat(1024), 'utf8');
    const resolved = await resolveInputFiles(file);
    vi.mocked(readFile).mockClear();

    const scan = await scanInputBytes(resolved.files);

    expect(scan).toEqual({ bytes: 1024 });
    expect(readFile).not.toHaveBeenCalled();
  });

  it('reports a sparse 50 MiB file size without reading it', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'sparse.bin');
    const handle = await open(file, 'w');
    try {
      await handle.truncate(50 * MIB);
    } finally {
      await handle.close();
    }
    const resolved = await resolveInputFiles(file);
    vi.mocked(readFile).mockClear();

    const scan = await scanInputBytes(resolved.files);

    expect(scan).toEqual({ bytes: 50 * MIB });
    expect(readFile).not.toHaveBeenCalled();
  });

  it('returns a stat size when a content read would fail', async () => {
    const dir = await tempDir();
    const scan = await scanInputBytes([{ file: dir, explicit: true }]);

    expect(scan).toEqual({ bytes: (await stat(dir)).size });
    expect(readFile).not.toHaveBeenCalled();
  });

  it('rejects a resolved directory before reading it', async () => {
    const dir = await tempDir();
    vi.mocked(readFile).mockClear();

    await expect(
      loadResolvedInputs({ files: [{ file: dir, explicit: true }] }),
    ).rejects.toThrow(`Unsupported input: ${dir}`);
    expect(readFile).not.toHaveBeenCalled();
  });

  it('rejects a file over the per-file guard before reading its content', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'oversized.json');
    const handle = await open(file, 'w');
    try {
      await handle.truncate(100 * MIB + 1);
    } finally {
      await handle.close();
    }
    const resolved = await resolveInputFiles(file);
    vi.mocked(readFile).mockClear();

    await expect(loadResolvedInputs(resolved)).rejects.toThrow(
      'Inputs exceed 100 MB in total. Split the run into smaller inputs or reduce the attachment payload.',
    );
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
    const groups = await loadResolvedInputs(resolved);

    expect(scan).toEqual({
      bytes: Buffer.byteLength(LEGACY) * 2,
    });
    expect(groups).toHaveLength(1);
  });
});

describe('Early input warning: resolved list identity', () => {
  it('loads a resolved list without resolving it again', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'report.json');
    await writeFile(file, LEGACY, 'utf8');
    const resolved = await resolveInputFiles(file);
    vi.mocked(realpath).mockClear();

    const groups = await loadResolvedInputs(resolved);

    expect(realpath).not.toHaveBeenCalled();
    expect(groups).toHaveLength(1);
    expect(groups[0]?.file).toBe(resolved.files[0]?.file);
  });
});

describe('host-locale-independent input order', () => {
  it('sorts resolved input files by UTF-16 code units, not the host locale', async () => {
    const dir = await tempDir();
    const names = [
      'apple.json',
      'Zebra.json',
      'Äpfel.json',
      'B.json',
      // A bare `b.json` would be the same file as `B.json` on a
      // case-insensitive host; the suffix keeps the case-boundary pair.
      'b0.json',
    ];
    for (const name of names) {
      await writeFile(path.join(dir, name), LEGACY, 'utf8');
    }

    const { files } = await resolveInputFiles(dir);

    // ASCII case, non-ASCII and equal/prefix names in one boundary table.
    expect(files.map((input) => path.basename(input.file))).toEqual([
      'B.json',
      'Zebra.json',
      'apple.json',
      'b0.json',
      'Äpfel.json',
    ]);
  });
});
