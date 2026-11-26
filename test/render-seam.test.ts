import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Envelope } from '@cucumber/messages';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BaselineComparison } from '../src/baseline.js';
import { readHistory } from '../src/history.js';
import { renderReport, summarizeReport } from '../src/index.js';
import { loadInputs, provenanceFor } from '../src/input/load.js';
import { parseMessages } from '../src/input/messages.js';
import { sanitizeEnvelopes } from '../src/input/sanitize.js';
import { buildLoadedRun, type LoadedRun } from '../src/loaded-run.js';
import type { RenderReportOptions } from '../src/options.js';
import { renderHtml, renderRun } from '../src/render/html.js';
import { indexRun } from '../src/report/index-run.js';
import { summarizeIndex } from '../src/summary.js';
import { projectSummary } from './baseline-helpers.js';
import { fixturePath, legacyFixture, messagesFixture } from './fixtures.js';

vi.mock('../src/input/sanitize.js', { spy: true });
vi.mock('../src/report/index-run.js', { spy: true });
vi.mock('../src/summary.js', { spy: true });
vi.mock('../src/loaded-run.js', { spy: true });

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function parseFile(file: string): Promise<Envelope[]> {
  return parseMessages(await readFile(file, 'utf8'), file);
}

async function inputFacts(file: string) {
  return { inputFiles: 1, inputBytes: (await stat(file)).size };
}

async function remoteImageEnvelopes(): Promise<Envelope[]> {
  const envelopes = await parseFile(messagesFixture('screenshot.ndjson'));
  const feature = envelopes.find(
    (envelope) => envelope.gherkinDocument?.feature,
  )?.gherkinDocument?.feature;
  if (!feature) throw new Error('fixture feature missing');
  feature.description = 'Before ![logo](https://example.com/logo.png) after';
  return envelopes;
}

function analysisView(html: string): string {
  const start = html.indexOf('id="analysis-view"');
  const ends = ['id="trends-view"', 'id="tolkira-lightbox"']
    .map((marker) => html.indexOf(marker, start + 1))
    .filter((index) => index > start)
    .sort((a, b) => a - b);
  return start < 0 ? '' : html.slice(start, ends[0] ?? html.length);
}

