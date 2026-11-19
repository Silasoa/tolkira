import { expect, test } from '@playwright/test';
import path from 'node:path';
import { legacyFixture } from '../fixtures.js';
import { removeReport, reportUrl, writeReport } from './helpers.js';

const unhappyFixture = legacyFixture('unhappy.json');
const tableFixture = legacyFixture('happy.json');

test('focuses a scenario from the needs-attention index', async ({ page }) => {
  const { dir, output } = await writeReport(
    [unhappyFixture],
    'Triage E2E',
    'tolkira-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const triage = page.getByRole('navigation', { name: 'Needs attention' });
    await expect(triage).toBeVisible();
    const openBefore = await page.locator('[data-scenario][open]').count();

    const link = triage.getByRole('link', { name: /steps are skipped/ });
    await link.focus();
    await expect(link).toBeFocused();
    await link.press('Enter');

    const hash = new URL(page.url()).hash;
    expect(hash).toMatch(/^#scenario-\d+-\d+$/);
    const target = page.locator(hash);
    await expect(target).toBeVisible();
    await expect(target).toHaveJSProperty('open', true);
    await expect(page.locator(`${hash} > summary`)).toBeFocused();
    expect(
      await target.evaluate(
        (element) =>
          element.closest<HTMLDetailsElement>('details[data-feature]')?.open,
      ),
    ).toBe(true);
    await expect(page.locator('[data-scenario][open]')).toHaveCount(openBefore);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator(hash)).toHaveJSProperty('open', true);

    await page.getByRole('button', { name: /^Passed/ }).click();
    await expect(triage).toBeHidden();
    await page.getByRole('button', { name: /^Passed/ }).click();
    await expect(triage).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Search scenarios' });
    await search.fill('Fred');
    await expect(triage).toBeHidden();
    await search.fill('');
    await expect(triage).toBeVisible();

    const tag = page.locator('select[data-tag-filter]');
    await tag.selectOption({ index: 1 });
    await expect(triage).toBeHidden();
    await tag.selectOption('');
    await expect(triage).toBeVisible();
  } finally {
    await removeReport(dir);
  }
});

test('shows a source strip for multiple input files', async ({ page }) => {
  const { dir, output } = await writeReport(
    [unhappyFixture, tableFixture],
    'Sources E2E',
    'tolkira-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const sources = page.getByRole('region', { name: 'Sources' });
    await expect(sources).toBeVisible();
    await expect(sources.getByText('unhappy.json', { exact: true })).toBeVisible();
    await expect(sources.getByText('happy.json', { exact: true })).toBeVisible();
    expect(await sources.innerText()).not.toContain(
      path.dirname(unhappyFixture),
    );

    await page.getByRole('button', { name: /^Passed/ }).click();
    await expect(sources).toBeHidden();
    await page.getByRole('button', { name: /^Passed/ }).click();
    await expect(sources).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Search scenarios' });
    await search.fill('Fred');
    await expect(sources).toBeHidden();
    await search.fill('');
    await expect(sources).toBeVisible();

    const tag = page.locator('select[data-tag-filter]');
    await tag.selectOption({ index: 1 });
    await expect(sources).toBeHidden();
  } finally {
    await removeReport(dir);
  }
});
