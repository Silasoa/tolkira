import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { buildRunManifest, serializeRunManifest } from '../src/artifacts.js';
import { readBaseline } from '../src/baseline.js';
import { formatCiOutput } from '../src/ci.js';
import { renderEmail } from '../src/email.js';
import { generateReport, renderReport, summarizeReport } from '../src/index.js';

const pdf = vi.hoisted(() => ({
  renderPdf:
    vi.fn<
      (html: string, options?: { timeoutMs?: number }) => Promise<Uint8Array>
    >(),
}));

vi.mock('../src/pdf.js', () => ({
  renderPdf: pdf.renderPdf,
  DEFAULT_TIMEOUT_MS: 300_000,
}));

import { runCli, type CliIO } from '../src/cli.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const FROZEN = new Date('2026-11-26T12:00:00.000Z');
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);

const dirs: string[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
  pdf.renderPdf.mockReset().mockResolvedValue(PDF_BYTES);
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(prefix = 'tolkira-equivalence-'): Promise<string> {
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

async function writeBaseline(dir: string): Promise<string> {
  const file = path.join(dir, 'b.json');
  const summary = await summarizeReport(fixture);
  await writeFile(file, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return file;
}

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    () => true,
    () => false,
  );
}

describe('mode x stdout matrix', () => {
  it('row 11: --out with --ci github prints the GitHub body', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'r.html');

    const result = await cli([fixture, '--out', report, '--ci', 'github']);
    const summary = await summarizeReport(fixture);

    expect(result).toEqual({
      code: 0,
      stdout: formatCiOutput(summary, 'github'),
      stderr: '',
    });
    await expect(readFile(report, 'utf8')).resolves.toContain('<html');
  });

  it('row 12: --out with --ci azure prints the Azure body', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'r.html');

    const result = await cli([fixture, '--out', report, '--ci', 'azure']);
    const summary = await summarizeReport(fixture);

    expect(result).toEqual({
      code: 0,
      stdout: formatCiOutput(summary, 'azure'),
      stderr: '',
    });
    await expect(readFile(report, 'utf8')).resolves.toContain('<html');
  });

  it('row 13: --ci markdown --ci-out writes the file and confirms the report', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'r.html');
    const ciOut = path.join(dir, 'ci.md');

    const result = await cli([
      fixture,
      '--out',
      report,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
    ]);
    const summary = await summarizeReport(fixture);

    expect(result).toEqual({
      code: 0,
      stdout: `Report written to ${report}\n`,
      stderr: '',
    });
    await expect(readFile(ciOut, 'utf8')).resolves.toBe(
      formatCiOutput(summary, 'markdown'),
    );
  });

  it('row 15: --json with an earlier baseline prints the compared summary', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'r.html');
    const baselineFile = await writeBaseline(dir);
    const baseline = await readBaseline(baselineFile);

    const result = await cli([
      fixture,
      '--out',
      report,
      '--json',
      '--baseline',
      baselineFile,
    ]);
    const summary = await summarizeReport(fixture, { baseline });

    expect(result).toEqual({
      code: 0,
      stdout: `${JSON.stringify(summary, null, 2)}\n`,
      stderr: '',
    });
    await expect(readFile(report, 'utf8')).resolves.toContain('<html');
  });

  it('row 17: --json wins over the manifest confirmation', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'r.html');
    const manifest = path.join(dir, 'm.json');

    const result = await cli([
      fixture,
      '--out',
      report,
      '--json',
      '--manifest',
      manifest,
    ]);
    const summary = await summarizeReport(fixture);

    expect(result).toEqual({
      code: 0,
      stdout: `${JSON.stringify(summary, null, 2)}\n`,
      stderr: '',
    });
    expect(result.stdout).not.toContain('Manifest written');
    await expect(readFile(manifest, 'utf8')).resolves.toContain(
      '"schemaVersion": 1',
    );
  });

  it('row 21: a standalone --ci github owns stdout in summary mode', async () => {
    const result = await cli([fixture, '--ci', 'github']);
    const summary = await summarizeReport(fixture);

    expect(result).toEqual({
      code: 0,
      stdout: formatCiOutput(summary, 'github'),
      stderr: '',
    });
  });

  it('row 22: --json with an earlier baseline works without --out', async () => {
    const dir = await tempDir();
    const baselineFile = await writeBaseline(dir);
    const baseline = await readBaseline(baselineFile);

    const result = await cli([fixture, '--json', '--baseline', baselineFile]);
    const summary = await summarizeReport(fixture, { baseline });

    expect(result).toEqual({
      code: 0,
      stdout: `${JSON.stringify(summary, null, 2)}\n`,
      stderr: '',
    });
  });

  it('row 23: summary markdown --ci-out writes the file with no stdout', async () => {
    const dir = await tempDir();
    const ciOut = path.join(dir, 'ci.md');

    const result = await cli([fixture, '--ci', 'markdown', '--ci-out', ciOut]);
    const summary = await summarizeReport(fixture);

    expect(result).toEqual({ code: 0, stdout: '', stderr: '' });
    await expect(readFile(ciOut, 'utf8')).resolves.toBe(
      formatCiOutput(summary, 'markdown'),
    );
  });
});

