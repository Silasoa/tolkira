import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCliArgs } from '../src/cli/args.js';
import { planCli, type CliPlan } from '../src/cli/plan.js';

const fixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);

// A 1x1 transparent PNG: the smallest logo that passes the data-URI check.
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-plan-'));
  dirs.push(dir);
  return dir;
}

async function runPlan(argv: string[]): Promise<CliPlan> {
  const result = await planCli(argv);
  if (!result.ok) {
    throw new Error(`expected a plan, got ${JSON.stringify(result)}`);
  }
  if (result.action.kind !== 'run') {
    throw new Error(`expected a run action, got ${result.action.kind}`);
  }
  return result.action.plan;
}

async function failure(argv: string[]) {
  const result = await planCli(argv);
  if (result.ok || result.kind !== 'message') {
    throw new Error(
      `expected a message failure, got ${JSON.stringify(result)}`,
    );
  }
  return result.message;
}

function parseError(argv: string[]): string {
  try {
    parseCliArgs(argv);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('expected parseArgs to fail');
}

async function writeLogo(dir: string): Promise<string> {
  const file = path.join(dir, 'logo.png');
  await writeFile(file, Buffer.from(PNG, 'base64'));
  return file;
}

const PLAN_TAIL = {
  exitCodes: { success: 0, failure: 1 },
} as const;

describe('planCli full plan shape', () => {
  it('maps every flag into one generate plan', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const pdf = path.join(dir, 'run.pdf');
    const email = path.join(dir, 'email.html');
    const history = path.join(dir, 'history.json');
    const ciOut = path.join(dir, 'summary.md');
    const manifest = path.join(dir, 'manifest.json');
    const baseline = path.join(dir, 'baseline.json');
    const logo = await writeLogo(dir);

    const plan = await runPlan([
      fixture,
      '--out',
      report,
      '--pdf',
      pdf,
      '--pdf-timeout',
      '120000',
      '--email',
      email,
      '--history',
      history,
      '--history-limit',
      '7',
      '--baseline',
      baseline,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
      '--manifest',
      manifest,
      '--json',
      '--static',
      '--title',
      'Plan',
      '--locale',
      'de-AT',
      '--meta',
      'a=1',
      '--meta',
      'b=2',
      '--accent',
      '#123456',
      '--logo',
      logo,
      '--max-size',
      '12.5',
    ]);

    expect(plan).toEqual({
      mode: 'generate',
      inputs: [fixture],
      report,
      pdf,
      email,
      history,
      ciOut,
      manifest,
      baseline,
      json: true,
      ci: 'markdown',
      title: 'Plan',
      locale: 'de-AT',
      metadata: { a: '1', b: '2' },
      accent: '#123456',
      logoDataUri: `data:image/png;base64,${PNG}`,
      static: true,
      maxSizeMb: 12.5,
      pdfTimeout: 120000,
      historyLimit: 7,
      writes: ['report', 'pdf', 'email', 'history', 'ci-markdown', 'manifest'],
      stdout: { machine: 'json', confirmations: [] },
      ...PLAN_TAIL,
    });
  });

  it('builds the minimal default generate plan', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');

    const plan = await runPlan([fixture, '--out', report]);

    expect(plan).toEqual({
      mode: 'generate',
      inputs: [fixture],
      report,
      json: false,
      metadata: {},
      static: false,
      maxSizeMb: 10,
      writes: ['report'],
      stdout: { machine: null, confirmations: ['report'] },
      ...PLAN_TAIL,
    });
  });

  it('builds a summary plan with no writes', async () => {
    const plan = await runPlan([fixture, '--json']);

    expect(plan).toEqual({
      mode: 'summary',
      inputs: [fixture],
      json: true,
      metadata: {},
      static: false,
      maxSizeMb: 10,
      writes: [],
      stdout: { machine: 'json', confirmations: [] },
      ...PLAN_TAIL,
    });
  });

  it('keeps an empty --title as a present empty title', async () => {
    const dir = await tempDir();
    const plan = await runPlan([
      fixture,
      '--out',
      path.join(dir, 'report.html'),
      '--title',
      '',
    ]);

    expect(plan.title).toBe('');
    expect(Object.hasOwn(plan, 'title')).toBe(true);
  });

  it('merges --meta with last-wins and keeps all four forms', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');

    const plan = await runPlan([
      fixture,
      '--out',
      report,
      '--meta',
      'a=1',
      '--meta',
      'b=',
      '--meta',
      'c=v=w',
      '--meta',
      'a=2',
    ]);

    expect(plan.metadata).toEqual({ a: '2', b: '', c: 'v=w' });
  });

  it('forces generate mode for --history, --static and --logo', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const history = path.join(dir, 'history.json');
    const pdf = path.join(dir, 'run.pdf');
    const logo = await writeLogo(dir);

    const withHistory = await runPlan([
      fixture,
      '--out',
      report,
      '--history',
      history,
      '--json',
    ]);
    expect(withHistory.mode).toBe('generate');
    expect(withHistory.writes).toEqual(['report', 'history']);

    const withStatic = await runPlan([fixture, '--pdf', pdf, '--static']);
    expect(withStatic.mode).toBe('generate');
    expect(withStatic.writes).toEqual(['pdf']);
    expect(withStatic.static).toBe(true);

    const withLogo = await runPlan([fixture, '--out', report, '--logo', logo]);
    expect(withLogo.mode).toBe('generate');
    expect(withLogo.logoDataUri).toContain('data:image/png;base64,');
  });
});