/** A Playwright report whose only attachment path does not exist. */
function playwrightReportWithMissingAttachment(): unknown {
  return {
    config: {
      version: '1.65.0',
      configFile: 'playwright.config.ts',
      rootDir: 'tests',
      projects: [{ id: 'chromium', name: 'chromium', retries: 0 }],
    },
    suites: [
      {
        title: 'seam.spec.ts',
        file: 'seam.spec.ts',
        line: 0,
        column: 0,
        specs: [
          {
            title: 'skips a missing attachment',
            ok: true,
            tags: [],
            id: 'seam-spec-1',
            file: 'seam.spec.ts',
            line: 1,
            column: 1,
            tests: [
              {
                timeout: 30000,
                annotations: [],
                expectedStatus: 'passed',
                projectId: 'chromium',
                projectName: 'chromium',
                status: 'expected',
                results: [
                  {
                    status: 'passed',
                    duration: 1,
                    retry: 0,
                    startTime: '2026-11-19T08:00:00.000Z',
                    stdout: [],
                    stderr: [],
                    annotations: [],
                    attachments: [
                      {
                        name: 'missing',
                        contentType: 'text/plain',
                        path: 'missing.txt',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    errors: [],
    stats: {
      startTime: '2026-11-19T08:00:00.000Z',
      duration: 1,
      expected: 1,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
    },
  };
}

async function skippedAttachmentReport(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-seam-'));
  tempDirs.push(dir);
  const file = path.join(dir, 'skipped.json');
  await writeFile(
    file,
    JSON.stringify(playwrightReportWithMissingAttachment()),
    'utf8',
  );
  return file;
}

// The directive proves the caller boundary: the brand and run facts live on
// LoadedRun, never on the options object. The function is never executed.
function callerFactTypeChecks(run: LoadedRun): void {
  // @ts-expect-error index is a loaded-run fact, not a render option.
  void renderHtml([], { index: undefined as never });
  // @ts-expect-error summary is a loaded-run fact, not a render option.
  void renderHtml([], { summary: undefined as never });
  // @ts-expect-error comparison is filled from the run.
  void renderHtml([], { comparison: undefined as never });
  // @ts-expect-error provenance is a loaded-run fact, not a render option.
  void renderHtml([], { provenance: undefined as never });
  // @ts-expect-error skippedAttachments is a loaded-run fact.
  void renderHtml([], { skippedAttachments: undefined as never });
  // @ts-expect-error inputFiles is filled from the run.
  void renderHtml([], { inputFiles: undefined as never });
  // @ts-expect-error inputBytes is filled from the run.
  void renderHtml([], { inputBytes: undefined as never });

  // @ts-expect-error index is a loaded-run fact, not a render option.
  void renderRun(run, { index: undefined as never });
  // @ts-expect-error summary is a loaded-run fact, not a render option.
  void renderRun(run, { summary: undefined as never });
  // @ts-expect-error comparison is filled from the run.
  void renderRun(run, { comparison: undefined as never });
  // @ts-expect-error provenance is a loaded-run fact, not a render option.
  void renderRun(run, { provenance: undefined as never });
  // @ts-expect-error skippedAttachments is a loaded-run fact.
  void renderRun(run, { skippedAttachments: undefined as never });
  // @ts-expect-error inputFiles is filled from the run.
  void renderRun(run, { inputFiles: undefined as never });
  // @ts-expect-error inputBytes is filled from the run.
  void renderRun(run, { inputBytes: undefined as never });
}

describe('report pipeline seam', () => {
  it('rejects every internal run fact at the caller boundary', () => {
    expect(callerFactTypeChecks).toBeTypeOf('function');
  });

  it('builds exactly once in renderHtml and never recomputes in renderRun', async () => {
    await renderHtml([], { title: 'Spy proof' });

    expect(buildLoadedRun).toHaveBeenCalledTimes(1);
    expect(sanitizeEnvelopes).toHaveBeenCalledTimes(1);
    expect(indexRun).toHaveBeenCalledTimes(1);
    expect(summarizeIndex).toHaveBeenCalledTimes(1);

    const run = buildLoadedRun([]);
    vi.clearAllMocks();
    await renderRun(run, { title: 'Spy proof' });

    expect(buildLoadedRun).not.toHaveBeenCalled();
    expect(sanitizeEnvelopes).not.toHaveBeenCalled();
    expect(indexRun).not.toHaveBeenCalled();
    expect(summarizeIndex).not.toHaveBeenCalled();
  });

  it('neutralises a remote Markdown image once through renderHtml', async () => {
    const html = await renderHtml(await remoteImageEnvelopes(), {
      title: 'Remote image',
    });

    expect(html).not.toContain('example.com/logo.png');
    expect(sanitizeEnvelopes).toHaveBeenCalledTimes(1);
  });

  it('renders an already-built run without sanitising again', async () => {
    const run = buildLoadedRun(await remoteImageEnvelopes());
    expect(sanitizeEnvelopes).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();

    const html = await renderRun(run, { title: 'Remote image' });

    expect(html).not.toContain('example.com/logo.png');
    expect(sanitizeEnvelopes).not.toHaveBeenCalled();
    expect(indexRun).not.toHaveBeenCalled();
    expect(summarizeIndex).not.toHaveBeenCalled();
  });

  it('keeps byte parity for the default report with the same input counts', async () => {
    const file = messagesFixture('screenshot.ndjson');
    const expected = await renderReport(file, { title: 'Seam default' });
    const run = buildLoadedRun(await parseFile(file), await inputFacts(file));

    const actual = await renderRun(run, { title: 'Seam default' });

    expect(actual).toBe(expected);
  });

  it('keeps byte parity for the static report', async () => {
    const file = messagesFixture('screenshot.ndjson');
    const options = { title: 'Seam static', static: true };
    const expected = await renderReport(file, options);
    const run = buildLoadedRun(await parseFile(file), await inputFacts(file));

    const actual = await renderRun(run, options);

    expect(actual).toBe(expected);
    expect(actual).not.toMatch(/<script\b/i);
  });

  it('keeps byte parity for the localized report', async () => {
    const file = messagesFixture('screenshot.ndjson');
    const options = { title: 'Seam locale', locale: 'de' };
    const expected = await renderReport(file, options);
    const run = buildLoadedRun(await parseFile(file), await inputFacts(file));

    const actual = await renderRun(run, options);

    expect(actual).toBe(expected);
    expect(actual).toContain('<html lang="de" dir="ltr">');
  });

  it('keeps byte parity for a baseline report through the run comparison', async () => {
    const file = messagesFixture('screenshot.ndjson');
    const baseline = projectSummary(await summarizeReport(file));
    const run = buildLoadedRun(await parseFile(file), {
      baseline,
      ...(await inputFacts(file)),
    });

    const expected = await renderReport(file, {
      title: 'Seam baseline',
      baseline,
    });
    const actual = await renderRun(run, { title: 'Seam baseline' });

    expect(actual).toBe(expected);
    expect(actual).toContain('class="baselinePanel"');
  });

  it('keeps byte parity with multi-file provenance', async () => {
    const files = [
      messagesFixture('screenshot.ndjson'),
      legacyFixture('happy.json'),
    ];
    const groups = await loadInputs(files);
    const provenance = provenanceFor(groups);
    const run = buildLoadedRun(
      groups.flatMap((group) => group.envelopes),
      {
        provenance,
        skippedAttachments: groups.reduce(
          (sum, group) => sum + group.skippedAttachments,
          0,
        ),
        inputFiles: groups.length,
        inputBytes: groups.reduce((sum, group) => sum + group.bytes, 0),
      },
    );

    const expected = await renderReport(files, { title: 'Seam multi' });
    const actual = await renderRun(run, { title: 'Seam multi' });

    expect(provenance.size).toBeGreaterThan(1);
    expect(actual).toContain('class="sources"');
    expect(actual).toBe(expected);
  });

  it('keeps byte parity when the input carries skipped attachments', async () => {
    const file = await skippedAttachmentReport();
    const groups = await loadInputs([file]);
    const skippedAttachments = groups.reduce(
      (sum, group) => sum + group.skippedAttachments,
      0,
    );
    const run = buildLoadedRun(
      groups.flatMap((group) => group.envelopes),
      {
        skippedAttachments,
        inputFiles: groups.length,
        inputBytes: groups.reduce((sum, group) => sum + group.bytes, 0),
      },
    );

    const expected = await renderReport(file, { title: 'Seam skipped' });
    const actual = await renderRun(run, { title: 'Seam skipped' });

    expect(skippedAttachments).toBeGreaterThan(0);
    expect(actual).toContain('path attachment was skipped');
    expect(actual).toBe(expected);
  });

  it('still ignores a baseline key passed to renderHtml at runtime', async () => {
    const file = messagesFixture('screenshot.ndjson');
    const baseline = projectSummary(await summarizeReport(file));
    const envelopes = await parseFile(file);

    const plain = await renderHtml(envelopes, { title: 'Ignored baseline' });
    const ignored = await renderHtml(envelopes, {
      title: 'Ignored baseline',
      baseline,
    } as unknown as RenderReportOptions);

    expect(ignored).toBe(plain);
    expect(ignored).not.toContain('class="baselinePanel"');
  });

  it('renders an empty run and keeps the Details input row omitted', async () => {
    const html = await renderRun(buildLoadedRun([]), {});
    const wrapper = await renderHtml([]);

    expect(html).toBe(wrapper);
    expect(html).toContain('<title>Tolkira report</title>');
    expect(html).toContain('0 / 0');
    expect(analysisView(html)).not.toContain('<dt>Input data</dt>');
  });

  it('renders the input row for zero counts but not for absent counts', async () => {
    const zero = await renderRun(
      buildLoadedRun([], { inputFiles: 0, inputBytes: 0 }),
      { title: 'Zero counts' },
    );
    const absent = await renderRun(buildLoadedRun([]), {
      title: 'Absent counts',
    });

    expect(analysisView(zero)).toContain('<dt>Input data</dt>');
    expect(analysisView(zero)).toContain('0 files');
    expect(analysisView(absent)).not.toContain('<dt>Input data</dt>');
  });

  it('renders Trends only from two history runs', async () => {
    const history = await readHistory(fixturePath('history', 'two-runs.json'));
    const run = buildLoadedRun([]);

    const one = await renderRun(run, {
      title: 'One history',
      history: history.slice(0, 1),
    });
    const two = await renderRun(run, {
      title: 'Two history',
      history: history.slice(0, 2),
    });

    expect(one).not.toContain('data-view="trends"');
    expect(one).not.toContain('id="trends-view"');
    expect(two).toContain('data-view="trends"');
    expect(two).toContain('id="trends-view"');
  });

  it('lets the run comparison win over a smuggled caller value', async () => {
    const file = messagesFixture('screenshot.ndjson');
    const baseline = projectSummary(await summarizeReport(file));
    const run = buildLoadedRun(await parseFile(file), {
      baseline,
      ...(await inputFacts(file)),
    });
    const smuggled: BaselineComparison = {
      block: {
        status: 'passed',
        counts: {
          newFailures: 0,
          fixed: 0,
          stillFailing: 0,
          other: 0,
          notInThisRun: 0,
          added: 0,
          ambiguous: 0,
        },
        notInThisRun: [],
      },
      changes: new Map(),
    };

    const clean = await renderRun(run, { title: 'Run wins' });
    const withSmuggled = await renderRun(run, {
      title: 'Run wins',
      comparison: smuggled,
    } as unknown as RenderReportOptions);

    expect(clean).toContain('class="baselinePanel"');
    expect(withSmuggled).toBe(clean);
  });
});
