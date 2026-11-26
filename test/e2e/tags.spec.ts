import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { de } from '../../src/i18n/catalogs.js';
import {
  removeReport,
  reportUrl,
  writeInput,
  writeReport,
  type ReportFile,
} from './helpers.js';

const germanInput = fileURLToPath(
  new URL('../fixtures/i18n/german-testdata.json', import.meta.url),
);

// One inherited feature tag plus a scenario tag per row; the long feature tag
// forces the table wider than a 320px panel at 200% text.
const LONG_TAG =
  '@a-very-long-feature-tag-name-that-keeps-the-tag-table-wider-than-a-320-pixel-panel-at-200-percent-text';
const wideInput = JSON.stringify([
  {
    uri: 'features/long-tags.feature',
    name: 'Long tag feature',
    tags: [{ name: LONG_TAG, line: 1 }],
    elements: Array.from({ length: 6 }, (_, index) => ({
      keyword: 'Scenario',
      type: 'scenario',
      name: `Long tag scenario ${index + 1}`,
      line: index + 3,
      tags: [{ name: `@scenario-tag-${index + 1}`, line: index + 3 }],
      steps: [
        {
          keyword: 'Given ',
          name: 'a passing step',
          result: { status: 'passed', duration: 1 },
        },
      ],
    })),
  },
]);

let english: ReportFile | undefined;
let german: ReportFile | undefined;
let staticReport: ReportFile | undefined;
let wideReport: ReportFile | undefined;
let wideFile: { dir: string; file: string } | undefined;

function report(file: ReportFile | undefined): ReportFile {
  if (!file) throw new Error('report was not written');
  return file;
}

function catalogValue(key: string): string {
  const value = (de as Record<string, string>)[key];
  if (!value) throw new Error(`Missing catalog key: ${key}`);
  return value;
}

function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

function overviewRows(page: Page): Promise<string[]> {
  return page.locator('#analysis-view .tagTable tbody tr').allInnerTexts();
}

async function detailsTab(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Details' }).click();
}

test.beforeAll(async () => {
  english = await writeReport(
    [germanInput],
    'Tags overview',
    'tolkira-tags-e2e-',
  );
  german = await writeReport(
    [germanInput],
    'Tag-Übersicht',
    'tolkira-tags-de-e2e-',
    'de',
  );
  staticReport = await writeReport(
    [germanInput],
    'Static tags',
    'tolkira-tags-static-e2e-',
    '',
    ['--static'],
  );
  wideFile = await writeInput(
    'long-tags.json',
    wideInput,
    'tolkira-tags-input-',
  );
  wideReport = await writeReport(
    [wideFile.file],
    'Wide tags',
    'tolkira-tags-wide-e2e-',
  );
});

test.afterAll(async () => {
  for (const file of [english, german, staticReport, wideReport]) {
    if (file) await removeReport(file.dir);
  }
  if (wideFile) await removeReport(wideFile.dir);
});

test('shows the tag overview in Details and not on the Report tab', async ({
  page,
}) => {
  await page.goto(reportUrl(report(english).output));

  await expect(page.locator('#analysis-view .tagTable')).toBeHidden();
  await expect(page.locator('#report-view .tagTable')).toHaveCount(0);

  await detailsTab(page);
  const panel = page.getByRole('region', { name: 'Tag overview' });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Tags');
  await expect(page.locator('#analysis-view .tagTable tbody tr')).toHaveCount(
    3,
  );
});

test('keeps every overview count when toolbar filters hide scenarios', async ({
  page,
}) => {
  await page.goto(reportUrl(report(english).output));
  await detailsTab(page);
  const before = await overviewRows(page);
  expect(before).toHaveLength(3);

  await page.getByRole('tab', { name: 'Report' }).click();
  const search = page.getByRole('searchbox', { name: 'Search scenarios' });
  await search.fill('ohne Deckung');
  await expect(
    page.locator('#report-view details.scenario:visible'),
  ).toHaveCount(1);
  await detailsTab(page);
  expect(await overviewRows(page)).toEqual(before);

  await page.getByRole('tab', { name: 'Report' }).click();
  await search.fill('');
  await page.locator('button[data-filter-status="passed"]').click();
  await expect(
    page.locator('#report-view details.scenario:visible'),
  ).toHaveCount(1);
  await detailsTab(page);
  expect(await overviewRows(page)).toEqual(before);

  await page.getByRole('tab', { name: 'Report' }).click();
  await page.locator('button[data-filter-status="passed"]').click();
  await page.locator('select[data-tag-filter]').selectOption('@fehler');
  await expect(
    page.locator('#report-view details.scenario:visible'),
  ).toHaveCount(1);
  await detailsTab(page);
  expect(await overviewRows(page)).toEqual(before);
});

test('scrolls the table inside its panel at 320px with 200% text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(reportUrl(report(wideReport).output));
  await detailsTab(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });

  expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
  const scroll = await page
    .locator('#analysis-view .tagTable')
    .evaluate((table) => {
      const wrap = table.parentElement;
      if (!wrap) throw new Error('tag table has no wrapper');
      return {
        overflowX: getComputedStyle(wrap).overflowX,
        scrollWidth: wrap.scrollWidth,
        clientWidth: wrap.clientWidth,
      };
    });

  expect(scroll.overflowX).toMatch(/auto|scroll/);
  expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
});

test.describe('static tag overview', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the panel open and script-free', async ({ page }) => {
    await page.goto(reportUrl(report(staticReport).output));

    await expect(page.locator('script')).toHaveCount(0);
    await expect(page.locator('#analysis-view')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Tag overview' }),
    ).toBeVisible();
    await expect(page.locator('#analysis-view .tagTable')).toBeVisible();
    await expect(page.locator('#analysis-view .tagTable tbody tr')).toHaveCount(
      3,
    );
    await expect(page.locator('#analysis-view .tagTable thead')).toContainText(
      'Scenarios',
    );
  });
});

test('repeats the header and keeps rows whole in print', async ({ page }) => {
  await page.setViewportSize({ width: 794, height: 1200 });
  await page.goto(reportUrl(report(english).output));
  await detailsTab(page);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
  });
  await page.emulateMedia({ media: 'print' });

  await expect(
    page.getByRole('region', { name: 'Tag overview' }),
  ).toBeVisible();
  const printStyles = await page
    .locator('#analysis-view .tagTable')
    .evaluate((table) => {
      const head = table.querySelector('thead');
      const row = table.querySelector('tbody tr');
      return {
        headDisplay: head ? getComputedStyle(head).display : '',
        rowBreak: row ? getComputedStyle(row).breakInside : '',
      };
    });

  expect(printStyles.headDisplay).toBe('table-header-group');
  expect(printStyles.rowBreak).toBe('avoid');
});

test('renders the German labels and verbatim tag names', async ({ page }) => {
  await page.goto(reportUrl(report(german).output));
  await page.getByRole('tab', { name: 'Details' }).click();
  const panel = page.getByRole('region', {
    name: catalogValue('details.tagsLabel'),
  });

  await expect(panel).toBeVisible();
  await expect(panel).toContainText(catalogValue('details.tags'));
  await expect(panel).toContainText(catalogValue('details.tagsNote'));
  for (const key of [
    'details.tagScenarios',
    'details.tagFailed',
    'details.tagSkipped',
  ]) {
    await expect(page.locator('#analysis-view .tagTable thead')).toContainText(
      catalogValue(key),
    );
  }
  await expect(panel).toContainText('@konto');
  await expect(panel).toContainText('@fehler');
});
