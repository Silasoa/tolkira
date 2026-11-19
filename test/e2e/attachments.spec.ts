import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { attachmentReport, SINGULAR_NOTICE } from '../attachments.js';
import { legacyFixture, messagesFixture } from '../fixtures.js';
import {
  removeReport,
  reportUrl,
  writeInput,
  writeReport,
} from './helpers.js';

const xssFixture = legacyFixture('xss.json');
const examplesAttachmentFixture = messagesFixture(
  'examples-tables-attachment.ndjson',
);

async function noticeMetrics(page: Page, headerSelector: string) {
  const metrics = await page.evaluate((selector) => {
    const notice = document.querySelector('.attachmentWarning');
    const header = document.querySelector(selector);
    if (!notice || !header) return null;
    const noticeRect = notice.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    return {
      noticeLeft: noticeRect.left,
      noticeRight: noticeRect.right,
      headerLeft: headerRect.left,
      headerRight: headerRect.right,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  }, headerSelector);
  expect(metrics).not.toBeNull();
  return metrics!;
}

test('does not execute HTML attachments', async ({ page }) => {
  const { dir, output } = await writeReport(
    [xssFixture],
    'XSS E2E',
    'tolkira-xss-e2e-',
  );
  let dialogOpened = false;
  page.on('dialog', async (dialog) => {
    dialogOpened = true;
    await dialog.dismiss();
  });

  try {
    await page.goto(reportUrl(output));
    await page.getByRole('button', { name: 'Expand all' }).click();
    const attachment = page.getByText(/attachment\.html/).first();
    await expect(attachment).toBeVisible();
    await attachment.click();

    const executed = await page.evaluate(
      () => (window as unknown as { __tolkiraXss?: number }).__tolkiraXss,
    );
    expect(executed).toBeUndefined();
    expect(dialogOpened).toBe(false);
  } finally {
    await removeReport(dir);
  }
});

test('keeps each example attachment on its own row', async ({ page }) => {
  const { dir, output } = await writeReport(
    [examplesAttachmentFixture],
    'Outlines attach',
    'tolkira-outline-attach-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const rows = page.locator('details.scenario');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('.thumb')).toBeVisible();
    await expect(rows.nth(1).locator('.thumb')).toBeVisible();
    await expect(rows.nth(0).locator('.shot')).toHaveCount(1);
    await expect(rows.nth(1).locator('.shot')).toHaveCount(1);
    await expect(rows.nth(0).locator('.rowRight')).toContainText('1 attachment');
    await expect(rows.nth(1).locator('.rowRight')).toContainText('1 attachment');

    await rows.nth(0).locator('summary').click();
    await rows.nth(0).locator('.shotButton').click();
    await expect(page.locator('#tolkira-lightbox')).toBeVisible();
  } finally {
    await removeReport(dir);
  }
});

test('shows an attachment warning on both tabs at 1440 and 320 px', async ({
  page,
}) => {
  const outside = await mkdtemp(
    path.join(tmpdir(), 'tolkira-attachment-e2e-outside-'),
  );
  const secret = path.join(outside, 'screenshot.png');
  await writeFile(secret, 'outside secret must not be read', 'utf8');
  const input = await writeInput(
    'playwright.json',
    JSON.stringify(
      attachmentReport([
        { name: 'screenshot', contentType: 'image/png', path: secret },
      ]),
    ),
    'tolkira-attachment-e2e-input-',
  );
  const { dir, output } = await writeReport(
    [input.file],
    'Attachment warning E2E',
    'tolkira-attachment-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const warning = page.locator('.attachmentWarning');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveText(SINGULAR_NOTICE);

    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });

      await page.getByRole('tab', { name: 'Report' }).click();
      await expect(warning).toBeVisible();
      const report = await noticeMetrics(page, '#report-view .runHead');
      expect(report.overflow, `report overflow at ${width}`).toBeLessThanOrEqual(
        1,
      );
      expect(
        Math.abs(report.noticeLeft - report.headerLeft),
        `report left edge at ${width}`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(report.noticeRight - report.headerRight),
        `report right edge at ${width}`,
      ).toBeLessThanOrEqual(1);

      await page.getByRole('tab', { name: 'Details' }).click();
      await expect(warning).toBeVisible();
      const details = await noticeMetrics(page, '#analysis-view .runHead');
      expect(
        details.overflow,
        `details overflow at ${width}`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(details.noticeLeft - details.headerLeft),
        `details left edge at ${width}`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(details.noticeRight - details.headerRight),
        `details right edge at ${width}`,
      ).toBeLessThanOrEqual(1);
    }

    await page.setViewportSize({ width: 320, height: 900 });
    await page.getByRole('tab', { name: 'Report' }).click();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    const zoomed = await page.evaluate(() => {
      const notice = document.querySelector('.attachmentWarning');
      if (!notice) return null;
      const rect = notice.getBoundingClientRect();
      const style = getComputedStyle(notice);
      const lineHeight =
        Number.parseFloat(style.lineHeight) ||
        Number.parseFloat(style.fontSize) * 1.5;
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        right: rect.right,
        lines: rect.height / lineHeight,
      };
    });

    expect(zoomed).not.toBeNull();
    expect(zoomed!.overflow).toBeLessThanOrEqual(1);
    expect(zoomed!.right).toBeLessThanOrEqual(320);
    expect(zoomed!.lines).toBeGreaterThan(1.5);
    await expect(warning).toBeVisible();
  } finally {
    await removeReport(dir);
    await removeReport(input.dir);
    await removeReport(outside);
  }
});
