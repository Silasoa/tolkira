import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { messagesFixture } from '../fixtures.js';
import {
  legacyFlakyReport,
  removeReport,
  reportUrl,
  writeInput,
  writeReportWithHistory,
  type ReportFile,
} from './helpers.js';

const firstInput = messagesFixture('second.ndjson');
const secondInput = messagesFixture('all-statuses.ndjson');

function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

async function expectWithinViewport(
  page: Page,
  locator: Locator,
  label: string,
): Promise<void> {
  await expect(locator, label).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} has a box`).not.toBeNull();
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(box!.x, `${label} left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(box!.x + box!.width, `${label} right edge`).toBeLessThanOrEqual(
    viewportWidth + 1,
  );
}

async function twoRunHistory(): Promise<{
  historyDir: string;
  first: ReportFile;
  second: ReportFile;
}> {
  const historyDir = await mkdtemp(path.join(tmpdir(), 'tolkira-trends-history-'));
  const history = path.join(historyDir, 'history.json');
  try {
    const first = await writeReportWithHistory(
      [firstInput],
      history,
      'Trends first',
    );
    const second = await writeReportWithHistory(
      [secondInput],
      history,
      'Trends second',
    );
    return { historyDir, first, second };
  } catch (error) {
    await rm(historyDir, { recursive: true, force: true });
    throw error;
  }
}

async function removeAll(
  historyDir: string,
  reports: Array<ReportFile | undefined>,
): Promise<void> {
  for (const report of reports) {
    if (report) await removeReport(report.dir);
  }
  if (historyDir) await rm(historyDir, { recursive: true, force: true });
}

