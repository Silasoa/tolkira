import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planOptions, type CliOptionsResult } from '../src/cli/plan.js';

type CliOptions = Extract<CliOptionsResult, { options: unknown }>['options'];

const fixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-plan-options-'));
  dirs.push(dir);
  return dir;
}

async function options(argv: string[]): Promise<CliOptions> {
  const result = planOptions(argv);
  if (!result.ok) {
    throw new Error(`expected options, got ${JSON.stringify(result)}`);
  }
  if ('action' in result) {
    throw new Error(`expected options, got action ${result.action}`);
  }
  return result.options;
}

async function action(
  argv: string[],
): Promise<'help' | 'version' | 'capabilities'> {
  const result = planOptions(argv);
  if (!result.ok || !('action' in result)) {
    throw new Error(`expected an action, got ${JSON.stringify(result)}`);
  }
  return result.action;
}

/** The exact parseArgs detail that the pre-refactor CLI prints after `tolkira: `. */
function parseError(argv: string[]): string {
  try {
    parseArgs({ args: argv, allowPositionals: true });
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('expected parseArgs to fail');
}

describe('planOptions shape and defaults', () => {
  it('returns the validated checks 1–23 values and raw meta/max-size/accent/logo', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const pdf = path.join(dir, 'run.pdf');
    const email = path.join(dir, 'email.html');
    const history = path.join(dir, 'history.json');
    const ciOut = path.join(dir, 'summary.md');
    const baseline = path.join(dir, 'baseline.json');
    const manifest = path.join(dir, 'manifest.json');
    const logo = path.join(dir, 'logo.png');

    const values = await options([
      fixture,
      '--out',
      report,
      '--static',
      '--pdf',
      pdf,
      '--pdf-timeout',
      '120000',
      '--email',
      email,
      '--json',
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
      '--history',
      history,
      '--history-limit',
      '7',
      '--baseline',
      baseline,
      '--manifest',
      manifest,
      '--title',
      '',
      '--locale',
      'de-AT',
      '--meta',
      'a=1',
      '--meta',
      'b=2',
      '--max-size',
      '12.5',
      '--accent',
      '#123456',
      '--logo',
      logo,
    ]);

    expect(values).toMatchObject({
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
      title: '',
      locale: 'de-AT',
      static: true,
      pdfTimeout: 120000,
      historyLimit: 7,
      meta: ['a=1', 'b=2'],
      maxSize: '12.5',
      accent: '#123456',
      logo,
    });
    // The parsed products belong to planCli, never to CliOptions.
    expect(values).not.toHaveProperty('metadata');
    expect(values).not.toHaveProperty('maxSizeMb');
    expect(values).not.toHaveProperty('logoDataUri');
    expect(values).not.toHaveProperty('writes');
    expect(values).not.toHaveProperty('stdout');
  });

  it('leaves absent optional values absent and reports the flag defaults', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');

    const values = await options([fixture, '--out', report]);

    expect(values).toMatchObject({ inputs: [fixture], report });
    expect(values.json).toBe(false);
    expect(values.static).toBe(false);
    expect(values.pdf).toBeUndefined();
    expect(values.email).toBeUndefined();
    expect(values.history).toBeUndefined();
    expect(values.ciOut).toBeUndefined();
    expect(values.manifest).toBeUndefined();
    expect(values.baseline).toBeUndefined();
    expect(values.ci).toBeUndefined();
    expect(values.title).toBeUndefined();
    expect(values.locale).toBeUndefined();
    expect(values.pdfTimeout).toBeUndefined();
    expect(values.historyLimit).toBeUndefined();
    expect(values.meta).toBeUndefined();
    expect(values.maxSize).toBeUndefined();
    expect(values.accent).toBeUndefined();
    expect(values.logo).toBeUndefined();
  });

  it('keeps an empty --title present and the raw locale tag', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');

    const values = await options([
      fixture,
      '--out',
      report,
      '--title',
      '',
      '--locale',
      'de-AT',
    ]);

    expect(values.title).toBe('');
    expect(values.locale).toBe('de-AT');
  });

  it('keeps --meta, --max-size, --accent and --logo unparsed and unread', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const missingLogo = path.join(dir, 'missing.png');

    const values = await options([
      fixture,
      '--out',
      report,
      '--meta',
      'not-a-pair',
      '--max-size',
      '0',
      '--accent',
      'red',
      '--logo',
      missingLogo,
    ]);

    expect(values.meta).toEqual(['not-a-pair']);
    expect(values.maxSize).toBe('0');
    expect(values.accent).toBe('red');
    expect(values.logo).toBe(missingLogo);
  });

  it('does not run the path checks (that is planCli)', async () => {
    const values = await options([fixture, '--out', fixture]);

    expect(values.report).toBe(fixture);
  });
});

