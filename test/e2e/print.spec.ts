import { expect, test, type Page } from '@playwright/test';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { legacyFixture, messagesFixture } from '../fixtures.js';
import {
  legacyFlakyReport,
  removeReport,
  reportUrl,
  writeInput,
  writeReport,
  writeReportWithHistory,
  type ReportFile,
} from './helpers.js';

const happyFixture = legacyFixture('happy.json');
const screenshotFixture = legacyFixture('screenshot.json');
const failedFixture = legacyFixture('failed.json');
const presentationFixture = messagesFixture('attachments-presentation.ndjson');
const markdownFixture = messagesFixture('markdown-descriptions.ndjson');
const germanInput = fileURLToPath(
  new URL('../fixtures/i18n/german-testdata.json', import.meta.url),
);
const historyFixture = fileURLToPath(
  new URL('../fixtures/history/two-runs.json', import.meta.url),
);

// A4 at 96 dpi, and the same page without the 12 mm print margins.
const A4_WIDTH = 794;
const A4_CONTENT_WIDTH = 703;

// A step data table wider than the A4 content width before the print reset;
// eight columns with long unbroken values.
const WIDE_TABLE = JSON.stringify([
  {
    uri: 'features/wide-table.feature',
    name: 'Wide step table',
    elements: [
      {
        keyword: 'Scenario',
        type: 'scenario',
        name: 'Wide data table prints unclipped',
        steps: [
          {
            keyword: 'Given ',
            name: 'the following account data',
            result: { status: 'passed', duration: 1000 },
            rows: [
              {
                cells: [
                  'Konto',
                  'Betrag',
                  'Währung',
                  'Empfänger',
                  'Referenz',
                  'Datum',
                  'Status',
                  'Kommentar',
                ],
              },
              {
                cells: [
                  'DE89 3704 0044 0532 0130 00',
                  '1.234,56',
                  'EUR',
                  'Beispiel GmbH',
                  '2026-11-20-ABCDEFGHIJKLMNOP',
                  '20.11.2026',
                  'akzeptiert',
                  'eine längere Beschreibung',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);

let english: ReportFile | undefined;
let noHistory: ReportFile | undefined;
let german: ReportFile | undefined;
let wideTable: ReportFile | undefined;
let wideTableInput: { dir: string; file: string } | undefined;
const historyDirs: string[] = [];

function report(file: ReportFile | undefined): ReportFile {
  if (!file) throw new Error('report was not written');
  return file;
}

async function freshHistory(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  const history = path.join(dir, 'history.json');
  await copyFile(historyFixture, history);
  historyDirs.push(dir);
  return history;
}

async function dispatchPrint(page: Page, type: 'beforeprint' | 'afterprint') {
  await page.evaluate((eventName) => {
    window.dispatchEvent(new Event(eventName));
  }, type);
}

async function documentOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function regionOverflow(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => element.scrollWidth - element.clientWidth);
}

// Text that wrapped onto more than one line, or overflowed its cell.
async function wrappingText(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluateAll((elements) =>
    elements
      .filter((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const box = element.getBoundingClientRect();
        const text = range.getBoundingClientRect();
        return (
          range.getClientRects().length > 1 ||
          text.left < box.left - 1 ||
          text.right > box.right + 1
        );
      })
      .map((element) => element.textContent?.trim() ?? ''),
  );
}

// A table header that broke into one-character lines (an overflow symptom).
async function oneCharacterStacks(
  page: Page,
  selector: string,
): Promise<string[]> {
  return page.locator(selector).evaluateAll((elements) =>
    elements
      .filter((element) => {
        const text = (element.textContent ?? '').trim();
        if (text.length < 2) return false;
        const range = document.createRange();
        range.selectNodeContents(element);
        return range.getClientRects().length > Math.ceil(text.length / 2);
      })
      .map((element) => element.textContent?.trim() ?? ''),
  );
}

// The fixed print columns: title width, duration line count and status fit.
async function trendsPrintMetrics(page: Page): Promise<{
  titleWidth: number;
  durationLines: number;
  statusOverflow: number;
  statusGap: number;
}> {
  return page.locator('#trends-view tbody tr').first().evaluate((row) => {
    const cells = [...row.querySelectorAll('td')];
    const title = cells[1];
    const status = cells[2];
    const next = cells[3];
    const duration = cells[10];
    if (!title || !status || !next || !duration) {
      throw new Error('Trends row cells are missing');
    }
    const range = document.createRange();
    range.selectNodeContents(duration);
    const pill = status.querySelector('.statusText');
    const pillBox = pill?.getBoundingClientRect();
    const nextBox = next.getBoundingClientRect();
    return {
      titleWidth: title.getBoundingClientRect().width,
      durationLines: range.getClientRects().length,
      statusOverflow: status.scrollWidth - status.clientWidth,
      statusGap: pillBox ? nextBox.left - pillBox.right : -1,
    };
  });
}

async function luminance(
  page: Page,
  selector: string,
  property: 'backgroundColor' | 'color',
): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((element, prop) => {
      const style = getComputedStyle(element);
      const value =
        prop === 'backgroundColor' ? style.backgroundColor : style.color;
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2d canvas is unavailable');
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const data = context.getImageData(0, 0, 1, 1).data;
      const channel = (component: number): number => {
        const normalized = component / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return (
        0.2126 * channel(data[0] ?? 0) +
        0.7152 * channel(data[1] ?? 0) +
        0.0722 * channel(data[2] ?? 0)
      );
    }, property);
}

test.beforeAll(async () => {
  english = await writeReportWithHistory(
    [happyFixture, screenshotFixture, failedFixture, presentationFixture],
    await freshHistory('tolkira-print-history-en-'),
    'Print archive',
    'tolkira-print-en-',
  );
  noHistory = await writeReport(
    [screenshotFixture],
    'Print no history',
    'tolkira-print-nohistory-',
  );
  german = await writeReportWithHistory(
    [germanInput, presentationFixture],
    await freshHistory('tolkira-print-history-de-'),
    'Druckbericht',
    'tolkira-print-de-',
    'de',
  );
  wideTableInput = await writeInput(
    'wide-table.json',
    WIDE_TABLE,
    'tolkira-print-table-',
  );
  wideTable = await writeReport(
    [wideTableInput.file, markdownFixture],
    'Print tables',
    'tolkira-print-tables-',
  );
});

test.afterAll(async () => {
  for (const file of [english, noHistory, german, wideTable]) {
    if (file) await removeReport(file.dir);
  }
  if (wideTableInput) {
    await rm(wideTableInput.dir, { recursive: true, force: true });
  }
  for (const dir of historyDirs) {
    await rm(dir, { recursive: true, force: true });
  }
});

test('opens the complete report for print and restores the previous state', async ({
  page,
}) => {
  await page.setViewportSize({ width: A4_WIDTH, height: 1200 });
  await page.goto(reportUrl(report(english).output));

  const closedFeature = page.locator('details.feature:not([open])').first();
  const closedScenario = page.locator('details.scenario:not([open])').first();
  await expect(closedFeature).toBeVisible();
  await expect(closedScenario).toBeVisible();
  // `:not([open])` stops matching once the element opens; keep the element
  // ids so the same feature and scenario are asserted after printing.
  const closedFeatureId = await closedFeature.getAttribute('id');
  const closedScenarioId = await closedScenario.getAttribute('id');
  const feature = page.locator(`#${closedFeatureId}`);
  const scenario = page.locator(`#${closedScenarioId}`);

  const lazyCount = await page.locator('img[loading="lazy"]').count();
  expect(lazyCount, 'lazy thumbnails').toBeGreaterThan(0);

  const shotButton = page.locator('.shotButton').first();
  await expect(shotButton).toBeVisible();
  await shotButton.click();
  const lightbox = page.locator('#tolkira-lightbox');
  await expect(lightbox).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.style.overflow),
    'lightbox scroll lock',
  ).toBe('hidden');

  await dispatchPrint(page, 'beforeprint');
  await page.emulateMedia({ media: 'print' });

  for (const view of ['#report-view', '#analysis-view', '#trends-view']) {
    await expect(page.locator(view), view).toBeVisible();
  }
  await expect(feature).toHaveAttribute('open', '');
  await expect(scenario).toHaveAttribute('open', '');
  await expect(page.locator('img[loading="eager"]')).toHaveCount(lazyCount);
  await expect(lightbox).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.style.overflow),
    'print overflow reset',
  ).not.toBe('hidden');

  await dispatchPrint(page, 'afterprint');
  await expect(page.locator('#report-view')).toBeVisible();
  await expect(page.locator('#analysis-view')).toBeHidden();
  await expect(page.locator('#trends-view')).toBeHidden();
  expect(await feature.getAttribute('open')).toBeNull();
  expect(await scenario.getAttribute('open')).toBeNull();
  await expect(page.locator('img[loading="lazy"]')).toHaveCount(lazyCount);

  await page.emulateMedia({ media: 'screen' });
  await expect(lightbox).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.style.overflow),
    'lightbox scroll lock restored',
  ).toBe('hidden');
});

test('prints without interactive chrome and fits the A4 tables', async ({
  page,
}) => {
  await page.setViewportSize({ width: A4_WIDTH, height: 1200 });
  await page.goto(reportUrl(report(english).output));

  const lightbox = page.locator('#tolkira-lightbox');
  await page.locator('.shotButton').first().click();
  await expect(lightbox).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.style.overflow),
    'lightbox scroll lock',
  ).toBe('hidden');

  await page.emulateMedia({ media: 'print' });
  expect(
    await lightbox.evaluate((dialog) => (dialog as HTMLDialogElement).open),
    'lightbox still open when print media applies',
  ).toBe(true);
  expect(
    await page.locator('#tolkira-lightbox:visible').count(),
    'print CSS hides the lightbox',
  ).toBe(0);

  await dispatchPrint(page, 'beforeprint');
  expect(
    await lightbox.evaluate((dialog) => (dialog as HTMLDialogElement).open),
    'lightbox closed for print',
  ).toBe(false);
  expect(
    await page.evaluate(() => document.documentElement.style.overflow),
    'print overflow reset',
  ).not.toBe('hidden');

  const chrome = [
    '.topbar',
    '.toolbar',
    '.search',
    '.tagFilter',
    '.filters',
    '.filter',
    '.presetFilter',
    '.expand',
    '.copyFailure',
    '.copyLog',
    '.view',
    '.lightboxClose',
    '.chev',
    '.lightbox',
  ];
  for (const selector of chrome) {
    expect(await page.locator(selector).count(), `${selector} exists`).toBeGreaterThan(
      0,
    );
    expect(
      await page.locator(`${selector}:visible`).count(),
      `${selector} hidden in print`,
    ).toBe(0);
  }

  await expect(page.locator('.shotButton').first()).toBeVisible();
  await expect(page.locator('.shot').first()).toBeVisible();

  await page.setViewportSize({ width: A4_CONTENT_WIDTH, height: 1200 });
  await expect(page.locator('#analysis-view .tableWrap').first()).toBeVisible();
  await expect(page.locator('#trends-view .tableWrap')).toBeVisible();

  expect(
    await regionOverflow(page, '#analysis-view .tableWrap'),
    'matrix overflow at the A4 content width',
  ).toBeLessThanOrEqual(1);
  expect(
    await regionOverflow(page, '#trends-view .tableWrap'),
    'Trends overflow at the A4 content width',
  ).toBeLessThanOrEqual(1);
  expect(await documentOverflow(page), 'document overflow').toBeLessThanOrEqual(
    1,
  );

  const layouts: Record<string, string> = {
    '#analysis-view .featureTable': 'fixed',
    '#trends-view .trendsTable': 'fixed',
  };
  for (const [table, expected] of Object.entries(layouts)) {
    expect(
      await page
        .locator(table)
        .evaluate((element) => getComputedStyle(element).tableLayout),
      `${table} layout`,
    ).toBe(expected);
  }

  await dispatchPrint(page, 'afterprint');
  expect(
    await lightbox.evaluate((dialog) => (dialog as HTMLDialogElement).open),
    'lightbox restored',
  ).toBe(true);
  expect(
    await page.locator('#tolkira-lightbox:visible').count(),
    'lightbox stays hidden while print media applies',
  ).toBe(0);
  await page.emulateMedia({ media: 'screen' });
  await expect(lightbox).toBeVisible();
});

