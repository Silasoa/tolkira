import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { de, en } from '../../src/i18n/catalogs.js';
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
let wideGermanReport: ReportFile | undefined;
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

function englishValue(key: string): string {
  const value = (en as Record<string, string>)[key];
  if (!value) throw new Error(`Missing catalog key: ${key}`);
  return value;
}

/** The panel section, not the scroll region: the wrapper is the only region. */
function tagPanel(page: Page) {
  return page.locator('#analysis-view section.panel:has(.tagTable)');
}

function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

function overviewRows(page: Page): Promise<string[]> {
  return page.locator('#analysis-view .tagTable tbody tr').allInnerTexts();
}

function tagTableScroll(page: Page): Promise<{
  overflowX: string;
  scrollWidth: number;
  clientWidth: number;
}> {
  return page.locator('#analysis-view .tagTable').evaluate((table) => {
    const wrap = table.parentElement;
    if (!wrap) throw new Error('tag table has no wrapper');
    return {
      overflowX: getComputedStyle(wrap).overflowX,
      scrollWidth: wrap.scrollWidth,
      clientWidth: wrap.clientWidth,
    };
  });
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
  wideGermanReport = await writeReport(
    [wideFile.file],
    'Wide tags',
    'tolkira-tags-wide-de-e2e-',
    'de',
  );
});

test.afterAll(async () => {
  for (const file of [
    english,
    german,
    staticReport,
    wideReport,
    wideGermanReport,
  ]) {
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
  const panel = tagPanel(page);
  await expect(panel).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Tags', exact: true }),
  ).toBeVisible();
  await expect(panel).toContainText(englishValue('details.tagsNote'));
  await expect(page.locator('#analysis-view .tagTable tbody tr')).toHaveCount(
    3,
  );
  await expect(
    page.getByRole('region', { name: 'Tag overview' }),
  ).toHaveAttribute('aria-describedby', 'tag-overview-note');
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
  await expect(page.locator('[data-scenario]:visible')).toHaveCount(1);
  await detailsTab(page);
  expect(await overviewRows(page)).toEqual(before);

  await page.getByRole('tab', { name: 'Report' }).click();
  await search.fill('');
  await page.locator('button[data-filter-status="passed"]').click();
  await expect(page.locator('[data-scenario]:visible')).toHaveCount(1);
  await detailsTab(page);
  expect(await overviewRows(page)).toEqual(before);

  await page.getByRole('tab', { name: 'Report' }).click();
  await page.locator('button[data-filter-status="passed"]').click();
  await page.locator('select[data-tag-filter]').selectOption('@fehler');
  await expect(page.locator('[data-scenario]:visible')).toHaveCount(1);
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
  const scroll = await tagTableScroll(page);

  expect(scroll.overflowX).toMatch(/auto|scroll/);
  expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
});

test('scrolls the German table inside its panel at 320px with 200% text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(reportUrl(report(wideGermanReport).output));
  await detailsTab(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });

  await expect(tagPanel(page)).toBeVisible();
  await expect(
    page.getByRole('region', { name: catalogValue('details.tagsLabel') }),
  ).toBeVisible();
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
  const scroll = await tagTableScroll(page);

  expect(scroll.overflowX).toMatch(/auto|scroll/);
  expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
});

test('keeps the panel bounded from 390 to 1440px', async ({ page }) => {
  test.setTimeout(60_000);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(reportUrl(report(english).output));
    await detailsTab(page);
    const panel = tagPanel(page);
    await expect(panel, `${width}px panel`).toBeVisible();
    await expect(panel.locator('.tagTable'), `${width}px table`).toBeVisible();
    expect(await pageOverflow(page), `${width}px overflow`).toBeLessThanOrEqual(
      1,
    );

    const widths = await panel.locator('.tagTable').evaluate((table) => {
      const wrap = table.parentElement;
      return {
        table: table.getBoundingClientRect().width,
        wrap: wrap?.getBoundingClientRect().width ?? 0,
        scroll: wrap?.scrollWidth ?? 0,
        client: wrap?.clientWidth ?? 0,
      };
    });
    if (width === 390) {
      expect(widths.scroll, '390px table fits').toBeLessThanOrEqual(
        widths.client + 1,
      );
    }
    if (width >= 1024) {
      expect(widths.table, `${width}px table width`).toBeLessThan(widths.wrap);
    }
  }
});

test.describe('static tag overview', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the panel open and script-free', async ({ page }) => {
    await page.goto(reportUrl(report(staticReport).output));

    await expect(page.locator('script')).toHaveCount(0);
    await expect(page.locator('#analysis-view')).toBeVisible();
    await expect(tagPanel(page)).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Tag overview' }),
    ).toBeVisible();
    await expect(page.locator('#analysis-view .tagTable')).toBeVisible();
    await expect(page.locator('#analysis-view .tagTable tbody tr')).toHaveCount(
      3,
    );
    await expect(page.locator('#analysis-view .tagTable thead')).toContainText(
      englishValue('details.tagScenarios'),
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

  await expect(tagPanel(page)).toBeVisible();
  const printStyles = await page
    .locator('#analysis-view .tagTable')
    .evaluate((table) => {
      const head = table.querySelector('thead');
      const headCell = table.querySelector('thead th');
      const row = table.querySelector('tbody tr');
      const bodyCell = table.querySelector('tbody th');
      const rows = table.querySelectorAll('tbody tr');
      const last = rows[rows.length - 1];
      const lastCell = last?.querySelector('td');
      const lastHead = last?.querySelector('th');
      return {
        headDisplay: head ? getComputedStyle(head).display : '',
        rowBreak: row ? getComputedStyle(row).breakInside : '',
        headRule: headCell ? getComputedStyle(headCell).borderBottomWidth : '',
        bodyRule: bodyCell ? getComputedStyle(bodyCell).borderBottomWidth : '',
        lastRule: lastCell ? getComputedStyle(lastCell).borderBottomWidth : '',
        lastHeadRule: lastHead
          ? getComputedStyle(lastHead).borderBottomWidth
          : '',
      };
    });

  expect(printStyles.headDisplay).toBe('table-header-group');
  expect(printStyles.rowBreak).toBe('avoid');
  expect(printStyles.headRule).toBe('1px');
  expect(printStyles.bodyRule).toBe('1px');
  expect(printStyles.lastRule).toBe('0px');
  expect(printStyles.lastHeadRule).toBe('0px');
});

test('renders the German labels and verbatim tag names', async ({ page }) => {
  await page.goto(reportUrl(report(german).output));
  await page.getByRole('tab', { name: 'Details' }).click();
  const panel = tagPanel(page);

  await expect(panel).toBeVisible();
  await expect(panel).toContainText(catalogValue('details.tags'));
  await expect(panel).toContainText(catalogValue('details.tagsNote'));
  await expect(
    page.getByRole('region', { name: catalogValue('details.tagsLabel') }),
  ).toHaveAttribute('aria-describedby', 'tag-overview-note');
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
