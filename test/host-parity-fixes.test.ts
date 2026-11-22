import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseLegacyJson } from '../src/input/legacy.js';
import { renderReport, summarizeReport } from '../src/index.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempInput(name: string, content: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-host-parity-'));
  tempDirs.push(dir);
  const file = path.join(dir, name);
  await writeFile(file, content, 'utf8');
  return file;
}

describe('JUnit nested classes', () => {
  it('splits one testsuite into one feature per classname', async () => {
    const file = await tempInput(
      'nested-classes.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="surefire">
  <testsuite name="PaymentsTest" tests="3" failures="1" time="0.06">
    <testcase name="outer passes" classname="Outer" time="0.01"/>
    <testcase name="nested passes" classname="Outer$Nested" time="0.02"/>
    <testcase name="nested fails" classname="Outer$Nested" time="0.03">
      <failure message="nested boom">AssertionError: nested boom</failure>
    </testcase>
  </testsuite>
</testsuites>`,
    );

    const summary = await summarizeReport(file);
    const byName = new Map(
      summary.scenarios.map((scenario) => [scenario.name, scenario]),
    );
    const outer = byName.get('outer passes');
    const nestedPass = byName.get('nested passes');
    const nestedFail = byName.get('nested fails');

    expect(summary.counts.features).toBe(2);
    expect(summary.counts.scenarios).toMatchObject({
      total: 3,
      passed: 2,
      failed: 1,
    });
    expect(new Set(summary.scenarios.map((scenario) => scenario.feature)).size).toBe(2);
    expect(outer?.feature).not.toBe(nestedPass?.feature);
    expect(outer?.feature).toBe('Outer');
    expect(nestedPass?.feature).toBe('Outer$Nested');
    expect(nestedFail?.feature).toBe(nestedPass?.feature);

    expect(outer).toMatchObject({ status: 'passed', durationMs: 10 });
    expect(nestedPass).toMatchObject({ status: 'passed', durationMs: 20 });
    expect(nestedFail).toMatchObject({ status: 'failed', durationMs: 30 });
    expect(nestedFail?.steps[0]?.message).toContain('nested boom');
    expect(
      summary.scenarios.every((scenario) =>
        scenario.uri.endsWith('nested-classes.xml'),
      ),
    ).toBe(true);

    const html = await renderReport(file, { title: 'Nested classes' });
    expect(html).toContain(outer?.feature);
    expect(html).toContain(nestedPass?.feature);
    expect(html).toContain('outer passes');
    expect(html).toContain('nested fails');
  });

  it('keeps a one-class suite as one feature', async () => {
    const file = await tempInput(
      'one-class.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="checkout" tests="2">
    <testcase name="guest checkout" classname="checkout.Cart" time="0.01"/>
    <testcase name="coupon checkout" classname="checkout.Cart" time="0.02"/>
  </testsuite>
</testsuites>`,
    );

    const summary = await summarizeReport(file);

    expect(summary.counts.features).toBe(1);
    expect(summary.scenarios.map((scenario) => scenario.feature)).toEqual([
      'checkout',
      'checkout',
    ]);
  });

  it('splits a dotted outer classname shape', async () => {
    const file = await tempInput(
      'dotted-classes.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="dotted" tests="2">
    <testcase name="outer" classname="Outer" time="0.01"/>
    <testcase name="inner" classname="Outer.Inner" time="0.02"/>
  </testsuite>
</testsuites>`,
    );

    const summary = await summarizeReport(file);
    const byName = new Map(
      summary.scenarios.map((scenario) => [scenario.name, scenario]),
    );

    expect(summary.counts.features).toBe(2);
    expect(byName.get('outer')?.feature).toBe('Outer');
    expect(byName.get('inner')?.feature).toBe('Outer.Inner');
  });

  it('keeps a classname-template suite as one feature', async () => {
    const file = await tempInput(
      'jest-classnames.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="jest tests">
  <testsuite name="jest tests" tests="3">
    <testcase name="guest checkout" classname="checkout.guest guest checkout" time="0.01"/>
    <testcase name="expired coupon" classname="checkout.guest expired coupon" time="0.02"/>
    <testcase name="slow payment" classname="checkout.payment slow payment" time="0.03"/>
  </testsuite>
</testsuites>`,
    );

    const summary = await summarizeReport(file);

    expect(summary.counts.features).toBe(1);
    expect(summary.counts.scenarios).toMatchObject({ total: 3, passed: 3 });
    expect(
      summary.scenarios.every((scenario) => scenario.feature === 'jest tests'),
    ).toBe(true);
  });

  it('keeps unclassed cases in a suite feature beside nested classes', async () => {
    const file = await tempInput(
      'mixed-classes.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="mixed suite" tests="3">
    <testcase name="outer passes" classname="Outer" time="0.01"/>
    <testcase name="nested passes" classname="Outer$Nested" time="0.02"/>
    <testcase name="loose passes" time="0.03"/>
  </testsuite>
</testsuites>`,
    );

    const summary = await summarizeReport(file);
    const byName = new Map(
      summary.scenarios.map((scenario) => [scenario.name, scenario]),
    );

    expect(summary.counts.features).toBe(3);
    expect(summary.counts.scenarios).toMatchObject({ total: 3, passed: 3 });
    expect(byName.get('outer passes')?.feature).toBe('Outer');
    expect(byName.get('nested passes')?.feature).toBe('Outer$Nested');
    expect(byName.get('loose passes')?.feature).toBe('mixed suite');
    expect(
      summary.scenarios.every((scenario) =>
        scenario.uri.endsWith('mixed-classes.xml'),
      ),
    ).toBe(true);
  });

  it('keeps two suites with the same nested classnames as separate features', async () => {
    const file = await tempInput(
      'two-suites.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="first suite" tests="2">
    <testcase name="first outer" classname="Outer" time="0.01"/>
    <testcase name="first nested" classname="Outer$Nested" time="0.02"/>
  </testsuite>
  <testsuite name="second suite" tests="2">
    <testcase name="second outer" classname="Outer" time="0.03"/>
    <testcase name="second nested" classname="Outer$Nested" time="0.04"/>
  </testsuite>
</testsuites>`,
    );

    const summary = await summarizeReport(file);
    const byName = new Map(
      summary.scenarios.map((scenario) => [scenario.name, scenario]),
    );

    expect(summary.counts.features).toBe(4);
    expect(summary.counts.scenarios).toMatchObject({ total: 4, passed: 4 });
    expect(byName.get('first outer')?.feature).toBe('Outer');
    expect(byName.get('first nested')?.feature).toBe('Outer$Nested');
    expect(byName.get('second outer')?.feature).toBe('Outer');
    expect(byName.get('second nested')?.feature).toBe('Outer$Nested');

    const html = await renderReport(file, { title: 'Two suites' });
    expect(html.match(/<details class="feature /g)).toHaveLength(4);
  });
});

function hookOutputLegacy(
  beforeOutput?: string | string[] | null,
  afterOutput?: string | string[] | null,
): string {
  return JSON.stringify([
    {
      uri: 'features/hook-output.feature',
      name: 'Hook output',
      elements: [
        {
          keyword: 'Scenario',
          type: 'scenario',
          name: 'Hook output scenario',
          before: [
            {
              keyword: 'Before ',
              hidden: true,
              result: { status: 'passed', duration: 1 },
              ...(beforeOutput !== undefined ? { output: beforeOutput } : {}),
            },
          ],
          steps: [
            {
              keyword: 'Given ',
              name: 'a step',
              result: { status: 'passed', duration: 1 },
            },
          ],
          after: [
            {
              keyword: 'After ',
              hidden: true,
              result: { status: 'passed', duration: 1 },
              ...(afterOutput !== undefined ? { output: afterOutput } : {}),
            },
          ],
        },
      ],
    },
  ]);
}

describe('legacy hook output', () => {
  it('attaches before and after hook output as text attachments', async () => {
    const content = hookOutputLegacy(
      ['Runs before @foo', 'second line'],
      'After line',
    );
    const envelopes = parseLegacyJson(content, 'hook-output.json', {
      idPrefix: 'hook',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const attachments = envelopes.flatMap((envelope) =>
      envelope.attachment ? [envelope.attachment] : [],
    );
    const before = attachments.find(
      (attachment) => attachment.fileName === 'Before hook output',
    );
    const after = attachments.find(
      (attachment) => attachment.fileName === 'After hook output',
    );

    expect(attachments).toHaveLength(2);
    expect(before).toMatchObject({
      mediaType: 'text/plain',
      contentEncoding: 'IDENTITY',
      body: 'Runs before @foo\nsecond line',
    });
    expect(after).toMatchObject({
      mediaType: 'text/plain',
      contentEncoding: 'IDENTITY',
      body: 'After line',
    });

    const testCase = envelopes.find((envelope) => envelope.testCase)?.testCase;
    const hookStepIds = new Set(
      (testCase?.testSteps ?? [])
        .filter((testStep) => testStep.hookId)
        .map((testStep) => testStep.id),
    );
    expect(hookStepIds.size).toBe(2);
    for (const attachment of attachments) {
      expect(hookStepIds.has(attachment.testStepId ?? '')).toBe(true);
      expect(attachment.testCaseStartedId).toBeTruthy();
    }

    const file = await tempInput('hook-output.json', content);
    const summary = await summarizeReport(file);
    expect(summary.counts.scenarios).toMatchObject({ total: 1, passed: 1 });
    expect(summary.scenarios[0]?.attachments).toBe(2);
    expect(summary.attachments.total).toBe(2);
    expect(summary.attachments.bytes).toBe(
      Buffer.byteLength('Runs before @foo\nsecond line', 'utf8') +
        Buffer.byteLength('After line', 'utf8'),
    );

    const html = await renderReport(file, { title: 'Hook output' });
    const hookBlocks = [
      ...html.matchAll(/<li class="hook"[^>]*>([\s\S]*?)<\/li>/g),
    ].map((match) => match[1] ?? '');
    const beforeBlock = hookBlocks.find((block) =>
      block.includes('Before hook output'),
    );
    const afterBlock = hookBlocks.find((block) =>
      block.includes('After hook output'),
    );

    expect(beforeBlock).toContain('text/plain');
    expect(beforeBlock).toContain('Runs before @foo');
    expect(beforeBlock).toContain('second line');
    expect(afterBlock).toContain('After line');
  });

  it('attaches output from inline steps hooks', () => {
    const content = JSON.stringify([
      {
        uri: 'features/inline-hook-output.feature',
        name: 'Inline hook output',
        elements: [
          {
            keyword: 'Scenario',
            type: 'scenario',
            name: 'Inline hook scenario',
            steps: [
              {
                keyword: 'Before ',
                hidden: true,
                result: { status: 'passed', duration: 1 },
                output: 'Before inline output',
              },
              {
                keyword: 'Given ',
                name: 'a step',
                result: { status: 'passed', duration: 1 },
              },
              {
                keyword: 'After ',
                hidden: true,
                result: { status: 'passed', duration: 1 },
                output: ['After inline output'],
              },
            ],
          },
        ],
      },
    ]);
    const envelopes = parseLegacyJson(content, 'inline-hook-output.json', {
      idPrefix: 'hook',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const attachments = envelopes.flatMap((envelope) =>
      envelope.attachment ? [envelope.attachment] : [],
    );

    expect(attachments).toHaveLength(2);
    expect(attachments.map((attachment) => attachment.fileName)).toEqual([
      'Before hook output',
      'After hook output',
    ]);
    expect(attachments.map((attachment) => attachment.body)).toEqual([
      'Before inline output',
      'After inline output',
    ]);
    expect(
      attachments.every(
        (attachment) =>
          attachment.mediaType === 'text/plain' &&
          attachment.contentEncoding === 'IDENTITY',
      ),
    ).toBe(true);
  });

  it('adds no extra attachment when hook output is absent', async () => {
    const content = hookOutputLegacy();
    const envelopes = parseLegacyJson(content, 'no-hook-output.json', {
      idPrefix: 'hook',
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(envelopes.filter((envelope) => envelope.attachment)).toHaveLength(0);

    const file = await tempInput('no-hook-output.json', content);
    const summary = await summarizeReport(file);
    expect(summary.scenarios[0]?.attachments).toBe(0);
    expect(summary.attachments.total).toBe(0);

    const html = await renderReport(file, { title: 'No hook output' });
    expect(html).not.toContain('Before hook output');
    expect(html).not.toContain('After hook output');
  });

  it('treats empty and null hook output as absent', () => {
    const outputs: Array<string | string[] | null> = ['', [], null];

    for (const output of outputs) {
      const envelopes = parseLegacyJson(
        hookOutputLegacy(output, output),
        'empty-hook-output.json',
        { idPrefix: 'hook', startedAt: new Date('2026-01-01T00:00:00.000Z') },
      );
      expect(
        envelopes.filter((envelope) => envelope.attachment),
        JSON.stringify(output),
      ).toHaveLength(0);
    }
  });

  it('ignores output on non-hook steps', () => {
    const envelopes = parseLegacyJson(
      JSON.stringify([
        {
          uri: 'features/non-hook.feature',
          name: 'Non-hook output',
          elements: [
            {
              keyword: 'Scenario',
              type: 'scenario',
              name: 'Non-hook scenario',
              steps: [
                {
                  keyword: 'Given ',
                  name: 'a step',
                  output: { ignored: true },
                  result: { status: 'passed', duration: 1 },
                },
              ],
            },
          ],
        },
      ]),
      'non-hook-output.json',
      { idPrefix: 'hook', startedAt: new Date('2026-01-01T00:00:00.000Z') },
    );

    expect(envelopes.filter((envelope) => envelope.attachment)).toHaveLength(0);
  });
});
