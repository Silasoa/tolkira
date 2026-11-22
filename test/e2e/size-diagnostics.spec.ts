import { expect, test, type Page } from '@playwright/test';
import {
  removeReport,
  reportUrl,
  writeInput,
  writeReport,
} from './helpers.js';

const LONG_NAME = `screenshot-${'a'.repeat(160)}.png`;

function sizeMessages(): string {
  const attachments = [
    { body: 'tiny', fileName: 'tiny.txt', mediaType: 'text/plain' },
    { body: 'm'.repeat(500), fileName: 'medium.txt', mediaType: 'text/plain' },
    {
      body: 'l'.repeat(5_000),
      fileName: LONG_NAME,
      mediaType: 'text/plain',
    },
  ].map((attachment, index) => ({
    ...attachment,
    testCaseStartedId: 'size-started',
    testStepId: 'size-test-step',
    timestamp: { seconds: 1, nanos: 2_000_000 + index },
  }));
  return `${[
    {
      source: {
        data: 'Feature: Size layout\n\n  Scenario: Long attachment name\n    Given an attachment\n',
        uri: 'features/size-layout.feature',
        mediaType: 'text/x.cucumber.gherkin+plain',
      },
    },
    {
      gherkinDocument: {
        uri: 'features/size-layout.feature',
        comments: [],
        feature: {
          tags: [],
          location: { line: 1, column: 1 },
          language: 'en',
          keyword: 'Feature',
          name: 'Size layout',
          description: '',
          children: [
            {
              scenario: {
                id: 'size-scenario',
                tags: [],
                location: { line: 3, column: 3 },
                keyword: 'Scenario',
                name: 'Long attachment name',
                description: '',
                steps: [
                  {
                    id: 'size-step',
                    location: { line: 4, column: 5 },
                    keyword: 'Given ',
                    keywordType: 'Context',
                    text: 'an attachment',
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
        id: 'size-pickle',
        uri: 'features/size-layout.feature',
        astNodeIds: ['size-scenario'],
        tags: [],
        name: 'Long attachment name',
        language: 'en',
        steps: [
          {
            id: 'size-pickle-step',
            text: 'an attachment',
            type: 'Context',
            astNodeIds: ['size-step'],
          },
        ],
      },
    },
    {
      testRunStarted: { id: 'size-run', timestamp: { seconds: 1, nanos: 0 } },
    },
    {
      testCase: {
        id: 'size-test-case',
        pickleId: 'size-pickle',
        testRunStartedId: 'size-run',
        testSteps: [
          { id: 'size-test-step', pickleStepId: 'size-pickle-step' },
        ],
      },
    },
    {
      testCaseStarted: {
        id: 'size-started',
        testCaseId: 'size-test-case',
        attempt: 0,
        timestamp: { seconds: 1, nanos: 1_000_000 },
      },
    },
    ...attachments.map((attachment) => ({ attachment })),
    {
      testStepFinished: {
        testCaseStartedId: 'size-started',
        testStepId: 'size-test-step',
        testStepResult: {
          status: 'PASSED',
          duration: { seconds: 0, nanos: 1_000_000 },
        },
        timestamp: { seconds: 1, nanos: 3_000_000 },
      },
    },
    {
      testCaseFinished: {
        testCaseStartedId: 'size-started',
        timestamp: { seconds: 1, nanos: 4_000_000 },
        willBeRetried: false,
      },
    },
    {
      testRunFinished: {
        testRunStartedId: 'size-run',
        timestamp: { seconds: 1, nanos: 5_000_000 },
        success: true,
      },
    },
  ]
    .map((line) => JSON.stringify(line))
    .join('\n')}\n`;
}

async function expectSizeList(page: Page, label: string): Promise<void> {
  const list = page.locator('.sizeList');
  await expect(list, `${label} size list`).toBeVisible();
  await expect(list, `${label} attachment name`).toContainText(
    LONG_NAME.slice(0, 40),
  );
  const values = list.locator('.sizeValue');
  await expect(values, `${label} size values`).toHaveCount(3);
  const firstItem = list.locator('li').first();
  const firstName = firstItem.locator('.sizeName').first();

  const listBox = await list.boundingBox();
  expect(listBox, `${label} list box`).not.toBeNull();
  const nameBox = await firstName.boundingBox();
  expect(nameBox, `${label} name box`).not.toBeNull();
  expect(nameBox!.width, `${label} name width`).toBeGreaterThanOrEqual(
    listBox!.width / 2,
  );
  const itemBox = await firstItem.boundingBox();
  expect(itemBox, `${label} item box`).not.toBeNull();
  expect(itemBox!.height, `${label} item height`).toBeLessThan(2_000);

  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(listBox!.x, `${label} list left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(
    listBox!.x + listBox!.width,
    `${label} list right edge`,
  ).toBeLessThanOrEqual(viewportWidth + 1);

  const listRight = listBox!.x + listBox!.width;
  for (let index = 0; index < 3; index += 1) {
    const box = await values.nth(index).boundingBox();
    expect(box, `${label} value ${index} box`).not.toBeNull();
    const right = box!.x + box!.width;
    expect(right, `${label} value ${index} right edge`).toBeGreaterThanOrEqual(
      listRight - 1,
    );
    expect(right, `${label} value ${index} right edge`).toBeLessThanOrEqual(
      listRight + 1,
    );
  }
}

async function expectNoOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${label} overflow`).toBeLessThanOrEqual(1);
}

test('keeps the size list inside 320, 390 and 1440 px and 200% text', async ({
  page,
}) => {
  const input = await writeInput('size-layout.ndjson', sizeMessages());
  const report = await writeReport([input.file], 'Size layout');
  try {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(reportUrl(report.output));
      await page.getByRole('tab', { name: 'Details' }).click();
      await expectSizeList(page, `${width}px`);
      await expectNoOverflow(page, `${width}px`);
    }

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(reportUrl(report.output));
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '32px';
      });
      await page.getByRole('tab', { name: 'Details' }).click();
      await expectSizeList(page, `${width}px at 200% text`);
      await expectNoOverflow(page, `${width}px at 200% text`);
    }
  } finally {
    await removeReport(report.dir);
    await removeReport(input.dir);
  }
});
