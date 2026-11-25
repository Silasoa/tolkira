import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/cli.js';
import {
  HISTORY_MAX_BYTES,
  type HistoryRun,
  type StatusCounts,
} from '../src/index.js';

const messages = fileURLToPath(
  new URL('./fixtures/messages/second.ndjson', import.meta.url),
);
const historyFixtures = fileURLToPath(
  new URL('./fixtures/history/', import.meta.url),
);

const dirs: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-history-window-cli-'));
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
  runs: HistoryRun[];
}

function counts(overrides: Partial<StatusCounts> = {}): StatusCounts {
  return {
    total: 1,
    passed: 1,
    failed: 0,
    skipped: 0,
    pending: 0,
    undefined: 0,
    ambiguous: 0,
    unknown: 0,
    ...overrides,
  };
}

function makeRun(index: number): HistoryRun {
  return {
    id: `id-${String(index).padStart(4, '0')}`,
    recordedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    title: 'Nightly',
    status: 'passed',
    counts: {
      features: 1,
      scenarios: counts(),
      steps: counts(),
    },
    durationMs: 1000 + index,
    attachments: { total: 0, bytes: 0 },
  };
}

function runs(count: number): HistoryRun[] {
  return Array.from({ length: count }, (_, index) => makeRun(index));
}

async function writeSidecar(
  file: string,
  entries: readonly HistoryRun[],
  schemaVersion = 1,
): Promise<void> {
  await writeFile(
    file,
    JSON.stringify({ schemaVersion, runs: entries }, null, 2),
    'utf8',
  );
}

async function readSidecar(file: string): Promise<Sidecar> {
  return JSON.parse(await readFile(file, 'utf8')) as Sidecar;
}

function ids(entries: readonly HistoryRun[]): string[] {
  return entries.map((run) => run.id);
}

function trendsRows(html: string): number {
  const start = html.indexOf('id="trends-view"');
  if (start === -1) return 0;
  const end = html.indexOf('<dialog', start);
  const panel = html.slice(start, end === -1 ? undefined : end);
  const body = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/.exec(panel);
  return [...(body?.[1] ?? '').matchAll(/<tr\b[\s\S]*?<\/tr>/g)].length;
}

function sparkPoints(html: string): number {
  return [...html.matchAll(/class="sparkPoint"/g)].length;
}

async function expectMissing(file: string): Promise<void> {
  await expect(readFile(file, 'utf8')).rejects.toMatchObject({
    code: 'ENOENT',
  });
}

