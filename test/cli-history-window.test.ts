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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/cli.js';
import type { HistoryRun, StatusCounts } from '../src/index.js';

const messages = fileURLToPath(
  new URL('./fixtures/messages/second.ndjson', import.meta.url),
);
const historyFixtures = fileURLToPath(
  new URL('./fixtures/history/', import.meta.url),
);

// A 1x1 transparent PNG: the smallest logo that passes the data-URI check.
const LOGO =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

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

async function expectMissing(file: string): Promise<void> {
  await expect(readFile(file, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
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
    expect(trendsRows(await readFile(output, 'utf8'))).toBe(5);
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

  it('keeps the default 30-run window byte-identical for report, CI, email and JSON', async () => {
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
    expect(trendsRows(await readFile(path.join(implicit, 'report.html'), 'utf8'))).toBe(3);
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
      expect(run.stderr).toContain('--history-limit');
      expect(run.stderr).toContain('1 to 365');
      expect(run.stderr).not.toContain('Unknown option');
      await expectMissing(output);
      await expectMissing(history);
    },
  );

  it('rejects --history-limit without --history and names both options', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');

    const run = await cli([
      messages,
      '--out',
      output,
      '--history-limit',
      '10',
    ]);

    expect(run.code).toBe(2);
    expect(run.stderr).not.toContain('Unknown option');
    expect(run.stderr).toContain('--history-limit');
    expect(run.stderr.replaceAll('--history-limit', '')).toContain('--history');
    await expectMissing(output);
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
  });

  it('lists --history-limit in --help', async () => {
    const help = await cli(['--help']);

    expect(help.code).toBe(0);
    expect(help.stdout).toContain('--history-limit <n>');
  });
});

describe('CLI history path safety with a window', () => {
  it('rejects a history path that names an input, logo, output or an input directory path', async () => {
    const dir = await tempDir();
    const inputDir = path.join(dir, 'results');
    await mkdir(inputDir);
    const input = path.join(inputDir, 'run.ndjson');
    await copyFile(messages, input);
    const inputBefore = await readFile(input, 'utf8');
    const logo = path.join(dir, 'logo.png');
    await writeFile(logo, Buffer.from(LOGO, 'base64'));
    const logoBefore = await readFile(logo);
    const output = path.join(dir, 'report.html');
    const pdf = path.join(dir, 'report.pdf');
    const email = path.join(dir, 'email.html');
    const ciOut = path.join(dir, 'summary.md');
    const insideInput = path.join(inputDir, 'history.json');
    const nestedInsideInput = path.join(inputDir, 'nested', 'history.json');

    const control = await cli([
      inputDir,
      '--out',
      path.join(dir, 'control.html'),
      '--history',
      path.join(dir, 'control-history.json'),
    ]);
    expect(control.code, control.stderr).toBe(0);

    const cases: Array<{ name: string; argv: string[]; touched: string }> = [
      {
        name: 'an input file',
        argv: [input, '--out', output, '--history', input],
        touched: input,
      },
      {
        name: 'the logo',
        argv: [input, '--out', output, '--logo', logo, '--history', logo],
        touched: logo,
      },
      {
        name: '--out',
        argv: [input, '--out', output, '--history', output],
        touched: output,
      },
      {
        name: '--pdf',
        argv: [input, '--out', output, '--pdf', pdf, '--history', pdf],
        touched: pdf,
      },
      {
        name: '--email',
        argv: [input, '--out', output, '--email', email, '--history', email],
        touched: email,
      },
      {
        name: '--ci-out',
        argv: [
          input,
          '--out',
          output,
          '--ci',
          'markdown',
          '--ci-out',
          ciOut,
          '--history',
          ciOut,
        ],
        touched: ciOut,
      },
      {
        name: 'a missing path inside an input directory',
        argv: [inputDir, '--out', output, '--history', insideInput],
        touched: insideInput,
      },
      {
        name: 'a missing nested path inside an input directory',
        argv: [inputDir, '--out', output, '--history', nestedInsideInput],
        touched: nestedInsideInput,
      },
    ];

    for (const { name, argv, touched } of cases) {
      const run = await cli(argv);

      expect(run.code, name).toBe(2);
      expect(run.stderr, name).toContain('--history');
      if (touched === input) {
        await expect(readFile(input, 'utf8'), name).resolves.toBe(inputBefore);
      } else if (touched === logo) {
        await expect(readFile(logo), name).resolves.toEqual(logoBefore);
      } else {
        await expect(readFile(touched, 'utf8'), name).rejects.toMatchObject({
          code: 'ENOENT',
        });
      }
      await expect(readFile(output, 'utf8'), name).rejects.toMatchObject({
        code: 'ENOENT',
      });
    }
  });
});

describe('CLI history write failures with a window', () => {
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
      const run = await cli([
        messages,
        '--out',
        output,
        '--history',
        history,
        '--history-limit',
        '5',
      ]);

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

  it.each([
    [
      'oversized',
      async (file: string) =>
        writeFile(
          file,
          JSON.stringify({
            schemaVersion: 1,
            runs: [],
            padding: 'x'.repeat(1024 * 1024 + 1),
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
