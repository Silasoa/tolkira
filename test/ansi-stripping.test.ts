import type { Envelope } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import { parseMessages } from '../src/input/messages.js';
import { renderHtml } from '../src/render/html.js';
import { buildReportModel } from '../src/report/model.js';
import { summarizeEnvelopes } from '../src/summary.js';

const ESC = '\u001b';

const HOSTILE =
  `${ESC}]8;;https://evil.example/${ESC}\\link${ESC}]8;;${ESC}\\` +
  `${ESC}]52;c;cHduZWQ=\u0007clip` +
  `${ESC}Pdcs payload${ESC}\\` +
  `${ESC}_apc payload${ESC}\\` +
  `${ESC}(Btwo-byte` +
  `\u009d52;c;c1-osc\u0007c1clip` +
  `\u0090c1-dcs\u009c` +
  `\u009b1mc1-csi\u009b0m` +
  `\u0000\u0007\u007f\u0085\u009f`;

const VISIBLE = 'linkcliptwo-bytec1clipc1-csi';

function envelopes(): Envelope[] {
  const lines: unknown[] = [
    {
      meta: {
        protocolVersion: '27.0.2',
        implementation: {},
        runtime: {},
        os: {},
        cpu: {},
      },
    },
    {
      gherkinDocument: {
        uri: 'features/ansi.feature',
        comments: [],
        feature: {
          tags: [],
          location: { line: 1, column: 1 },
          language: 'en',
          keyword: 'Feature',
          name: 'ANSI',
          description: '',
          children: [
            {
              scenario: {
                id: 'scenario',
                tags: [],
                location: { line: 2, column: 3 },
                keyword: 'Scenario',
                name: 'stripped',
                description: '',
                steps: [
                  {
                    id: 'step',
                    location: { line: 3, column: 5 },
                    keyword: 'Given ',
                    keywordType: 'Context',
                    text: 'x',
                  },
                ],
                examples: [],
              },
            },
          ],
        },
      },
    },
    {
      pickle: {
        id: 'p',
        uri: 'features/ansi.feature',
        name: 'stripped',
        language: 'en',
        astNodeIds: ['scenario'],
        tags: [],
        steps: [{ id: 'ps', text: 'x', astNodeIds: ['step'] }],
      },
    },
    {
      hook: {
        id: 'h',
        type: 'BEFORE_TEST_CASE',
        name: 'before hook',
        sourceReference: { uri: 'features/steps.ts', location: { line: 1 } },
      },
    },
    {
      testCase: {
        id: 'tc',
        pickleId: 'p',
        testSteps: [
          { id: 'hs', hookId: 'h' },
          { id: 'ss', pickleStepId: 'ps' },
        ],
      },
    },
    { testRunStarted: { id: 'run', timestamp: { seconds: 0, nanos: 0 } } },
    {
      testRunHookStarted: {
        id: 'rhs',
        testRunStartedId: 'run',
        hookId: 'h',
        timestamp: { seconds: 0, nanos: 1 },
      },
    },
    {
      testRunHookFinished: {
        testRunHookStartedId: 'rhs',
        timestamp: { seconds: 0, nanos: 2 },
        result: {
          status: 'FAILED',
          duration: { seconds: 0, nanos: 1 },
          message: HOSTILE,
        },
      },
    },
    {
      testCaseStarted: {
        id: 'tcs',
        testCaseId: 'tc',
        attempt: 0,
        timestamp: { seconds: 0, nanos: 3 },
      },
    },
    {
      testStepFinished: {
        testCaseStartedId: 'tcs',
        testStepId: 'hs',
        testStepResult: {
          status: 'FAILED',
          duration: { seconds: 0, nanos: 1 },
          message: HOSTILE,
        },
        timestamp: { seconds: 0, nanos: 4 },
      },
    },
    {
      testStepFinished: {
        testCaseStartedId: 'tcs',
        testStepId: 'ss',
        testStepResult: {
          status: 'FAILED',
          duration: { seconds: 0, nanos: 1 },
          message: HOSTILE,
        },
        timestamp: { seconds: 0, nanos: 5 },
      },
    },
    {
      testCaseFinished: {
        testCaseStartedId: 'tcs',
        timestamp: { seconds: 0, nanos: 6 },
        willBeRetried: false,
      },
    },
    {
      testRunFinished: {
        testRunStartedId: 'run',
        timestamp: { seconds: 0, nanos: 7 },
        success: false,
      },
    },
  ];
  return parseMessages(lines.map((line) => JSON.stringify(line)).join('\n'), 'ansi.ndjson');
}

describe('ANSI escape stripping in report text', () => {
  it('strips step, hook and run-hook messages in the report model', () => {
    const model = buildReportModel(envelopes());
    const scenario = model.scenarios[0];

    expect(scenario?.steps[0]?.message).toBe(VISIBLE);
    expect(scenario?.hooks[0]?.message).toBe(VISIBLE);
    expect(model.runHooks[0]?.message).toBe(VISIBLE);
  });

  it('strips step and hook messages in the machine-readable summary', () => {
    const summary = summarizeEnvelopes(envelopes());
    const steps = summary.scenarios[0]?.steps ?? [];
    const hook = steps.find((step) => step.keyword === 'Hook');

    expect(hook?.message).toBe(VISIBLE);
    expect(steps.find((step) => step.keyword === 'Given')?.message).toBe(VISIBLE);
  });

  it('never emits escape sequences or terminal payloads into HTML', async () => {
    const input = envelopes();
    const html = await renderHtml(input, { title: 'ANSI' });

    expect(html).not.toContain(ESC);
    expect(html).not.toContain(']52;');
    expect(html).not.toContain(']8;;');
    expect(html).not.toContain('dcs payload');
    expect(html).not.toContain('apc payload');
    // oxlint-disable-next-line no-control-regex
    expect(html).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/);
    expect(html).toContain(VISIBLE);
  });
});