describe('CLI history window', () => {
  it('reads and writes the newest five of seven runs and renders five rows', async () => {
    const dir = await tempDir();
    const history = path.join(dir, 'history.json');
    const output = path.join(dir, 'report.html');
    const prior = runs(7);
    await writeSidecar(history, prior);

    const run = await cli([
      messages,
      '--out',
      output,
      '--history',
      history,
      '--history-limit',
      '5',
    ]);

    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    const sidecar = await readSidecar(history);
    expect(sidecar.schemaVersion).toBe(1);
    expect(ids(sidecar.runs).slice(0, 4)).toEqual(ids(prior.slice(3)));
    expect(sidecar.runs).toHaveLength(5);
    expect(sidecar.runs.at(-1)?.title).toBe('Tolkira report');
    const html = await readFile(output, 'utf8');
    expect(trendsRows(html)).toBe(5);
    expect(sparkPoints(html)).toBe(5);
  });

  it('keeps 40 of 41 runs and renders 40 rows at a window of 40', async () => {
    const dir = await tempDir();
    const history = path.join(dir, 'history.json');
    const output = path.join(dir, 'report.html');
    const prior = runs(40);
    await writeSidecar(history, prior, 2);

    const run = await cli([
      messages,
      '--out',
      output,
      '--history',
      history,
      '--history-limit',
      '40',
    ]);

    expect(run.code, run.stderr).toBe(0);
    const sidecar = await readSidecar(history);
    expect(sidecar.schemaVersion).toBe(2);
    expect(sidecar.runs).toHaveLength(40);
    expect(ids(sidecar.runs).slice(0, 39)).toEqual(ids(prior.slice(1)));
    expect(trendsRows(await readFile(output, 'utf8'))).toBe(40);
  });

  it('keeps one run and omits the Trends tab at a window of one', async () => {
    const dir = await tempDir();
    const history = path.join(dir, 'history.json');
    const output = path.join(dir, 'report.html');
    await writeSidecar(history, runs(7));

    const run = await cli([
      messages,
      '--out',
      output,
      '--history',
      history,
      '--history-limit',
      '1',
    ]);

    expect(run.code, run.stderr).toBe(0);
    const sidecar = await readSidecar(history);
    expect(sidecar.schemaVersion).toBe(1);
    expect(sidecar.runs).toHaveLength(1);
    expect(sidecar.runs[0]?.title).toBe('Tolkira report');

    const html = await readFile(output, 'utf8');
    expect(html).not.toContain('data-view="trends"');
    expect(html).not.toContain('id="trends-view"');
  });

  it('accepts the 365 upper boundary and writes schema 2', async () => {
    const dir = await tempDir();
    const history = path.join(dir, 'history.json');
    const output = path.join(dir, 'report.html');
    await writeSidecar(history, runs(2));

    const run = await cli([
      messages,
      '--out',
      output,
      '--history',
      history,
      '--history-limit',
      '365',
    ]);

    expect(run.code, run.stderr).toBe(0);
    const sidecar = await readSidecar(history);
    expect(sidecar.schemaVersion).toBe(2);
    expect(sidecar.runs).toHaveLength(3);
    expect(trendsRows(await readFile(output, 'utf8'))).toBe(3);
  });

  it('keeps implicit and explicit --history-limit 30 byte-identical in one build', async () => {
    const root = await tempDir();
    const implicit = path.join(root, 'implicit');
    const explicit = path.join(root, 'explicit');
    await mkdir(implicit);
    await mkdir(explicit);
    const frozen = new Date('2026-11-20T09:30:00.000Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(frozen);

    for (const dir of [implicit, explicit]) {
      await writeSidecar(path.join(dir, 'history.json'), runs(2));
    }

    const run = (dir: string, extra: string[] = []) =>
      cli([
        messages,
        '--out',
        path.join(dir, 'report.html'),
        '--email',
        path.join(dir, 'email.html'),
        '--json',
        '--ci',
        'markdown',
        '--ci-out',
        path.join(dir, 'ci.md'),
        '--history',
        path.join(dir, 'history.json'),
        ...extra,
      ]);

    const byDefault = await run(implicit);
    const atThirty = await run(explicit, ['--history-limit', '30']);
    const withoutHistory = await cli([messages, '--json']);

    expect(byDefault.code, byDefault.stderr).toBe(0);
    expect(atThirty.code, atThirty.stderr).toBe(0);
    expect(withoutHistory.code, withoutHistory.stderr).toBe(0);

    for (const name of ['report.html', 'email.html', 'ci.md', 'history.json']) {
      await expect(
        readFile(path.join(implicit, name), 'utf8'),
        name,
      ).resolves.toBe(await readFile(path.join(explicit, name), 'utf8'));
    }
    expect(byDefault.stdout).toBe(atThirty.stdout);
    expect(byDefault.stdout).toBe(withoutHistory.stdout);

    const sidecar = await readSidecar(path.join(implicit, 'history.json'));
    expect(sidecar.schemaVersion).toBe(1);
    expect(sidecar.runs).toHaveLength(3);
    expect(
      trendsRows(await readFile(path.join(implicit, 'report.html'), 'utf8')),
    ).toBe(3);
  });

  it.each(['0', '366', '1.5', 'abc', '05', ''])(
    'rejects --history-limit %j with exit 2 naming the range',
    async (value) => {
      const dir = await tempDir();
      const output = path.join(dir, 'report.html');
      const history = path.join(dir, 'history.json');

      const run = await cli([
        messages,
        '--out',
        output,
        '--history',
        history,
        '--history-limit',
        value,
      ]);

      expect(run.code).toBe(2);
      expect(run.stderr.split('\n')[0]).toBe(
        `tolkira: Invalid --history-limit "${value}". Use an integer from 1 to 365.`,
      );
      await expectMissing(output);
      await expectMissing(history);
    },
  );

  it('rejects --history-limit without --history and names both options', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');

    const run = await cli([messages, '--out', output, '--history-limit', '10']);

    expect(run.code).toBe(2);
    expect(run.stderr.split('\n')[0]).toBe(
      'tolkira: --history-limit requires --history',
    );
    await expectMissing(output);

    // No output flag: the requirement check still wins over the bare usage text.
    const bare = await cli([messages, '--history-limit', '10']);
    expect(bare.code).toBe(2);
    expect(bare.stderr.split('\n')[0]).toBe(
      'tolkira: --history-limit requires --history',
    );
  });

  it('keeps the existing --history requires --out error with a limit', async () => {
    const dir = await tempDir();
    const history = path.join(dir, 'history.json');

    const run = await cli([
      messages,
      '--json',
      '--history',
      history,
      '--history-limit',
      '10',
    ]);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('--history requires --out');
    expect(run.stderr).not.toContain('Unknown option');
    expect(run.stdout).toBe('');
    await expectMissing(history);

    const bare = await cli([messages, '--history', history]);
    expect(bare.code).toBe(2);
    expect(bare.stderr.split('\n')[0]).toBe(
      'tolkira: --history requires --out',
    );
    expect(bare.stdout).toBe('');
    await expectMissing(history);
  });

  it.each([
    ['3\n66', '3 66'],
    ['3\u202e66', '3 66'],
  ])(
    'flattens the control in --history-limit %j to %j',
    async (value, shown) => {
      const run = await cli([
        messages,
        '--out',
        path.join(await tempDir(), 'report.html'),
        '--history',
        path.join(await tempDir(), 'history.json'),
        '--history-limit',
        value,
      ]);

      expect(run.code).toBe(2);
      expect(run.stderr.split('\n')[0]).toBe(
        `tolkira: Invalid --history-limit "${shown}". Use an integer from 1 to 365.`,
      );
    },
  );

  it('lists --history-limit in --help', async () => {
    const help = await cli(['--help']);

    expect(help.code).toBe(0);
    expect(help.stdout).toContain('--history-limit <n>');
    expect(help.stdout).toContain('(default 30, range 1 to 365)');
  });
});

describe('CLI history read failures with a window', () => {
  it.each([
    [
      'oversized',
      async (file: string) =>
        writeFile(
          file,
          JSON.stringify({
            schemaVersion: 1,
            runs: [],
            padding: 'x'.repeat(HISTORY_MAX_BYTES + 1),
          }),
          'utf8',
        ),
    ],
    [
      'malformed',
      async (file: string) =>
        copyFile(path.join(historyFixtures, 'malformed-entry.json'), file),
    ],
  ])(
    'exits 1 naming the file and keeps an %s sidecar unchanged',
    async (_, create) => {
      const dir = await tempDir();
      const history = path.join(dir, 'history.json');
      await create(history);
      const before = await readFile(history, 'utf8');
      const output = path.join(dir, 'report.html');

      const run = await cli([
        messages,
        '--out',
        output,
        '--history',
        history,
        '--history-limit',
        '40',
      ]);

      expect(run.code).toBe(1);
      expect(run.stderr).toContain('history.json');
      await expect(readFile(history, 'utf8')).resolves.toBe(before);
      await expectMissing(output);
    },
  );
});
