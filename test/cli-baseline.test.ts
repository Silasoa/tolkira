import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyFixture, messagesFixture } from './fixtures.js';
import {
  baselineBlock,
  cleanupTempDirs,
  cli,
  makeTempDir,
  mixedBaseline,
  mixedFeatures,
  parsedSummary,
  summarizeWithBaseline,
  validBaseline,
  writeLegacyRun,
  writeText,
  type BaselineRenderOptions,
} from './baseline-helpers.js';
import {
  CucumberHtmlStream,
  generateReport,
  renderReport,
  summarizeReport,
} from '../src/index.js';
import { parseMessages } from '../src/input/messages.js';
import { renderHtml } from '../src/render/html.js';

// The CLI tests never launch a browser: the PDF module is replaced here.
const pdf = vi.hoisted(() => ({ renderPdf: vi.fn() }));
vi.mock('../src/pdf.js', () => ({ renderPdf: pdf.renderPdf }));

const input = legacyFixture('minimal.json');
const failedInput = legacyFixture('failed.json');
const screenshot = messagesFixture('screenshot.ndjson');
const emptyInput = messagesFixture('empty-none.ndjson');

const LOGO =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const PDF_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

afterEach(cleanupTempDirs);

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  pdf.renderPdf.mockReset().mockResolvedValue(Buffer.from(PDF_BYTES));
});

async function baselineFor(
  dir: string,
  file: string,
  name = 'baseline.json',
): Promise<string> {
  return writeText(
    dir,
    name,
    JSON.stringify(await summarizeReport(file), null, 2),
  );
}

