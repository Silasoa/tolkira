import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';

const failed = fileURLToPath(
  new URL('./fixtures/legacy/failed.json', import.meta.url),
);
const screenshot = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const allStatuses = fileURLToPath(
  new URL('./fixtures/messages/all-statuses.ndjson', import.meta.url),
);
const logoPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-cli-ci-'));
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

async function missing(file: string): Promise<boolean> {
  try {
    await readFile(file);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT';
  }
}

describe('CLI CI output', () => {
  it('emits GitHub annotations on stdout without writing HTML', async () => {
    const run = await cli([failed, '--ci', 'github']);

    expect(run.code).toBe(0);
    expect(run.stderr).toBe('');
    const lines = run.stdout.trimEnd().split('\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.startsWith('::'))).toBe(true);
    expect(run.stdout).toContain('::error ');
    expect(run.stdout).toContain('::notice title=Tolkira::');
    expect(run.stdout).not.toContain('Report written to');
  });

  it('writes Markdown to stdout without --out', async () => {
    const run = await cli([allStatuses, '--ci', 'markdown']);

    expect(run.code).toBe(0);
    expect(run.stderr).toBe('');
    expect(run.stdout.startsWith('## Tolkira report')).toBe(true);
    expect(run.stdout).not.toContain('::error');
    expect(run.stdout).not.toContain('Report written to');
  });

  it('writes Markdown to --ci-out and creates missing directories', async () => {
    const dir = await tempDir();
    const ciFile = path.join(dir, 'nested', 'deep', 'summary.md');

    const run = await cli([
      failed,
      '--ci',
      'markdown',
      '--ci-out',
      ciFile,
    ]);

    expect(run.code).toBe(0);
    const markdown = await readFile(ciFile, 'utf8');
    expect(markdown.startsWith('## Tolkira report')).toBe(true);
    expect(markdown).toContain('Happy HTML reporting');
    expect(run.stdout).toBe('');
    await expect(readdir(dir)).resolves.toEqual(['nested']);
  });

  it('writes HTML and stdout Markdown without a human confirmation', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');

    const run = await cli([failed, '--out', output, '--ci', 'markdown']);

    expect(run.code).toBe(0);
    expect(run.stderr).toBe('');
    expect(run.stdout.startsWith('## Tolkira report')).toBe(true);
    expect(run.stdout).not.toMatch(/^::/m);
    expect(run.stdout).not.toContain('Report written to');
    await expect(readFile(output, 'utf8')).resolves.toContain('<html');
  });

  it('forwards --title to the Markdown heading', async () => {
    const run = await cli([failed, '--ci', 'markdown', '--title', 'Nightly']);

    expect(run.code).toBe(0);
    expect(run.stdout.startsWith('## Nightly\n')).toBe(true);
    expect(run.stdout).not.toContain('## Tolkira report');
  });

  it('names the requested CI target and keeps the report on a failed write', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');
    const ciTarget = path.join(dir, 'ci-target');
    await mkdir(ciTarget);

    const run = await cli([
      failed,
      '--out',
      output,
      '--ci',
      'markdown',
      '--ci-out',
      ciTarget,
    ]);

    expect(run.code).toBe(1);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain(`Cannot write CI output to ${ciTarget} (`);
    expect(run.stderr).toMatch(/\([A-Z]+\)/);
    expect(run.stderr).not.toContain('.tmp');
    expect(run.stderr).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    await expect(readFile(output, 'utf8')).resolves.toContain('<html');
    expect(await readdir(ciTarget)).toEqual([]);
    expect((await readdir(dir)).sort()).toEqual(['ci-target', 'report.html']);
  });

  it('caps a long --title heading at 200 code points', async () => {
    const run = await cli([failed, '--ci', 'markdown', '--title', 'x'.repeat(201)]);

    expect(run.code).toBe(0);
    expect(run.stdout.startsWith(`## ${'x'.repeat(200)}[truncated]\n`)).toBe(
      true,
    );

    const exact = await cli([failed, '--ci', 'markdown', '--title', 'y'.repeat(200)]);
    expect(exact.stdout.startsWith(`## ${'y'.repeat(200)}\n`)).toBe(true);
  });

  it.skipIf(
    process.platform === 'win32' || process.getuid?.() === 0,
  )('reports a permission failure for --ci-out and keeps the report', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');
    const ciDir = path.join(dir, 'locked');
    await mkdir(ciDir);
    const ciTarget = path.join(ciDir, 'summary.md');
    await chmod(ciDir, 0o555);

    try {
      const run = await cli([
        failed,
        '--out',
        output,
        '--ci',
        'markdown',
        '--ci-out',
        ciTarget,
      ]);

      expect(run.code).toBe(1);
      expect(run.stderr).toContain(`Cannot write CI output to ${ciTarget} (`);
      expect(run.stderr).not.toContain('.tmp');
      await expect(readFile(output, 'utf8')).resolves.toContain('<html');
      await expect(readFile(ciTarget, 'utf8')).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      await chmod(ciDir, 0o755);
    }
  });

  it('rejects GitHub annotations bound to --ci-out before writing anything', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');
    const ciFile = path.join(dir, 'summary.md');

    const run = await cli([
      failed,
      '--out',
      output,
      '--ci',
      'github',
      '--ci-out',
      ciFile,
    ]);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('--ci-out');
    expect(await missing(output)).toBe(true);
    expect(await missing(ciFile)).toBe(true);
  });

  it('rejects empty, unknown and case-mismatched --ci values', async () => {
    const invalid = [
      ['--ci', ''],
      ['--ci', 'GitHub'],
      ['--ci', 'yaml'],
    ];

    for (const extra of invalid) {
      const run = await cli([failed, ...extra]);
      expect(run.code, extra.join(' ')).toBe(2);
      expect(run.stderr, extra.join(' ')).toContain('--ci');
      expect(run.stderr, extra.join(' ')).toMatch(/github|markdown/i);
      expect(run.stdout, extra.join(' ')).toBe('');
    }
  });

  it('rejects --ci-out without --ci and an empty --ci-out path', async () => {
    const dir = await tempDir();
    const withoutCi = await cli([
      failed,
      '--ci-out',
      path.join(dir, 'summary.md'),
    ]);
    expect(withoutCi.code).toBe(2);
    expect(withoutCi.stderr).toContain('--ci-out');
    expect(withoutCi.stderr).toMatch(/requires/i);

    const emptyPath = await cli([failed, '--ci', 'markdown', '--ci-out', '']);
    expect(emptyPath.code).toBe(2);
    expect(emptyPath.stderr).toContain('--ci-out');
    expect(emptyPath.stderr).toMatch(/file path|requires/i);
    await expect(readdir(dir)).resolves.toEqual([]);
  });

  it('rejects --json and --ci on stdout but allows both with --ci-out', async () => {
    const conflict = await cli([screenshot, '--json', '--ci', 'github']);
    expect(conflict.code).toBe(2);
    expect(conflict.stdout).toBe('');
    expect(conflict.stderr).toContain('--json');
    const [conflictError] = conflict.stderr.split('\n');
    expect(conflictError).not.toContain('--ci-out');
    expect(conflictError).toMatch(/drop/);

    const markdownConflict = await cli([screenshot, '--json', '--ci', 'markdown']);
    expect(markdownConflict.code).toBe(2);
    const [markdownError] = markdownConflict.stderr.split('\n');
    expect(markdownError).toContain('--ci-out');

    const dir = await tempDir();
    const ciFile = path.join(dir, 'summary.md');
    const allowed = await cli([
      screenshot,
      '--json',
      '--ci',
      'markdown',
      '--ci-out',
      ciFile,
    ]);
    expect(allowed.code).toBe(0);
    expect(allowed.stderr).toBe('');
    const summary = JSON.parse(allowed.stdout) as { status: string };
    expect(summary.status).toBe('failed');
    await expect(readFile(ciFile, 'utf8')).resolves.toContain(
      '## Tolkira report',
    );
  });

  it('rejects a --ci-out path that resolves to --out, an input or the logo', async () => {
    const outDir = await tempDir();
    const output = path.join(outDir, 'report.html');
    const alias = `${outDir}${path.sep}nested${path.sep}..${path.sep}report.html`;
    expect(alias).not.toBe(output);

    const sameAsOut = await cli([
      screenshot,
      '--out',
      output,
      '--ci',
      'markdown',
      '--ci-out',
      alias,
    ]);
    expect(sameAsOut.code).toBe(2);
    expect(sameAsOut.stderr).toContain('--ci-out');
    expect(sameAsOut.stderr).toMatch(/--out|overwrite/);
    await expect(readdir(outDir)).resolves.toEqual([]);

    const inputDir = await tempDir();
    const input = path.join(inputDir, 'input.ndjson');
    await copyFile(screenshot, input);
    const before = await readFile(input, 'utf8');
    const sameAsInput = await cli([
      input,
      '--ci',
      'markdown',
      '--ci-out',
      input,
    ]);
    expect(sameAsInput.code).toBe(2);
    expect(sameAsInput.stderr).toContain('--ci-out');
    expect(sameAsInput.stderr).toMatch(/input|overwrite/);
    await expect(readFile(input, 'utf8')).resolves.toBe(before);

    const logoDir = await tempDir();
    const logo = path.join(logoDir, 'logo.png');
    const logoOutput = path.join(logoDir, 'report.html');
    await writeFile(logo, logoPng);
    const logoBefore = await readFile(logo);
    const sameAsLogo = await cli([
      screenshot,
      '--out',
      logoOutput,
      '--logo',
      logo,
      '--ci',
      'markdown',
      '--ci-out',
      logo,
    ]);
    expect(sameAsLogo.code).toBe(2);
    expect(sameAsLogo.stderr).toContain('--ci-out');
    expect(sameAsLogo.stderr).toMatch(/logo|overwrite/);
    await expect(readFile(logo)).resolves.toEqual(logoBefore);
    expect(await missing(logoOutput)).toBe(true);
  });

  it.skipIf(process.platform === 'linux')(
    'rejects case-only --ci-out collisions with --out and an input',
    async () => {
      const outDir = await tempDir();
      const sameAsOut = await cli([
        screenshot,
        '--out',
        path.join(outDir, 'Report.html'),
        '--ci',
        'markdown',
        '--ci-out',
        path.join(outDir, 'report.html'),
      ]);
      expect(sameAsOut.code).toBe(2);
      expect(sameAsOut.stderr).toContain('--ci-out');
      expect(sameAsOut.stderr).toMatch(/--out|overwrite/);
      await expect(readdir(outDir)).resolves.toEqual([]);

      const inputDir = await tempDir();
      const upper = path.join(inputDir, 'INPUT.NDJSON');
      await copyFile(screenshot, upper);
      const before = await readFile(upper, 'utf8');
      const sameAsInput = await cli([
        upper,
        '--ci',
        'markdown',
        '--ci-out',
        path.join(inputDir, 'input.ndjson'),
      ]);
      expect(sameAsInput.code).toBe(2);
      expect(sameAsInput.stderr).toContain('--ci-out');
      expect(sameAsInput.stderr).toMatch(/input|overwrite/);
      await expect(readFile(upper, 'utf8')).resolves.toBe(before);
      await expect(readdir(inputDir)).resolves.toEqual(['INPUT.NDJSON']);
    },
  );

  it('rejects a --ci-out alias through a symlinked directory', async (context) => {
    const dir = await tempDir();
    const real = path.join(dir, 'real');
    const link = path.join(dir, 'link');
    await mkdir(real);
    try {
      await symlink(real, link, process.platform === 'win32' ? 'junction' : 'dir');
    } catch {
      context.skip('directory symlinks are not supported here');
    }

    const run = await cli([
      screenshot,
      '--out',
      path.join(link, 'report.html'),
      '--ci',
      'markdown',
      '--ci-out',
      path.join(real, 'report.html'),
    ]);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('--ci-out');
    expect(run.stderr).toMatch(/--out|overwrite/);
    await expect(readdir(real)).resolves.toEqual([]);
  });

  it('keeps HTML byte-identical with --ci and exits 0 for a failed run', async () => {
    const dir = await tempDir();
    const baseline = path.join(dir, 'baseline.html');
    const withCi = path.join(dir, 'with-ci.html');
    const ciFile = path.join(dir, 'summary.md');

    const plain = await cli([screenshot, '--out', baseline]);
    const annotated = await cli([
      screenshot,
      '--out',
      withCi,
      '--ci',
      'markdown',
      '--ci-out',
      ciFile,
    ]);

    expect(plain.code).toBe(0);
    expect(annotated.code).toBe(0);
    expect(annotated.stderr).toBe('');
    expect(annotated.stdout).toContain(`Report written to ${withCi}`);
    expect(await readFile(baseline)).toEqual(await readFile(withCi));
    await expect(readFile(ciFile, 'utf8')).resolves.toContain(
      '## Tolkira report',
    );
  });

  it('returns 1 when the CI file cannot be written but keeps the HTML', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'report.html');
    const blocker = path.join(dir, 'blocked');
    await writeFile(blocker, 'not a directory', 'utf8');

    const run = await cli([
      failed,
      '--out',
      output,
      '--ci',
      'markdown',
      '--ci-out',
      path.join(blocker, 'summary.md'),
    ]);

    expect(run.code).toBe(1);
    expect(run.stderr).toContain('tolkira:');
    await expect(readFile(output, 'utf8')).resolves.toContain('<html');
  });

  it('keeps --logo dependent on --out when --ci is present', async () => {
    const dir = await tempDir();
    const logo = path.join(dir, 'logo.png');
    await writeFile(logo, logoPng);

    const run = await cli([failed, '--ci', 'markdown', '--logo', logo]);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('--logo requires --out');
  });

  it('accepts --ci azure and exits 0 on a failed run', async () => {
    const run = await cli([failed, '--ci', 'azure']);

    expect(run.code).toBe(0);
    expect(run.stderr).toBe('');
    const lines = run.stdout.trimEnd().split('\n');
    expect(
      lines.every(
        (line) =>
          line.startsWith('##vso[task.logissue ') ||
          line.startsWith('##[section]Tolkira: '),
      ),
    ).toBe(true);
    expect(lines.at(-1)).toBe(
      '##[section]Tolkira: 6 scenarios: 5 passed, 1 failed; 0 unexecuted',
    );
    expect(run.stdout).toContain('##vso[task.logissue type=error]');
    expect(run.stdout).not.toContain('Report written to');
  });

  it('rejects --ci azure with --ci-out before writing anything', async () => {
    const dir = await tempDir();
    const ciFile = path.join(dir, 'summary.md');
    const run = await cli([
      failed,
      '--ci',
      'azure',
      '--ci-out',
      ciFile,
    ]);

    expect(run.code).toBe(2);
    const [error] = run.stderr.split('\n');
    expect(error).toContain('--ci azure');
    expect(error).toContain('writes annotations to stdout');
    expect(error).toContain('--ci-out is only for --ci markdown');
    expect(run.stdout).toBe('');
    expect(await missing(ciFile)).toBe(true);
  });

  it('does not suggest adding --ci-out to --json --ci azure', async () => {
    const run = await cli([failed, '--json', '--ci', 'azure']);

    expect(run.code).toBe(2);
    expect(run.stdout).toBe('');
    const [error] = run.stderr.split('\n');
    expect(error).toContain('azure');
    expect(error).toMatch(/drop/);
    expect(error).toMatch(/--ci markdown.*--ci-out/);
    expect(error).not.toMatch(/add --ci-out/i);
  });

  it('lists azure for an invalid --ci value', async () => {
    for (const value of ['yaml', 'Azure']) {
      const run = await cli([failed, '--ci', value]);

      expect(run.code, value).toBe(2);
      expect(run.stdout, value).toBe('');
      const [error] = run.stderr.split('\n');
      expect(error, value).toContain(`Invalid --ci "${value}"`);
      expect(error, value).toMatch(/github.*azure.*markdown/);
    }
  });

  it('lists azure in --help', async () => {
    const run = await cli(['--help']);

    expect(run.code).toBe(0);
    expect(run.stdout).toMatch(
      /--ci <format>[^\n]*github, azure or markdown/,
    );
  });
});