describe('planOptions actions and precedence', () => {
  it.each([
    [['--help'], 'help'],
    [['-h'], 'help'],
    [['--version'], 'version'],
    [['-v'], 'version'],
    [['--capabilities'], 'capabilities'],
  ] as const)('returns the %j action', async (argv, expected) => {
    expect(await action([...argv])).toBe(expected);
  });

  it('checks help before version, and version before capabilities', async () => {
    expect(await action(['--version', '--help'])).toBe('help');
    expect(await action(['--capabilities', '--help'])).toBe('help');
    expect(await action(['--capabilities', '--version'])).toBe('version');
  });

  it('lets --version and --help ignore positionals and later usage errors', async () => {
    expect(await action([fixture, '--version'])).toBe('version');
    expect(await action([fixture, '--help', '--out='])).toBe('help');
  });

  it('rejects --capabilities with an input or any other option', async () => {
    for (const argv of [
      ['--capabilities', fixture],
      ['--capabilities', '--json'],
      ['--capabilities', '--out='],
    ]) {
      const result = planOptions(argv);
      expect(result).toEqual({
        ok: false,
        kind: 'message',
        message:
          '--capabilities takes no input and no other option; ' +
          'run tolkira --capabilities alone',
      });
    }
  });

  it('fails a parse error before help even when help is present', async () => {
    for (const argv of [
      ['--bogus', '--help'],
      ['--help', '--bogus'],
    ]) {
      const result = planOptions(argv);
      expect(result).toEqual({
        ok: false,
        kind: 'message',
        message: parseError(['--bogus']),
      });
    }
  });
});

describe('planOptions purity', () => {
  it('creates no file or directory, prints nothing and does not mutate argv', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const argv = [fixture, '--out', report, '--json'];
    const before = [...argv];
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    try {
      const values = await options(argv);

      expect(values.report).toBe(report);
      expect(stdout).not.toHaveBeenCalled();
      expect(stderr).not.toHaveBeenCalled();
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }

    expect(argv).toEqual(before);
    expect(await readdir(dir)).toEqual([]);
  });

  it('is pure for an action too', async () => {
    const dir = await tempDir();
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    try {
      expect(await action(['--help'])).toBe('help');
      expect(stdout).not.toHaveBeenCalled();
      expect(stderr).not.toHaveBeenCalled();
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }

    expect(await readdir(dir)).toEqual([]);
  });
});

