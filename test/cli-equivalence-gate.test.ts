import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli, type CliIO } from '../src/cli.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const historyFixture = fileURLToPath(
  new URL('./fixtures/history/two-runs.json', import.meta.url),
);
const FROZEN = new Date('2026-11-26T12:00:00.000Z');

const dirs: string[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(prefix = 'tolkira-gate-'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

async function cli(argv: string[]) {
  let stdout = '';
  let stderr = '';
  const io: CliIO = {
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  };
  const code = await runCli(argv, io);
  return { code, stdout, stderr };
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function hash(file: string): Promise<{ bytes: number; sha: string }> {
  const bytes = await readFile(file);
  return { bytes: bytes.byteLength, sha: sha256(bytes) };
}

function normalizePdf(bytes: Buffer): Buffer {
  let text = bytes.toString('latin1');
  text = text.replace(
    /\/(CreationDate|ModDate)\s*\([^)]*\)/g,
    '/$1 (D:FIXED)',
  );
  text = text.replace(/\/ID\s*\[[^\]]*\]/g, '/ID [<FIXED><FIXED>]');
  return Buffer.from(text, 'latin1');
}

function spawnCli(argv: string[]) {
  return spawnSync(process.execPath, [path.join(repoRoot, 'dist', 'cli.js'), ...argv], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 120_000,
  });
}

describe('one-time gate rows 1-10, 14, 16, 18, 19, 20', () => {
  it('row 1: --help prints USAGE and exits 0', async () => {
    const result = await cli(['--help']);
    expect(result.code).toBe(0);
    expect(result.stdout.startsWith('Usage: tolkira')).toBe(true);
    expect(result.stderr).toBe('');
  });

  it('row 2: --version prints the version line and exits 0', async () => {
    const result = await cli(['--version']);
    expect(result).toEqual({ code: 0, stdout: '0.6.1\n', stderr: '' });
  });

  it('row 3: --capabilities prints the JSON document and exits 0', async () => {
    const result = await cli(['--capabilities']);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: 1,
      name: 'tolkira',
    });
  });

  it('row 4: --capabilities with an input is a usage error', async () => {
    const result = await cli(['--capabilities', fixture]);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(
      '--capabilities takes no input and no other option',
    );
  });

  it('row 5: no arguments is bare usage', async () => {
    const result = await cli([]);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr.startsWith('Usage: tolkira')).toBe(true);
  });

  it('row 6: --json prints the summary JSON', async () => {
    const result = await cli([fixture, '--json']);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ schemaVersion: 2 });
  });

  it('row 7: --out writes the report and confirms it', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'r.html');
    const result = await cli([fixture, '--out', report]);
    expect(result).toEqual({
      code: 0,
      stdout: `Report written to ${report}\n`,
      stderr: '',
    });
    await expect(readFile(report, 'utf8')).resolves.toContain('<html');
  });

  it('row 8: --json suppresses the report confirmation', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'r.html');
    const result = await cli([fixture, '--out', report, '--json']);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ schemaVersion: 2 });
    expect(result.stdout).not.toContain('Report written');
  });

  it('row 9: --pdf writes a real Chromium PDF and confirms it', async () => {
    const dir = await tempDir();
    const pdf = path.join(dir, 'r.pdf');
    const result = await cli([fixture, '--pdf', pdf]);
    expect(result).toEqual({
      code: 0,
      stdout: `PDF written to ${pdf}\n`,
      stderr: '',
    });
    const bytes = await readFile(pdf);
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('%PDF');
  }, 120_000);

  it('row 10: --email writes the summary email and confirms it', async () => {
    const dir = await tempDir();
    const email = path.join(dir, 'e.html');
    const result = await cli([fixture, '--email', email]);
    expect(result).toEqual({
      code: 0,
      stdout: `Email written to ${email}\n`,
      stderr: '',
    });
    await expect(readFile(email, 'utf8')).resolves.toContain('<html');
  });

  it('row 14: --history writes the report and history', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'r.html');
    const history = path.join(dir, 'h.json');
    const result = await cli([fixture, '--out', report, '--history', history]);
    expect(result).toEqual({
      code: 0,
      stdout: `Report written to ${report}\n`,
      stderr: '',
    });
    await expect(readFile(history, 'utf8')).resolves.toContain('"runs"');
  });

  it('row 16: --manifest writes the report and confirms the manifest', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'r.html');
    const manifest = path.join(dir, 'm.json');
    const result = await cli([fixture, '--out', report, '--manifest', manifest]);
    expect(result).toEqual({
      code: 0,
      stdout:
        `Report written to ${report}\n` +
        `Manifest written to ${manifest}\n`,
      stderr: '',
    });
    await expect(readFile(manifest, 'utf8')).resolves.toContain(
      '"schemaVersion": 1',
    );
  });

  it('row 18: --static writes a script-free report', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'r.html');
    const result = await cli([fixture, '--out', report, '--static']);
    expect(result.code).toBe(0);
    const html = await readFile(report, 'utf8');
    expect(html).not.toContain('<script');
  });

  it('row 19: --locale de writes the German report', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'r.html');
    const result = await cli([fixture, '--out', report, '--locale', 'de']);
    expect(result.code).toBe(0);
    const html = await readFile(report, 'utf8');
    expect(html).toContain('lang="de"');
  });

  it('row 20: --ci nope is a usage error', async () => {
    const dir = await tempDir();
    const summary = await cli([
      fixture,
      '--out',
      path.join(dir, 'r.html'),
      '--ci',
      'nope',
    ]);
    expect(summary.code).toBe(2);
    expect(summary.stdout).toBe('');
    expect(summary.stderr).toContain(
      'Invalid --ci "nope". Use github, azure or markdown.',
    );
  });
});

