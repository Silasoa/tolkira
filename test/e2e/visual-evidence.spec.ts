import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { messagesFixture } from '../fixtures.js';
import {
  removeReport,
  reportUrl,
  waitForImages,
  writeReport,
} from './helpers.js';

const fixture = messagesFixture('screenshot.ndjson');

async function capture(
  page: Page,
  engine: string,
  name: string,
): Promise<void> {
  await waitForImages(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
    `${name} overflow`,
  ).toBeLessThanOrEqual(1);
  const dir = path.resolve('test-results', 'visual', engine);
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

// B-054: a green run leaves viewport images; nothing is compared or committed.
test('captures default and static viewport evidence', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const engine = testInfo.project.name;
  const defaultReport = await writeReport(
    [fixture],
    'Visual evidence default',
    'tolkira-visual-evidence-',
  );
  const staticReport = await writeReport(
    [fixture],
    'Visual evidence static',
    'tolkira-visual-evidence-static-',
    '',
    ['--static'],
  );

  try {
    for (const [form, report, title] of [
      ['default', defaultReport, 'Visual evidence default'],
      ['static', staticReport, 'Visual evidence static'],
    ] as const) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(reportUrl(report.output));
      await expect(
        page.getByRole('heading', { name: title, level: 1 }),
      ).toBeVisible();
      await expect(page.locator('img[src^="data:image/png"]').first()).toBeVisible();
      await capture(page, engine, `${form}-1440`);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(reportUrl(report.output));
      await expect(
        page.getByRole('heading', { name: title, level: 1 }),
      ).toBeVisible();
      await capture(page, engine, `${form}-390`);

      await page.setViewportSize({ width: 320, height: 700 });
      await page.goto(reportUrl(report.output));
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '32px';
      });
      await expect(
        page.getByRole('heading', { name: title, level: 1 }),
      ).toBeVisible();
      await capture(page, engine, `${form}-320-text-zoom`);
    }

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(reportUrl(defaultReport.output));
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    await page.getByRole('tab', { name: 'Details' }).click();
    await expect(
      page.getByRole('heading', { name: 'Run details', level: 1 }),
    ).toBeVisible();
    await capture(page, engine, 'default-details-320-text-zoom');
  } finally {
    await removeReport(defaultReport.dir);
    await removeReport(staticReport.dir);
  }
});
