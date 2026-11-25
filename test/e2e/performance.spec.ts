import { expect, test } from '@playwright/test';
import { removeReport, reportUrl, writeInput, writeReport } from './helpers.js';

test('loads and searches a 1,000-row non-passed report within budget', async ({
  page,
}) => {
  test.slow();
  const input = await writeInput(
    'non-passed.ndjson',
    nonPassedNdjson(1000),
    'tolkira-non-passed-input-',
  );
  const { dir, output } = await writeReport(
    [input.file],
    'Stress non-passed',
    'tolkira-non-passed-e2e-',
  );

  try {
    const loadStarted = Date.now();
    await page.goto(reportUrl(output));
    await expect(page.locator('details.scenario[open]')).toHaveCount(1000);
    expect(Date.now() - loadStarted).toBeLessThan(10_000);

    const searchStarted = Date.now();
    await page
      .getByRole('searchbox', { name: 'Search scenarios' })
      .fill('Non-passed scenario 1000');
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 1000 scenarios visible',
    );
    expect(Date.now() - searchStarted).toBeLessThan(10_000);
  } finally {
    await removeReport(dir);
    await removeReport(input.dir);
  }
});

function nonPassedNdjson(count: number): string {
  const envelopes: Array<Record<string, unknown>> = [
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
          children: Array.from({ length: count }, (_, index) => {
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
          }),
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
            { id: `ts${n}`, pickleStepId: `ps${n}`, stepDefinitionIds: [] },
          ],
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
              code: `Given("an undefined step ${n}", () => {})`,
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
