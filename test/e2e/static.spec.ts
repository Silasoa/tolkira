import { expect, test, type Page } from '@playwright/test';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { messagesFixture } from '../fixtures.js';
import {
  removeReport,
  reportUrl,
  writeReport,
  writeReportWithHistory,
  type ReportFile,
} from './helpers.js';

const screenshotFixture = messagesFixture('screenshot.ndjson');
const allStatusesFixture = messagesFixture('all-statuses.ndjson');
const germanInput = fileURLToPath(
  new URL('../fixtures/i18n/german-testdata.json', import.meta.url),
);
const historyFixture = fileURLToPath(
  new URL('../fixtures/history/two-runs.json', import.meta.url),
);

let english: ReportFile | undefined;
let german: ReportFile | undefined;
let noHistory: ReportFile | undefined;
const historyDirs: string[] = [];

function report(file: ReportFile | undefined): ReportFile {
  if (!file) throw new Error('report was not written');
  return file;
}

async function freshHistory(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  await copyFile(historyFixture, path.join(dir, 'history.json'));
  historyDirs.push(dir);
  return path.join(dir, 'history.json');
}

function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

async function expectStackedViews(page: Page, trends: boolean): Promise<void> {
  await expect(page.locator('#report-view')).toBeVisible();
  await expect(page.locator('#analysis-view')).toBeVisible();
  if (trends) {
    await expect(page.locator('#trends-view')).toBeVisible();
  } else {
    await expect(page.locator('#trends-view')).toHaveCount(0);
  }
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('tabpanel')).toHaveCount(0);
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('details:not([open])')).toHaveCount(0);
}

test.beforeAll(async () => {
  english = await writeReportWithHistory(
    [screenshotFixture, allStatusesFixture],
    await freshHistory('tolkira-static-history-'),
    'Static archive',
    'tolkira-static-e2e-',
    '',
    ['--static'],
  );
  german = await writeReportWithHistory(
    [germanInput],
    await freshHistory('tolkira-static-history-de-'),
    'Statischer Bericht',
    'tolkira-static-de-e2e-',
    'de',
    ['--static'],
  );
  noHistory = await writeReport(
    [screenshotFixture],
    'Static no history',
    'tolkira-static-nohistory-e2e-',
    '',
    ['--static'],
  );
});

test.afterAll(async () => {
  for (const file of [english, german, noHistory]) {
    if (file) await removeReport(file.dir);
  }
  for (const dir of historyDirs) {
    await rm(dir, { recursive: true, force: true });
  }
});

test.describe('static report without scripting', () => {
  test.use({ javaScriptEnabled: false });

  test('shows every section, an image and no scripts at every gate viewport', async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(reportUrl(report(english).output));

      await expectStackedViews(page, true);
      await expect(page.locator('img.shot').first()).toBeVisible();
      await expect(page.locator('script')).toHaveCount(0);
      expect(
        await pageOverflow(page),
        `${width}px overflow`,
      ).toBeLessThanOrEqual(1);
    }

    expect(
      requests.every(
        (url) => url.startsWith('file:') || url.startsWith('data:'),
      ),
      'no network request',
    ).toBe(true);
  });

  test('keeps the open details readable at 320 px and 200% text', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(reportUrl(report(english).output));
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).fontSize,
      ),
    ).toBe('32px');

    await expectStackedViews(page, true);
    await expect(
      page.locator('[data-scenario-name="Passing"] .detailInline'),
    ).toBeVisible();
    await expect(page.locator('img.shot').first()).toBeVisible();
    expect(
      await pageOverflow(page),
      '320px at 200% text overflow',
    ).toBeLessThanOrEqual(1);
  });

  test('shows the full report from a bookmarked filter URL', async ({
    page,
  }) => {
    const base = reportUrl(report(english).output);
    await page.goto(base);
    const total = await page.locator('details.scenario').count();
    expect(total).toBeGreaterThan(0);

    for (const search of [
      '?query=no-such-scenario',
      '?hide=passed',
      '?tag=@missing',
    ]) {
      const url = reportUrl(report(english).output, search);
      await page.goto(url);

      await expect(page).toHaveURL(url);
      await expect(page.locator('input[data-search]')).toHaveCount(0);
      await expect(page.locator('mark')).toHaveCount(0);
      expect(
        await page.locator('details.scenario:visible').count(),
        `${search} visible rows`,
      ).toBe(total);
    }
  });

  test('keeps the German labels and test data', async ({ page }) => {
    await page.goto(reportUrl(report(german).output));

    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.locator('#report-view')).toContainText(
      'Erstellt von Tolkira',
    );
    await expect(page.locator('#analysis-view')).toContainText('Laufdetails');
    await expect(page.locator('#trends-view')).toContainText(
      'Aufgezeichnete Läufe',
    );
    await expect(page.locator('#feature-list')).toContainText(
      'Überweisung ohne Deckung',
    );
    await expectStackedViews(page, true);
  });

  test('omits Trends without history', async ({ page }) => {
    await page.goto(reportUrl(report(noHistory).output));

    await expectStackedViews(page, false);
    await expect(page.locator('img.shot').first()).toBeVisible();
  });

  test('prints every present section and open detail', async ({ page }) => {
    await page.setViewportSize({ width: 794, height: 1200 });
    await page.emulateMedia({ media: 'print' });
    await page.goto(reportUrl(report(english).output));

    await expectStackedViews(page, true);
    await expect(page.locator('.views')).toHaveCount(0);
    await expect(page.locator('.topbar:visible')).toHaveCount(0);
    await expect(page.locator('#report-view .shot').first()).toBeVisible();
    await expect(page.locator('#analysis-view .featureTable')).toBeVisible();
    await expect(page.locator('#trends-view tbody tr')).toHaveCount(3);
  });
});
