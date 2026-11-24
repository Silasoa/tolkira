import {
  copyFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../src/i18n/catalogs.js';
import type { RenderReportOptions } from '../src/options.js';

// The CLI tests never launch a browser: the PDF module is replaced here.
const pdf = vi.hoisted(() => ({ renderPdf: vi.fn() }));
vi.mock('../src/pdf.js', () => ({ renderPdf: pdf.renderPdf }));

import { runCli } from '../src/cli.js';
import { generateReport, renderReport } from '../src/index.js';

const fixture = fileURLToPath(
  new URL('./fixtures/messages/screenshot.ndjson', import.meta.url),
);
const historyFixture = fileURLToPath(
  new URL('./fixtures/history/two-runs.json', import.meta.url),
);

// Deliberately not valid UTF-8: the PDF must be written byte for byte.
const PDF_BYTES = Buffer.from([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xff, 0xfe,
  0x00, 0x01, 0x80, 0x7f,
]);

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
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-cli-static-'));
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

function mockHtml(): string {
  const call = pdf.renderPdf.mock.calls[0] as unknown[] | undefined;
  const html = call?.[0];
  expect(typeof html).toBe('string');
  return html as string;
}

function tagWithId(html: string, id: string): string {
  const index = html.indexOf(`id="${id}"`);
  expect(index, `#${id}`).toBeGreaterThan(-1);
  const start = html.lastIndexOf('<', index);
  return html.slice(start, html.indexOf('>', index) + 1);
}

function hasScript(html: string): boolean {
  return /<script\b/i.test(html);
}

describe('CLI --static', () => {
  it('lists --static in the help', async () => {
    const result = await run(['--help']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('--static');
    expect(result.stdout).not.toMatch(/Unknown option/i);
  });

  it('writes a script-free report with --out', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');

    const result = await run([fixture, '--static', '--out', report]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(`Report written to ${report}\n`);
    const html = await readFile(report, 'utf8');
    expect(hasScript(html), 'no <script>').toBe(false);
    expect(html).toContain('id="report-view"');
    expect(html).not.toContain('class="views"');
    expect(html.match(/<main\b/g) ?? []).toHaveLength(1);
  });

  it('rejects --static without --out or --pdf and writes nothing', async () => {
    const dir = await tempDir();
    const cases: string[][] = [
      ['--json'],
      ['--ci', 'markdown'],
      ['--email', path.join(dir, 'email.html')],
    ];

    for (const extra of cases) {
      const result = await run([fixture, '--static', ...extra]);
      const firstLine = result.stderr.split('\n')[0] ?? '';

      expect(result.code, extra.join(' ')).toBe(2);
      expect(result.stdout, extra.join(' ')).toBe('');
      expect(firstLine, extra.join(' ')).toBe(
        'tolkira: --static requires --out or --pdf',
      );
      expect(firstLine, extra.join(' ')).not.toMatch(/Unknown option/i);
    }

    // A bare --static is the same usage error; it names no surface today.
    const bare = await run([fixture, '--static']);
    expect(bare.code).toBe(2);
    expect(bare.stdout).toBe('');
    expect(await readdir(dir)).toEqual([]);
    expect(pdf.renderPdf).not.toHaveBeenCalled();
  });

  it('keeps JSON and CI stdout byte-identical with a report surface', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const jsonBaseline = await run([fixture, '--json']);
    const jsonStatic = await run([
      fixture,
      '--static',
      '--out',
      report,
      '--json',
    ]);

    expect(jsonBaseline.code, jsonBaseline.stderr).toBe(0);
    expect(jsonStatic.code, jsonStatic.stderr).toBe(0);
    expect(jsonStatic.stdout).toBe(jsonBaseline.stdout);
    expect(hasScript(await readFile(report, 'utf8')), 'no <script>').toBe(
      false,
    );

    const ciBaseline = await run([fixture, '--ci', 'markdown']);
    const ciStatic = await run([
      fixture,
      '--static',
      '--out',
      report,
      '--ci',
      'markdown',
    ]);

    expect(ciBaseline.code, ciBaseline.stderr).toBe(0);
    expect(ciStatic.code, ciStatic.stderr).toBe(0);
    expect(ciStatic.stdout).toBe(ciBaseline.stdout);
  });

  it('writes the email summary alongside a static report', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const email = path.join(dir, 'email.html');

    const result = await run([
      fixture,
      '--static',
      '--out',
      report,
      '--email',
      email,
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(hasScript(await readFile(report, 'utf8')), 'no <script>').toBe(
      false,
    );
    await expect(readFile(email, 'utf8')).resolves.toContain('<html');
  });

  it('renders --static --pdf from a script-free source', async () => {
    const dir = await tempDir();
    const output = path.join(dir, 'run.pdf');

    const result = await run([fixture, '--static', '--pdf', output]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toBe(`PDF written to ${output}\n`);
    expect(await readdir(dir)).toEqual(['run.pdf']);
    expect((await readFile(output)).equals(PDF_BYTES)).toBe(true);
    const html = mockHtml();
    expect(hasScript(html), 'no <script>').toBe(false);
    expect(html).toContain('id="analysis-view"');
    expect(html).not.toContain('id="trends-view"');
  });

  it('includes Details and Trends in the static PDF source with history', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const output = path.join(dir, 'run.pdf');
    const history = path.join(dir, 'history.json');
    await copyFile(historyFixture, history);

    const result = await run([
      fixture,
      '--static',
      '--out',
      report,
      '--pdf',
      output,
      '--history',
      history,
    ]);

    expect(result.code, result.stderr).toBe(0);
    const html = mockHtml();
    expect(hasScript(html), 'no <script>').toBe(false);
    expect(html).toContain('id="analysis-view"');
    expect(html).toContain('id="trends-view"');
    expect(html).toContain(en['details.title']);
    expect(html).toContain(en['trends.recordedRuns']);
    for (const id of ['analysis-view', 'trends-view']) {
      expect(tagWithId(html, id), id).not.toContain('hidden');
    }
    expect((await stat(output)).size).toBe(PDF_BYTES.length);
  });

  it('stacks a German static report with Trends from --history', async () => {
    const dir = await tempDir();
    const report = path.join(dir, 'report.html');
    const history = path.join(dir, 'history.json');
    await copyFile(historyFixture, history);

    // `--static --baseline` is owned by the baseline change; this pins the
    // composition with the only sidecar that exists today.
    const result = await run([
      fixture,
      '--static',
      '--out',
      report,
      '--history',
      history,
      '--locale',
      'de',
    ]);

    expect(result.code, result.stderr).toBe(0);
    const html = await readFile(report, 'utf8');
    expect(hasScript(html), 'no <script>').toBe(false);
    expect(html).toContain('<html lang="de"');
    expect(html).toContain('Laufdetails');
    expect(html).toContain('Aufgezeichnete Läufe');
    expect(html).not.toMatch(/\brole="tab(?:list|panel)?"/);
  });

  it('accepts static: true through the render API', async () => {
    const options: RenderReportOptions = { title: 'Static API', static: true };

    const rendered = await renderReport(fixture, options);
    expect(hasScript(rendered), 'no <script>').toBe(false);
    expect(rendered).toContain('id="report-view"');

    const generated = await generateReport(fixture, options);
    expect(hasScript(generated.html), 'no <script>').toBe(false);
    expect(generated.summary.schemaVersion).toBe(2);
  });
});
