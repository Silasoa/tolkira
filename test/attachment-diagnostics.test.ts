import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatCiOutput } from '../src/ci.js';
import { renderEmail } from '../src/email.js';
import { generateReport, summarizeReport } from '../src/index.js';
import { loadEnvelopes } from '../src/input/load.js';
import { parseMessages } from '../src/input/messages.js';
import { buildReportModel, type ReportScenario } from '../src/report/model.js';
import { renderHtml } from '../src/render/html.js';
import {
  SKIP_REASON,
  SKIP_WHERE,
  attachmentReport,
  attachmentTexts,
  skipMore,
  skipNotice,
  writeAttachmentReport,
} from './attachments.js';
import { messagesFixture } from './fixtures.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(prefix = 'tolkira-attachment-test-'): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function writeJson(
  dir: string,
  name: string,
  value: unknown,
): Promise<string> {
  const file = path.join(dir, name);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return file;
}

// ReportScenario.skippedAttachments is optional and only set for a positive
// count; a missing field and an explicit zero both mean "no skip".
function skippedCount(scenario: ReportScenario | undefined): number {
  const optional = scenario as
    | (ReportScenario & { skippedAttachments?: number })
    | undefined;
  return optional?.skippedAttachments ?? 0;
}

// The scenario detail, including nested passed-hook details.
function scenarioBlock(html: string, name: string): string {
  const marker = `data-scenario-name="${name}"`;
  const markerIndex = html.indexOf(marker);
  expect(markerIndex, `scenario ${name}`).toBeGreaterThan(-1);
  const start = html.lastIndexOf('<details class="scenario"', markerIndex);
  let depth = 0;
  let index = start;
  while (index < html.length) {
    const open = html.indexOf('<details', index);
    const close = html.indexOf('</details>', index);
    if (close < 0) return html.slice(start);
    if (open >= 0 && open < close) {
      depth += 1;
      index = open + 8;
    } else {
      depth -= 1;
      index = close + 10;
      if (depth === 0) return html.slice(start, index);
    }
  }
  return html.slice(start);
}

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function shellNotice(html: string): string {
  return (
    /<div class="noticeShell"><div class="attachmentWarning"[^>]*>([\s\S]*?)<\/div><\/div>/.exec(
      html,
    )?.[1] ?? ''
  );
}

