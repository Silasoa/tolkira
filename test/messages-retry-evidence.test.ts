import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseLegacyJson } from '../src/input/legacy.js';
import { parseMessages } from '../src/input/messages.js';
import { indexRun } from '../src/report/index-run.js';
import { buildReportModel } from '../src/report/model.js';
import { renderHtml } from '../src/render/html.js';
import { summarizeEnvelopes } from '../src/summary.js';
import { legacyFixture, messagesFixture } from './fixtures.js';
import { earlierAttemptsOf, earlierBlocks } from './retry-reports.js';

const retryFixture = messagesFixture('retry-evidence.ndjson');

async function messagesEnvelopes(file: string) {
  return parseMessages(await readFile(file, 'utf8'), file);
}

describe('Messages retry evidence', () => {
  it('keeps every start in input order and displays earlier attempts by position', async () => {
    const envelopes = await messagesEnvelopes(retryFixture);
    const index = indexRun(envelopes);
    const pickleId = 'retry-evidence-pickle';
    const allAttempts = (
      index as typeof index & {
        allAttempts?: Map<string, Array<{ id: string }>>;
      }
    ).allAttempts;

    expect(allAttempts?.get(pickleId)?.map((start) => start.id)).toEqual([
      'retry-evidence-start-a',
      'retry-evidence-start-b',
      'retry-evidence-start-c',
      'retry-evidence-start-d',
    ]);
    expect(index.attempts.get(pickleId)?.id).toBe('retry-evidence-start-d');

    const model = buildReportModel(envelopes);
    const scenario = model.scenarios[0];
    if (!scenario) throw new Error('expected the retried scenario');
    expect(scenario.status).toBe('passed');
    expect(scenario.attempt).toBe(0);

    const earlier = earlierAttemptsOf(scenario);
    expect(earlier).toHaveLength(2);
    // All starts share attempt 0, and one is missing it. Display numbers come
    // from envelope order, and the unexecuted first start is not shown.
    expect(earlier?.map((entry) => entry.attempt)).toEqual([1, 2]);
    expect(earlier?.map((entry) => entry.status)).toEqual(['failed', 'passed']);
    expect(earlier?.[0]).toMatchObject({
      durationMs: 1000,
      message: 'Error: <b>first</b> attempt failed evil',
    });
    expect(earlier?.[1]?.durationMs).toBe(500);
  });

  it('does not embed an earlier Messages image', async () => {
    const envelopes = await messagesEnvelopes(retryFixture);
    const model = buildReportModel(envelopes);
    const earlier = earlierAttemptsOf(model.scenarios[0]!);
    expect(earlier?.[0]?.attachments).toEqual([]);
    expect(earlier?.[1]?.attachments).toEqual([]);

    const summary = summarizeEnvelopes(envelopes);
    expect(summary.scenarios[0]?.attachments).toBe(0);
    expect(summary.attachments).toEqual({ total: 0, bytes: 0 });
    expect(JSON.stringify(summary)).not.toMatch(/earlier/i);
  });

  it('renders the Messages earlier attempts in order without an image or controls', async () => {
    const envelopes = await messagesEnvelopes(retryFixture);
    const html = await renderHtml(envelopes, { title: 'Messages retry' });
    const blocks = earlierBlocks(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('Earlier attempts (2)');
    expect(blocks[0]).toContain('Attempt 1');
    expect(blocks[0]).toContain('Attempt 2');
    expect(blocks[0]).toContain('Failed');
    expect(blocks[0]).toContain(
      'Error: &lt;b&gt;first&lt;/b&gt; attempt failed evil',
    );
    expect(blocks[0]).not.toContain('<img');
    expect(html).not.toContain('\u001b');
    expect(html).not.toContain('\u202e');
    expect(html).not.toContain('\u202c');
  });

  it('exposes no earlier attempts for legacy JSON or a single start', async () => {
    const legacy = await readFile(legacyFixture('happy.json'), 'utf8');
    const legacyModel = buildReportModel(
      parseLegacyJson(legacy, 'happy.json', { idPrefix: 'legacy-retry' }),
    );
    expect(legacyModel.scenarios.length).toBeGreaterThan(0);
    for (const scenario of legacyModel.scenarios) {
      expect(earlierAttemptsOf(scenario)).toBeUndefined();
    }

    const single = await messagesEnvelopes(
      messagesFixture('screenshot.ndjson'),
    );
    const singleModel = buildReportModel(single);
    expect(singleModel.scenarios.length).toBeGreaterThan(0);
    for (const scenario of singleModel.scenarios) {
      expect(earlierAttemptsOf(scenario)).toBeUndefined();
    }
  });
});
