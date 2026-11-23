import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  removeReport,
  reportUrl,
  writeInput,
  writeReport,
} from './helpers.js';

const LONG_NAME = `screenshot-${'a'.repeat(160)}.png`;
const MIB = 1024 * 1024;

function sizeMessages(largeBytes = 0): string {
  const attachments = [
    { body: 'tiny', fileName: 'tiny.txt', mediaType: 'text/plain' },
    { body: 'm'.repeat(500), fileName: 'medium.txt', mediaType: 'text/plain' },
    {
      body: 'l'.repeat(5_000),
      fileName: LONG_NAME,
      mediaType: 'text/plain',
    },
    ...(largeBytes > 0
      ? [
          {
            body: 'x'.repeat(largeBytes),
            fileName: 'large.txt',
            mediaType: 'text/plain',
          },
        ]
      : []),
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

async function sizeMetaTracks(page: Page): Promise<string[]> {
  return page
    .locator('dl.sizeMeta')
    .evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(/\s+/).filter(Boolean),
    );
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

test('shows exact bytes with MB above 1 MiB without overflow', async ({
  page,
}) => {
  const input = await writeInput('size-large.ndjson', sizeMessages(1_100_000));
  const report = await writeReport([input.file], 'Size large');
  try {
    const bytes = Buffer.byteLength(
      await readFile(report.output, 'utf8'),
      'utf8',
    );
    const mb = new Intl.NumberFormat('en', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(bytes / MIB);
    expect(bytes).toBeGreaterThan(MIB);

    const check = async (label: string): Promise<void> => {
      const row = page
        .locator('dl.sizeMeta dt', { hasText: 'Report HTML' })
        .locator('xpath=following-sibling::dd[1]');
      await expect(row, `${label} report row`).toBeVisible();
      const text = (await row.textContent())?.trim() ?? '';
      expect(text, `${label} leading count`).toMatch(
        new RegExp(`^${bytes} `),
      );
      expect(text, `${label} MB`).toContain(`(${mb}\u00a0MB)`);
      await expectNoOverflow(page, label);
    };

    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(reportUrl(report.output));
      await page.getByRole('tab', { name: 'Details' }).click();
      await check(`${width}px`);
    }

    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(reportUrl(report.output));
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    await page.getByRole('tab', { name: 'Details' }).click();
    await check('320px at 200% text');
  } finally {
    await removeReport(report.dir);
    await removeReport(input.dir);
  }
});

test('stacks the German Details run panel and keeps the wide layout', async ({
  page,
}) => {
  const input = await writeInput(
    'size-large-de.ndjson',
    sizeMessages(1_100_000),
  );
  const report = await writeReport(
    [input.file],
    'Size large de',
    'tolkira-size-de-e2e-',
    'de',
  );
  try {
    const bytes = Buffer.byteLength(
      await readFile(report.output, 'utf8'),
      'utf8',
    );
    expect(bytes).toBeGreaterThan(MIB);
    const grouped = new Intl.NumberFormat('de').format(bytes);

    await page.setViewportSize({ width: 560, height: 900 });
    await page.goto(reportUrl(report.output));
    await page.getByRole('tab', { name: 'Details' }).click();
    const sizeMeta = page.locator('dl.sizeMeta');
    await expect(sizeMeta, 'German size panel').toBeVisible();

    const narrowTracks = await sizeMetaTracks(page);
    expect(narrowTracks, '560px used tracks').toHaveLength(1);
    for (const track of narrowTracks) {
      expect(track, '560px track is used px').toMatch(
        /^-?\d+(?:\.\d+)?px$/,
      );
    }

    const stacked = await sizeMeta.evaluate((list) => {
      const dt = list.querySelector('dt');
      const dd = list.querySelector('dd');
      if (!dt || !dd) return undefined;
      return {
        dt: dt.getBoundingClientRect().top,
        dd: dd.getBoundingClientRect().top,
      };
    });
    expect(stacked, '560px label and value positions').toBeDefined();
    expect(stacked!.dd, '560px value below label').toBeGreaterThan(
      stacked!.dt,
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    const wideTracks = await sizeMetaTracks(page);
    expect(wideTracks, '1440px used tracks').toHaveLength(2);
    for (const track of wideTracks) {
      expect(track, '1440px track is used px').toMatch(/^-?\d+(?:\.\d+)?px$/);
    }

    await page.setViewportSize({ width: 320, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    const row = page
      .locator('dl.sizeMeta dt', { hasText: 'Bericht-HTML' })
      .locator('xpath=following-sibling::dd[1]');
    await expect(row, '320px German report row').toBeVisible();
    const lines = await row.evaluate((element, text) => {
      const node = [...element.childNodes].find(
        (child) =>
          child.nodeType === Node.TEXT_NODE &&
          (child.textContent ?? '').includes(text),
      );
      if (!node) return -1;
      const content = node.textContent ?? '';
      const start = content.indexOf(text);
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + text.length);
      return range.getClientRects().length;
    }, grouped);
    expect(lines, '320px grouped byte count lines').toBe(1);
    await expectNoOverflow(page, '320px at 200% text');
  } finally {
    await removeReport(report.dir);
    await removeReport(input.dir);
  }
});