test('prints content without chrome at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ media: 'print' });
  await page.goto(reportUrl(report(english).output));
  await dispatchPrint(page, 'beforeprint');

  expect(await page.locator('.topbar:visible').count(), 'topbar').toBe(0);
  expect(await page.locator('.toolbar:visible').count(), 'toolbar').toBe(0);
  await expect(page.locator('#report-view')).toBeVisible();
  await expect(page.locator('#report-view h1')).toBeVisible();
  await expect(page.locator('#analysis-view')).toBeVisible();
  await expect(page.locator('#report-view .shot').first()).toBeVisible();
});

test('prints from Details or Trends and restores that tab', async ({ page }) => {
  await page.setViewportSize({ width: A4_WIDTH, height: 1200 });
  await page.goto(reportUrl(report(english).output));

  const detailsTab = page.getByRole('tab', { name: 'Details' });
  await detailsTab.click();
  await expect(detailsTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#analysis-view')).toBeVisible();

  await dispatchPrint(page, 'beforeprint');
  await page.emulateMedia({ media: 'print' });
  for (const view of ['#report-view', '#analysis-view', '#trends-view']) {
    await expect(page.locator(view), view).toBeVisible();
  }

  await dispatchPrint(page, 'afterprint');
  await expect(page.locator('#report-view')).toBeHidden();
  await expect(page.locator('#analysis-view')).toBeVisible();
  await expect(page.locator('#trends-view')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await expect(detailsTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#analysis-view')).toBeVisible();

  const trendsTab = page.getByRole('tab', { name: 'Trends' });
  await trendsTab.click();
  await expect(trendsTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#trends-view')).toBeVisible();

  await dispatchPrint(page, 'beforeprint');
  await page.emulateMedia({ media: 'print' });
  for (const view of ['#report-view', '#analysis-view', '#trends-view']) {
    await expect(page.locator(view), view).toBeVisible();
  }

  await dispatchPrint(page, 'afterprint');
  await expect(page.locator('#report-view')).toBeHidden();
  await expect(page.locator('#analysis-view')).toBeHidden();
  await expect(page.locator('#trends-view')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await expect(trendsTab).toHaveAttribute('aria-selected', 'true');
});

test('fits wide step and description tables to the printed page', async ({
  page,
}) => {
  await page.setViewportSize({ width: A4_CONTENT_WIDTH, height: 1200 });
  await page.emulateMedia({ media: 'print' });
  await page.goto(reportUrl(report(wideTable).output));
  await dispatchPrint(page, 'beforeprint');

  for (const selector of [
    '#report-view .dataTable',
    '#report-view .description table',
  ]) {
    const table = page.locator(selector).first();
    await expect(table, selector).toBeVisible();
    expect(
      await table.evaluate((element) => getComputedStyle(element).tableLayout),
      `${selector} layout`,
    ).toBe('fixed');
  }

  expect(
    await regionOverflow(page, '#report-view .tableWrap:has(.dataTable)'),
    'step table overflow',
  ).toBeLessThanOrEqual(1);
  expect(
    await regionOverflow(
      page,
      '#report-view .description .tableWrap',
    ),
    'description table overflow',
  ).toBeLessThanOrEqual(1);
  expect(await documentOverflow(page), 'document overflow').toBeLessThanOrEqual(
    1,
  );
});

test('resets the print state without a dialog close method', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    for (const method of ['close', 'showModal'] as const) {
      Object.defineProperty(HTMLDialogElement.prototype, method, {
        configurable: true,
        value: undefined,
      });
    }
  });
  await page.setViewportSize({ width: A4_WIDTH, height: 1200 });
  await page.goto(reportUrl(report(english).output));
  expect(
    await page.evaluate(
      () => typeof document.createElement('dialog').close,
      'dialog.close is unavailable',
    ),
  ).toBe('undefined');

  await page.locator('.shotButton').first().click();
  expect(
    await page.evaluate(() => document.documentElement.style.overflow),
    'lightbox scroll lock without dialog.close',
  ).toBe('hidden');

  await dispatchPrint(page, 'beforeprint');
  expect(
    await page.evaluate(() => document.documentElement.style.overflow),
    'overflow reset without dialog.close',
  ).not.toBe('hidden');
  await dispatchPrint(page, 'afterprint');
  expect(errors, 'print lifecycle script errors').toEqual([]);
});

test('prints the light palette from a dark screen', async ({ page }) => {
  await page.setViewportSize({ width: A4_WIDTH, height: 1200 });
  await page.emulateMedia({ colorScheme: 'light', media: 'screen' });
  await page.goto(reportUrl(report(english).output));
  await dispatchPrint(page, 'beforeprint');

  const logPanel = 'details.attachmentText:has(pre.ansiLog)';
  const logText = 'details.attachmentText:has(pre.ansiLog) pre.ansiLog';

  const sample = async () => ({
    body: await luminance(page, 'body', 'backgroundColor'),
    chip: await luminance(
      page,
      '#report-view .statusText.pass',
      'backgroundColor',
    ),
    logPanel: await luminance(page, logPanel, 'backgroundColor'),
    logText: await luminance(page, logText, 'color'),
  });

  const light = await sample();
  expect(light.body, 'light body').toBeGreaterThan(0.8);
  expect(light.chip, 'light status chip').toBeGreaterThan(0.7);
  expect(light.logPanel, 'light ANSI panel').toBeGreaterThan(0.8);
  expect(light.logText, 'dark ink on the ANSI log').toBeLessThan(0.2);

  await page.emulateMedia({ colorScheme: 'dark', media: 'screen' });
  const dark = await sample();
  expect(dark.body, 'dark screen body').toBeLessThan(0.2);
  expect(dark.chip, 'dark screen status chip').toBeLessThan(0.4);
  expect(dark.logPanel, 'dark screen ANSI panel').toBeLessThan(0.2);
  expect(dark.logText, 'light ink on the dark ANSI log').toBeGreaterThan(0.6);

  await page.emulateMedia({ colorScheme: 'dark', media: 'print' });
  const printed = await sample();
  expect(printed.body, 'printed body stays light').toBeGreaterThan(0.8);
  expect(printed.chip, 'printed status chip stays light').toBeGreaterThan(0.7);
  expect(printed.logPanel, 'printed ANSI panel stays light').toBeGreaterThan(0.8);
  expect(printed.logText, 'printed ANSI ink stays dark').toBeLessThan(0.2);
});

test('prints the active Report without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: A4_WIDTH, height: 1200 },
  });
  const page = await context.newPage();
  try {
    await page.emulateMedia({ media: 'print' });
    await page.goto(reportUrl(report(english).output));

    await expect(page.locator('#report-view')).toBeVisible();
    await expect(page.locator('#analysis-view')).toBeHidden();
    await expect(page.locator('#trends-view')).toBeHidden();
    expect(await page.locator('.topbar:visible').count()).toBe(0);
    expect(await page.locator('.toolbar:visible').count()).toBe(0);

    const closed = page.locator('details.feature:not([open])').first();
    await expect(closed).toBeVisible();
    expect(await closed.getAttribute('open')).toBeNull();
    await expect(page.locator('.shot').first()).toBeVisible();
  } finally {
    await context.close();
  }
});

