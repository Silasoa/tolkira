import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  attachmentReport,
  SKIP_REASON,
  SKIP_WHERE,
  skipNotice,
} from '../attachments.js';
import { legacyFixture, messagesFixture } from '../fixtures.js';
import { removeReport, reportUrl, writeInput, writeReport } from './helpers.js';

const xssFixture = legacyFixture('xss.json');
const examplesAttachmentFixture = messagesFixture(
  'examples-tables-attachment.ndjson',
);

async function noticeMetrics(page: Page, headerSelector: string) {
  const metrics = await page.evaluate((selector) => {
    const notice = document.querySelector('.noticeShell .attachmentWarning');
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

test('counts the rendered screenshot once in Details', async ({ page }) => {
  const { dir, output } = await writeReport(
    [messagesFixture('screenshot.ndjson')],
    'Attachment parity E2E',
    'tolkira-attachment-parity-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    await expect(
      page.locator('img[src^="data:image/png"]').first(),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Details' }).click();
    const count = await page
      .locator('#analysis-view .sizeMeta dt')
      .evaluateAll((terms) => {
        const term = terms.find(
          (entry) => entry.textContent?.trim() === 'Attachments',
        );
        return term?.nextElementSibling?.textContent?.trim();
      });

    expect(count).toBe('1');
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
    await expect(rows.nth(0).locator('.rowRight')).toContainText(
      '1 attachment',
    );
    await expect(rows.nth(1).locator('.rowRight')).toContainText(
      '1 attachment',
    );

    await rows.nth(0).locator('summary').click();
    await rows.nth(0).locator('.shotButton').click();
    await expect(page.locator('#tolkira-lightbox')).toBeVisible();
  } finally {
    await removeReport(dir);
  }
});

test('shows the skipped-attachment notice in the shell and on the scenario at 1440 and 320 px', async ({
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
    const shellWarning = page.locator('.noticeShell .attachmentWarning');
    await expect(shellWarning).toBeVisible();
    await expect(shellWarning).toHaveText(`${skipNotice(1)} ${SKIP_WHERE}`);
    await expect(shellWarning).not.toContainText(outside);
    await expect(page.locator('body')).not.toContainText(
      'outside secret must not be read',
    );

    const scenario = page.locator(
      'details.scenario[data-scenario-name="attachment test"]',
    );
    const scenarioWarning = scenario.locator('.attachmentWarning');
    const feature = page.locator('details.feature').first();
    if (
      !(await feature.evaluate(
        (element) => (element as HTMLDetailsElement).open,
      ))
    ) {
      await feature.locator('summary').first().click();
    }

    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });

      await page.getByRole('tab', { name: 'Report' }).click();
      await expect(shellWarning).toBeVisible();
      if (
        !(await scenario.evaluate(
          (element) => (element as HTMLDetailsElement).open,
        ))
      ) {
        await scenario.locator('summary').first().click();
      }
      await expect(scenario).toHaveAttribute('open', '');
      await expect(scenarioWarning).toBeVisible();
      await expect(scenarioWarning).toContainText(skipNotice(1));
      await expect(scenarioWarning).toContainText(
        `screenshot - ${SKIP_REASON.outside}`,
      );
      await expect(scenario.locator('.attachmentSkipList li')).toHaveCount(1);
      await expect(scenarioWarning).not.toContainText(outside);
      const report = await noticeMetrics(page, '#report-view .runHead');
      expect(
        report.overflow,
        `report overflow at ${width}`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(report.noticeLeft - report.headerLeft),
        `report left edge at ${width}`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(report.noticeRight - report.headerRight),
        `report right edge at ${width}`,
      ).toBeLessThanOrEqual(1);

      await page.getByRole('tab', { name: 'Details' }).click();
      await expect(shellWarning).toBeVisible();
      await expect(
        page.locator('#analysis-view .attachmentWarning'),
      ).toHaveCount(0);
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

    await page.setViewportSize({ width: 1024, height: 900 });
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    await page.emulateMedia({ media: 'print' });
    const printedList = await scenario
      .locator('.attachmentSkipList')
      .evaluate((element) => ({
        display: getComputedStyle(element).display,
        width: element.getBoundingClientRect().width,
      }));
    expect(printedList.display).not.toBe('none');
    expect(printedList.width).toBeGreaterThan(0);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    await page.emulateMedia({ media: 'screen' });

    await page.setViewportSize({ width: 320, height: 900 });
    await page.getByRole('tab', { name: 'Report' }).click();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    const zoomed = await page.evaluate(() => {
      const notice = document.querySelector('.noticeShell .attachmentWarning');
      if (!notice) return null;
      const rect = notice.getBoundingClientRect();
      const style = getComputedStyle(notice);
      // Computed CSS lengths carry a px suffix, which Number() rejects.
      const lineHeight =
        // oxlint-disable-next-line unicorn/prefer-number-coercion -- computed CSS lengths carry px
        Number.parseFloat(style.lineHeight) ||
        // oxlint-disable-next-line unicorn/prefer-number-coercion -- computed CSS lengths carry px
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
    await expect(shellWarning).toBeVisible();
  } finally {
    await removeReport(dir);
    await removeReport(input.dir);
    await removeReport(outside);
  }
});