// The report escapes the catalog notice, including its apostrophes.
function escapedNotice(count: number): string {
  return skipNotice(count).replace(/'/g, '&#39;');
}

interface SkippedEntry {
  name: string;
  reason: string;
}

// ReportScenario gains the entries with the implementation; the cast keeps the
// Red run on runtime behaviour instead of a static type error.
function skippedEntries(
  scenario: ReportScenario | undefined,
): SkippedEntry[] {
  const optional = scenario as
    | (ReportScenario & { skippedAttachmentEntries?: SkippedEntry[] })
    | undefined;
  return optional?.skippedAttachmentEntries ?? [];
}

interface RetriedReport {
  suites: Array<{
    specs: Array<{
      tests: Array<{
        status: string;
        results: Array<Record<string, unknown>>;
      }>;
    }>;
  }>;
}

interface AttachmentReport {
  suites: Array<{
    specs: Array<{
      title: string;
      id: string;
      tests: Array<{
        status: string;
        results: Array<{
          retry: number;
          attachments: unknown[];
          [field: string]: unknown;
        }>;
        [field: string]: unknown;
      }>;
      [field: string]: unknown;
    }>;
  }>;
}

function twoScenarioReport(
  outsideAttachments: unknown[],
  insideAttachments: unknown[],
): unknown {
  const report = attachmentReport([]) as AttachmentReport;
  const suite = report.suites[0];
  const template = suite?.specs[0];
  const test = template?.tests[0];
  const result = test?.results[0];
  if (!suite || !template || !test || !result) {
    throw new Error('attachmentReport has no spec template');
  }
  const spec = (title: string, id: string, attachments: unknown[]) => ({
    ...template,
    title,
    id,
    tests: [
      {
        ...test,
        results: [{ ...result, retry: 0, attachments }],
      },
    ],
  });
  suite.specs = [
    spec('outside scenario', 'attachments-outside', outsideAttachments),
    spec('inside scenario', 'attachments-inside', insideAttachments),
  ];
  return report;
}

async function messagesWithSkippedCount(raw: string): Promise<string> {
  const sentinel = '__skipped_count__';
  const lines = (await readFile(messagesFixture('hooks.ndjson'), 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  for (const line of lines) {
    const started = line.testCaseStarted as Record<string, unknown> | undefined;
    if (started) started.skippedAttachments = sentinel;
  }
  return lines
    .map((line) => JSON.stringify(line))
    .join('\n')
    .replaceAll(
      `"skippedAttachments":"${sentinel}"`,
      `"skippedAttachments":${raw}`,
    );
}

interface HookLine {
  pickle?: { id: string; name: string };
  testCase?: {
    id: string;
    pickleId: string;
    testSteps: Array<{ id: string; hookId?: string }>;
  };
  testCaseStarted?: { id: string; testCaseId: string };
  testStepFinished?: {
    testCaseStartedId: string;
    testStepId: string;
    testStepResult: { status: string; message?: string };
  };
  attachment?: Record<string, unknown>;
}

describe('attachment diagnostics', () => {
  it('shows a per-scenario notice with the final-attempt skip count', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-attachment-outside-');
    const first = path.join(outside, 'first.md');
    const second = path.join(outside, 'second.md');
    const firstSecret = 'first outside secret must not be read';
    const secondSecret = 'second outside secret must not be read';
    await writeFile(first, firstSecret, 'utf8');
    await writeFile(second, secondSecret, 'utf8');
    const input = await writeAttachmentReport(dir, [
      { name: 'first', contentType: 'text/plain', path: first },
      { name: 'second', contentType: 'text/plain', path: second },
    ]);
    const control = await writeAttachmentReport(dir, [], 'control.json');

    const generated = await generateReport(input, {
      title: 'Attachment diagnostics',
    });
    const model = buildReportModel(await loadEnvelopes(input));
    const scenario = model.scenarios.find(
      (entry) => entry.name === 'attachment test',
    );
    const detail = scenarioBlock(generated.html, 'attachment test');

    // The scenario owns the notice, once, with the count and both entries.
    // These are the Red assertions for the new behaviour; soft so every gap is
    // reported.
    expect.soft(skippedCount(scenario)).toBe(2);
    expect.soft(skippedEntries(scenario)).toEqual([
      { name: 'first', reason: 'outside' },
      { name: 'second', reason: 'outside' },
    ]);
    expect.soft(detail).toContain('<div class="attachmentWarning"');
    expect.soft(detail).toContain('class="attachmentSkipList"');
    expect.soft(occurrences(detail, escapedNotice(2))).toBe(1);
    expect.soft(detail).toContain(
      `<li><code>first</code> - ${SKIP_REASON.outside}</li>`,
    );
    expect.soft(detail).toContain(
      `<li><code>second</code> - ${SKIP_REASON.outside}</li>`,
    );
    expect.soft(detail).not.toContain('attachmentSkipMore');

    // Run-level count and notice stay, now generic and pointing at scenarios.
    expect(generated.skippedAttachments).toBe(2);
    expect(generated.html).toContain('<div class="noticeShell">');
    expect(occurrences(generated.html, escapedNotice(2))).toBe(2);
    expect(generated.html).toContain(SKIP_WHERE);
    expect(shellNotice(generated.html)).not.toContain(SKIP_REASON.outside);

    // Outside roots are counted, never read or embedded.
    expect(scenario?.attachments).toEqual([]);
    expect(attachmentTexts(await loadEnvelopes(input))).toEqual([]);
    expect(generated.html).not.toContain(firstSecret);
    expect(generated.html).not.toContain(secondSecret);

    // JSON, CI and email stay a function of the unchanged summary.
    const controlSummary = await summarizeReport(control);
    expect(JSON.stringify(generated.summary, null, 2)).toBe(
      JSON.stringify(controlSummary, null, 2),
    );
    const now = new Date('2026-11-22T00:00:00.000Z');
    const email = renderEmail(generated.summary, { now });
    expect(email).toBe(renderEmail(controlSummary, { now }));
    expect(email).not.toContain('path attachment');
    for (const format of ['markdown', 'github'] as const) {
      expect(formatCiOutput(generated.summary, format)).toBe(
        formatCiOutput(controlSummary, format),
      );
    }
  });

  it('renders an inside-root attachment without a scenario notice', async () => {
    const dir = await tempDir();
    const inside = 'inside root attachment body';
    await writeFile(path.join(dir, 'inside-note.txt'), inside, 'utf8');
    const input = await writeAttachmentReport(
      dir,
      [
        {
          name: 'inside',
          contentType: 'text/plain',
          path: 'inside-note.txt',
        },
      ],
      'inside.json',
    );

    const generated = await generateReport(input, { title: 'Inside root' });
    const model = buildReportModel(await loadEnvelopes(input));
    const scenario = model.scenarios.find(
      (entry) => entry.name === 'attachment test',
    );

    expect(generated.skippedAttachments).toBe(0);
    expect(skippedCount(scenario)).toBe(0);
    expect(skippedEntries(scenario)).toEqual([]);
    expect(scenario?.attachments).toHaveLength(1);
    expect(generated.html).toContain(inside);
    expect(generated.html).not.toContain('<div class="attachmentWarning"');
    expect(generated.html).not.toContain('class="attachmentSkipList"');
    expect(generated.html).not.toContain(escapedNotice(1));
    expect(generated.html).not.toContain(escapedNotice(2));
  });

  it('does not show a notice when an earlier attempt skipped and the final one is clean', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-attachment-outside-');
    const earlier = path.join(outside, 'earlier.md');
    const earlierSecret = 'earlier attempt must not be read';
    await writeFile(earlier, earlierSecret, 'utf8');
    const report = attachmentReport([]) as RetriedReport;
    const test = report.suites[0]?.specs[0]?.tests[0];
    if (!test) throw new Error('attachmentReport has no test');
    const baseResult = test.results[0];
    if (!baseResult) throw new Error('attachmentReport has no result');
    test.status = 'flaky';
    test.results = [
      {
        ...baseResult,
        retry: 0,
        attachments: [
          { name: 'earlier', contentType: 'text/plain', path: earlier },
        ],
      },
      { ...baseResult, retry: 1, attachments: [] },
    ];
    const input = await writeJson(dir, 'retried.json', report);

    const generated = await generateReport(input, { title: 'Retried' });
    const model = buildReportModel(await loadEnvelopes(input));
    const scenario = model.scenarios.find(
      (entry) => entry.name === 'attachment test',
    );

    expect(scenario?.attempt).toBe(1);
    expect(generated.skippedAttachments).toBe(0);
    expect(skippedCount(scenario)).toBe(0);
    expect(skippedEntries(scenario)).toEqual([]);
    expect(generated.html).not.toContain('<div class="attachmentWarning"');
    expect(generated.html).not.toContain('class="attachmentSkipList"');
    expect(generated.html).not.toContain(earlierSecret);
  });

  it('marks only the scenario whose final attempt skipped an attachment', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-attachment-outside-');
    const outsideFile = path.join(outside, 'outside.md');
    const outsideSecret = 'outside two-scenario secret must not be read';
    const insideName = 'inside-note.txt';
    const insideBody = 'inside two-scenario attachment body';
    await writeFile(outsideFile, outsideSecret, 'utf8');
    await writeFile(path.join(dir, insideName), insideBody, 'utf8');
    const input = await writeJson(
      dir,
      'two-scenarios.json',
      twoScenarioReport(
        [{ name: 'outside', contentType: 'text/plain', path: outsideFile }],
        [{ name: 'inside', contentType: 'text/plain', path: insideName }],
      ),
    );

    const generated = await generateReport(input, { title: 'Two scenarios' });
    const model = buildReportModel(await loadEnvelopes(input));
    const outsideScenario = model.scenarios.find(
      (entry) => entry.name === 'outside scenario',
    );
    const insideScenario = model.scenarios.find(
      (entry) => entry.name === 'inside scenario',
    );
    const outsideDetail = scenarioBlock(generated.html, 'outside scenario');
    const insideDetail = scenarioBlock(generated.html, 'inside scenario');

    expect(generated.skippedAttachments).toBe(1);
    expect(skippedCount(outsideScenario)).toBe(1);
    expect(skippedEntries(outsideScenario)).toEqual([
      { name: 'outside', reason: 'outside' },
    ]);
    expect(outsideScenario?.attachments).toEqual([]);
    expect(outsideDetail).toContain('<div class="attachmentWarning"');
    expect(occurrences(outsideDetail, escapedNotice(1))).toBe(1);
    expect(outsideDetail).toContain(
      `<li><code>outside</code> - ${SKIP_REASON.outside}</li>`,
    );
    expect(skippedCount(insideScenario)).toBe(0);
    expect(skippedEntries(insideScenario)).toEqual([]);
    expect(insideDetail).not.toContain('<div class="attachmentWarning"');
    expect(insideDetail).toContain(insideBody);
    expect(insideScenario?.attachments.map((entry) => entry.fileName)).toEqual([
      'inside',
    ]);
    expect(occurrences(generated.html, escapedNotice(1))).toBe(2);
    expect(occurrences(generated.html, SKIP_WHERE)).toBe(1);
    expect(generated.html).not.toContain(outsideSecret);
  });

  it('ignores an untrusted skipped-attachment count in plain Messages', async () => {
    const dir = await tempDir();
    const control = path.join(dir, 'control.ndjson');
    await writeFile(
      control,
      await readFile(messagesFixture('hooks.ndjson'), 'utf8'),
      'utf8',
    );
    const controlSummary = await summarizeReport(control);
    const now = new Date('2026-11-22T00:00:00.000Z');
    const controlEmail = renderEmail(controlSummary, { now });
    const controlMarkdown = formatCiOutput(controlSummary, 'markdown');
    const controlGithub = formatCiOutput(controlSummary, 'github');
    const values: Array<[string, string]> = [
      ['infinity', '1e999'],
      ['string', '"2"'],
      ['boolean', 'true'],
      ['array', '[2]'],
      ['zero', '0'],
      ['negative', '-1'],
      ['fraction', '1.5'],
    ];

    for (const [label, raw] of values) {
      const file = path.join(dir, `${label}.ndjson`);
      await writeFile(file, await messagesWithSkippedCount(raw), 'utf8');

      const generated = await generateReport(file, {
        title: 'Untrusted count',
      });
      const model = buildReportModel(await loadEnvelopes(file));

      expect(model.scenarios.length, label).toBeGreaterThan(0);
      expect(
        model.scenarios.every((entry) => skippedCount(entry) === 0),
        label,
      ).toBe(true);
      expect(
        model.scenarios.every((entry) => skippedEntries(entry).length === 0),
        label,
      ).toBe(true);
      expect(generated.skippedAttachments, label).toBe(0);
      expect(generated.html, label).not.toContain(
        '<div class="attachmentWarning"',
      );
      expect(JSON.stringify(generated.summary, null, 2), label).toBe(
        JSON.stringify(controlSummary, null, 2),
      );
      expect(renderEmail(generated.summary, { now }), label).toBe(controlEmail);
      expect(formatCiOutput(generated.summary, 'markdown'), label).toBe(
        controlMarkdown,
      );
      expect(formatCiOutput(generated.summary, 'github'), label).toBe(
        controlGithub,
      );
    }
  });

  it('counts a missing attachment but not trace or inline attachments', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-attachment-outside-');
    const trace = path.join(outside, 'trace.zip');
    const inlineBody = 'inline attachment body';
    await writeFile(trace, 'trace marker', 'utf8');
    const input = await writeAttachmentReport(
      dir,
      [
        { name: 'trace', contentType: 'application/zip', path: trace },
        {
          name: 'inline',
          contentType: 'text/plain',
          body: Buffer.from(inlineBody, 'utf8').toString('base64'),
        },
        { name: 'missing', contentType: 'text/plain', path: 'missing.md' },
      ],
      'counted-missing.json',
    );

    const generated = await generateReport(input, { title: 'Counted missing' });
    const model = buildReportModel(await loadEnvelopes(input));
    const scenario = model.scenarios.find(
      (entry) => entry.name === 'attachment test',
    );

    expect(generated.skippedAttachments).toBe(1);
    expect(skippedCount(scenario)).toBe(1);
    expect(skippedEntries(scenario)).toEqual([
      { name: 'missing', reason: 'missing' },
    ]);
    expect(scenario?.attachments.map((entry) => entry.fileName)).toEqual([
      'inline',
    ]);
    expect(generated.html).toContain('<div class="attachmentWarning"');
    expect(generated.html).toContain(
      `<li><code>missing</code> - ${SKIP_REASON.missing}</li>`,
    );
    expect(generated.html).not.toContain('trace marker');
    expect(generated.html).toContain(inlineBody);
  });

  it('lists three of five skips with their own reasons and counts the rest', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-attachment-outside-');
    const secret = path.join(outside, 'secret.png');
    await writeFile(secret, 'outside secret must not be read', 'utf8');
    await mkdir(path.join(dir, 'shots'));
    const input = await writeAttachmentReport(
      dir,
      [
        { name: 'outside.png', contentType: 'image/png', path: secret },
        { name: 'missing.png', contentType: 'image/png', path: 'missing.png' },
        { name: 'shots', contentType: 'image/png', path: 'shots' },
        {
          name: 'remote.png',
          contentType: 'image/png',
          path: 'http://example.com/secret.png',
        },
        { name: 'later.png', contentType: 'image/png', path: 'later.png' },
      ],
      'five-skips.json',
    );

    const generated = await generateReport(input, { title: 'Five skips' });
    const model = buildReportModel(await loadEnvelopes(input));
    const scenario = model.scenarios.find(
      (entry) => entry.name === 'attachment test',
    );
    const detail = scenarioBlock(generated.html, 'attachment test');

    expect(generated.skippedAttachments).toBe(5);
    expect(skippedCount(scenario)).toBe(5);
    expect(skippedEntries(scenario)).toEqual([
      { name: 'outside.png', reason: 'outside' },
      { name: 'missing.png', reason: 'missing' },
      { name: 'shots', reason: 'not-regular' },
    ]);
    expect(detail).toContain(
      `<li><code>outside.png</code> - ${SKIP_REASON.outside}</li>`,
    );
    expect(detail).toContain(
      `<li><code>missing.png</code> - ${SKIP_REASON.missing}</li>`,
    );
    expect(detail).toContain(
      `<li><code>shots</code> - ${SKIP_REASON['not-regular']}</li>`,
    );
    expect(occurrences(detail, '<li><code>')).toBe(3);
    expect(detail).toContain(skipMore(2));
    expect(generated.html).not.toContain('outside secret must not be read');
  });

  it('lists a mixed outside, missing and non-local reason', async () => {
    const dir = await tempDir();
    const outside = await tempDir('tolkira-attachment-outside-');
    const secret = path.join(outside, 'secret.png');
    await writeFile(secret, 'outside secret must not be read', 'utf8');
    const input = await writeAttachmentReport(
      dir,
      [
        { name: 'outside.png', contentType: 'image/png', path: secret },
        { name: 'missing.png', contentType: 'image/png', path: 'missing.png' },
        {
          name: 'file.png',
          contentType: 'image/png',
          path: 'file:///etc/passwd',
        },
      ],
      'mixed-reasons.json',
    );

    const generated = await generateReport(input, { title: 'Mixed' });
    const model = buildReportModel(await loadEnvelopes(input));
    const scenario = model.scenarios.find(
      (entry) => entry.name === 'attachment test',
    );
    const detail = scenarioBlock(generated.html, 'attachment test');

    expect(skippedEntries(scenario)).toEqual([
      { name: 'outside.png', reason: 'outside' },
      { name: 'missing.png', reason: 'missing' },
      { name: 'file.png', reason: 'non-local' },
    ]);
    expect(detail).toContain(SKIP_REASON.outside);
    expect(detail).toContain(SKIP_REASON.missing);
    expect(detail).toContain(SKIP_REASON['non-local']);
    expect(detail).not.toContain('attachmentSkipMore');
  });

  it('escapes a skipped name that looks like HTML', async () => {
    const dir = await tempDir();
    const input = await writeAttachmentReport(
      dir,
      [
        {
          name: '<img src=x onerror=alert(1)>.png',
          contentType: 'image/png',
          path: 'missing.png',
        },
      ],
      'html-name.json',
    );

    const generated = await generateReport(input, { title: 'Escaped name' });
    const detail = scenarioBlock(generated.html, 'attachment test');

    expect(detail).toContain(
      `&lt;img src=x onerror=alert(1)&gt;.png</code> - ${SKIP_REASON.missing}`,
    );
    expect(generated.html).not.toContain('<img src=x');
  });

  it('renders a failed hook attachment beside the hook and in the scenario list', async () => {
    const hooks = messagesFixture('hooks.ndjson');
    const hookText = 'failed hook attachment body';
    const lines = (await readFile(hooks, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as HookLine);
    const pickle = lines.find(
      (line) => line.pickle?.name === 'No tags and a passed step',
    )?.pickle;
    if (!pickle) throw new Error('missing hooks pickle');
    const testCase = lines.find(
      (line) => line.testCase?.pickleId === pickle.id,
    )?.testCase;
    const started = lines.find(
      (line) => line.testCaseStarted?.testCaseId === testCase?.id,
    )?.testCaseStarted;
    const hookStep = testCase?.testSteps.find((step) => step.hookId);
    if (!testCase || !started || !hookStep) {
      throw new Error('missing hook test step');
    }
    const finished = lines.find(
      (line) =>
        line.testStepFinished?.testCaseStartedId === started.id &&
        line.testStepFinished.testStepId === hookStep.id,
    )?.testStepFinished;
    if (!finished) throw new Error('missing hook result');
    finished.testStepResult.status = 'FAILED';
    finished.testStepResult.message = 'hook boom';
    lines.push({
      attachment: {
        body: Buffer.from(hookText, 'utf8').toString('base64'),
        contentEncoding: 'BASE64',
        fileName: 'hook-note.txt',
        mediaType: 'text/plain',
        testCaseStartedId: started.id,
        testStepId: hookStep.id,
      },
    });

    const envelopes = parseMessages(
      lines.map((line) => JSON.stringify(line)).join('\n'),
      'hook-attachment.ndjson',
    );
    const model = buildReportModel(envelopes);
    const scenario = model.scenarios.find(
      (entry) => entry.name === 'No tags and a passed step',
    );
    const html = await renderHtml(envelopes, { title: 'Hook attachment' });
    const failedHook =
      /<li class="hook" data-status="failed">[\s\S]*?<\/li>/.exec(html)?.[0] ??
      '';

    expect(scenario).toBeDefined();
    expect(scenario?.hooks.find((hook) => hook.status === 'failed')).toBeTruthy();
    expect(scenario?.attachments.map((entry) => entry.fileName)).toContain(
      'hook-note.txt',
    );
    expect(failedHook).toContain('hook-note.txt');
    expect(failedHook).toContain(hookText);
  });
});