test('prints Report and Details only when the report has no history', async ({
  page,
}) => {
  await page.setViewportSize({ width: A4_WIDTH, height: 1200 });
  await page.emulateMedia({ media: 'print' });
  await page.goto(reportUrl(report(noHistory).output));
  await dispatchPrint(page, 'beforeprint');

  await expect(page.locator('#report-view')).toBeVisible();
  await expect(page.locator('#analysis-view')).toBeVisible();
  await expect(page.locator('#trends-view')).toHaveCount(0);
  expect(
    await page.locator('[data-view="trends"]').count(),
    'no Trends tab in the DOM',
  ).toBe(0);
});

test('prints the German history report at the A4 content width', async ({
  page,
}) => {
  await page.setViewportSize({ width: A4_CONTENT_WIDTH, height: 1200 });
  await page.emulateMedia({ media: 'print' });
  await page.goto(reportUrl(report(german).output));
  await dispatchPrint(page, 'beforeprint');

  await expect(page.locator('#report-view')).toContainText(
    'Erstellt von Tolkira',
  );
  await expect(page.locator('#report-view .runHead .meta')).toContainText(
    '2 Features',
  );
  await expect(page.locator('#report-view .runHead .meta')).toContainText(
    '3 Szenarien mit Ergebnissen',
  );
  await expect(page.locator('#report-view')).toContainText(
    'Überweisung ohne Deckung',
  );
  await expect(page.locator('#analysis-view')).toBeVisible();
  await expect(page.locator('#analysis-view')).toContainText('Laufdetails');
  await expect(
    page.locator('#analysis-view .tableWrap').first(),
  ).toHaveAttribute('aria-label', 'Feature-Statusmatrix');
  await expect(page.locator('#trends-view')).toBeVisible();
  await expect(page.locator('#trends-view')).toContainText(
    'Aufgezeichnete Läufe',
  );
  await expect(page.locator('#trends-view')).toContainText('3 Läufe');
  await expect(page.locator('.shot').first()).toBeVisible();

  const clientKeys = await page.evaluate(() => {
    const block = document.getElementById('tolkira-messages');
    if (!block?.textContent) return [];
    return Object.keys(
      JSON.parse(block.textContent) as Record<string, string>,
    );
  });
  expect(clientKeys.filter((key) => /print/i.test(key))).toEqual([]);

  expect(
    await regionOverflow(page, '#analysis-view .tableWrap'),
    'German matrix overflow',
  ).toBeLessThanOrEqual(1);
  expect(
    await regionOverflow(page, '#trends-view .tableWrap'),
    'German Trends overflow',
  ).toBeLessThanOrEqual(1);
  expect(
    await oneCharacterStacks(page, '#trends-view .trendsTable thead th'),
    'German Trends header character stacks',
  ).toEqual([]);
  expect(
    await wrappingText(page, '#trends-view .trendsTable tbody .statusText'),
    'German Trends status pills split',
  ).toEqual([]);
  const metrics = await trendsPrintMetrics(page);
  expect(metrics.titleWidth, 'German Trends title width').toBeGreaterThan(100);
  expect(metrics.durationLines, 'German Trends duration lines').toBe(1);
  expect(
    metrics.statusOverflow,
    'German Trends status overflow',
  ).toBeLessThanOrEqual(1);
  expect(metrics.statusGap, 'German Trends status gap').toBeGreaterThanOrEqual(
    0,
  );
  const oldest = page.locator('#trends-view tbody tr').last();
  await expect(oldest.locator('td').nth(8), 'old Flaky cell').toHaveText('—');
  await expect(oldest.locator('td').nth(9), 'old Flaky share cell').toHaveText(
    '—',
  );
  expect(await documentOverflow(page), 'German document overflow').toBeLessThanOrEqual(
    1,
  );
});

