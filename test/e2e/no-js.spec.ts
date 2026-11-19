import { expect, test } from '@playwright/test';
import { legacyFixture, messagesFixture } from '../fixtures.js';
import { removeReport, reportUrl, writeReport } from './helpers.js';

const emptyFixture = messagesFixture('empty.ndjson');
const hooksFixture = messagesFixture('hooks.ndjson');
const rulesOutlineBackgroundFixture = messagesFixture(
  'rules-outline-background.ndjson',
);
const unhappyFixture = legacyFixture('unhappy.json');

test.describe('without scripting', () => {
  test.use({ javaScriptEnabled: false });

  test('keeps an empty run readable', async ({ page }) => {
    const { dir, output } = await writeReport(
      [emptyFixture],
      'Empty no JS',
      'tolkira-empty-nojs-e2e-',
    );

    try {
      await page.goto(reportUrl(output));

      await expect(
        page
          .getByRole('tabpanel', { name: 'Report' })
          .getByText('0 / 0', { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Empty Scenarios' }),
      ).toBeVisible();
      await expect(page.locator('details.feature')).toHaveAttribute('open', '');
      const row = page.locator('[data-scenario-name="Blank Scenario"]');
      await expect(row).toBeVisible();
      await expect(row.locator('.statusText')).toHaveCount(0);
      await expect(row.locator('.statusCell .sr')).toHaveText('Not executed');
      await expect(
        page.getByRole('navigation', { name: 'Needs attention' }),
      ).toHaveCount(0);
    } finally {
      await removeReport(dir);
    }
  });

  test('keeps hook disclosures readable', async ({ page }) => {
    const { dir, output } = await writeReport(
      [hooksFixture],
      'Hooks no JS',
      'tolkira-hook-nojs-e2e-',
    );

    try {
      await page.goto(reportUrl(output));
      const group = page.locator('details.hookGroup').first();
      await expect(group).toBeVisible();
      await group.locator('summary').click();
      await expect(group.locator('.hook').first()).toBeVisible();
    } finally {
      await removeReport(dir);
    }
  });

  test('keeps the triage links readable', async ({ page }) => {
    const { dir, output } = await writeReport(
      [unhappyFixture],
      'Triage E2E',
      'tolkira-e2e-',
    );

    try {
      await page.goto(reportUrl(output));
      const triage = page.getByRole('navigation', { name: 'Needs attention' });
      await expect(triage).toBeVisible();
      const link = triage.getByRole('link', { name: /steps are skipped/ });
      await expect(link).toHaveAttribute('href', /^#scenario-\d+-\d+$/);
      const href = await link.getAttribute('href');
      await expect(page.locator(href!)).toHaveCount(1);
      await expect(page.locator('#feature-1')).toBeVisible();
      await expect(page.locator('#report-view')).toBeVisible();
    } finally {
      await removeReport(dir);
    }
  });

  test('keeps rule and background headings visible', async ({ page }) => {
    const { dir, output } = await writeReport(
      [rulesOutlineBackgroundFixture],
      'Rules no JS',
      'tolkira-rule-nojs-e2e-',
    );
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    try {
      await page.goto(reportUrl(output));
      await expect(page.locator('section.rule[data-rule]')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /Outline rule/, level: 3 }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /Feature setup/, level: 3 }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /Rule setup/, level: 3 }),
      ).toBeVisible();
      await expect(page.locator('section.outline').first()).toBeVisible();
      expect(
        requests.every(
          (url) => url.startsWith('file:') || url.startsWith('data:'),
        ),
      ).toBe(true);
    } finally {
      await removeReport(dir);
    }
  });
});