describe('planCli write order and stdout policy', () => {
  it('declares generate writes in report, PDF, email, history, CI, manifest order', async () => {
    const dir = await tempDir();
    const plan = await runPlan([
      fixture,
      '--out',
      path.join(dir, 'report.html'),
      '--pdf',
      path.join(dir, 'run.pdf'),
      '--email',
      path.join(dir, 'email.html'),
      '--history',
      path.join(dir, 'history.json'),
      '--ci',
      'markdown',
      '--ci-out',
      path.join(dir, 'summary.md'),
      '--manifest',
      path.join(dir, 'manifest.json'),
    ]);

    expect(plan.writes).toEqual([
      'report',
      'pdf',
      'email',
      'history',
      'ci-markdown',
      'manifest',
    ]);
    expect(plan.stdout).toEqual({
      machine: null,
      confirmations: ['report', 'pdf', 'email', 'manifest'],
    });
  });

  it('declares summary writes as email, CI, manifest', async () => {
    const dir = await tempDir();
    const plan = await runPlan([
      fixture,
      '--email',
      path.join(dir, 'email.html'),
      '--ci',
      'markdown',
      '--ci-out',
      path.join(dir, 'summary.md'),
      '--manifest',
      path.join(dir, 'manifest.json'),
    ]);

    expect(plan.writes).toEqual(['email', 'ci-markdown', 'manifest']);
    expect(plan.stdout).toEqual({
      machine: null,
      confirmations: ['email', 'manifest'],
    });
  });

  it('lets --json own stdout and suppresses every confirmation', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const manifest = path.join(dir, 'manifest.json');

    const plan = await runPlan([
      fixture,
      '--out',
      report,
      '--json',
      '--manifest',
      manifest,
      '--ci',
      'markdown',
      '--ci-out',
      path.join(dir, 'summary.md'),
    ]);

    expect(plan.stdout).toEqual({ machine: 'json', confirmations: [] });
    expect(plan.writes).toContain('manifest');
  });

  it('lets a standalone --ci own stdout', async () => {
    const dir = await tempDir();
    const plan = await runPlan([
      fixture,
      '--out',
      path.join(dir, 'report.html'),
      '--ci',
      'github',
    ]);

    expect(plan.stdout).toEqual({ machine: 'ci', confirmations: [] });
  });

  it('frees stdout when --ci-out is present', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const plan = await runPlan([
      fixture,
      '--out',
      report,
      '--ci',
      'markdown',
      '--ci-out',
      path.join(dir, 'summary.md'),
    ]);

    expect(plan.stdout).toEqual({
      machine: null,
      confirmations: ['report'],
    });
  });

  it('has no summary confirmations when only --ci-out writes', async () => {
    const dir = await tempDir();
    const plan = await runPlan([
      fixture,
      '--ci',
      'markdown',
      '--ci-out',
      path.join(dir, 'summary.md'),
    ]);

    expect(plan.writes).toEqual(['ci-markdown']);
    expect(plan.stdout).toEqual({ machine: null, confirmations: [] });
  });

  it('keeps the generate confirmation order without a PDF', async () => {
    const dir = await tempDir();
    const plan = await runPlan([
      fixture,
      '--out',
      path.join(dir, 'report.html'),
      '--email',
      path.join(dir, 'email.html'),
      '--manifest',
      path.join(dir, 'manifest.json'),
    ]);

    expect(plan.stdout.confirmations).toEqual(['report', 'email', 'manifest']);
  });
});