async function expectMissing(file: string): Promise<void> {
  await expect(readFile(file, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
}

describe('CLI --baseline', () => {
  it('lists --baseline in the help', async () => {
    const result = await cli(['--help']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('--baseline <file>');
    expect(result.stdout).not.toMatch(/Unknown option/i);
  });

  it('writes a report with the panel and leaves the baseline untouched', async () => {
    const dir = await makeTempDir();
    const baseline = await baselineFor(dir, input);
    const bytes = await readFile(baseline);
    const before = await stat(baseline);
    const report = path.join(dir, 'report.html');

    const result = await cli([
      input,
      '--baseline',
      baseline,
      '--out',
      report,
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(`Report written to ${report}\n`);
    const html = await readFile(report, 'utf8');
    expect(html).toContain('Compared with baseline');
    expect(html).not.toContain('baseline.json');
    expect(html).not.toContain(dir);
    expect(html).not.toContain('Unknown option');

    const after = await stat(baseline);
    expect(after.mtimeMs).toBe(before.mtimeMs);
    expect((await readFile(baseline)).equals(bytes)).toBe(true);
    expect((await readdir(dir)).sort()).toEqual(['baseline.json', 'report.html']);
  });

  it('prints the JSON block between attachments and scenarios', async () => {
    const dir = await makeTempDir();
    const baseline = await baselineFor(dir, input);

    const result = await cli([input, '--baseline', baseline, '--json']);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).not.toContain('baseline.json');
    const summary = parsedSummary(result.stdout);
    expect(summary.schemaVersion).toBe(2);
    expect(Object.keys(summary)).toEqual([
      'schemaVersion',
      'status',
      'durationMs',
      'counts',
      'attachments',
      'baseline',
      'scenarios',
    ]);
    const block = baselineBlock(summary);
    expect(block.status).toBe('passed');
    expect(block.counts).toMatchObject({
      newFailures: 0,
      fixed: 0,
      stillFailing: 0,
      notInThisRun: 0,
      added: 0,
      ambiguous: 0,
    });
    expect(block.notInThisRun).toEqual([]);
    for (const scenario of summary.scenarios) {
      expect(scenario).not.toHaveProperty('id');
    }
  });

  it('writes the mixed comparison counts through --json', async () => {
    const dir = await makeTempDir();
    const current = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const baseline = await writeText(
      dir,
      'mixed-baseline.json',
      JSON.stringify(mixedBaseline(), null, 2),
    );

    const result = await cli([current, '--baseline', baseline, '--json']);

    expect(result.code, result.stderr).toBe(0);
    const block = baselineBlock(parsedSummary(result.stdout));
    expect(block.counts).toMatchObject({
      newFailures: 2,
      fixed: 1,
      stillFailing: 3,
      notInThisRun: 1,
      added: 1,
      ambiguous: 0,
    });
    expect(block.notInThisRun.map((row) => row.name)).toEqual(['gone one']);
  });

  it('emits the Markdown baseline line', async () => {
    const dir = await makeTempDir();
    const current = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const baseline = await writeText(
      dir,
      'mixed-baseline.json',
      JSON.stringify(mixedBaseline(), null, 2),
    );

    const result = await cli([
      current,
      '--baseline',
      baseline,
      '--ci',
      'markdown',
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      'Baseline: 2 new failures · 1 fixed · 3 still failing · 1 not in this run',
    );
    expect(result.stdout).not.toContain('gone one');
  });

  it('writes a Markdown CI file beside a baseline report', async () => {
    const dir = await makeTempDir();
    const current = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const baseline = await writeText(
      dir,
      'mixed-baseline.json',
      JSON.stringify(mixedBaseline(), null, 2),
    );
    const ciOut = path.join(dir, 'summary.md');

    const result = await cli([
      current,
      '--baseline',
      baseline,
      '--ci',
      'markdown',
      '--ci-out',
      ciOut,
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toBe('');
    expect(await readFile(ciOut, 'utf8')).toContain(
      'Baseline: 2 new failures · 1 fixed · 3 still failing · 1 not in this run',
    );
  });

  it('keeps the email bytes unchanged when a baseline is supplied', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const dir = await makeTempDir();
    const current = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const baseline = await writeText(
      dir,
      'mixed-baseline.json',
      JSON.stringify(mixedBaseline(), null, 2),
    );
    const plainEmail = path.join(dir, 'plain-email.html');
    const comparedEmail = path.join(dir, 'compared-email.html');
    const report = path.join(dir, 'report.html');

    const plain = await cli([current, '--out', report, '--email', plainEmail]);
    const compared = await cli([
      current,
      '--baseline',
      baseline,
      '--out',
      report,
      '--email',
      comparedEmail,
    ]);

    expect(plain.code, plain.stderr).toBe(0);
    expect(compared.code, compared.stderr).toBe(0);
    expect(await readFile(comparedEmail, 'utf8')).toBe(
      await readFile(plainEmail, 'utf8'),
    );
  });

  it('renders the PDF from a report that contains the panel', async () => {
    const dir = await makeTempDir();
    const current = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const baseline = await writeText(
      dir,
      'mixed-baseline.json',
      JSON.stringify(mixedBaseline(), null, 2),
    );
    const output = path.join(dir, 'run.pdf');

    const result = await cli([current, '--baseline', baseline, '--pdf', output]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toBe(`PDF written to ${output}\n`);
    expect((await readFile(output)).equals(PDF_BYTES)).toBe(true);
    const call = pdf.renderPdf.mock.calls[0] as unknown[] | undefined;
    const html = call?.[0];
    expect(typeof html).toBe('string');
    expect(html as string).toContain('Compared with baseline');
  });

  it('keeps the static form with a baseline', async () => {
    const dir = await makeTempDir();
    const current = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const baseline = await writeText(
      dir,
      'mixed-baseline.json',
      JSON.stringify(mixedBaseline(), null, 2),
    );
    const report = path.join(dir, 'report.html');

    const result = await cli([
      current,
      '--baseline',
      baseline,
      '--static',
      '--out',
      report,
    ]);

    expect(result.code, result.stderr).toBe(0);
    const html = await readFile(report, 'utf8');
    expect(/<script\b/i.test(html)).toBe(false);
    expect(html.match(/<main\b/g) ?? []).toHaveLength(1);
    expect(html).toContain('Compared with baseline');
  });

  it('accepts a summary written by an earlier --json run', async () => {
    const dir = await makeTempDir();
    const oldFeatures = [
      {
        name: 'Checkout',
        uri: 'features/checkout.feature',
        scenarios: mixedBaseline().scenarios.map((row) => ({
          name: row.name,
          status: row.executed ? row.status : 'unexecuted',
        })),
      },
    ];
    const oldRun = await writeLegacyRun(dir, 'old.json', oldFeatures);
    const current = await writeLegacyRun(dir, 'current.json', mixedFeatures());
    const first = await cli([oldRun, '--json']);
    expect(first.code, first.stderr).toBe(0);
    const baseline = await writeText(dir, 'baseline.json', first.stdout);
    const report = path.join(dir, 'report.html');

    const second = await cli([
      current,
      '--baseline',
      baseline,
      '--out',
      report,
      '--json',
    ]);

    expect(second.code, second.stderr).toBe(0);
    expect(second.stdout).not.toContain('Report written to');
    const summary = parsedSummary(second.stdout);
    expect(baselineBlock(summary).counts).toMatchObject({
      newFailures: 2,
      fixed: 1,
      stillFailing: 3,
      notInThisRun: 1,
    });
    expect(await readFile(report, 'utf8')).toContain('Compared with baseline');
  });

  it('is deterministic for the same inputs, baseline and options', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const dir = await makeTempDir();
    const current = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const baseline = await writeText(
      dir,
      'mixed-baseline.json',
      JSON.stringify(mixedBaseline(), null, 2),
    );
    const report = path.join(dir, 'report.html');

    const first = await cli([
      current,
      '--baseline',
      baseline,
      '--out',
      report,
      '--json',
    ]);
    expect(first.code, first.stderr).toBe(0);
    const firstHtml = await readFile(report, 'utf8');

    const second = await cli([
      current,
      '--baseline',
      baseline,
      '--out',
      report,
      '--json',
    ]);
    expect(second.code, second.stderr).toBe(0);

    expect(second.stdout).toBe(first.stdout);
    expect(await readFile(report, 'utf8')).toBe(firstHtml);

    const firstCi = await cli([current, '--baseline', baseline, '--ci', 'markdown']);
    const secondCi = await cli([
      current,
      '--baseline',
      baseline,
      '--ci',
      'markdown',
    ]);
    expect(firstCi.code, firstCi.stderr).toBe(0);
    expect(secondCi.code, secondCi.stderr).toBe(0);
    expect(secondCi.stdout).toBe(firstCi.stdout);
  });
});

describe('CLI --baseline usage errors', () => {
  const rejectionCases: Array<[string, (dir: string) => string[]]> = [
    ['email only', (dir) => ['--email', path.join(dir, 'email.html')]],
    ['github only', () => ['--ci', 'github']],
    ['azure only', () => ['--ci', 'azure']],
    ['no surface', () => []],
  ];

  it.each(rejectionCases)(
    'rejects %s with exit 2 and writes nothing',
    async (label, extra) => {
      const dir = await makeTempDir();
      const baseline = await baselineFor(dir, input);
      const result = await cli([input, '--baseline', baseline, ...extra(dir)]);

      expect(result.code, label).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).not.toMatch(/Unknown option/i);
      expect(result.stderr).toContain('--baseline');
      expect(result.stderr).toMatch(/--out|--json|--ci markdown/);
      await expectMissing(path.join(dir, 'email.html'));
    },
  );

  it('rejects a missing baseline with exit 1 and names the file', async () => {
    const dir = await makeTempDir();
    const missing = path.join(dir, 'missing-baseline.json');
    const report = path.join(dir, 'report.html');

    const result = await cli([
      input,
      '--baseline',
      missing,
      '--out',
      report,
    ]);

    expect(result.code, result.stderr).toBe(1);
    expect(result.stderr).toContain('missing-baseline.json');
    expect(result.stderr).not.toMatch(/Unknown option/i);
    await expectMissing(report);
  });

  it('rejects the same path for --baseline and --history', async () => {
    const dir = await makeTempDir();
    const current = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const baseline = await writeText(
      dir,
      'shared.json',
      JSON.stringify(mixedBaseline(), null, 2),
    );
    const report = path.join(dir, 'report.html');

    const result = await cli([
      current,
      '--baseline',
      baseline,
      '--out',
      report,
      '--history',
      baseline,
    ]);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('--baseline');
    await expectMissing(report);
  });

  it('rejects every path collision before reading the baseline', async () => {
    const dir = await makeTempDir();
    const inputFile = path.join(dir, 'input.json');
    await copyFile(input, inputFile);
    const inputDir = path.join(dir, 'inputs');
    await mkdir(inputDir);
    await copyFile(input, path.join(inputDir, 'input.json'));
    const logo = path.join(dir, 'logo.png');
    await writeFile(logo, Buffer.from(LOGO, 'base64'));
    const report = path.join(dir, 'report.html');
    const pdfPath = path.join(dir, 'run.pdf');
    const email = path.join(dir, 'email.html');
    const history = path.join(dir, 'history.json');
    const ciOut = path.join(dir, 'ci.md');
    const insideInput = path.join(inputDir, 'new-baseline.json');

    const cases: Array<{ label: string; args: string[] }> = [
      {
        label: 'input',
        args: [inputFile, '--baseline', inputFile, '--out', report],
      },
      {
        label: 'inside an input directory',
        args: [inputDir, '--baseline', insideInput, '--out', report],
      },
      {
        label: 'logo',
        args: [
          inputFile,
          '--baseline',
          logo,
          '--out',
          report,
          '--logo',
          logo,
        ],
      },
      {
        label: '--out',
        args: [inputFile, '--baseline', report, '--out', report],
      },
      {
        label: '--pdf',
        args: [inputFile, '--baseline', pdfPath, '--pdf', pdfPath],
      },
      {
        label: '--email',
        args: [
          inputFile,
          '--baseline',
          email,
          '--out',
          report,
          '--email',
          email,
        ],
      },
      {
        label: '--history',
        args: [
          inputFile,
          '--baseline',
          history,
          '--out',
          report,
          '--history',
          history,
        ],
      },
      {
        label: '--ci-out',
        args: [
          inputFile,
          '--baseline',
          ciOut,
          '--ci',
          'markdown',
          '--ci-out',
          ciOut,
        ],
      },
    ];

    for (const testCase of cases) {
      const result = await cli(testCase.args);

      expect(result.code, testCase.label).toBe(2);
      expect(result.stdout, testCase.label).toBe('');
      expect(result.stderr, testCase.label).not.toMatch(/Unknown option/i);
      expect(result.stderr, testCase.label).toContain('--baseline');
      await expectMissing(report);
      await expectMissing(pdfPath);
      await expectMissing(email);
      await expectMissing(history);
      await expectMissing(ciOut);
      await expectMissing(insideInput);
    }
    expect(pdf.renderPdf).not.toHaveBeenCalled();
  });
});

describe('baseline API', () => {
  it('accepts the projection through generateReport, renderReport and summarizeReport', async () => {
    const dir = await makeTempDir();
    const current = await writeLegacyRun(dir, 'mixed.json', mixedFeatures());
    const options: BaselineRenderOptions = {
      title: 'Baseline API',
      baseline: mixedBaseline(),
    };

    const rendered = await renderReport(current, options);
    expect(rendered).toContain('Compared with baseline');

    const generated = await generateReport(current, options);
    expect(generated.html).toContain('Compared with baseline');
    expect(baselineBlock(generated.summary).counts).toMatchObject({
      newFailures: 2,
      fixed: 1,
      stillFailing: 3,
      notInThisRun: 1,
    });

    const summary = await summarizeWithBaseline(current, {
      baseline: mixedBaseline(),
    });
    expect(baselineBlock(summary).counts.fixed).toBe(1);
  });

  it('rejects a baseline at the type level and ignores it at runtime', async () => {
    const envelopes = parseMessages(
      await readFile(screenshot, 'utf8'),
      screenshot,
    );
    const plain = await renderHtml(envelopes, { title: 'Stream' });
    const baseline = validBaseline();

    // @ts-expect-error renderHtml keeps RenderOptions; it takes no baseline.
    const ignored = await renderHtml(envelopes, { title: 'Stream', baseline });
    expect(ignored).toBe(plain);

    // @ts-expect-error the stream keeps RenderReportOptions; it takes no baseline.
    const stream = new CucumberHtmlStream({ title: 'Stream', baseline });
    const streamed = Readable.from(envelopes).pipe(stream);
    let html = '';
    for await (const chunk of streamed) html += chunk;
    expect(html).toBe(plain);

    // Positive control: the file API does take the same projection, so the
    // negative half above cannot pass by accident.
    const options: BaselineRenderOptions = { title: 'Stream', baseline };
    const rendered = await renderReport(screenshot, options);
    expect(rendered).toContain('Compared with baseline');
  });

  it('exports the BaselineSummary type from the package entry', async () => {
    const index = await readFile(
      fileURLToPath(new URL('../src/index.ts', import.meta.url)),
      'utf8',
    );

    expect(index).toMatch(
      /export\s+type\s*\{[^}]*\bBaselineSummary\b[^}]*\}/s,
    );
    expect(index).toMatch(/\bBaselineRenderOptions\b/);
  });
});

describe('default guard', () => {
  it('adds no baseline block, CI line or panel without the flag', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const dir = await makeTempDir();
    const report = path.join(dir, 'plain.html');

    const json = await cli([failedInput, '--json']);
    expect(json.code, json.stderr).toBe(0);
    const summary = parsedSummary(json.stdout);
    expect(summary).not.toHaveProperty('baseline');
    expect(json.stdout).not.toContain('"change"');
    expect(json.stdout).not.toContain('"notInThisRun"');

    const ci = await cli([failedInput, '--ci', 'markdown']);
    expect(ci.code, ci.stderr).toBe(0);
    expect(ci.stdout).not.toContain('Baseline:');

    const written = await cli([failedInput, '--out', report]);
    expect(written.code, written.stderr).toBe(0);
    const html = await readFile(report, 'utf8');
    expect(html).not.toContain('Compared with baseline');
    expect(html).not.toContain('Not in this run');
    expect(html).not.toContain('new-failure');

    const email = path.join(dir, 'email.html');
    const firstEmail = await cli([failedInput, '--email', email]);
    expect(firstEmail.code, firstEmail.stderr).toBe(0);
    const emailHtml = await readFile(email, 'utf8');
    expect(emailHtml).not.toContain('Compared with baseline');
    const secondEmail = await cli([failedInput, '--email', email]);
    expect(secondEmail.code, secondEmail.stderr).toBe(0);
    expect(await readFile(email, 'utf8')).toBe(emailHtml);
  });

  it('keeps an empty run without a baseline free of comparison output', async () => {
    const result = await cli([emptyInput, '--ci', 'markdown']);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).not.toContain('Baseline:');
  });
});
