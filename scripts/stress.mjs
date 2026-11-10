import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const count = Number(process.argv[2] ?? 1000);
const mode = process.argv[3] ?? 'scenarios';

const modes = new Set(['scenarios', 'outlines', 'non-passed']);
if (!Number.isInteger(count) || count < 1) {
  throw new Error(
    'Usage: node scripts/stress.mjs [scenario-count] [scenarios|outlines|non-passed]',
  );
}
if (!modes.has(mode)) {
  throw new Error(
    'Usage: node scripts/stress.mjs [scenario-count] [scenarios|outlines|non-passed]',
  );
}

const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-stress-'));
const input = path.join(
  dir,
  mode === 'scenarios' ? 'stress.json' : 'stress.ndjson',
);
const output = path.join(dir, 'stress.html');

function outlineMessages() {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: `r${index + 1}`,
    cells: [{ value: String(index + 1) }],
  }));
  const envelopes = [
    { testRunStarted: { timestamp: { seconds: 1, nanos: 0 } } },
    {
      gherkinDocument: {
        uri: 'features/stress-outline.feature',
        comments: [],
        feature: {
          name: 'Stress outline feature',
          keyword: 'Feature',
          language: 'en',
          description: '',
          tags: [],
          location: { line: 1, column: 1 },
          children: [
            {
              scenario: {
                id: 's1',
                keyword: 'Scenario Outline',
                name: 'Stress outline <n>',
                description: '',
                tags: [],
                location: { line: 2, column: 1 },
                steps: [
                  {
                    id: 'step1',
                    keyword: 'Given ',
                    keywordType: 'CONTEXT',
                    text: 'value <n>',
                    location: { line: 3, column: 1 },
                  },
                ],
                examples: [
                  {
                    id: 'e1',
                    keyword: 'Examples',
                    name: 'Rows',
                    description: '',
                    tags: [],
                    location: { line: 4, column: 1 },
                    tableHeader: {
                      id: 'h1',
                      location: { line: 5, column: 1 },
                      cells: [{ value: 'n' }],
                    },
                    tableBody: rows,
                  },
                ],
              },
            },
          ],
        },
      },
    },
  ];
  for (let index = 0; index < count; index += 1) {
    const n = index + 1;
    envelopes.push(
      {
        pickle: {
          id: `p${n}`,
          uri: 'features/stress-outline.feature',
          name: `Stress outline ${n}`,
          language: 'en',
          astNodeIds: ['s1', `r${n}`],
          tags: [],
          steps: [{ id: `ps${n}`, text: `value ${n}`, astNodeIds: ['step1'] }],
        },
      },
      {
        testCase: {
          id: `tc${n}`,
          pickleId: `p${n}`,
          testSteps: [{ id: `ts${n}`, pickleStepId: `ps${n}` }],
        },
      },
      {
        testCaseStarted: {
          id: `tcs${n}`,
          testCaseId: `tc${n}`,
          attempt: 0,
          timestamp: { seconds: 1, nanos: n },
        },
      },
      {
        testStepFinished: {
          testCaseStartedId: `tcs${n}`,
          testStepId: `ts${n}`,
          timestamp: { seconds: 1, nanos: n },
          testStepResult: {
            status: 'PASSED',
            duration: { seconds: 0, nanos: 1000000 },
          },
        },
      },
      {
        testCaseFinished: {
          testCaseStartedId: `tcs${n}`,
          timestamp: { seconds: 1, nanos: n },
          willBeRetried: false,
        },
      },
    );
  }
  envelopes.push({
    testRunFinished: { timestamp: { seconds: 2, nanos: 0 }, success: true },
  });
  return envelopes.map((envelope) => JSON.stringify(envelope)).join('\n');
}