describe('one-time gate: 1.1 baseline comparison', () => {
  it('reproduces the generate, summary and --json artifacts', async () => {
    const dir = await tempDir();
    const generate = path.join(dir, 'generate');
    const summary = path.join(dir, 'summary');
    const json = path.join(dir, 'json');
    await mkdir(generate, { recursive: true });
    await mkdir(summary, { recursive: true });
    await mkdir(json, { recursive: true });

    const report = path.join(generate, 'report.html');
    const pdf = path.join(generate, 'report.pdf');
    const email = path.join(generate, 'email.html');
    const history = path.join(generate, 'history.json');
    const ci = path.join(generate, 'summary.md');
    const manifest = path.join(generate, 'manifest.json');
    await copyFile(historyFixture, history);

    const generateRun = await cli([
      fixture,
      '--out',
      report,
      '--pdf',
      pdf,
      '--email',
      email,
      '--history',
      history,
      '--ci',
      'markdown',
      '--ci-out',
      ci,
      '--manifest',
      manifest,
      '--locale',
      'en',
    ]);
    expect(generateRun.code, generateRun.stderr).toBe(0);
    expect(generateRun.stderr).toBe('');
    expect(generateRun.stdout).toBe(
      `Report written to ${report}\n` +
        `PDF written to ${pdf}\n` +
        `Email written to ${email}\n` +
        `Manifest written to ${manifest}\n`,
    );

    expect(await hash(report)).toEqual({
      bytes: 98930,
      sha: '35f601978e270c87f8df113728d3b7e73c3a4b8dfe916f8c92bafc355e61180c',
    });
    expect(await hash(email)).toEqual({
      bytes: 4951,
      sha: '6d01fc31b2dcdf782542db4c31bc5d7da4ca3058858aa0d6bf8ebcb2fab620aa',
    });
    expect(await hash(history)).toEqual({
      bytes: 2450,
      sha: '7cf2d838d03dddf7b8408f65d78b820e641234b15fc4b0c5e29ee2201d4f0fb5',
    });
    expect(await hash(ci)).toEqual({
      bytes: 480,
      sha: '640af92da29ec892697d3eb3326ac54abfd17e14e37719b19d76a4e821ea3524',
    });
    expect(await hash(manifest)).toEqual({
      bytes: 1118,
      sha: '1ae0d2fc438e7733dda23676566da6c277d7a7f2c8512e5e5db9b493b0ff7ce3',
    });

    const pdfBytes = await readFile(pdf);
    expect(pdfBytes.byteLength).toBe(145116);
    const normalized = normalizePdf(pdfBytes);
    expect(normalized.byteLength).toBe(145084);
    expect(sha256(normalized)).toBe(
      '544c1fec6c5df287b1d9d134413dc86ab4689a8e12084fb4f99b6120e553e5dd',
    );

    const summaryEmail = path.join(summary, 'email.html');
    const summaryCi = path.join(summary, 'summary.md');
    const summaryManifest = path.join(summary, 'manifest.json');
    const summaryRun = await cli([
      fixture,
      '--email',
      summaryEmail,
      '--ci',
      'markdown',
      '--ci-out',
      summaryCi,
      '--manifest',
      summaryManifest,
      '--locale',
      'en',
    ]);
    expect(summaryRun.code, summaryRun.stderr).toBe(0);
    expect(summaryRun.stdout).toBe(
      `Email written to ${summaryEmail}\n` +
        `Manifest written to ${summaryManifest}\n`,
    );
    expect(await hash(summaryEmail)).toEqual({
      bytes: 4922,
      sha: '9e98e79d669257e68e201b00a00c4a17ea7ea106a1532a2d235c2cfd6173aca1',
    });
    expect(await hash(summaryCi)).toEqual({
      bytes: 480,
      sha: '640af92da29ec892697d3eb3326ac54abfd17e14e37719b19d76a4e821ea3524',
    });
    expect(await hash(summaryManifest)).toEqual({
      bytes: 925,
      sha: '43cc61c9683bd20f360bf7f73d88815b56325fe9557a482ababb6c1dd5333a69',
    });

    const jsonRun = await cli([fixture, '--json']);
    expect(jsonRun.code).toBe(0);
    const b = path.join(json, 'b.json');
    await writeFile(b, jsonRun.stdout, 'utf8');
    expect(await hash(b)).toEqual({
      bytes: 1519,
      sha: '09c4be0d7b20f5f9981521956e94d3b7cffc7a932856850090d49c3cce9b2da8',
    });
  }, 180_000);

  it('reproduces the four process streams and exit codes', () => {
    for (const [argv, stream, bytes, sha] of [
      [
        ['--help'],
        'stdout',
        2044,
        '0debb225b3d6e9b98bd966671925f55cd9f574eba65bd35a4b92ef75c6ee4574',
      ],
      [
        ['--version'],
        'stdout',
        6,
        '87b241b275c591694846560e9879f50c9da3150f854efdabd782c539772f3033',
      ],
      [
        ['--capabilities'],
        'stdout',
        1318,
        '013d180c59d64916fffdd92643fafae8ff5e478b2e6bb2b599b9d1fc41df647c',
      ],
      [
        [],
        'stderr',
        2044,
        '0debb225b3d6e9b98bd966671925f55cd9f574eba65bd35a4b92ef75c6ee4574',
      ],
    ] as const) {
      const result = spawnCli([...argv]);
      const actual = result[stream] ?? '';
      const expectedCode = argv.length === 0 ? 2 : 0;
      expect(result.status, JSON.stringify(argv)).toBe(expectedCode);
      expect(Buffer.byteLength(actual), JSON.stringify(argv)).toBe(bytes);
      expect(sha256(Buffer.from(actual, 'utf8')), JSON.stringify(argv)).toBe(
        sha,
      );
    }
  });
});
