import { readFile } from 'node:fs/promises';
import type { Envelope } from '@cucumber/messages';
import { describe, expect, it } from 'vitest';
import { parseMessages } from '../src/input/messages.js';
import { buildReportModel } from '../src/report/model.js';
import { renderHtml } from '../src/render/html.js';
import { messagesFixture } from './fixtures.js';

const fixture = messagesFixture('parameters.ndjson');

async function envelopes(): Promise<Envelope[]> {
  return parseMessages(await readFile(fixture, 'utf8'), fixture);
}

async function render(): Promise<string> {
  return renderHtml(await envelopes(), { title: 'Parameters' });
}

function testCaseFor(list: Envelope[], pickleName: string) {
  const pickle = list.find((envelope) => envelope.pickle?.name === pickleName)?.pickle;
  expect(pickle).toBeDefined();
  const testCase = list.find(
    (envelope) => envelope.testCase?.pickleId === pickle?.id,
  )?.testCase;
  expect(testCase).toBeDefined();
  return testCase!;
}

function scenarioHtml(html: string, name: string): string {
  const start = html.indexOf(`data-scenario-name="${name}"`);
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf('</details>', start));
}

describe('step parameter highlighting', () => {
  it('wraps typed arguments and keeps surrounding text', async () => {
    const html = await render();

    expect(html).toContain(
      'I have <span class="param" data-parameter-type="int">12</span> cucumbers',
    );
    expect(html.match(/class="param"/g)).toHaveLength(2);
  });

  it('escapes unsafe argument text inside the parameter span', async () => {
    const html = await render();

    expect(html).toContain(
      'the string <span class="param" data-parameter-type="string">&quot;&lt;script&gt;alert(1)&lt;/script&gt; &amp; &#39;quoted&#39;&quot;</span> is set',
    );
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('falls back to plain escaped text without one match list', async () => {
    const html = await render();

    expect(html).toContain(
      '<span class="kw">Then</span> <span class="stepText">a step with two matches</span>',
    );
    expect(html).toContain(
      '<span class="kw">And</span> <span class="stepText">a plain step</span>',
    );
    expect(html.match(/class="param"/g)).toHaveLength(2);
  });

  it('keeps the plain step text in the search attribute', async () => {
    const html = await render();
    const search =
      html.match(
        /data-scenario-name="Text and markup"[^>]*data-search="([^"]*)"/,
      )?.[1] ?? '';

    expect(search).toContain('the string');
    expect(search).toContain('alert(1)');
    expect(search).toContain('&amp;');
  });

  it('keeps the summary step text unchanged', async () => {
    const list = await envelopes();
    const model = buildReportModel(list);
    const scenario = model.scenarios.find(
      (entry) => entry.name === 'Text and markup',
    );
    const step = scenario?.steps[0];

    expect(step?.text).toBe(
      'the string "<script>alert(1)</script> & \'quoted\'" is set',
    );
  });

  it('falls back to the full text for an out-of-range argument start', async () => {
    const list = await envelopes();
    const testCase = testCaseFor(list, 'Numbers');
    testCase.testSteps[0]!.stepMatchArgumentsLists = [
      {
        stepMatchArguments: [
          { group: { start: 999, value: 'nope' }, parameterTypeName: 'int' },
        ],
      },
    ];

    const html = await renderHtml(list, { title: 'Parameters' });
    const numbers = scenarioHtml(html, 'Numbers');

    expect(numbers).not.toContain('class="param"');
    expect(numbers).toContain(
      '<span class="stepText">I have 12 cucumbers</span>',
    );
  });

  it('falls back to the full text for overlapping arguments', async () => {
    const list = await envelopes();
    const testCase = testCaseFor(list, 'Numbers');
    testCase.testSteps[0]!.stepMatchArgumentsLists = [
      {
        stepMatchArguments: [
          { group: { start: 7, value: '12' }, parameterTypeName: 'int' },
          { group: { start: 7, value: '12' }, parameterTypeName: 'int' },
        ],
      },
    ];

    const html = await renderHtml(list, { title: 'Parameters' });
    const numbers = scenarioHtml(html, 'Numbers');

    expect(numbers).not.toContain('class="param"');
    expect(numbers).toContain(
      '<span class="stepText">I have 12 cucumbers</span>',
    );
  });

  it('falls back to the full text for a truncated argument range', async () => {
    const list = await envelopes();
    const testCase = testCaseFor(list, 'Numbers');
    testCase.testSteps[0]!.stepMatchArgumentsLists = [
      {
        stepMatchArguments: [
          { group: { start: 10, value: 'cucumbers and more' }, parameterTypeName: 'string' },
        ],
      },
    ];

    const html = await renderHtml(list, { title: 'Parameters' });
    const numbers = scenarioHtml(html, 'Numbers');

    expect(numbers).not.toContain('class="param"');
    expect(numbers).toContain(
      '<span class="stepText">I have 12 cucumbers</span>',
    );
  });

  it('falls back to the full text when an argument value does not match', async () => {
    const list = await envelopes();
    const testCase = testCaseFor(list, 'Numbers');
    testCase.testSteps[0]!.stepMatchArgumentsLists = [
      {
        stepMatchArguments: [
          { group: { start: 7, value: '13' }, parameterTypeName: 'int' },
        ],
      },
    ];

    const html = await renderHtml(list, { title: 'Parameters' });
    const numbers = scenarioHtml(html, 'Numbers');

    expect(numbers).not.toContain('class="param"');
    expect(numbers).toContain(
      '<span class="stepText">I have 12 cucumbers</span>',
    );
  });

  it('highlights arguments at the start and end of a step', async () => {
    const list = await envelopes();
    const testCase = testCaseFor(list, 'Numbers');
    testCase.testSteps[0]!.stepMatchArgumentsLists = [
      {
        stepMatchArguments: [
          { group: { start: 0, value: 'I' }, parameterTypeName: 'word' },
          {
            group: { start: 10, value: 'cucumbers' },
            parameterTypeName: 'word',
          },
        ],
      },
    ];

    const html = await renderHtml(list, { title: 'Parameters' });

    expect(html).toContain(
      '<span class="param" data-parameter-type="word">I</span> have 12 <span class="param" data-parameter-type="word">cucumbers</span>',
    );
  });

  it('labels a missing parameter type as anonymous', async () => {
    const list = await envelopes();
    const testCase = testCaseFor(list, 'Numbers');
    testCase.testSteps[0]!.stepMatchArgumentsLists = [
      { stepMatchArguments: [{ group: { start: 7, value: '12' } }] },
    ];

    const html = await renderHtml(list, { title: 'Parameters' });

    expect(html).toContain(
      '<span class="param" data-parameter-type="anonymous">12</span>',
    );
  });
});