describe('planCli actions and purity', () => {
  it.each([
    [['--help'], 'help'],
    [['-h'], 'help'],
    [['--version'], 'version'],
    [['-v'], 'version'],
    [['--capabilities'], 'capabilities'],
  ] as const)('resolves %j to the %s action', async (argv, kind) => {
    await expect(planCli([...argv])).resolves.toEqual({
      ok: true,
      action: { kind },
    });
  });

  it('keeps help, version and capabilities precedence', async () => {
    await expect(planCli(['--version', '--help'])).resolves.toEqual({
      ok: true,
      action: { kind: 'help' },
    });
    await expect(planCli(['--capabilities', '--version'])).resolves.toEqual({
      ok: true,
      action: { kind: 'version' },
    });
  });

  it('rejects --capabilities with an input', async () => {
    const result = await planCli(['--capabilities', fixture]);
    expect(result).toEqual({
      ok: false,
      kind: 'message',
      message:
        '--capabilities takes no input and no other option; ' +
        'run tolkira --capabilities alone',
    });
  });

  it('fails a parse error with the parseArgs detail', async () => {
    const result = await planCli(['--nope']);
    expect(result).toEqual({
      ok: false,
      kind: 'message',
      message: parseError(['--nope']),
    });
  });

  it('returns the bare usage failure', async () => {
    await expect(planCli([])).resolves.toEqual({ ok: false, kind: 'usage' });
  });

  it('writes and prints nothing while planning', async () => {
    const dir = await tempDir();
    const argv = [fixture, '--out', path.join(dir, 'report.html'), '--json'];
    const before = [...argv];
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    try {
      const plan = await runPlan(argv);
      expect(plan.mode).toBe('generate');
      expect(stdout).not.toHaveBeenCalled();
      expect(stderr).not.toHaveBeenCalled();
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }

    expect(argv).toEqual(before);
    expect(await readdir(dir)).toEqual([]);
  });
});

