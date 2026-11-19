import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { messagesFixture } from '../fixtures.js';
import {
  removeReport,
  reportUrl,
  writeInput,
  writeReport,
} from './helpers.js';

const examplesFixture = messagesFixture('examples-tables.ndjson');

test('groups outlines and keeps triage, search and tag filters usable', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [examplesFixture],
    'Outlines',
    'tolkira-outline-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    await expect(page.locator('section.outline')).toHaveCount(2);
    await expect(page.locator('section.examples')).toHaveCount(3);
    await expect(page.locator('.exampleNo')).toHaveCount(7);
    await expect(
      page.locator('.triageScenario').filter({ hasText: 'These are failing #2.1' }),
    ).toBeVisible();

    await page
      .locator('.triageScenario')
      .filter({ hasText: 'These are failing #2.1' })
      .click();
    const failed = page.locator('[data-scenario][data-example="#2.1"]');
    await expect(failed).toHaveAttribute('open', '');
    await expect(failed.locator('summary')).toBeFocused();

    await expect(
      page.locator('[data-example="#1.1"][data-scenario-name="Eating cucumbers"]'),
    ).not.toHaveAttribute('open', '');
    await expect(
      page.locator('[data-example="#2.1"][data-scenario-name="Eating cucumbers"]'),
    ).toHaveAttribute('open', '');

    const search = page.getByRole('searchbox', { name: /Search/ });
    await search.fill('Eating cucumbers with <friends> friends');
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('section.examples:visible')).toHaveCount(1);
    await expect(page.locator('details.scenario:visible')).toHaveCount(3);

    await search.fill('These are failing');
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('section.examples:visible')).toHaveCount(1);
    await expect(page.locator('details.scenario:visible')).toHaveCount(2);

    await search.fill('');
    const tagFilter = page.locator('select[data-tag-filter]');
    await tagFilter.selectOption('@passing');
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('section.examples:visible')).toHaveCount(1);
    await expect(page.locator('details.scenario:visible')).toHaveCount(2);

    await tagFilter.selectOption('@failing');
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('section.examples:visible')).toHaveCount(1);
    await expect(page.locator('details.scenario:visible')).toHaveCount(2);
    await expect(
      page.locator('details.scenario:visible .exampleNo').first(),
    ).toHaveText('#2.1');

    await tagFilter.selectOption('');
    await expect(page.locator('details.scenario:visible')).toHaveCount(7);
    await expect(
      page.locator('details.scenario:visible .exampleNo').first(),
    ).toHaveText('#1.1');

    const failedFilter = page.locator('button.filter[data-filter-status="failed"]');
    await failedFilter.click();
    await expect(page.locator('details.scenario:visible')).toHaveCount(5);
    await expect(page.locator('section.outline:visible')).toHaveCount(2);
    await expect(page.locator('section.examples:visible')).toHaveCount(2);
    await failedFilter.click();

    const passedFilter = page.locator('button.filter[data-filter-status="passed"]');
    await passedFilter.click();
    await expect(page.locator('details.scenario:visible')).toHaveCount(2);
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('section.examples:visible')).toHaveCount(1);
    await passedFilter.click();
    await expect(page.locator('details.scenario:visible')).toHaveCount(7);
  } finally {
    await removeReport(dir);
  }
});

test('does not duplicate a retried outline row', async ({ page }) => {
  const lines = (await readFile(examplesFixture, 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, any>);
  const pickle = lines.find((line) => line.pickle?.astNodeIds?.length === 2)
    ?.pickle;
  const testCase = lines.find(
    (line) => line.testCase?.pickleId === pickle?.id,
  )?.testCase;
  const started = lines.find(
    (line) => line.testCaseStarted?.testCaseId === testCase?.id,
  )?.testCaseStarted;
  const finished = lines.find(
    (line) => line.testCaseFinished?.testCaseStartedId === started?.id,
  )?.testCaseFinished;
  const stepFinished = lines.find(
    (line) => line.testStepFinished?.testCaseStartedId === started?.id,
  )?.testStepFinished;
  expect(pickle && started && finished && stepFinished).toBeTruthy();
  const retryId = `${started.id}-retry`;
  lines.push(
    {
      testCaseStarted: {
        ...started,
        id: retryId,
        attempt: 1,
        timestamp: { seconds: 10, nanos: 0 },
      },
    },
    {
      testStepFinished: {
        ...stepFinished,
        testCaseStartedId: retryId,
        timestamp: { seconds: 10, nanos: 0 },
        testStepResult: {
          ...stepFinished.testStepResult,
          status: 'FAILED',
        },
      },
    },
    {
      testCaseFinished: {
        ...finished,
        testCaseStartedId: retryId,
        timestamp: { seconds: 10, nanos: 0 },
      },
    },
  );
  const input = await writeInput(
    'outline-retry.ndjson',
    `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    'tolkira-outline-retry-input-',
  );
  const { dir, output } = await writeReport(
    [input.file],
    'Retry',
    'tolkira-outline-retry-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const retried = page.locator(
      '[data-example="#1.1"][data-scenario-name="Eating cucumbers"]',
    );
    await expect(retried).toHaveCount(1);
    await expect(retried).toHaveAttribute('data-status', 'failed');
  } finally {
    await removeReport(dir);
    await removeReport(input.dir);
  }
});

test('caps grouped outline search at 20 rows', async ({ page }) => {
  const input = await writeInput(
    'many-outlines.ndjson',
    outlineNdjson(30),
    'tolkira-outline-cap-input-',
  );
  const { dir, output } = await writeReport(
    [input.file],
    'Many outlines',
    'tolkira-outline-cap-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const search = page.getByRole('searchbox', { name: /Search/ });
    await search.fill('Stress outline');
    await expect(page.locator('details.scenario[open]')).toHaveCount(20);
    await expect(page.locator('#tolkira-search-note')).toContainText(
      '20 of 30 matches expanded',
    );
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('section.examples:visible')).toHaveCount(1);

    await search.fill('Outline description line.');
    await expect(page.locator('details.scenario[open]')).toHaveCount(20);
    await search.fill('Examples description line.');
    await expect(page.locator('details.scenario[open]')).toHaveCount(20);

    await search.fill('');
    await expect(page.locator('details.scenario[open]')).toHaveCount(0);
  } finally {
    await removeReport(dir);
    await removeReport(input.dir);
  }
});

function outlineNdjson(count: number): string {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: `r${index + 1}`,
    cells: [{ value: String(index + 1) }],
  }));
  const envelopes: Array<Record<string, unknown>> = [
    { testRunStarted: { timestamp: { seconds: 1, nanos: 0 } } },
    {
      gherkinDocument: {
        uri: 'features/many-outlines.feature',
        comments: [],
        feature: {
          name: 'Many outline examples',
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
                description: 'Outline description line.',
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
                    description: 'Examples description line.',
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
          uri: 'features/many-outlines.feature',
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
