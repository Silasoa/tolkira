import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';

const messages = fileURLToPath(
  new URL('./fixtures/messages/second.ndjson', import.meta.url),
);
const otherMessages = fileURLToPath(
  new URL('./fixtures/messages/all-statuses.ndjson', import.meta.url),
);
const historyFixtures = fileURLToPath(
  new URL('./fixtures/history/', import.meta.url),
);

// A 1x1 transparent PNG: the smallest logo that passes the data-URI check.
const LOGO =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-cli-history-'));
  dirs.push(dir);
  return dir;
}

async function cli(argv: string[]) {
  let stdout = '';
  let stderr = '';
  const code = await runCli(argv, {
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { code, stdout, stderr };
}

interface Sidecar {
  schemaVersion: number;
  runs: Array<Record<string, unknown>>;
}

async function readSidecar(file: string): Promise<Sidecar> {
  return JSON.parse(await readFile(file, 'utf8')) as Sidecar;
}

describe('CLI history sidecar', () => {
  it('creates the file on the first run and shows Trends on the second', async () => {
    const dir = await tempDir();
    const history = path.join(dir, 'history.json');
    const firstOut = path.join(dir, 'first.html');
    const secondOut = path.join(dir, 'second.html');

    const first = await cli([messages, '--out', firstOut, '--history', history]);

    expect(first.code).toBe(0);
    expect(first.stderr).toBe('');
    const sidecar = await readSidecar(history);
    expect(sidecar.schemaVersion).toBe(1);
    expect(sidecar.runs).toHaveLength(1);
    const entry = sidecar.runs[0] ?? {};
    expect(Object.keys(entry).sort()).toEqual([
      'attachments',
      'counts',
      'durationMs',
      'id',
      'recordedAt',
      'status',
      'title',
    ]);
    expect(entry.title).toBe('Tolkira report');
    expect(new Date(String(entry.recordedAt)).toISOString()).toBe(
      entry.recordedAt,
    );
    expect(entry.counts).toMatchObject({
      features: 1,
      scenarios: { total: 2 },
    });
    expect(entry.attachments).toEqual({ total: 1, bytes: 68 });

    const firstHtml = await readFile(firstOut, 'utf8');
    expect(firstHtml).not.toContain('data-view="trends"');
    expect(firstHtml).not.toContain('id="trends-view"');

    const second = await cli([
      otherMessages,
      '--out',
      secondOut,
      '--history',
      history,
      '--title',
      'Second run',
    ]);

    expect(second.code).toBe(0);
    const updated = await readSidecar(history);
    expect(updated.runs).toHaveLength(2);
    expect(updated.runs[1]?.title).toBe('Second run');

    const secondHtml = await readFile(secondOut, 'utf8');
    expect(secondHtml).toContain('data-view="trends"');
    expect(secondHtml).toContain('id="trends-view"');
    expect(secondHtml).toContain('>Trends</button>');
  });

  it('does not duplicate an identical run and still renders the report', async () => {
    const dir = await tempDir();
    const history = path.join(dir, 'history.json');
    const firstOut = path.join(dir, 'first.html');
    const secondOut = path.join(dir, 'second.html');

    const first = await cli([messages, '--out', firstOut, '--history', history]);
    expect(first.code).toBe(0);
    const before = await readFile(history, 'utf8');

    const second = await cli([messages, '--out', secondOut, '--history', history]);

    expect(second.code).toBe(0);
    await expect(readFile(history, 'utf8')).resolves.toBe(before);
    expect((await readSidecar(history)).runs).toHaveLength(1);
    const html = await readFile(secondOut, 'utf8');
    expect(html).toContain('<html');
    expect(html).not.toContain('data-view="trends"');
  });

  it('rejects an empty --history and --history without --out', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');
    const history = path.join(dir, 'history.json');

    const empty = await cli([messages, '--out', output, '--history', '']);
    expect(empty.code).toBe(2);
    expect(empty.stderr).toContain('--history requires a file path');

    const withoutOut = await cli([
      messages,
      '--json',
      '--history',
      history,
    ]);
    expect(withoutOut.code).toBe(2);
    expect(withoutOut.stderr).toContain('--history');
    expect(withoutOut.stderr).toContain('--out');
    expect(withoutOut.stdout).toBe('');

    await expect(readFile(history, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });

    const help = await cli(['--help']);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain('--history <file>');
  });

  it.each([
    ['invalid JSON', 'corrupt.json'],
    ['a wrong schema version', 'wrong-schema.json'],
    ['a malformed entry', 'malformed-entry.json'],
  ])(
    'exits 1 without writing when the file has %s',
    async (_, fixtureName) => {
      const dir = await tempDir();
      const history = path.join(dir, 'history.json');
      await copyFile(path.join(historyFixtures, fixtureName), history);
      const before = await readFile(history, 'utf8');
      const output = path.join(dir, 'report.html');

      const run = await cli([messages, '--out', output, '--history', history]);

      expect(run.code).toBe(1);
      expect(run.stderr).toContain('history.json');
      await expect(readFile(history, 'utf8')).resolves.toBe(before);
      await expect(readFile(output, 'utf8')).rejects.toMatchObject({
        code: 'ENOENT',
      });
    },
  );

  it('exits 1 without writing when the file is oversized', async () => {
    const dir = await tempDir();
    const history = path.join(dir, 'history.json');
    await writeFile(
      history,
      JSON.stringify({
        schemaVersion: 1,
        runs: [],
        padding: 'x'.repeat(1024 * 1024 + 1),
      }),
      'utf8',
    );
    const before = await readFile(history, 'utf8');
    const output = path.join(dir, 'report.html');

    const run = await cli([messages, '--out', output, '--history', history]);

    expect(run.code).toBe(1);
    expect(run.stderr).toContain('history.json');
    await expect(readFile(history, 'utf8')).resolves.toBe(before);
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects a history path that names an input, the logo, --out or --ci-out', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'input.ndjson');
    await copyFile(messages, input);
    const inputBefore = await readFile(input, 'utf8');
    const logo = path.join(dir, 'logo.png');
    await writeFile(logo, Buffer.from(LOGO, 'base64'));
    const logoBefore = await readFile(logo);
    const output = path.join(dir, 'report.html');
    const ciOut = path.join(dir, 'summary.md');

    // Control: the flag itself works before any collision is exercised.
    const control = await cli([
      input,
      '--out',
      path.join(dir, 'control.html'),
      '--history',
      path.join(dir, 'control-history.json'),
    ]);
    expect(control.code, control.stderr).toBe(0);

    const asInput = await cli([input, '--out', output, '--history', input]);
    expect(asInput.code, asInput.stderr).toBe(2);
    await expect(readFile(input, 'utf8')).resolves.toBe(inputBefore);

    const asLogo = await cli([
      input,
      '--out',
      output,
      '--logo',
      logo,
      '--history',
      logo,
    ]);
    expect(asLogo.code, asLogo.stderr).toBe(2);
    await expect(readFile(logo)).resolves.toEqual(logoBefore);

    const asOutput = await cli([input, '--out', output, '--history', output]);
    expect(asOutput.code, asOutput.stderr).toBe(2);

    const asCiOut = await cli([
      input,
      '--out',
      output,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
      '--history',
      ciOut,
    ]);
    expect(asCiOut.code, asCiOut.stderr).toBe(2);

    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(readFile(ciOut, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects a history path inside an input directory even when it is missing', async () => {
    const dir = await tempDir();
    const inputDir = path.join(dir, 'results');
    await mkdir(inputDir);
    await copyFile(messages, path.join(inputDir, 'run.ndjson'));
    const output = path.join(dir, 'report.html');

    const control = await cli([
      inputDir,
      '--out',
      path.join(dir, 'control.html'),
      '--history',
      path.join(dir, 'control-history.json'),
    ]);
    expect(control.code, control.stderr).toBe(0);

    for (const history of [
      path.join(inputDir, 'history.json'),
      path.join(inputDir, 'nested', 'history.json'),
    ]) {
      const run = await cli([inputDir, '--out', output, '--history', history]);

      expect(run.code, history).toBe(2);
      expect(run.stderr, history).toContain('--history');
      await expect(readFile(history, 'utf8'), history).rejects.toMatchObject({
        code: 'ENOENT',
      });
    }
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('exits 1 and keeps the HTML when the sidecar cannot be written', async () => {
    const dir = await tempDir();
    const sidecarDir = path.join(dir, 'sidecar');
    await mkdir(sidecarDir);
    const history = path.join(sidecarDir, 'history.json');
    await copyFile(path.join(historyFixtures, 'two-runs.json'), history);
    const before = await readFile(history, 'utf8');
    const output = path.join(dir, 'report.html');

    // Readable but not replaceable: POSIX refuses the temp file in a read-only
    // directory, Windows refuses to rename over a read-only file.
    await chmod(history, 0o444);
    await chmod(sidecarDir, 0o555);
    try {
      const run = await cli([messages, '--out', output, '--history', history]);

      expect(run.code).toBe(1);
      expect(run.stderr).toContain('history.json');
      await expect(readFile(output, 'utf8')).resolves.toContain('<html');
      await expect(readFile(history, 'utf8')).resolves.toBe(before);
      expect(
        (await readdir(sidecarDir)).filter((name) => name.endsWith('.tmp')),
      ).toEqual([]);
    } finally {
      await chmod(sidecarDir, 0o755);
      await chmod(history, 0o644);
    }
  });

  it('reads and writes no history without the flag', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'input.ndjson');
    await copyFile(messages, input);
    const history = path.join(dir, 'history.json');
    const firstOut = path.join(dir, 'report-a.html');
    const secondOut = path.join(dir, 'report-b.html');

    const first = await cli([input, '--out', firstOut]);
    expect(first.code).toBe(0);
    await expect(readFile(history, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });

    await copyFile(path.join(historyFixtures, 'two-runs.json'), history);
    const before = await readFile(history, 'utf8');

    const second = await cli([input, '--out', secondOut]);
    expect(second.code).toBe(0);

    const baseline = await readFile(firstOut, 'utf8');
    const without = await readFile(secondOut, 'utf8');
    expect(without).toBe(baseline);
    expect(without).not.toContain('data-view="trends"');
    expect(without).not.toContain('id="trends-view"');
    await expect(readFile(history, 'utf8')).resolves.toBe(before);
    expect((await readdir(dir)).sort()).toEqual([
      'history.json',
      'input.ndjson',
      'report-a.html',
      'report-b.html',
    ]);
  });
});