test('shows the Trends tab from the second run and switches by keyboard', async ({
  page,
}) => {
  let first: ReportFile | undefined;
  let second: ReportFile | undefined;
  let historyDir = '';
  try {
    ({ historyDir, first, second } = await twoRunHistory());

    await page.goto(reportUrl(first.output));
    await expect(page.getByRole('tab', { name: 'Trends' })).toHaveCount(0);
    await expect(page.locator('#report-view')).toBeVisible();

    await page.goto(reportUrl(second.output));
    await expect(page.getByRole('tab', { name: 'Trends' })).toBeVisible();
    await page.getByRole('tab', { name: 'Trends' }).click();

    await expect(page.locator('#trends-view')).toBeVisible();
    await expect(page.locator('#report-view')).toBeHidden();
    await expect(page.getByRole('tab', { name: 'Trends' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const rows = page.locator('#trends-view tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Trends second');
    await expect(rows.last()).toContainText('Trends first');
    await expect(rows.first()).toContainText(/\d+(\.\d)?%/);

    await page.getByRole('tab', { name: 'Report' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Details' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Trends' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Trends' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('#trends-view')).toBeVisible();
    await expect(page.locator('#analysis-view')).toBeHidden();

    await page.keyboard.press('Home');
    await expect(page.getByRole('tab', { name: 'Report' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('#report-view')).toBeVisible();
    await expect(page.locator('#trends-view')).toBeHidden();
  } finally {
    await removeAll(historyDir, [first, second]);
  }
});

test('keeps one tab row and an anchored scenario visible at 320 and 200% text zoom', async ({
  page,
}) => {
  let first: ReportFile | undefined;
  let second: ReportFile | undefined;
  let historyDir = '';
  try {
    ({ historyDir, first, second } = await twoRunHistory());
    const url = reportUrl(second.output, '#scenario-1-1');

    async function expectTabRowAndAnchor(
      label: string,
      maxBarHeight: number,
    ): Promise<void> {
      const views = page.locator('.views');
      expect(
        await views.evaluate((element) => getComputedStyle(element).flexWrap),
        `${label} tab wrap`,
      ).toBe('nowrap');

      const tabs = page.getByRole('tab');
      const boxes = await tabs.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().top),
      );
      expect(boxes.length, label).toBeGreaterThanOrEqual(3);
      for (const top of boxes) {
        expect(Math.abs(top - (boxes[0] ?? 0)), `${label} tab row`).toBeLessThan(
          1.5,
        );
      }

      const bar = await page.locator('.topbar').boundingBox();
      expect(bar, `${label} topbar`).not.toBeNull();
      expect(bar!.height, `${label} topbar height`).toBeLessThanOrEqual(
        maxBarHeight,
      );

      await expect
        .poll(async () => {
          const target = await page.locator('#scenario-1-1').boundingBox();
          return target ? target.y - (bar!.y + bar!.height) : -999;
        }, `${label} anchor below the bar`)
        .toBeGreaterThanOrEqual(-1);
    }

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(url);
    await expect(page.locator('#scenario-1-1')).toBeVisible();
    await expectTabRowAndAnchor('320', 120);

    await page.addInitScript(() => {
      document.documentElement.style.fontSize = '32px';
    });
    await page.goto(url);
    await expect(page.locator('#scenario-1-1')).toBeVisible();
    await expectTabRowAndAnchor('320 at 200%', 240);
  } finally {
    await removeAll(historyDir, [first, second]);
  }
});

test('keeps the Trends table usable at 320, 1440 and 200% text zoom', async ({
  page,
}) => {
  let first: ReportFile | undefined;
  let second: ReportFile | undefined;
  let historyDir = '';
  try {
    ({ historyDir, first, second } = await twoRunHistory());
    const url = reportUrl(second.output);
    const region = page.locator('#trends-view .tableWrap');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    await page.getByRole('tab', { name: 'Trends' }).click();
    expect(await pageOverflow(page), '1440 overflow').toBeLessThanOrEqual(1);
    await expectWithinViewport(page, region, 'trends table at 1440');
    await expect(page.locator('#trends-view tbody tr')).toHaveCount(2);

    await page.setViewportSize({ width: 320, height: 700 });
    await page.getByRole('tab', { name: 'Trends' }).click();
    expect(await pageOverflow(page), '320 overflow').toBeLessThanOrEqual(1);
    await expectWithinViewport(page, region, 'trends table at 320');
    expect(
      await region.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
      'trends table scrolls at 320',
    ).toBe(true);

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    expect(
      await pageOverflow(page),
      '320 at 200% text overflow',
    ).toBeLessThanOrEqual(1);
    await expectWithinViewport(page, region, 'trends table at 200%');
    await expect(page.getByRole('tab', { name: 'Trends' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('#trends-view tbody tr')).toHaveCount(2);
  } finally {
    await removeAll(historyDir, [first, second]);
  }
});

test('shows the Flaky count and share at 1440, 390, 320 and 200%', async ({
  page,
}) => {
  let historyDir = '';
  const inputs: string[] = [];
  let first: ReportFile | undefined;
  let second: ReportFile | undefined;
  try {
    historyDir = await mkdtemp(path.join(tmpdir(), 'tolkira-trends-flaky-'));
    const history = path.join(historyDir, 'history.json');
    const flakyInput = await writeInput(
      'flaky.json',
      legacyFlakyReport([0, 1]),
      'tolkira-trends-flaky-input-',
    );
    const plainInput = await writeInput(
      'plain.json',
      legacyFlakyReport([]),
      'tolkira-trends-flaky-input-',
    );
    inputs.push(flakyInput.dir, plainInput.dir);

    first = await writeReportWithHistory(
      [flakyInput.file],
      history,
      'Flaky first',
    );
    second = await writeReportWithHistory(
      [plainInput.file],
      history,
      'Flaky second',
    );
    const url = reportUrl(second.output);
    const region = page.locator('#trends-view .tableWrap');
    const note = (
      JSON.parse(
        await readFile(
          new URL('../../src/i18n/locales/en.json', import.meta.url),
          'utf8',
        ),
      ) as Record<string, { message: string }>
    )['trends.flakyNote']?.message;

    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(url);
      await page.getByRole('tab', { name: 'Trends' }).click();
      const rows = page.locator('#trends-view tbody tr');
      await expect(rows).toHaveCount(2);
      await expect(
        page.getByRole('columnheader', { name: 'Flaky', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('columnheader', { name: 'Flaky share', exact: true }),
      ).toBeVisible();
      expect(note, 'en trends.flakyNote').toBeTruthy();
      await expect(page.locator('#trends-view')).toContainText(note as string);
      await expect(rows.filter({ hasText: 'Flaky first' })).toContainText('5%');
      await expect(rows.filter({ hasText: 'Flaky second' })).toContainText(
        '0%',
      );
      expect(await pageOverflow(page), `${width} overflow`).toBeLessThanOrEqual(
        1,
      );
      await expectWithinViewport(page, region, `trends table at ${width}`);
      const numericCells = await rows
        .first()
        .locator('td.num')
        .evaluateAll((cells) =>
          cells.map((cell) => {
            const range = document.createRange();
            range.selectNodeContents(cell);
            return {
              text: cell.textContent?.trim() ?? '',
              width: cell.getBoundingClientRect().width,
              lines: range.getClientRects().length,
            };
          }),
        );
      expect(numericCells.length, `${width} numeric cells`).toBe(8);
      for (const cell of numericCells) {
        expect(cell.width, `${width} ${cell.text} width`).toBeGreaterThan(30);
        expect(cell.lines, `${width} ${cell.text} lines`).toBe(1);
      }
    }

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    expect(
      await pageOverflow(page),
      '320 at 200% text overflow',
    ).toBeLessThanOrEqual(1);
    await expectWithinViewport(page, region, 'trends table at 200%');
    await expect(
      page.getByRole('columnheader', { name: 'Flaky share', exact: true }),
    ).toBeVisible();
  } finally {
    for (const dir of inputs) await rm(dir, { recursive: true, force: true });
    if (historyDir) await rm(historyDir, { recursive: true, force: true });
    for (const report of [first, second]) {
      if (report) await removeReport(report.dir);
    }
  }
});

test('keeps 5-digit numeric cells on one line at 390 and 320', async ({
  page,
}) => {
  let historyDir = '';
  let inputDir = '';
  let file: ReportFile | undefined;
  try {
    historyDir = await mkdtemp(path.join(tmpdir(), 'tolkira-trends-digits-'));
    const history = path.join(historyDir, 'history.json');
    await writeFile(
      history,
      JSON.stringify({
        schemaVersion: 1,
        runs: [
          {
            id: '5-digit-run',
            recordedAt: '2026-01-05T09:30:00.000Z',
            title: 'Large suite',
            status: 'passed',
            counts: {
              features: 1,
              scenarios: {
                total: 12345,
                passed: 12345,
                failed: 0,
                skipped: 0,
                pending: 0,
                undefined: 0,
                ambiguous: 0,
                unknown: 0,
              },
              steps: {
                total: 12345,
                passed: 12345,
                failed: 0,
                skipped: 0,
                pending: 0,
                undefined: 0,
                ambiguous: 0,
                unknown: 0,
              },
            },
            durationMs: 8_345_000,
            attachments: { total: 0, bytes: 0 },
            flaky: 0,
          },
        ],
      }),
      'utf8',
    );
    const input = await writeInput(
      'plain.json',
      legacyFlakyReport([]),
      'tolkira-trends-digits-input-',
    );
    inputDir = input.dir;
    file = await writeReportWithHistory(
      [input.file],
      history,
      'Five digit current',
    );
    const url = reportUrl(file.output);
    const region = page.locator('#trends-view .tableWrap');

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(url);
      await page.getByRole('tab', { name: 'Trends' }).click();
      const row = page
        .locator('#trends-view tbody tr')
        .filter({ hasText: 'Large suite' });
      await expect(row).toHaveCount(1);
      await expect(row.locator('td').nth(3)).toHaveText('12345');
      await expect(row.locator('td').nth(10)).toHaveText('8345.00 s');
      expect(
        await region.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        ),
        `${width} trends table scrolls`,
      ).toBe(true);
      const numericCells = await row.locator('td.num').evaluateAll((cells) =>
        cells.map((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          return {
            text: cell.textContent?.trim() ?? '',
            width: cell.getBoundingClientRect().width,
            lines: range.getClientRects().length,
          };
        }),
      );
      expect(numericCells.length, `${width} numeric cells`).toBe(8);
      for (const cell of numericCells) {
        expect(cell.width, `${width} ${cell.text} width`).toBeGreaterThan(30);
        expect(cell.lines, `${width} ${cell.text} lines`).toBe(1);
      }
    }
  } finally {
    if (file) await removeReport(file.dir);
    await rm(inputDir, { recursive: true, force: true });
    await rm(historyDir, { recursive: true, force: true });
  }
});