test('prints the failed-only filter, its marker and full Details and Trends', async ({
  page,
}) => {
  await page.setViewportSize({ width: A4_WIDTH, height: 1200 });
  await page.goto(reportUrl(report(english).output));

  const preset = page.locator('button[data-filter-preset="failed"]');
  await preset.click();
  await expect(preset).toHaveAttribute('aria-pressed', 'true');
  const live = page.locator('#tolkira-live');
  await expect(live).toContainText('scenarios visible');

  await page.emulateMedia({ media: 'print' });

  await expect(live).toBeVisible();
  const marker = await live.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      position: style.position,
      width: element.getBoundingClientRect().width,
    };
  });
  expect(marker.position, 'print filter marker position').toBe('static');
  expect(marker.width, 'print filter marker width').toBeGreaterThan(1);

  const visibleStatuses = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('#report-view details.scenario')]
      .filter((element) => !element.hidden)
      .map((element) => element.dataset.status ?? ''),
  );
  expect(visibleStatuses.length, 'filtered rows').toBeGreaterThan(0);
  expect(
    visibleStatuses.every((status) => status === 'failed'),
    'only failed rows print',
  ).toBe(true);
  await expect(
    page.locator('#report-view details.scenario[data-status="passed"]').first(),
  ).toBeHidden();

  await dispatchPrint(page, 'beforeprint');
  await expect(page.locator('#analysis-view')).toBeVisible();
  await expect(page.locator('#analysis-view .featureTable')).toContainText(
    'Happy HTML reporting',
  );
  await expect(page.locator('#analysis-view .legend')).toContainText('Passed');
  await expect(page.locator('#trends-view')).toBeVisible();
  await expect(page.locator('#trends-view tbody tr')).toHaveCount(3);
});