describe('machine byte API equivalence', () => {
  it('matches summarizeReport for --json', async () => {
    const result = await cli([fixture, '--json']);
    const summary = await summarizeReport(fixture);

    expect(result).toEqual({
      code: 0,
      stdout: `${JSON.stringify(summary, null, 2)}\n`,
      stderr: '',
    });
  });

  it('matches formatCiOutput for stdout and --ci-out markdown', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'r.html');
    const ciOut = path.join(dir, 'ci.md');
    const summary = await summarizeReport(fixture);

    const stdout = await cli([fixture, '--ci', 'markdown', '--title', 'Equiv']);
    expect(stdout).toEqual({
      code: 0,
      stdout: formatCiOutput(summary, 'markdown', { title: 'Equiv' }),
      stderr: '',
    });

    const file = await cli([
      fixture,
      '--out',
      report,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
      '--title',
      'Equiv',
    ]);
    expect(file.code, file.stderr).toBe(0);
    await expect(readFile(ciOut, 'utf8')).resolves.toBe(
      formatCiOutput(summary, 'markdown', { title: 'Equiv' }),
    );
  });

  it('matches buildRunManifest and serializeRunManifest', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'r.html');
    const ciOut = path.join(dir, 'ci.md');
    const manifest = path.join(dir, 'm.json');

    const result = await cli([
      fixture,
      '--out',
      report,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
      '--manifest',
      manifest,
    ]);
    expect(result.code, result.stderr).toBe(0);
    const generated = await generateReport(fixture);
    const expected = serializeRunManifest(
      buildRunManifest(
        generated.summary,
        generated.skippedAttachments,
        [
          { kind: 'report', path: report },
          { kind: 'ci-markdown', path: ciOut },
        ],
        manifest,
      ),
    );

    await expect(readFile(manifest, 'utf8')).resolves.toBe(expected);
  });

  it('keeps history bytes deterministic under a frozen clock', async () => {
    const dirsForRun = [await tempDir(), await tempDir()];
    const histories: string[] = [];

    for (const dir of dirsForRun) {
      const history = path.join(dir, 'history.json');
      const result = await cli([
        fixture,
        '--out',
        path.join(dir, 'report.html'),
        '--history',
        history,
      ]);
      expect(result.code, result.stderr).toBe(0);
      histories.push(await readFile(history, 'utf8'));
    }

    expect(histories[1]).toBe(histories[0]);
  });
});

describe('report, email and PDF API equivalence', () => {
  it('writes the renderReport bytes', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');

    const result = await cli([
      fixture,
      '--out',
      report,
      '--title',
      'Equiv',
      '--meta',
      'a=1',
    ]);
    expect(result.code, result.stderr).toBe(0);

    await expect(readFile(report, 'utf8')).resolves.toBe(
      await renderReport(fixture, {
        title: 'Equiv',
        metadata: { a: '1' },
      }),
    );
  });

  it('writes the renderEmail bytes for a generate run', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const email = path.join(dir, 'email.html');

    const result = await cli([
      fixture,
      '--out',
      report,
      '--email',
      email,
      '--title',
      'Equiv',
      '--locale',
      'en',
      '--accent',
      '#123456',
    ]);
    expect(result.code, result.stderr).toBe(0);
    const summary = await summarizeReport(fixture);

    await expect(readFile(email, 'utf8')).resolves.toBe(
      renderEmail(summary, {
        title: 'Equiv',
        locale: 'en',
        reportName: 'report.html',
        accent: '#123456',
        now: FROZEN,
      }),
    );
  });

  it('writes the renderEmail bytes for a summary run', async () => {
    const dir = await tempDir();
    const email = path.join(dir, 'email.html');

    const result = await cli([fixture, '--email', email, '--locale', 'de']);
    expect(result.code, result.stderr).toBe(0);
    const summary = await summarizeReport(fixture);

    await expect(readFile(email, 'utf8')).resolves.toBe(
      renderEmail(summary, { locale: 'de', now: FROZEN }),
    );
  });

  it('passes the exact CLI HTML and timeout to renderPdf and writes its bytes', async () => {
    const dir = await tempDir();
    const pdfPath = path.join(dir, 'run.pdf');
    const expectedHtml = await renderReport(fixture, { title: 'Pdf' });

    const result = await cli([
      fixture,
      '--pdf',
      pdfPath,
      '--pdf-timeout',
      '1234',
      '--title',
      'Pdf',
    ]);

    expect(result).toEqual({
      code: 0,
      stdout: `PDF written to ${pdfPath}\n`,
      stderr: '',
    });
    expect(pdf.renderPdf).toHaveBeenCalledWith(expectedHtml, {
      timeoutMs: 1234,
    });
    const written = await readFile(pdfPath);
    expect(written.equals(Buffer.from(PDF_BYTES))).toBe(true);
  });
});