describe('planOptions single-defect messages (checks 1–23)', () => {
  const emptyPaths: Array<[string, string[]]> = [
    ['--out', [fixture, '--out=']],
    ['--pdf', [fixture, '--pdf=']],
    ['--baseline', [fixture, '--baseline=']],
    ['--manifest', [fixture, '--manifest=']],
  ];

  it.each(emptyPaths)('rejects an empty %s path', async (flag, argv) => {
    const result = planOptions(argv);
    expect(result).toEqual({
      ok: false,
      kind: 'message',
      message: `${flag} requires a file path`,
    });
  });

  it.each([
    [
      '--static without an output',
      [fixture, '--static'],
      '--static requires --out or --pdf',
    ],
    [
      '--pdf-timeout without --pdf',
      [fixture, '--pdf-timeout', '5'],
      '--pdf-timeout requires --pdf',
    ],
    [
      'invalid --pdf-timeout',
      [fixture, '--pdf', 'run.pdf', '--pdf-timeout', 'abc'],
      'Invalid --pdf-timeout "abc". Use a positive integer of milliseconds.',
    ],
    ['empty --email', [fixture, '--email='], '--email requires a file path'],
    [
      'unsupported --locale',
      [fixture, '--out', 'report.html', '--locale', 'fr'],
      'Unsupported locale "fr". Supported locales: en, de.',
    ],
    [
      '--locale without a locale surface',
      [fixture, '--locale', 'de'],
      '--locale requires --out, --pdf or --email',
    ],
    [
      'unknown --ci',
      [fixture, '--out', 'report.html', '--ci', 'nope'],
      'Invalid --ci "nope". Use github, azure or markdown.',
    ],
    [
      'empty --ci-out',
      [fixture, '--out', 'report.html', '--ci', 'markdown', '--ci-out='],
      '--ci-out requires a file path',
    ],
    [
      '--ci-out without --ci',
      [fixture, '--out', 'report.html', '--ci-out', 'summary.md'],
      '--ci-out requires --ci',
    ],
    [
      '--ci github with --ci-out',
      [fixture, '--out', 'report.html', '--ci', 'github', '--ci-out', 's.md'],
      '--ci github writes annotations to stdout; --ci-out is only for --ci markdown',
    ],
    [
      '--ci azure with --ci-out',
      [fixture, '--out', 'report.html', '--ci', 'azure', '--ci-out', 's.md'],
      '--ci azure writes annotations to stdout; --ci-out is only for --ci markdown',
    ],
    [
      '--json with stdout --ci github',
      [fixture, '--json', '--ci', 'github'],
      '--json and --ci github both write to stdout; drop --json or --ci github',
    ],
    [
      '--json with stdout --ci azure',
      [fixture, '--json', '--ci', 'azure'],
      '--json and --ci azure both write to stdout; ' +
        'drop --json or --ci azure, or use --ci markdown with --ci-out',
    ],
    [
      '--json with stdout --ci markdown',
      [fixture, '--json', '--ci', 'markdown'],
      '--json and --ci markdown both write to stdout; ' +
        'add --ci-out for the Markdown summary or drop one',
    ],
    [
      '--baseline without a surface',
      [fixture, '--baseline', 'baseline.json', '--email', 'email.html'],
      '--baseline requires --out, --pdf, --json or --ci markdown',
    ],
    [
      '--history-limit without --history',
      [fixture, '--out', 'report.html', '--history-limit', '5'],
      '--history-limit requires --history',
    ],
    [
      'non-empty --history without --out',
      [fixture, '--json', '--history', 'history.json'],
      '--history requires --out',
    ],
    [
      'empty --logo',
      [fixture, '--out', 'report.html', '--logo='],
      '--logo requires a file path',
    ],
    [
      '--logo without --out',
      [fixture, '--json', '--logo', 'logo.png'],
      '--logo requires --out',
    ],
    [
      'empty --history',
      [fixture, '--out', 'report.html', '--history='],
      '--history requires a file path',
    ],
  ])('rejects %s', async (_label, argv, message) => {
    const result = planOptions(argv);
    expect(result).toEqual({ ok: false, kind: 'message', message });
  });

  it('returns the bare usage failure without a message', async () => {
    for (const argv of [
      [],
      [fixture],
      ['--json'],
      [fixture, '--logo='],
      [fixture, '--history='],
    ]) {
      const result = planOptions(argv);
      expect(result).toEqual({ ok: false, kind: 'usage' });
    }
  });
});

