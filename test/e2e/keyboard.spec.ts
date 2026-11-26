import { expect, test } from '@playwright/test';
import { legacyFixture, messagesFixture } from '../fixtures.js';
import { removeReport, reportUrl, writeReport } from './helpers.js';

const tableFixture = legacyFixture('happy.json');
const hooksFixture = messagesFixture('hooks.ndjson');

test('keeps Details content reachable by keyboard', async ({ page }) => {
  const { dir, output } = await writeReport(
    [tableFixture],
    'Keyboard E2E',
    'tolkira-keys-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    await page.getByRole('tab', { name: 'Details' }).click();
    await page.getByRole('tab', { name: 'Details' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#analysis-view')).toBeFocused();

    await page.keyboard.press('Tab');
    const tableWrap = page.locator('#analysis-view .analysisGrid .tableWrap');
    await expect(tableWrap).toBeFocused();

    await page.keyboard.press('Tab');
    const tagWrap = page.getByRole('region', { name: 'Tag overview' });
    await expect(tagWrap).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#analysis-view pre.json')).toBeFocused();
  } finally {
    await removeReport(dir);
  }
});

test('operates the hooks disclosure by keyboard', async ({ page }) => {
  const { dir, output } = await writeReport(
    [hooksFixture],
    'Hook keyboard',
    'tolkira-hook-keyboard-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const group = page.locator('details.hookGroup').first();
    await group.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(group).toHaveAttribute('open', '');
    await expect(group.locator('.hook').first()).toBeVisible();
  } finally {
    await removeReport(dir);
  }
});