describe('file set and determinism', () => {
  async function runAll(dir: string) {
    const report = path.join(dir, 'report.html');
    const pdfPath = path.join(dir, 'run.pdf');
    const email = path.join(dir, 'email.html');
    const history = path.join(dir, 'history.json');
    const ciOut = path.join(dir, 'ci.md');
    const manifest = path.join(dir, 'manifest.json');

    const result = await cli([
      fixture,
      '--out',
      report,
      '--pdf',
      pdfPath,
      '--email',
      email,
      '--history',
      history,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
      '--manifest',
      manifest,
      '--json',
      '--title',
      'Equiv',
    ]);

    return {
      result,
      files: {
        report: await readFile(report),
        pdf: await readFile(pdfPath),
        email: await readFile(email),
        history: await readFile(history),
        ciOut: await readFile(ciOut),
        manifest: await readFile(manifest),
      },
      listing: (await readdir(dir)).sort(),
    };
  }

  it('writes exactly the requested files and the same bytes twice', async () => {
    const firstDir = await tempDir();
    const secondDir = await tempDir();
    const first = await runAll(firstDir);
    const second = await runAll(secondDir);

    expect(first.result.code, first.result.stderr).toBe(0);
    expect(second.result.code, second.result.stderr).toBe(0);
    expect(first.result.stdout).toBe(second.result.stdout);
    expect(first.files.report.equals(second.files.report)).toBe(true);
    expect(first.files.pdf.equals(second.files.pdf)).toBe(true);
    expect(first.files.email.equals(second.files.email)).toBe(true);
    expect(first.files.history.equals(second.files.history)).toBe(true);
    expect(first.files.ciOut.equals(second.files.ciOut)).toBe(true);
    expect(first.files.manifest.equals(second.files.manifest)).toBe(true);
    expect(first.listing).toEqual([
      'ci.md',
      'email.html',
      'history.json',
      'manifest.json',
      'report.html',
      'run.pdf',
    ]);
    expect(first.listing).toEqual(second.listing);
    expect(first.listing.filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it.skipIf(process.platform === 'win32')(
    'creates every artifact with mode 0600 on POSIX',
    async () => {
      const dir = await tempDir();
      const run = await runAll(dir);
      expect(run.result.code, run.result.stderr).toBe(0);

      for (const name of run.listing) {
        const info = await stat(path.join(dir, name));
        expect(info.mode & 0o777, name).toBe(0o600);
      }
    },
  );

  it('keeps completed writes and leaves no temp file when a later write fails', async () => {
    const dir = await tempDir();
    const manifestDir = path.join(dir, 'manifest.json');
    await mkdir(manifestDir);

    const result = await cli([
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
      path.join(dir, 'ci.md'),
      '--manifest',
      manifestDir,
    ]);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Cannot write manifest to');
    for (const name of [
      'report.html',
      'run.pdf',
      'email.html',
      'history.json',
      'ci.md',
    ]) {
      await expect(exists(path.join(dir, name)), name).resolves.toBe(true);
    }
    expect((await stat(manifestDir)).isDirectory()).toBe(true);
    expect(
      (await readdir(dir)).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
  });
});

describe('built CLI from a temporary esbuild bundle', () => {
  let bundle: string;

  beforeAll(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-cli-bundle-'));
    dirs.push(dir);
    bundle = path.join(dir, 'cli.mjs');
    await build({
      entryPoints: [path.join(repoRoot, 'src', 'cli.ts')],
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'esm',
      outfile: bundle,
      logLevel: 'silent',
    });
  }, 120_000);

  function spawnCli(argv: string[]) {
    const result = spawnSync(process.execPath, [bundle, ...argv], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 120_000,
    });
    return {
      code: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  it('returns the pinned bytes and exit codes for --help, --version, --capabilities and bare usage', async () => {
    // The version and capabilities rows change at a release: re-pin both
    // intentionally when the version or the capabilities document changes.
    const rows = [
      [
        ['--help'],
        0,
        'stdout',
        2044,
        '0debb225b3d6e9b98bd966671925f55cd9f574eba65bd35a4b92ef75c6ee4574',
      ],
      [
        ['--version'],
        0,
        'stdout',
        6,
        '87b241b275c591694846560e9879f50c9da3150f854efdabd782c539772f3033',
      ],
      [
        ['--capabilities'],
        0,
        'stdout',
        1318,
        '013d180c59d64916fffdd92643fafae8ff5e478b2e6bb2b599b9d1fc41df647c',
      ],
      [
        [],
        2,
        'stderr',
        2044,
        '0debb225b3d6e9b98bd966671925f55cd9f574eba65bd35a4b92ef75c6ee4574',
      ],
    ] as const;

    for (const [argv, code, stream, bytes, sha] of rows) {
      const spawned = spawnCli([...argv]);
      expect(spawned.code, JSON.stringify(argv)).toBe(code);
      expect(Buffer.byteLength(spawned[stream]), JSON.stringify(argv)).toBe(
        bytes,
      );
      expect(
        createHash('sha256').update(spawned[stream]).digest('hex'),
        JSON.stringify(argv),
      ).toBe(sha);
      expect(
        stream === 'stdout' ? spawned.stderr : spawned.stdout,
        JSON.stringify(argv),
      ).toBe('');
      expect(spawned, JSON.stringify(argv)).toEqual(await cli([...argv]));
    }
  });
});
