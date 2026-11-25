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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/cli.js';
import { renderEmail } from '../src/email.js';
import { summarizeReport } from '../src/index.js';

const fixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const historyFixture = fileURLToPath(
  new URL('./fixtures/history/two-runs.json', import.meta.url),
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
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-cli-email-'));
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
    .replaceAll(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

describe('CLI --email', () => {
  it('writes the report and the email in one run and confirms both', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const email = path.join(dir, 'email.html');

    const result = await run([
      fixture,
      '--out',
      report,
      '--email',
      email,
      '--title',
      'Mail run',
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(
      `Report written to ${report}\nEmail written to ${email}\n`,
    );

    const html = await readFile(email, 'utf8');
    expect(html).toContain('<title>Mail run — Failed</title>');
    expect(html).toContain('<html lang="en" dir="ltr">');
    const text = plainText(html);
    expect(text).toContain('2 scenarios with results');
    expect(text).toContain('report.html');
    expect(text).toContain('Full report');
    expect(text).not.toContain(dir);

    await expect(readFile(report, 'utf8')).resolves.toContain('<html');
  });

  it('writes a standalone summary and states that no report exists', async () => {
    const dir = await tempDir();
    const email = path.join(dir, 'email.html');

    const result = await run([fixture, '--email', email]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(`Email written to ${email}\n`);
    expect(result.stdout).not.toContain('Report written');

    const text = plainText(await readFile(email, 'utf8'));
    expect(text).toContain('No full report is attached.');
    expect(text).not.toContain('--out');
    expect(text).not.toContain('Full report:');
    expect(text).not.toContain(dir);
  });

  it('keeps JSON stdout byte-identical and writes the email in addition', async () => {
    const dir = await tempDir();
    const email = path.join(dir, 'email.html');
    const baseline = await run([fixture, '--json']);
    const withEmail = await run([fixture, '--json', '--email', email]);

    expect(baseline.code, baseline.stderr).toBe(0);
    expect(withEmail.code, withEmail.stderr).toBe(0);
    expect(withEmail.stderr).toBe('');
    expect(withEmail.stdout).toBe(baseline.stdout);
    expect(withEmail.stdout).not.toContain('Email written');
    await expect(stat(email)).resolves.toMatchObject({
      size: expect.any(Number),
    });

    const report = path.join(dir, 'report.html');
    const emailWithOut = path.join(dir, 'email-with-out.html');
    const withReport = await run([
      fixture,
      '--out',
      report,
      '--json',
      '--email',
      emailWithOut,
    ]);
    expect(withReport.code, withReport.stderr).toBe(0);
    expect(withReport.stdout).toBe(baseline.stdout);
    expect(withReport.stdout).not.toContain('Email written');
    await expect(readFile(emailWithOut, 'utf8')).resolves.toContain('<html');
  });

  it('keeps CI stdout byte-identical and writes the email in addition', async () => {
    const dir = await tempDir();
    const email = path.join(dir, 'email.html');
    const baseline = await run([fixture, '--ci', 'markdown']);
    const withEmail = await run([
      fixture,
      '--ci',
      'markdown',
      '--email',
      email,
    ]);

    expect(baseline.code, baseline.stderr).toBe(0);
    expect(withEmail.code, withEmail.stderr).toBe(0);
    expect(withEmail.stdout).toBe(baseline.stdout);
    expect(withEmail.stdout).not.toContain('Email written');
    await expect(readFile(email, 'utf8')).resolves.toContain('<html');
  });

  it('composes with --out, --json, --ci, --ci-out and --history', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const email = path.join(dir, 'email.html');
    const history = path.join(dir, 'history.json');
    const ciOut = path.join(dir, 'summary.md');
    await copyFile(historyFixture, history);

    const result = await run([
      fixture,
      '--out',
      report,
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

    expect(result.code, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).not.toContain('Email written');
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    await expect(readFile(report, 'utf8')).resolves.toContain('<html');
    await expect(readFile(email, 'utf8')).resolves.toContain('report.html');
    await expect(readFile(ciOut, 'utf8')).resolves.toContain('Screenshot');
    const stored = JSON.parse(await readFile(history, 'utf8')) as {
      runs: unknown[];
    };
    expect(stored.runs).toHaveLength(3);
  });

  it('accepts --locale with --email and without --out', async () => {
    const dir = await tempDir();
    const email = path.join(dir, 'email-de.html');
    const englishJson = await run([fixture, '--json']);

    const standalone = await run([fixture, '--email', email, '--locale', 'de']);

    expect(standalone.code, standalone.stderr).toBe(0);
    expect(standalone.stderr).toBe('');
    expect(standalone.stdout).toBe(`Email written to ${email}\n`);
    const text = plainText(await readFile(email, 'utf8'));
    expect(text).toContain('Fehlgeschlagen');
    expect(text).toContain('Szenarien mit Ergebnissen');
    expect(text).not.toContain('Pass rate');
    expect(text).not.toContain('Report written');

    const jsonEmail = path.join(dir, 'email-de-json.html');
    const withJson = await run([
      fixture,
      '--email',
      jsonEmail,
      '--locale',
      'de',
      '--json',
    ]);
    expect(withJson.code, withJson.stderr).toBe(0);
    expect(withJson.stdout).toBe(englishJson.stdout);
    expect(withJson.stdout).not.toContain('Email written');
    await expect(readFile(jsonEmail, 'utf8')).resolves.toContain(
      '<html lang="de"',
    );
  });

  it('keeps --locale a usage error with only --json or --ci', async () => {
    const dir = await tempDir();
    const email = path.join(dir, 'email.html');

    const json = await run([fixture, '--json', '--locale', 'de']);
    expect(json.code).toBe(2);
    expect(json.stdout).toBe('');
    expect(json.stderr).toMatch(/--locale[^\n]*--out/i);

    const ci = await run([fixture, '--ci', 'markdown', '--locale', 'de']);
    expect(ci.code).toBe(2);
    expect(ci.stdout).toBe('');
    expect(ci.stderr).toMatch(/--locale[^\n]*--out/i);

    await expect(stat(email)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects an unsupported locale and writes no email', async () => {
    const dir = await tempDir();
    const email = path.join(dir, 'email.html');

    const result = await run([fixture, '--email', email, '--locale', 'fr']);

    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/\bfr\b/);
    expect(result.stderr).toMatch(/\ben\b/);
    expect(result.stderr).toMatch(/\bde\b/);
    await expect(stat(email)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects an empty --email path and writes nothing', async () => {
    const dir = await tempDir();

    const result = await run([fixture, '--email', '']);

    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/--email[^\n]*file path/i);
    expect(await readdir(dir)).toEqual([]);
  });

  it('requires at least one input', async () => {
    const dir = await tempDir();
    const email = path.join(dir, 'email.html');

    const result = await run(['--email', email]);

    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    await expect(stat(email)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects collisions with an input, the logo, --out, --ci-out and --history', async () => {
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
    const controlEmail = path.join(dir, 'control-email.html');
    const controlReport = path.join(dir, 'control-report.html');

    const control = await run([
      input,
      '--out',
      controlReport,
      '--email',
      controlEmail,
      '--logo',
      logo,
    ]);
    expect(control.code, control.stderr).toBe(0);

    const asInput = await run([input, '--out', report, '--email', input]);
    expect(asInput.code, asInput.stderr).toBe(2);
    await expect(readFile(input, 'utf8')).resolves.toBe(inputBefore);

    const asLogo = await run([
      input,
      '--out',
      report,
      '--logo',
      logo,
      '--email',
      logo,
    ]);
    expect(asLogo.code, asLogo.stderr).toBe(2);
    await expect(readFile(logo)).resolves.toEqual(logoBefore);

    const asOutput = await run([input, '--out', report, '--email', report]);
    expect(asOutput.code, asOutput.stderr).toBe(2);

    const asCiOut = await run([
      input,
      '--out',
      report,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
      '--email',
      ciOut,
    ]);
    expect(asCiOut.code, asCiOut.stderr).toBe(2);

    const asHistory = await run([
      input,
      '--out',
      report,
      '--history',
      history,
      '--email',
      history,
    ]);
    expect(asHistory.code, asHistory.stderr).toBe(2);

    for (const file of [report, ciOut, history]) {
      await expect(stat(file), file).rejects.toMatchObject({ code: 'ENOENT' });
    }
    await expect(readFile(controlEmail, 'utf8')).resolves.toContain('<html');
  });

  it('rejects an email at or inside an input directory and writes nothing', async () => {
    const dir = await tempDir();
    const inputDir = path.join(dir, 'results');
    await mkdir(inputDir);
    await copyFile(fixture, path.join(inputDir, 'run.ndjson'));
    const report = path.join(dir, 'report.html');

    for (const email of [inputDir, path.join(inputDir, 'email.html')]) {
      const result = await run([inputDir, '--out', report, '--email', email]);

      expect(result.code, result.stderr).toBe(2);
      expect(result.stderr).toMatch(/--email[^\n]*input/i);
      expect(result.stdout).toBe('');
      expect(await readdir(inputDir)).toEqual(['run.ndjson']);
      await expect(stat(report)).rejects.toMatchObject({ code: 'ENOENT' });
    }
  });

  it('rejects an email through a symlinked input directory', async () => {
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

    const result = await run([
      inputDir,
      '--email',
      path.join(link, 'email.html'),
    ]);

    expect(result.code, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/--email[^\n]*input/i);
    await expect(stat(path.join(inputDir, 'email.html'))).rejects.toMatchObject(
      {
        code: 'ENOENT',
      },
    );
  });

  // Only these platforms fold path case; Linux treats the names as different.
  it.skipIf(!['win32', 'darwin'].includes(process.platform))(
    'rejects a case-variant --email collision with --out',
    async () => {
      const dir = await tempDir();
      const input = path.join(dir, 'input.ndjson');
      await copyFile(fixture, input);

      const result = await run([
        input,
        '--out',
        path.join(dir, 'Report.HTML'),
        '--email',
        path.join(dir, 'report.html'),
      ]);

      expect(result.code, result.stderr).toBe(2);
      await expect(stat(path.join(dir, 'report.html'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    },
  );

  it('fails on an email write error, keeps the report and skips later outputs', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const emailTarget = path.join(dir, 'email-target.html');
    await mkdir(emailTarget);
    const history = path.join(dir, 'history.json');
    await copyFile(historyFixture, history);
    const historyBefore = await readFile(history, 'utf8');
    const ciOut = path.join(dir, 'summary.md');

    const result = await run([
      fixture,
      '--out',
      report,
      '--email',
      emailTarget,
      '--history',
      history,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
      '--json',
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(emailTarget);
    expect(result.stderr).not.toContain('.tmp');
    expect(result.stdout).toBe('');

    await expect(readFile(report, 'utf8')).resolves.toContain('<html');
    await expect(readFile(history, 'utf8')).resolves.toBe(historyBefore);
    await expect(stat(ciOut)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(
      (await readdir(dir)).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
  });

  it('fails without --out and writes no stdout, --ci-out or temp file', async () => {
    const dir = await tempDir();
    const emailTarget = path.join(dir, 'email-target.html');
    await mkdir(emailTarget);
    const ciOut = path.join(dir, 'summary.md');

    const result = await run([
      fixture,
      '--email',
      emailTarget,
      '--json',
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
    ]);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(emailTarget);
    expect(result.stderr).not.toContain('.tmp');
    await expect(stat(ciOut)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(
      (await readdir(dir)).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
    expect(await readdir(dir)).toEqual(['email-target.html']);
  });

  it('applies --accent to the standalone email', async () => {
    const dir = await tempDir();
    const email = path.join(dir, 'email.html');

    const result = await run([
      fixture,
      '--email',
      email,
      '--accent',
      '#123456',
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(await readFile(email, 'utf8')).toMatch(/border[^;"']*#123456/i);
  });

  it('confirms the standalone email when --ci-out frees stdout', async () => {
    const dir = await tempDir();
    const email = path.join(dir, 'email.html');
    const ciOut = path.join(dir, 'summary.md');

    const result = await run([
      fixture,
      '--email',
      email,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toBe(`Email written to ${email}\n`);
    await expect(readFile(ciOut, 'utf8')).resolves.toContain('Screenshot');
  });

  it.skipIf(process.platform === 'win32')(
    'keeps the email confirmation on one line',
    async () => {
      const dir = await tempDir();
      const email = path.join(dir, 'email\nspoof.html');

      const result = await run([fixture, '--email', email]);

      expect(result.code, result.stderr).toBe(0);
      expect(result.stdout).toBe(
        `Email written to ${email.replaceAll('\n', ' ')}\n`,
      );
    },
  );

  it('leaves the directory untouched without --email', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');

    const result = await run([fixture, '--out', report]);

    expect(result.code, result.stderr).toBe(0);
    expect(await readdir(dir)).toEqual(['report.html']);
    expect(result.stdout).toBe(`Report written to ${report}\n`);
  });

  it('keeps the report bytes unchanged when an email is written too', async () => {
    const dir = await tempDir();
    const plainReport = path.join(dir, 'plain.html');
    const emailReport = path.join(dir, 'with-email.html');
    const email = path.join(dir, 'email.html');

    const plain = await run([
      fixture,
      '--out',
      plainReport,
      '--title',
      'Same run',
    ]);
    const withEmail = await run([
      fixture,
      '--out',
      emailReport,
      '--email',
      email,
      '--title',
      'Same run',
    ]);

    expect(plain.code, plain.stderr).toBe(0);
    expect(withEmail.code, withEmail.stderr).toBe(0);
    expect(await readFile(emailReport, 'utf8')).toBe(
      await readFile(plainReport, 'utf8'),
    );
  });

  it('confirms the email alongside the report when --ci-out frees stdout', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const email = path.join(dir, 'email.html');
    const ciOut = path.join(dir, 'summary.md');

    const result = await run([
      fixture,
      '--out',
      report,
      '--email',
      email,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain(`Report written to ${report}`);
    expect(result.stdout).toContain(`Email written to ${email}`);
    expect(result.stdout.indexOf('Report written')).toBeLessThan(
      result.stdout.indexOf('Email written'),
    );
    await expect(readFile(ciOut, 'utf8')).resolves.toContain('Screenshot');
  });

  it('matches renderEmail exactly with a pinned clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T09:30:00.000Z'));

    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const email = path.join(dir, 'email.html');

    const result = await run([
      fixture,
      '--out',
      report,
      '--email',
      email,
      '--title',
      'Parity',
      '--locale',
      'de',
      '--accent',
      '#123456',
    ]);

    expect(result.code, result.stderr).toBe(0);
    const summary = await summarizeReport(fixture);
    const expected = renderEmail(summary, {
      title: 'Parity',
      locale: 'de',
      reportName: path.basename(report),
      accent: '#123456',
      now: new Date('2026-11-20T09:30:00.000Z'),
    });
    expect(await readFile(email, 'utf8')).toBe(expected);
  });

  it('creates the email parent directory', async () => {
    const dir = await tempDir();
    const email = path.join(dir, 'nested', 'deep', 'email.html');

    const result = await run([fixture, '--email', email]);

    expect(result.code, result.stderr).toBe(0);
    await expect(readFile(email, 'utf8')).resolves.toContain('<html');
  });

  it('documents --email in the help and the output requirement', async () => {
    const result = await run(['--help']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('--email <file>');
    expect(result.stdout).toContain(
      'At least one of --out, --pdf, --json, --ci or --email is required',
    );
    const titleLine = result.stdout
      .split('\n')
      .find((line) => line.includes('--title'));
    expect(titleLine).toMatch(/email/i);
  });
});