function nonPassedMessages() {
  const children = Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return {
      scenario: {
        id: `s${n}`,
        tags: [],
        location: { line: n * 2, column: 3 },
        keyword: 'Scenario',
        name: `Non-passed scenario ${n}`,
        description: '',
        steps: [
          {
            id: `step${n}`,
            location: { line: n * 2 + 1, column: 5 },
            keyword: 'Given ',
            keywordType: 'Context',
            text: `an undefined step ${n}`,
          },
        ],
        examples: [],
      },
    };
  });
  const envelopes = [
    { testRunStarted: { id: 'run', timestamp: { seconds: 1, nanos: 0 } } },
    {
      gherkinDocument: {
        uri: 'features/stress-non-passed.feature',
        comments: [],
        feature: {
          name: 'Stress non-passed feature',
          keyword: 'Feature',
          language: 'en',
          description: '',
          tags: [],
          location: { line: 1, column: 1 },
          children,
        },
      },
    },
  ];
  for (let index = 0; index < count; index += 1) {
    const n = index + 1;
    envelopes.push(
      {
        pickle: {
          id: `p${n}`,
          uri: 'features/stress-non-passed.feature',
          name: `Non-passed scenario ${n}`,
          language: 'en',
          astNodeIds: [`s${n}`],
          tags: [],
          steps: [
            {
              id: `ps${n}`,
              text: `an undefined step ${n}`,
              astNodeIds: [`step${n}`],
            },
          ],
        },
      },
      {
        testCase: {
          id: `tc${n}`,
          pickleId: `p${n}`,
          testSteps: [
            {
              id: `ts${n}`,
              pickleStepId: `ps${n}`,
              stepDefinitionIds: [],
              stepMatchArgumentsLists: [],
            },
          ],
          testRunStartedId: 'run',
        },
      },
      {
        testCaseStarted: {
          id: `tcs${n}`,
          testCaseId: `tc${n}`,
          attempt: 0,
          timestamp: { seconds: 1, nanos: n },
        },
      },
      {
        suggestion: {
          id: `sug${n}`,
          pickleStepId: `ps${n}`,
          snippets: [
            {
              language: 'typescript',
              code: `Given("an undefined step ${n}", () => {\n  return "pending"\n})`,
            },
          ],
        },
      },
      {
        testStepFinished: {
          testCaseStartedId: `tcs${n}`,
          testStepId: `ts${n}`,
          timestamp: { seconds: 1, nanos: n },
          testStepResult: {
            status: 'UNDEFINED',
            duration: { seconds: 0, nanos: 0 },
          },
        },
      },
      {
        testCaseFinished: {
          testCaseStartedId: `tcs${n}`,
          timestamp: { seconds: 1, nanos: n },
          willBeRetried: false,
        },
      },
    );
  }
  envelopes.push({
    testRunFinished: {
      testRunStartedId: 'run',
      timestamp: { seconds: 2, nanos: 0 },
      success: false,
    },
  });
  return envelopes.map((envelope) => JSON.stringify(envelope)).join('\n');
}

const elements = Array.from({ length: count }, (_, index) => ({
  keyword: 'Scenario',
  type: 'scenario',
  name: `Stress scenario ${index + 1}`,
  steps: [
    {
      keyword: 'Given ',
      name: 'step one',
      result: { status: 'passed', duration: 1000 },
    },
    {
      keyword: 'When ',
      name: 'step two',
      result: { status: 'passed', duration: 2000 },
    },
    {
      keyword: 'Then ',
      name: 'step three',
      result: { status: 'passed', duration: 3000 },
    },
  ],
}));

try {
  await writeFile(
    input,
    mode === 'outlines'
      ? outlineMessages()
      : mode === 'non-passed'
        ? nonPassedMessages()
        : `${JSON.stringify([{ uri: 'features/stress.feature', name: 'Stress feature', elements }])}\n`,
    'utf8',
  );

  const started = performance.now();
  const { stdout } = await run(
    process.execPath,
    ['dist/cli.js', input, '--out', output, '--json'],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const elapsedMs = Math.round(performance.now() - started);
  const summary = JSON.parse(stdout);
  const htmlBytes = (await stat(output)).size;
  const maxMs = count <= 1000 ? 1000 : 3000;
  const maxBytes = count <= 1000 ? 5 * 1024 * 1024 : 20 * 1024 * 1024;

  if (summary.counts.scenarios.total !== count) {
    throw new Error(`Expected ${count} scenarios, got ${summary.counts.scenarios.total}`);
  }
  const expectedSteps = mode === 'scenarios' ? count * 3 : count;
  if (summary.counts.steps.total !== expectedSteps) {
    throw new Error(`Expected ${expectedSteps} steps, got ${summary.counts.steps.total}`);
  }
  const html = await readFile(output, 'utf8');
  const openScenarios = (
    html.match(/<details class="scenario"[^>]* open>/g) ?? []
  ).length;
  if (mode === 'non-passed' && openScenarios !== count) {
    throw new Error(
      `Expected ${count} open scenarios, got ${openScenarios}.`,
    );
  }
  if (elapsedMs > maxMs) {
    throw new Error(`Stress run took ${elapsedMs} ms, above the ${maxMs} ms budget.`);
  }
  if (htmlBytes > maxBytes) {
    throw new Error(`Stress report is ${htmlBytes} bytes, above the ${maxBytes} byte budget.`);
  }

  console.log(
    JSON.stringify(
      {
        mode,
        scenarios: count,
        steps: expectedSteps,
        openScenarios,
        elapsedMs,
        htmlBytes,
        htmlMb: Math.round((htmlBytes / 1024 / 1024) * 10) / 10,
        status: summary.status,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
