import { mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { skippedAttachmentEntriesOf } from '../src/attempt-diagnostics.js';
import {
  MAX_RETRY_EVIDENCE_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  retryEvidenceFits,
} from '../src/attachment.js';
import { generateReport, summarizeReport } from '../src/index.js';
import { parsePlaywrightJson } from '../src/input/playwright.js';
import { indexRun } from '../src/report/index-run.js';
import { buildReportModel } from '../src/report/model.js';
import type { ReportScenario } from '../src/report/model.js';
import { renderHtml } from '../src/render/html.js';
import { playwrightFixture } from './fixtures.js';
import {
  RETRY_EVIDENCE_BUDGET,
  SMALL_PNG,
  SMALL_PNG_BYTES,
  attemptResult,
  earlierAttemptsOf,
  earlierBlocks,
  inlineImage,
  retryReport,
  retrySpec,
} from './retry-reports.js';

const retryFixture = playwrightFixture('retry-evidence.json');
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(prefix = 'tolkira-retry-'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function modelFromReport(
  report: unknown,
  source = 'synthetic-retry.json',
): Promise<{
  envelopes: Awaited<ReturnType<typeof parsePlaywrightJson>>['envelopes'];
  scenario: ReportScenario;
  skippedAttachments: number;
}> {
  const { envelopes, skippedAttachments } = await parsePlaywrightJson(
    report,
    source,
  );
  const scenario = buildReportModel(envelopes).scenarios[0];
  if (!scenario) throw new Error('expected one scenario');
  return { envelopes, scenario, skippedAttachments };
}

describe('Playwright retry evidence', () => {
  it('pins the 10 MB retry-evidence budget constant', async () => {
    const attachment = await import('../src/attachment.js');
    expect(
      (attachment as Record<string, unknown>).MAX_RETRY_EVIDENCE_BYTES,
    ).toBe(RETRY_EVIDENCE_BUDGET);
  });

  describe('final-first reserve', () => {
    it('accepts exactly 10 MB of evidence and rejects one byte more', () => {
      expect(retryEvidenceFits(0, 0, MAX_RETRY_EVIDENCE_BYTES)).toBe(true);
      expect(retryEvidenceFits(0, 0, MAX_RETRY_EVIDENCE_BYTES + 1)).toBe(false);
      expect(
        retryEvidenceFits(0, MAX_RETRY_EVIDENCE_BYTES - 1, 1),
      ).toBe(true);
      expect(retryEvidenceFits(0, MAX_RETRY_EVIDENCE_BYTES, 1)).toBe(false);
    });

    it('accepts a final total leaving exactly 10 MB and rejects one byte less', () => {
      const leavingExactlyTen = MAX_TOTAL_ATTACHMENT_BYTES - MAX_RETRY_EVIDENCE_BYTES;
      expect(retryEvidenceFits(leavingExactlyTen, 0, MAX_RETRY_EVIDENCE_BYTES)).toBe(
        true,
      );
      expect(
        retryEvidenceFits(leavingExactlyTen + 1, 0, MAX_RETRY_EVIDENCE_BYTES),
      ).toBe(false);
    });

    it('accepts a normal image inside the evidence budget and total cap', () => {
      expect(retryEvidenceFits(1024, 0, 4096)).toBe(true);
      expect(retryEvidenceFits(MAX_TOTAL_ATTACHMENT_BYTES - 4096, 0, 4096)).toBe(
        true,
      );
    });
  });

  it('exposes the failed earlier attempt and keeps the passed final result', async () => {
    const value = JSON.parse(await readFile(retryFixture, 'utf8')) as unknown;
    const { envelopes, skippedAttachments } = await parsePlaywrightJson(
      value,
      retryFixture,
    );
    const model = buildReportModel(envelopes);
    const scenario = model.scenarios[0];
    if (!scenario) throw new Error('expected the retried scenario');

    expect(scenario.name).toBe('pays an invoice after a gateway timeout');
    expect(scenario.status).toBe('passed');
    expect(scenario.attempt).toBe(1);
    expect(scenario.durationMs).toBe(900);
    expect(skippedAttachments).toBe(0);

    const earlier = earlierAttemptsOf(scenario);
    expect(earlier).toHaveLength(1);
    expect(earlier?.[0]).toMatchObject({
      attempt: 1,
      status: 'failed',
      durationMs: 1200,
      message: 'Error: payment gateway timed out',
    });
    expect(earlier?.[0]?.attachments).toHaveLength(1);
    expect(earlier?.[0]?.attachments[0]).toMatchObject({
      fileName: 'failure.png',
      mediaType: 'image/png',
      kind: 'image',
      bytes: SMALL_PNG_BYTES,
    });
    expect(earlier?.[0]?.attachments[0]?.dataUri).toMatch(
      /^data:image\/png;base64,/,
    );
  });

  it('keeps summary counts, bytes and steps final-attempt-only', async () => {
    const summary = await summarizeReport(retryFixture);
    expect(summary.schemaVersion).toBe(2);
    expect(summary.scenarios).toHaveLength(1);
    const row = summary.scenarios[0];
    if (!row) throw new Error('expected the retried scenario');
    expect(row.status).toBe('passed');
    expect(row.attempt).toBe(1);
    expect(row.attachments).toBe(0);
    expect(summary.attachments).toEqual({ total: 0, bytes: 0 });
    expect(row.steps.map((step) => step.text)).toEqual([
      'Given the gateway responds',
    ]);
    expect(JSON.stringify(summary)).not.toMatch(/earlier/i);
  });

  it('exposes status, duration and the first failure without an image', async () => {
    const { scenario, skippedAttachments } = await modelFromReport(
      retryReport([
        retrySpec('retries without a screenshot', [
          attemptResult({
            retry: 0,
            duration: 1500,
            message: 'Error: the upload endpoint closed the connection',
          }),
          attemptResult({ retry: 1, status: 'passed', duration: 400 }),
        ]),
      ]),
    );

    expect(skippedAttachments).toBe(0);
    const earlier = earlierAttemptsOf(scenario);
    expect(earlier).toHaveLength(1);
    expect(earlier?.[0]).toMatchObject({
      attempt: 1,
      status: 'failed',
      durationMs: 1500,
      message: 'Error: the upload endpoint closed the connection',
      attachments: [],
    });
  });

  it('keeps every start in input order and caps the model at three earlier attempts', async () => {
    const results = [0, 1, 2, 3, 4].map((retry) =>
      attemptResult({ retry, message: `Error: failure ${retry + 1}` }),
    );
    results.push(attemptResult({ retry: 5, status: 'passed', duration: 100 }));
    const { envelopes } = await parsePlaywrightJson(
      retryReport([retrySpec('retries five times', results)]),
      'synthetic-retry.json',
    );
    const index = indexRun(envelopes);
    const pickleId = [...index.pickles.keys()][0];
    if (!pickleId) throw new Error('expected a pickle');
    const allAttempts = (
      index as typeof index & { allAttempts?: Map<string, unknown[]> }
    ).allAttempts;
    expect(allAttempts?.get(pickleId)).toHaveLength(6);
    expect(index.attempts.get(pickleId)?.attempt).toBe(5);

    const scenario = buildReportModel(envelopes, undefined, index).scenarios[0];
    if (!scenario) throw new Error('expected the retried scenario');
    const earlier = earlierAttemptsOf(scenario);
    expect(earlier).toHaveLength(3);
    expect(earlier?.map((entry) => entry.attempt)).toEqual([1, 2, 3]);
    expect(earlier?.map((entry) => entry.status)).toEqual([
      'failed',
      'failed',
      'failed',
    ]);
    expect(earlier?.map((entry) => entry.message)).toEqual([
      'Error: failure 1',
      'Error: failure 2',
      'Error: failure 3',
    ]);
    expect(scenario.status).toBe('passed');
    expect(scenario.attempt).toBe(5);
  });

  it('embeds only one earlier image per report', async () => {
    const report = retryReport([
      retrySpec(
        'first retried test',
        [
          attemptResult({
            retry: 0,
            message: 'Error: first',
            attachments: [inlineImage('first.png')],
          }),
          attemptResult({ retry: 1, status: 'passed' }),
        ],
        { file: 'first.spec.ts' },
      ),
      retrySpec(
        'second retried test',
        [
          attemptResult({
            retry: 0,
            message: 'Error: second',
            attachments: [inlineImage('second.png')],
          }),
          attemptResult({ retry: 1, status: 'passed' }),
        ],
        { file: 'second.spec.ts' },
      ),
    ]);
    const { envelopes } = await parsePlaywrightJson(
      report,
      'synthetic-retry.json',
    );
    const model = buildReportModel(envelopes);
    const images = model.scenarios.flatMap(
      (entry) => earlierAttemptsOf(entry) ?? [],
    );
    expect(
      images.flatMap((entry) => entry.attachments).map((entry) => entry.fileName),
    ).toEqual(['first.png']);
  });

  it('takes the image from the first failed earlier attempt, not the first start', async () => {
    const { scenario } = await modelFromReport(
      retryReport([
        retrySpec('passes once then fails once', [
          attemptResult({ retry: 0, status: 'passed', duration: 300 }),
          attemptResult({
            retry: 1,
            duration: 800,
            message: 'Error: disk full',
            attachments: [inlineImage('second-attempt.png')],
          }),
          attemptResult({ retry: 2, status: 'passed', duration: 200 }),
        ]),
      ]),
    );

    const earlier = earlierAttemptsOf(scenario);
    expect(earlier).toHaveLength(2);
    expect(earlier?.[0]).toMatchObject({
      attempt: 1,
      status: 'passed',
      attachments: [],
    });
    expect(earlier?.[1]).toMatchObject({
      attempt: 2,
      status: 'failed',
      message: 'Error: disk full',
    });
    expect(earlier?.[1]?.attachments).toHaveLength(1);
    expect(earlier?.[1]?.attachments[0]?.fileName).toBe('second-attempt.png');
  });

  it('re-applies the declared media type after a path read', async () => {
    const dir = await tempDir();
    await writeFile(
      path.join(dir, 'shot.png'),
      Buffer.from(SMALL_PNG, 'base64'),
    );
    const source = path.join(dir, 'report.json');
    const { scenario, skippedAttachments } = await modelFromReport(
      retryReport([
        retrySpec('retries with a path screenshot', [
          attemptResult({
            retry: 0,
            message: 'Error: timeout',
            attachments: [
              { name: 'shot.png', contentType: 'image/png', path: 'shot.png' },
            ],
          }),
          attemptResult({ retry: 1, status: 'passed' }),
        ]),
      ]),
      source,
    );

    expect(skippedAttachments).toBe(0);
    const image = earlierAttemptsOf(scenario)?.[0]?.attachments[0];
    expect(image).toMatchObject({
      fileName: 'shot.png',
      mediaType: 'image/png',
      kind: 'image',
      bytes: SMALL_PNG_BYTES,
    });
    expect(image?.dataUri).toMatch(/^data:image\/png;base64,/);
  });

  it('omits an earlier image above the 10 MB retry-evidence budget and keeps the run valid', async () => {
    const dir = await tempDir();
    const big = path.join(dir, 'big.png');
    const handle = await open(big, 'w');
    await handle.truncate(RETRY_EVIDENCE_BUDGET + 1);
    await handle.close();
    const source = path.join(dir, 'report.json');
    const { envelopes, scenario, skippedAttachments } = await modelFromReport(
      retryReport([
        retrySpec('retries with an oversized screenshot', [
          attemptResult({
            retry: 0,
            message: 'Error: timeout',
            attachments: [
              { name: 'big.png', contentType: 'image/png', path: 'big.png' },
            ],
          }),
          attemptResult({ retry: 1, status: 'passed' }),
        ]),
      ]),
      source,
    );

    expect(skippedAttachments).toBe(0);
    const earlier = earlierAttemptsOf(scenario);
    expect(earlier).toHaveLength(1);
    expect(earlier?.[0]?.message).toBe('Error: timeout');
    expect(earlier?.[0]?.attachments).toEqual([]);
    const html = await renderHtml(envelopes, { title: 'Retry budget' });
    expect(html).not.toContain('data:image/png;base64,');
    expect(html).toContain('Earlier attempts (1)');
  });

  it('does not count an earlier outside-root probe as a skipped attachment', async () => {
    const outsideDir = await tempDir('tolkira-retry-outside-');
    const outside = path.join(outsideDir, 'outside.png');
    await writeFile(outside, Buffer.from(SMALL_PNG, 'base64'));
    const { envelopes, scenario, skippedAttachments } = await modelFromReport(
      retryReport([
        retrySpec('retries with an outside screenshot', [
          attemptResult({
            retry: 0,
            message: 'Error: timeout',
            attachments: [
              { name: 'outside.png', contentType: 'image/png', path: outside },
            ],
          }),
          attemptResult({
            retry: 1,
            status: 'passed',
            attachments: [
              {
                name: 'missing.png',
                contentType: 'image/png',
                path: 'missing.png',
              },
            ],
          }),
        ]),
      ]),
    );

    // Only the final-attempt miss is authoritative.
    expect(skippedAttachments).toBe(1);
    const finalStarted = envelopes
      .flatMap((envelope) =>
        envelope.testCaseStarted ? [envelope.testCaseStarted] : [],
      )
      .at(-1);
    if (!finalStarted) throw new Error('expected the final start');
    expect(skippedAttachmentEntriesOf(finalStarted)).toEqual([
      { name: 'missing.png', reason: 'missing' },
    ]);
    const earlier = earlierAttemptsOf(scenario);
    expect(earlier).toHaveLength(1);
    expect(earlier?.[0]?.attachments).toEqual([]);
  });

  it('keeps final attachment counts and bytes when an earlier image also exists', async () => {
    const input = await tempDir();
    const file = path.join(input, 'report.json');
    const value = retryReport([
      retrySpec('retries with a final screenshot', [
        attemptResult({
          retry: 0,
          message: 'Error: timeout',
          attachments: [inlineImage('earlier.png')],
        }),
        attemptResult({
          retry: 1,
          status: 'passed',
          attachments: [inlineImage('final.png')],
        }),
      ]),
    ]);
    await writeFile(file, `${JSON.stringify(value)}\n`, 'utf8');

    const generated = await generateReport(file);
    const row = generated.summary.scenarios[0];
    if (!row) throw new Error('expected the retried scenario');
    expect(row.attachments).toBe(1);
    expect(generated.summary.attachments).toEqual({
      total: 1,
      bytes: SMALL_PNG_BYTES,
    });
    expect(generated.html).toContain('Earlier attempts (1)');
    expect(generated.html).toContain('data:image/png;base64,');
  });

  it('shows earlier status and error but no image for a multi-input report', async () => {
    const dir = await tempDir();
    for (const [name, message] of [
      ['first.json', 'Error: first input failed'],
      ['second.json', 'Error: second input failed'],
    ] as const) {
      const value = retryReport([
        retrySpec(`retried ${name}`, [
          attemptResult({
            retry: 0,
            message,
            attachments: [inlineImage(`${name}.png`)],
          }),
          attemptResult({ retry: 1, status: 'passed' }),
        ]),
      ]);
      await writeFile(
        path.join(dir, name),
        `${JSON.stringify(value)}\n`,
        'utf8',
      );
    }

    const generated = await generateReport(
      [path.join(dir, 'first.json'), path.join(dir, 'second.json')],
      { title: 'Two retried inputs' },
    );
    expect(generated.summary.scenarios).toHaveLength(2);
    expect(generated.summary.attachments).toEqual({ total: 0, bytes: 0 });
    const blocks = earlierBlocks(generated.html);
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      expect(block).not.toContain('<img');
    }
    expect(generated.html).toContain('Error: first input failed');
    expect(generated.html).toContain('Error: second input failed');
  });
});
