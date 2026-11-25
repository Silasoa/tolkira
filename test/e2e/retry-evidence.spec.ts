import { expect, test } from '@playwright/test';
import { playwrightFixture } from '../fixtures.js';
import {
  removeReport,
  reportUrl,
  writeReport,
  type ReportFile,
} from './helpers.js';

const retryFixture = playwrightFixture('retry-evidence.json');
let report: ReportFile | undefined;

test.beforeAll(async () => {
  report = await writeReport(
    [retryFixture],
    'Retry evidence',
    'tolkira-retry-evidence-e2e-',
  );
});

test.afterAll(async () => {
  if (report) await removeReport(report.dir);
});

function output(): string {
  if (!report) throw new Error('report was not written');
  return report.output;
}

test('keeps the earlier-attempts disclosure usable at 320px and 200% zoom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(reportUrl(output()));

  await page.locator('details.feature summary').first().click();
  await page.locator('details.scenario summary.scenarioButton').first().click();
  const details = page.locator('details.earlierAttempts').first();
  await expect(details).toBeVisible();
  expect(await details.getAttribute('open')).toBeNull();
  await expect(details.locator('summary')).toContainText(
    'Earlier attempts (1)',
  );

  await details.locator('summary').click();
  await expect(details.locator('.earlierAttemptMessage')).toContainText(
    'payment gateway timed out',
  );
  await expect(details.locator('.shot')).toBeVisible();

  const viewportOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(viewportOverflow, 'document overflow at 320px').toBeLessThanOrEqual(1);

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  const zoomOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(zoomOverflow, 'document overflow at 200% text').toBeLessThanOrEqual(1);
  const blockOverflow = await details.evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  );
  expect(
    blockOverflow,
    'earlier block overflow at 200% text',
  ).toBeLessThanOrEqual(1);
  const box = await details.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x, 'earlier block left edge').toBeGreaterThanOrEqual(-0.5);
  expect(box!.x + box!.width, 'earlier block right edge').toBeLessThanOrEqual(
    321,
  );
});

test.describe('without scripting', () => {
  test.use({ javaScriptEnabled: false });

  test('opens the earlier attempts natively', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(reportUrl(output()));

    await page.locator('details.feature summary').first().click();
    await page
      .locator('details.scenario summary.scenarioButton')
      .first()
      .click();
    const details = page.locator('details.earlierAttempts').first();
    await expect(details).toBeVisible();
    expect(await details.getAttribute('open')).toBeNull();
    await details.locator('summary').click();
    await expect(details.locator('.earlierAttemptMessage')).toBeVisible();
    await expect(details.locator('.shot')).toBeVisible();
  });
});

test('opens earlier attempts for print', async ({ page }) => {
  await page.setViewportSize({ width: 794, height: 1200 });
  await page.goto(reportUrl(output()));
  await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
  });
  await page.emulateMedia({ media: 'print' });

  const details = page.locator('details.earlierAttempts').first();
  await expect(details).toHaveAttribute('open', '');
  await expect(details.locator('summary')).toContainText(
    'Earlier attempts (1)',
  );
  await expect(details.locator('.earlierAttemptMessage')).toBeVisible();
  await expect(details.locator('.shot')).toBeVisible();
});