test('writes a multi-page A4 PDF with the complete print state', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'page.pdf is Chromium-only');

  await page.setViewportSize({ width: A4_WIDTH, height: 1200 });
  await page.emulateMedia({ media: 'print' });
  await page.goto(reportUrl(report(english).output));
  await dispatchPrint(page, 'beforeprint');
  await expect(page.locator('#analysis-view')).toBeVisible();
  await expect(page.locator('#trends-view')).toBeVisible();

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });

  expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
  const pages = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? [];
  expect(pages.length, 'Report, Details and Trends pages').toBeGreaterThanOrEqual(
    3,
  );
});

test('prints the German flaky Trends columns without clipping', async ({
  page,
}) => {
  const historyDir = await mkdtemp(path.join(tmpdir(), 'tolkira-print-flaky-'));
  const history = path.join(historyDir, 'history.json');
  const input = await writeInput(
    'flaky-de.json',
    legacyFlakyReport([0, 1]),
    'tolkira-print-flaky-input-',
  );
  let file: ReportFile | undefined;
  try {
    await copyFile(historyFixture, history);
    file = await writeReportWithHistory(
      [input.file],
      history,
      'Druckbericht',
      'tolkira-print-flaky-report-',
      'de',
    );
    const de = JSON.parse(
      await readFile(
        new URL('../../src/i18n/locales/de.json', import.meta.url),
        'utf8',
      ),
    ) as Record<string, string>;

    await page.setViewportSize({ width: A4_CONTENT_WIDTH, height: 1200 });
    await page.emulateMedia({ media: 'print' });
    await page.goto(reportUrl(file.output));
    await dispatchPrint(page, 'beforeprint');

    await expect(page.locator('#trends-view')).toBeVisible();
    expect(de['trends.flaky'], 'de trends.flaky').toBeTruthy();
    expect(de['trends.flakyShare'], 'de trends.flakyShare').toBeTruthy();
    await expect(page.locator('#trends-view thead')).toContainText(
      de['trends.flaky'] as string,
    );
    await expect(page.locator('#trends-view thead')).toContainText(
      de['trends.flakyShare'] as string,
    );
    await expect(page.locator('#trends-view tbody tr').first()).toContainText(
      new Intl.NumberFormat('de', {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(0.05),
    );

    expect(
      await regionOverflow(page, '#trends-view .tableWrap'),
      'flaky Trends overflow',
    ).toBeLessThanOrEqual(1);
    expect(
      await oneCharacterStacks(page, '#trends-view .trendsTable thead th'),
      'flaky Trends header character stacks',
    ).toEqual([]);
    const metrics = await trendsPrintMetrics(page);
    expect(metrics.titleWidth, 'flaky Trends title width').toBeGreaterThan(100);
    expect(metrics.durationLines, 'flaky Trends duration lines').toBe(1);
    expect(
      metrics.statusOverflow,
      'flaky Trends status overflow',
    ).toBeLessThanOrEqual(1);
    expect(
      metrics.statusGap,
      'flaky Trends status gap',
    ).toBeGreaterThanOrEqual(0);
    expect(
      await documentOverflow(page),
      'flaky document overflow',
    ).toBeLessThanOrEqual(1);
  } finally {
    if (file) await removeReport(file.dir);
    await rm(input.dir, { recursive: true, force: true });
    await rm(historyDir, { recursive: true, force: true });
  }
});