describe('planOptions boundary values', () => {
  it.each(['1', '365'])('accepts --history-limit %s', async (value) => {
    const values = await options([
      fixture,
      '--out',
      'report.html',
      '--history',
      'history.json',
      '--history-limit',
      value,
    ]);
    expect(values.historyLimit).toBe(Number(value));
  });

  it.each(['0', '366', '01', '1.5', 'abc', ''])(
    'rejects --history-limit %j',
    async (value) => {
      const result = planOptions([
        fixture,
        '--out',
        'report.html',
        '--history',
        'history.json',
        '--history-limit',
        value,
      ]);
      expect(result).toEqual({
        ok: false,
        kind: 'message',
        message: `Invalid --history-limit "${value}". Use an integer from 1 to 365.`,
      });
    },
  );

  it.each(['1', '2147483647'])('accepts --pdf-timeout %s', async (value) => {
    const values = await options([
      fixture,
      '--pdf',
      'run.pdf',
      '--pdf-timeout',
      value,
    ]);
    expect(values.pdfTimeout).toBe(Number(value));
  });

  it.each(['0', '2147483648', '01'])(
    'rejects --pdf-timeout %j',
    async (value) => {
      const result = planOptions([
        fixture,
        '--pdf',
        'run.pdf',
        '--pdf-timeout',
        value,
      ]);
      expect(result).toEqual({
        ok: false,
        kind: 'message',
        message: `Invalid --pdf-timeout "${value}". Use a positive integer of milliseconds.`,
      });
    },
  );

  it.each(['github', 'azure', 'markdown'])('accepts --ci %s', async (value) => {
    const values = await options([
      fixture,
      '--out',
      'report.html',
      '--ci',
      value,
      ...(value === 'markdown' ? ['--ci-out', 'summary.md'] : []),
    ]);
    expect(values.ci).toBe(value);
  });

  it.each(['GitHub', 'Azure', 'Markdown', ''])(
    'rejects --ci %j with the exact message',
    async (value) => {
      const result = planOptions([
        fixture,
        '--out',
        'report.html',
        '--ci',
        value,
      ]);
      expect(result).toEqual({
        ok: false,
        kind: 'message',
        message: `Invalid --ci "${value}". Use github, azure or markdown.`,
      });
    },
  );
});

describe('planOptions precedence within checks 1–23', () => {
  it.each([
    [
      'empty --out before empty --pdf',
      [fixture, '--out=', '--pdf='],
      '--out requires a file path',
    ],
    [
      'empty --manifest before --static',
      [fixture, '--manifest=', '--static'],
      '--manifest requires a file path',
    ],
    [
      '--static before --pdf-timeout',
      [fixture, '--static', '--pdf-timeout', '5'],
      '--static requires --out or --pdf',
    ],
    [
      '--pdf-timeout dependency before empty --email',
      [fixture, '--pdf-timeout', '5', '--email='],
      '--pdf-timeout requires --pdf',
    ],
    [
      'invalid --locale before invalid --ci',
      [fixture, '--out', 'report.html', '--locale', 'fr', '--ci', 'nope'],
      'Unsupported locale "fr". Supported locales: en, de.',
    ],
    [
      'invalid --ci before empty --ci-out',
      [fixture, '--out', 'report.html', '--ci', 'nope', '--ci-out='],
      'Invalid --ci "nope". Use github, azure or markdown.',
    ],
    [
      '--json/--ci conflict before --baseline surface',
      [fixture, '--json', '--ci', 'github', '--baseline', 'baseline.json'],
      '--json and --ci github both write to stdout; drop --json or --ci github',
    ],
    [
      'earlier empty --out before bare usage',
      ['--out=', '--json'],
      '--out requires a file path',
    ],
    [
      'earlier empty --out before empty --logo',
      [fixture, '--out=', '--logo='],
      '--out requires a file path',
    ],
    [
      'capabilities conflict before every other check',
      ['--capabilities', fixture, '--out='],
      '--capabilities takes no input and no other option; ' +
        'run tolkira --capabilities alone',
    ],
    [
      'history-limit dependency before bare usage',
      [fixture, '--history-limit', '5'],
      '--history-limit requires --history',
    ],
  ])('keeps %s', async (_label, argv, message) => {
    const result = planOptions(argv);
    expect(result).toEqual({ ok: false, kind: 'message', message });
  });
});