describe('planCli messages added by checks 32–34', () => {
  it.each([
    [
      'invalid metadata',
      [fixture, '--out', 'report.html', '--meta', 'not-a-pair'],
      'Invalid metadata entry "not-a-pair". Use key=value.',
    ],
    [
      'empty metadata key',
      [fixture, '--out', 'report.html', '--meta', '=x'],
      'Invalid metadata entry "=x". Use key=value.',
    ],
    [
      'invalid --max-size',
      [fixture, '--out', 'report.html', '--max-size', '0'],
      'Invalid --max-size "0". Use a positive number of MB.',
    ],
    [
      'invalid --accent',
      [fixture, '--out', 'report.html', '--accent', 'red'],
      'Invalid --accent "red". Use a hex colour such as #1b5e20.',
    ],
    [
      'short --accent',
      [fixture, '--out', 'report.html', '--accent', '#12345'],
      'Invalid --accent "#12345". Use a hex colour such as #1b5e20.',
    ],
  ])('rejects %s', async (_label, argv, message) => {
    expect(await failure(argv)).toBe(message);
  });

  it('accepts the --max-size Number() equivalence classes', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');

    for (const [value, expected] of [
      ['1e3', 1000],
      ['0x10', 16],
      [' 5 ', 5],
    ] as const) {
      const plan = await runPlan([
        fixture,
        '--out',
        report,
        '--max-size',
        value,
      ]);
      expect(plan.maxSizeMb, value).toBe(expected);
    }
  });

  it.each(['', '0', '-1', 'NaN', 'Infinity'])(
    'rejects the --max-size value %j through the equals form',
    async (value) => {
      expect(
        await failure([fixture, '--out', 'report.html', `--max-size=${value}`]),
      ).toBe(`Invalid --max-size "${value}". Use a positive number of MB.`);
    },
  );

  it('rejects the bare --max-size -1 token as ambiguous through planCli', async () => {
    const argv = [fixture, '--out', 'report.html', '--max-size', '-1'];
    expect(await failure(argv)).toBe(parseError(argv));
  });
});

describe('planCli same- and cross-family precedence (checks 24–34)', () => {
  it('puts every early scalar error before a later --out collision', async () => {
    expect(
      await failure([
        fixture,
        '--out',
        fixture,
        '--pdf',
        'run.pdf',
        '--pdf-timeout',
        'abc',
      ]),
    ).toBe(
      'Invalid --pdf-timeout "abc". Use a positive integer of milliseconds.',
    );

    expect(await failure([fixture, '--out', fixture, '--locale', 'fr'])).toBe(
      'Unsupported locale "fr". Supported locales: en, de.',
    );

    expect(await failure([fixture, '--out', fixture, '--ci', 'nope'])).toBe(
      'Invalid --ci "nope". Use github, azure or markdown.',
    );

    expect(
      await failure([
        fixture,
        '--out',
        fixture,
        '--history',
        'history.json',
        '--history-limit',
        'abc',
      ]),
    ).toBe('Invalid --history-limit "abc". Use an integer from 1 to 365.');
  });

  it('puts an early dependency error before a later --out collision', async () => {
    expect(
      await failure([fixture, '--out', fixture, '--pdf-timeout', '5']),
    ).toBe('--pdf-timeout requires --pdf');
  });

  it('puts path errors before later meta, max-size and accent parsing', async () => {
    expect(
      await failure([fixture, '--manifest', fixture, '--meta', 'bad']),
    ).toBe(
      '--manifest must not overwrite an input file, the logo, ' +
        '--out, --pdf, --email, --history, --ci-out or --baseline',
    );

    expect(await failure([fixture, '--out', fixture, '--meta', 'bad'])).toBe(
      '--out must not overwrite an input file',
    );

    expect(await failure([fixture, '--out', fixture, '--max-size', '0'])).toBe(
      '--out must not overwrite an input file',
    );

    expect(await failure([fixture, '--out', fixture, '--accent', 'red'])).toBe(
      '--out must not overwrite an input file',
    );
  });

  it('keeps the path-check pair order between families', async () => {
    expect(
      await failure([fixture, '--out', fixture, '--history', fixture]),
    ).toBe(
      '--history must not overwrite an input file, the logo, ' +
        '--out, --pdf, --ci-out, --email or --baseline',
    );

    expect(
      await failure([
        fixture,
        '--out',
        'report.html',
        '--ci',
        'markdown',
        '--ci-out',
        'report.html',
        '--email',
        'report.html',
      ]),
    ).toBe('--ci-out must not overwrite --out');

    expect(
      await failure([
        fixture,
        '--out',
        'report.html',
        '--email',
        'report.html',
        '--pdf',
        'report.html',
      ]),
    ).toBe('--email must not overwrite --out');
  });
});
