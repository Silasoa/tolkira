import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { formatCiOutput } from '../src/ci.js';
import { renderEmail } from '../src/email.js';
import { buildHistoryRun, HISTORY_SCHEMA_VERSION } from '../src/history.js';
import { renderReport, summarizeReport } from '../src/index.js';
import { runCli } from '../src/cli.js';
import { de, en } from '../src/i18n/catalogs.js';
import { parsePlaywrightJson } from '../src/input/playwright.js';
import { renderHtml } from '../src/render/html.js';
import { REPORT_CSS } from '../src/render/styles.js';
import {
  legacyFixture,
  messagesFixture,
  playwrightFixture,
} from './fixtures.js';
import {
  attemptResult,
  earlierBlocks,
  retryReport,
  retrySpec,
} from './retry-reports.js';
import { scenarioSummary } from './render-helpers.js';

const retryFixture = playwrightFixture('retry-evidence.json');

function earlierTag(html: string): string {
  const start = html.indexOf('<details class="earlierAttempts"');
  if (start < 0) return '';
  return html.slice(start, html.indexOf('>', start) + 1);
}

describe('retry evidence rendering', () => {
  it('renders a collapsed native disclosure with status, duration, error and one image', async () => {
    const html = await renderReport(retryFixture, { title: 'Retry evidence' });
    const blocks = earlierBlocks(html);
    expect(blocks).toHaveLength(1);
    expect(earlierTag(html)).not.toMatch(/\bopen\b/);
    expect(blocks[0]).toContain('Earlier attempts (1)');
    expect(blocks[0]).toContain('Attempt 1');
    expect(blocks[0]).toContain('Failed');
    expect(blocks[0]).toContain('1.20 s');
    expect(blocks[0]).toContain('Error: payment gateway timed out');
    expect(blocks[0]?.match(/<img\b/g) ?? []).toHaveLength(1);
    expect(blocks[0]).toMatch(/alt="[^"]*failure\.png[^"]*image\/png[^"]*"/);

    const summary = scenarioSummary(
      html,
      'pays an invoice after a gateway timeout',
    );
    expect(summary).toContain('Passed');
    expect(summary).not.toContain('<img');
  });

  it('renders 3 of 5 and only the first three earlier attempts', async () => {
    const results = [0, 1, 2, 3, 4].map((retry) =>
      attemptResult({ retry, message: `Error: failure ${retry + 1}` }),
    );
    results.push(attemptResult({ retry: 5, status: 'passed', duration: 100 }));
    const { envelopes } = await parsePlaywrightJson(
      retryReport([retrySpec('retries five times', results)]),
      'synthetic-retry.json',
    );
    const html = await renderHtml(envelopes, { title: 'Five retries' });
    const blocks = earlierBlocks(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('Earlier attempts (3 of 5)');
    expect(blocks[0]?.match(/<li\b/g) ?? []).toHaveLength(3);
    for (const attempt of [1, 2, 3]) {
      expect(blocks[0]).toContain(`Attempt ${attempt}`);
    }
    expect(blocks[0]).not.toContain('Attempt 4');
    expect(blocks[0]).not.toContain('Attempt 5');
    expect(html).not.toContain('Error: failure 4');

    const summary = scenarioSummary(html, 'retries five times');
    expect(summary).toContain('Passed');
  });

  it('escapes HTML, ANSI and bidi in earlier messages and attachment names', async () => {
    const value = JSON.parse(await readFile(retryFixture, 'utf8')) as unknown;
    const { envelopes } = await parsePlaywrightJson(value, retryFixture);
    const earlierStart = envelopes.find(
      (envelope) => envelope.testCaseStarted?.attempt === 0,
    )?.testCaseStarted;
    if (!earlierStart) throw new Error('expected the earlier start');
    const earlierResult = envelopes.find(
      (envelope) =>
        envelope.testStepFinished?.testCaseStartedId === earlierStart.id,
    )?.testStepFinished;
    if (!earlierResult) throw new Error('expected the earlier result');
    earlierResult.testStepResult.message =
      'Error: <script>alert("x")</script> \u001b[31mred\u001b[0m \u202Eevil\u202C';
    const earlierAttachment = envelopes.find(
      (envelope) => envelope.attachment?.testCaseStartedId === earlierStart.id,
    )?.attachment;
    if (!earlierAttachment) throw new Error('expected the earlier image');
    earlierAttachment.fileName = '<img src=x onerror=alert(1)>.png';

    const html = await renderHtml(envelopes, { title: 'Escaping' });
    const block = earlierBlocks(html)[0] ?? '';
    expect(block).toContain(
      'Error: &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    expect(block).not.toContain('<script>alert');
    expect(block).not.toContain('\u001b');
    expect(block).not.toContain('\u202e');
    expect(block).not.toContain('\u202c');
    expect(block).toContain('&lt;img src=x onerror=alert(1)&gt;.png');
    expect(block).not.toContain('<img src=x');
  });

  it('localizes the block and keeps the German status and duration', async () => {
    const english = en as unknown as Record<string, string>;
    const german = de as unknown as Record<string, string>;
    expect(english['report.earlierAttempts']).toMatch(/earlier attempts/i);
    expect(english['report.earlierAttempt']).toMatch(/attempt/i);
    expect(english['report.earlierAttemptImage']).toMatch(/attempt/i);
    expect(german['report.earlierAttempts']).toBeTruthy();
    expect(german['report.earlierAttempt']).toBeTruthy();
    expect(german['report.earlierAttemptImage']).toBeTruthy();

    const html = await renderReport(retryFixture, {
      title: 'Wiederholung',
      locale: 'de',
    });
    const block = earlierBlocks(html)[0] ?? '';
    expect(block).toContain('Fehlgeschlagen');
    expect(block).toContain('1,20 s');
  });

  it('renders no earlier block for legacy and single-attempt reports', async () => {
    const legacy = await renderReport(legacyFixture('happy.json'), {
      title: 'Legacy',
    });
    expect(legacy).not.toContain('class="earlierAttempts"');
    expect(legacy).not.toContain('Earlier attempts');

    const single = await renderReport(messagesFixture('screenshot.ndjson'), {
      title: 'Single',
    });
    expect(single).not.toContain('class="earlierAttempts"');
  });

  it('keeps the earlier block visible and unbroken in print', () => {
    expect(REPORT_CSS).toContain('.earlierAttempts');
    const print = REPORT_CSS.slice(REPORT_CSS.indexOf('@media print'));
    expect(print).toMatch(/\.earlierAttempts[^{]*\{[^}]*break-inside:\s*avoid/);
    expect(print).not.toMatch(/\.earlierAttempts[^{]*\{[^}]*display:\s*none/);
  });

  it('keeps earlier evidence out of JSON, CI, email and history', async () => {
    const summary = await summarizeReport(retryFixture);
    expect(summary.schemaVersion).toBe(2);
    expect(Object.keys(summary.scenarios[0] ?? {})).not.toContain(
      'earlierAttempts',
    );

    let stdout = '';
    const code = await runCli([retryFixture, '--json'], {
      stdout: (text) => {
        stdout += text;
      },
      stderr: () => undefined,
    });
    expect(code).toBe(0);
    const json = JSON.parse(stdout) as Record<string, unknown>;
    expect(json.schemaVersion).toBe(2);
    expect(JSON.stringify(json)).not.toMatch(/earlier/i);

    for (const format of ['github', 'azure', 'markdown'] as const) {
      expect(formatCiOutput(summary, format)).not.toMatch(/earlier/i);
    }

    const email = renderEmail(summary, {
      title: 'Retry evidence',
      now: new Date('2026-11-22T00:00:00.000Z'),
    });
    expect(email).not.toMatch(/earlier attempts/i);

    const history = buildHistoryRun(
      summary,
      'Retry evidence',
      new Date('2026-11-22T00:00:00.000Z'),
    );
    expect(HISTORY_SCHEMA_VERSION).toBe(1);
    expect(JSON.stringify(history)).not.toMatch(/earlier/i);
  });
});
