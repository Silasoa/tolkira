import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../src/i18n/catalogs.js';

// The CLI tests never launch a browser: the PDF module is replaced here.
const pdf = vi.hoisted(() => ({ renderPdf: vi.fn() }));
vi.mock('../src/pdf.js', () => ({ renderPdf: pdf.renderPdf }));

import { runCli } from '../src/cli.js';

const fixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const historyFixture = fileURLToPath(
  new URL('./fixtures/history/two-runs.json', import.meta.url),
);

// A 1x1 transparent PNG: the smallest logo that passes the data-URI check.
const LOGO =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// Deliberately not valid UTF-8: the PDF must be written byte for byte.
const PDF_BYTES = Buffer.from([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xff, 0xfe,
  0x00, 0x01, 0x80, 0x7f,
]);

const INSTALL_GUIDANCE =
  'PDF output needs the optional Playwright Chromium engine.\n' +
  'In your project: npm i -D playwright-core@^1.65.0\n' +
  'Then: npx playwright-core install chromium-headless-shell\n' +
  'A project-local Tolkira install is recommended. Or omit --pdf.';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

beforeEach(() => {
  pdf.renderPdf.mockReset().mockResolvedValue(Buffer.from(PDF_BYTES));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-cli-pdf-'));
  dirs.push(dir);
  return dir;
}

async function run(argv: string[]) {
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

function plainText(html: string): string {
  return html
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    () => true,
    () => false,
  );
}

function mockHtml(): string {
  const call = pdf.renderPdf.mock.calls[0] as unknown[] | undefined;
  const html = call?.[0];
  expect(typeof html).toBe('string');
  return html as string;
}

describe('CLI --pdf', () => {
  it('writes a PDF as the only output without writing a report file', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'run.pdf');

    const result = await run([fixture, '--pdf', output, '--title', 'Pdf run']);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(`PDF written to ${output}\n`);
    expect(await readdir(dir)).toEqual(['run.pdf']);
    expect((await readFile(output)).equals(PDF_BYTES)).toBe(true);
    expect(mockHtml()).toContain('<html');
    expect(mockHtml()).toContain('Pdf run');
  });

  it('writes report, PDF, email, history and --ci-out in order', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'input.ndjson');
    await copyFile(fixture, input);
    const report = path.join(dir, 'report.html');
    const output = path.join(dir, 'run.pdf');
    const email = path.join(dir, 'email.html');
    const history = path.join(dir, 'history.json');
    const ciOut = path.join(dir, 'summary.md');
    await copyFile(historyFixture, history);
    const historyBefore = await readFile(history, 'utf8');

    let seen:
      | { report: boolean; email: boolean; ciOut: boolean; history: string }
      | undefined;
    pdf.renderPdf.mockImplementation(async () => {
      seen = {
        report: await exists(report),
        email: await exists(email),
        ciOut: await exists(ciOut),
        history: await readFile(history, 'utf8'),
      };
      return Buffer.from(PDF_BYTES);
    });

    const result = await run([
      input,
      '--out',
      report,
      '--pdf',
      output,
      '--email',
      email,
      '--history',
      history,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(seen).toEqual({
      report: true,
      email: false,
      ciOut: false,
      history: historyBefore,
    });

    const views = result.stdout.split('\n');
    const reportLine = views.findIndex((line) =>
      line.startsWith('Report written'),
    );
    const pdfLine = views.findIndex((line) => line.startsWith('PDF written'));
    const emailLine = views.findIndex((line) =>
      line.startsWith('Email written'),
    );
    expect(reportLine).toBeGreaterThanOrEqual(0);
    expect(pdfLine).toBeGreaterThan(reportLine);
    expect(emailLine).toBeGreaterThan(pdfLine);

    await expect(readFile(report, 'utf8')).resolves.toContain('<html');
    expect((await readFile(output)).equals(PDF_BYTES)).toBe(true);
    await expect(readFile(email, 'utf8')).resolves.toContain('<html');
    await expect(readFile(ciOut, 'utf8')).resolves.toContain('Screenshot');
    const stored = JSON.parse(await readFile(history, 'utf8')) as {
      runs: unknown[];
    };
    expect(stored.runs).toHaveLength(3);
  });

  it('keeps JSON stdout byte-identical and writes the PDF', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'run.pdf');
    const baseline = await run([fixture, '--json']);

    const withPdf = await run([fixture, '--json', '--pdf', output]);

    expect(baseline.code, baseline.stderr).toBe(0);
    expect(withPdf.code, withPdf.stderr).toBe(0);
    expect(withPdf.stderr).toBe('');
    expect(withPdf.stdout).toBe(baseline.stdout);
    expect(withPdf.stdout).not.toContain('PDF written');
    expect((await readFile(output)).equals(PDF_BYTES)).toBe(true);
  });

  it('keeps CI stdout byte-identical and writes the PDF', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'run.pdf');
    const baseline = await run([fixture, '--ci', 'markdown']);

    const withPdf = await run([
      fixture,
      '--ci',
      'markdown',
      '--pdf',
      output,
    ]);

    expect(baseline.code, baseline.stderr).toBe(0);
    expect(withPdf.code, withPdf.stderr).toBe(0);
    expect(withPdf.stderr).toBe('');
    expect(withPdf.stdout).toBe(baseline.stdout);
    expect(withPdf.stdout).not.toContain('PDF written');
    await expect(stat(output)).resolves.toMatchObject({
      size: expect.any(Number),
    });
  });

  it('keeps the report bytes unchanged when a PDF is written too', async () => {
    const dir = await tempDir();
    const plainReport = path.join(dir, 'plain.html');
    const pdfReport = path.join(dir, 'with-pdf.html');

    const plain = await run([
      fixture,
      '--out',
      plainReport,
      '--title',
      'Same run',
    ]);
    const withPdf = await run([
      fixture,
      '--out',
      pdfReport,
      '--pdf',
      path.join(dir, 'run.pdf'),
      '--title',
      'Same run',
    ]);

    expect(plain.code, plain.stderr).toBe(0);
    expect(withPdf.code, withPdf.stderr).toBe(0);
    expect(await readFile(pdfReport, 'utf8')).toBe(
      await readFile(plainReport, 'utf8'),
    );
  });

  it('fails on a PDF error, keeps the report and skips every later output', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const output = path.join(dir, 'run.pdf');
    const email = path.join(dir, 'email.html');
    const history = path.join(dir, 'history.json');
    const ciOut = path.join(dir, 'summary.md');
    await copyFile(historyFixture, history);
    const historyBefore = await readFile(history, 'utf8');
    pdf.renderPdf.mockRejectedValue(new Error('render failed'));

    const result = await run([
      fixture,
      '--out',
      report,
      '--pdf',
      output,
      '--email',
      email,
      '--history',
      history,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
      '--json',
    ]);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(output);
    expect(result.stderr).toContain('render failed');
    await expect(readFile(report, 'utf8')).resolves.toContain('<html');
    await expect(stat(output)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(email)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(ciOut)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(history, 'utf8')).resolves.toBe(historyBefore);
    expect(
      (await readdir(dir)).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
  });

  it('exits 1 with install guidance when the engine is missing', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const output = path.join(dir, 'run.pdf');
    const email = path.join(dir, 'email.html');
    pdf.renderPdf.mockRejectedValue(new Error(INSTALL_GUIDANCE));

    const result = await run([
      fixture,
      '--out',
      report,
      '--pdf',
      output,
      '--email',
      email,
    ]);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(output);
    expect(result.stderr).toMatch(/optional Playwright Chromium engine/i);
    expect(result.stderr).toMatch(/npm i(?:nstall)? -D playwright/);
    expect(result.stderr).toMatch(
      /playwright-core install chromium-headless-shell/,
    );
    await expect(readFile(report, 'utf8')).resolves.toContain('<html');
    await expect(stat(output)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(email)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects an empty --pdf path and writes nothing', async () => {
    const dir = await tempDir();

    const result = await run([fixture, '--pdf', '']);

    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/--pdf[^\n]*file path/i);
    expect(await readdir(dir)).toEqual([]);
  });

  it('requires at least one input', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'run.pdf');

    const result = await run(['--pdf', output]);

    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).not.toMatch(/Unknown option/i);
    await expect(stat(output)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects collisions with an input, the logo, --out, --ci-out, --history and --email', async () => {
    const dir = await tempDir();
    const input = path.join(dir, 'input.ndjson');
    await copyFile(fixture, input);
    const inputBefore = await readFile(input, 'utf8');
    const logo = path.join(dir, 'logo.png');
    await writeFile(logo, Buffer.from(LOGO, 'base64'));
    const logoBefore = await readFile(logo);
    const report = path.join(dir, 'report.html');
    const ciOut = path.join(dir, 'summary.md');
    const history = path.join(dir, 'history.json');
    await copyFile(historyFixture, history);
    const historyBefore = await readFile(history, 'utf8');
    const email = path.join(dir, 'email.html');

    const asInput = await run([input, '--pdf', input]);
    expect(asInput.code, asInput.stderr).toBe(2);
    expect(asInput.stderr).toContain('--pdf');
    expect(asInput.stderr).toMatch(/input/i);
    await expect(readFile(input, 'utf8')).resolves.toBe(inputBefore);

    const asLogo = await run([
      input,
      '--out',
      report,
      '--logo',
      logo,
      '--pdf',
      logo,
    ]);
    expect(asLogo.code, asLogo.stderr).toBe(2);
    expect(asLogo.stderr).toContain('--pdf');
    expect(asLogo.stderr).toMatch(/logo/i);
    await expect(readFile(logo)).resolves.toEqual(logoBefore);

    const asOutput = await run([input, '--out', report, '--pdf', report]);
    expect(asOutput.code, asOutput.stderr).toBe(2);
    expect(asOutput.stderr).toMatch(/--pdf[^\n]*--out|--out[^\n]*--pdf/i);

    const asCiOut = await run([
      input,
      '--out',
      report,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
      '--pdf',
      ciOut,
    ]);
    expect(asCiOut.code, asCiOut.stderr).toBe(2);
    expect(asCiOut.stderr).toMatch(/--pdf[^\n]*--ci-out|--ci-out[^\n]*--pdf/i);

    const asHistory = await run([
      input,
      '--out',
      report,
      '--history',
      history,
      '--pdf',
      history,
    ]);
    expect(asHistory.code, asHistory.stderr).toBe(2);
    expect(asHistory.stderr).toMatch(/--pdf[^\n]*--history|--history[^\n]*--pdf/i);

    const asEmail = await run([
      input,
      '--out',
      report,
      '--email',
      email,
      '--pdf',
      email,
    ]);
    expect(asEmail.code, asEmail.stderr).toBe(2);
    expect(asEmail.stderr).toMatch(/--pdf[^\n]*--email|--email[^\n]*--pdf/i);

    for (const file of [report, ciOut, email]) {
      await expect(stat(file), file).rejects.toMatchObject({ code: 'ENOENT' });
    }
    await expect(readFile(history, 'utf8')).resolves.toBe(historyBefore);
  });

  it('rejects a PDF at or inside an input directory and writes nothing', async () => {
    const dir = await tempDir();
    const inputDir = path.join(dir, 'results');
    await mkdir(inputDir);
    await copyFile(fixture, path.join(inputDir, 'run.ndjson'));
    const report = path.join(dir, 'report.html');

    for (const output of [
      inputDir,
      path.join(inputDir, 'run.pdf'),
      path.join(inputDir, 'nested', 'run.pdf'),
    ]) {
      const result = await run([inputDir, '--out', report, '--pdf', output]);

      expect(result.code, output).toBe(2);
      expect(result.stderr, output).toMatch(/--pdf[^\n]*input/i);
      expect(result.stdout).toBe('');
      expect(await readdir(inputDir)).toEqual(['run.ndjson']);
      await expect(stat(report)).rejects.toMatchObject({ code: 'ENOENT' });
    }
  });

  it('rejects a PDF through a symlinked input directory', async () => {
    const dir = await tempDir();
    const inputDir = path.join(dir, 'results');
    await mkdir(inputDir);
    await copyFile(fixture, path.join(inputDir, 'run.ndjson'));
    const link = path.join(dir, 'linked-results');
    try {
      await symlink(
        inputDir,
        link,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch (error) {
      // Some Windows hosts cannot create junctions without extra privileges.
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EPERM' || code === 'EACCES') return;
      throw error;
    }

    const result = await run([inputDir, '--pdf', path.join(link, 'run.pdf')]);

    expect(result.code, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/--pdf[^\n]*input/i);
    await expect(
      stat(path.join(inputDir, 'run.pdf')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  // Only these platforms fold path case; Linux treats the names as different.
  it.skipIf(!['win32', 'darwin'].includes(process.platform))(
    'rejects a case-variant PDF collision with --out',
    async () => {
      const dir = await tempDir();
      const input = path.join(dir, 'input.ndjson');
      await copyFile(fixture, input);

      const result = await run([
        input,
        '--out',
        path.join(dir, 'Report.PDF'),
        '--pdf',
        path.join(dir, 'report.pdf'),
      ]);

      expect(result.code, result.stderr).toBe(2);
      expect(result.stderr).not.toMatch(/Unknown option/i);
      expect(result.stderr).toContain('--pdf');
      await expect(
        stat(path.join(dir, 'report.pdf')),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    },
  );

  it('fails on a directory PDF path, keeps the report and leaves no temp file', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const output = path.join(dir, 'run.pdf');
    await mkdir(output);

    const result = await run([fixture, '--out', report, '--pdf', output]);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(output);
    expect(result.stderr).not.toContain('.tmp');
    await expect(readFile(report, 'utf8')).resolves.toContain('<html');
    expect(
      (await readdir(dir)).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
    expect((await stat(output)).isDirectory()).toBe(true);
  });

  it('writes the engine bytes unchanged', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'run.pdf');

    const result = await run([fixture, '--pdf', output]);

    expect(result.code, result.stderr).toBe(0);
    const written = await readFile(output);
    expect(written.equals(PDF_BYTES)).toBe(true);
    expect(written.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('accepts --locale with --pdf and without --out', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'run.pdf');
    const baseline = await run([fixture, '--json']);

    const result = await run([fixture, '--pdf', output, '--locale', 'de']);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(`PDF written to ${output}\n`);
    expect(mockHtml()).toContain('<html lang="de"');
    expect(mockHtml()).toContain('Fehlgeschlagen');
    expect(await readdir(dir)).toEqual(['run.pdf']);

    const withJson = await run([
      fixture,
      '--pdf',
      output,
      '--locale',
      'de',
      '--json',
    ]);
    expect(withJson.code, withJson.stderr).toBe(0);
    expect(withJson.stdout).toBe(baseline.stdout);
  });

  it('adds no PDF-specific catalog key', () => {
    expect(Object.keys(en).filter((key) => /pdf/i.test(key))).toEqual([]);
  });

  it('rejects --logo and --history with --pdf but no --out', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'run.pdf');
    const logo = path.join(dir, 'logo.png');
    await writeFile(logo, Buffer.from(LOGO, 'base64'));
    const history = path.join(dir, 'history.json');
    await copyFile(historyFixture, history);

    const withLogo = await run([
      fixture,
      '--pdf',
      output,
      '--logo',
      logo,
    ]);
    expect(withLogo.code, withLogo.stderr).toBe(2);
    expect(withLogo.stderr).not.toMatch(/Unknown option/i);
    expect(withLogo.stderr).toMatch(/--logo[^\n]*--out/i);
    await expect(stat(output)).rejects.toMatchObject({ code: 'ENOENT' });

    const withHistory = await run([
      fixture,
      '--pdf',
      output,
      '--history',
      history,
    ]);
    expect(withHistory.code, withHistory.stderr).toBe(2);
    expect(withHistory.stderr).not.toMatch(/Unknown option/i);
    expect(withHistory.stderr).toMatch(/--history[^\n]*--out/i);
    await expect(stat(output)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('names the report in the email with --out and the PDF without it', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const output = path.join(dir, 'run.pdf');
    const emailWithReport = path.join(dir, 'email-with-report.html');

    const withReport = await run([
      fixture,
      '--out',
      report,
      '--pdf',
      output,
      '--email',
      emailWithReport,
    ]);

    expect(withReport.code, withReport.stderr).toBe(0);
    const reportMail = plainText(await readFile(emailWithReport, 'utf8'));
    expect(reportMail).toContain('report.html');
    expect(reportMail).not.toContain('run.pdf');

    const pdfDir = await tempDir();
    const pdfOnly = path.join(pdfDir, 'run.pdf');
    const emailOnly = path.join(pdfDir, 'email-pdf-only.html');
    let emailAtPdfTime: boolean | undefined;
    pdf.renderPdf.mockImplementation(async () => {
      emailAtPdfTime = await exists(emailOnly);
      return Buffer.from(PDF_BYTES);
    });

    const withPdfOnly = await run([
      fixture,
      '--pdf',
      pdfOnly,
      '--email',
      emailOnly,
    ]);

    expect(withPdfOnly.code, withPdfOnly.stderr).toBe(0);
    expect(withPdfOnly.stdout).toBe(
      `PDF written to ${pdfOnly}\nEmail written to ${emailOnly}\n`,
    );
    expect(emailAtPdfTime).toBe(false);
    const pdfMail = plainText(await readFile(emailOnly, 'utf8'));
    expect(pdfMail).toContain('run.pdf');
    expect(pdfMail).not.toContain('report.html');
    expect((await readdir(pdfDir)).sort()).toEqual([
      'email-pdf-only.html',
      'run.pdf',
    ]);
  });

  it('passes --pdf-timeout to the engine and accepts the integer bounds', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'run.pdf');

    const result = await run([
      fixture,
      '--pdf',
      output,
      '--pdf-timeout',
      '120000',
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(pdf.renderPdf).toHaveBeenCalledWith(expect.stringContaining('<html'), {
      timeoutMs: 120_000,
    });

    const max = await run([
      fixture,
      '--pdf',
      path.join(dir, 'max.pdf'),
      '--pdf-timeout',
      '2147483647',
    ]);
    expect(max.code, max.stderr).toBe(0);
    expect(pdf.renderPdf).toHaveBeenLastCalledWith(
      expect.stringContaining('<html'),
      { timeoutMs: 2_147_483_647 },
    );
  });

  it('rejects invalid --pdf-timeout values without writing a PDF', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'run.pdf');

    for (const value of [
      '0',
      '-5',
      'abc',
      '0300',
      '2147483648',
      '1.5',
      '+5',
    ]) {
      const result = await run([
        fixture,
        '--pdf',
        output,
        '--pdf-timeout',
        value,
      ]);

      expect(result.code, value).toBe(2);
      expect(result.stdout, value).toBe('');
      expect(result.stderr, value).toMatch(
        /Invalid --pdf-timeout|argument is ambiguous/i,
      );
      await expect(stat(output), value).rejects.toMatchObject({
        code: 'ENOENT',
      });
    }
    expect(pdf.renderPdf).not.toHaveBeenCalled();
  });

  it('rejects --pdf-timeout without --pdf', async () => {
    const dir = await tempDir();

    const result = await run([
      fixture,
      '--out',
      path.join(dir, 'report.html'),
      '--pdf-timeout',
      '1000',
    ]);

    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/--pdf-timeout[^\n]*--pdf/i);
    expect(pdf.renderPdf).not.toHaveBeenCalled();
  });

  it('warns about the size threshold on a PDF-only run', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'run.pdf');

    const result = await run([
      fixture,
      '--pdf',
      output,
      '--max-size',
      '0.001',
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toBe(`PDF written to ${output}\n`);
    expect(result.stderr).toContain('report HTML is');
    expect(result.stderr).toContain('inflate the HTML and the PDF');
  });

  it('keeps a raw render error on one line and caps it at 500 characters', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'run.pdf');
    pdf.renderPdf.mockRejectedValue(
      new Error(`${'x'.repeat(600)}\nC:\\Users\\secret\\chrome.exe`),
    );

    const result = await run([fixture, '--pdf', output]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(output);
    expect(result.stderr.split('\n')[0]).toMatch(/x{500}$/);
    expect(result.stderr).not.toContain('secret');
    expect(result.stderr).not.toContain('chrome.exe');
  });

  it('documents --pdf and --pdf-timeout in the help and the output requirement', async () => {
    const result = await run(['--help']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('--pdf <file>');
    expect(result.stdout).toContain('--pdf-timeout <ms>');
    expect(result.stdout).toMatch(
      /At least one of --out, --pdf, --json, --ci or --email is required/,
    );
  });
});
