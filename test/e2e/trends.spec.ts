import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { messagesFixture } from '../fixtures.js';
import {
  removeReport,
  reportUrl,
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
