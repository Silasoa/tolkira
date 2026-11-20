import { expect, test, type Page } from '@playwright/test';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readClipboard,
  removeReport,
  reportUrl,
  stubClipboard,
  writeReport,
  writeReportWithHistory,
  type ReportFile,
} from './helpers.js';

const germanInput = fileURLToPath(
  new URL('../fixtures/i18n/german-testdata.json', import.meta.url),
);
const historyFixture = fileURLToPath(
  new URL('../fixtures/history/two-runs.json', import.meta.url),
);

const EMPTY_RESULT =
  'Keine Szenarien entsprechen der aktuellen Suche oder den Filtern.';
const FAILED_ONLY = 'Nur fehlgeschlagene';
const COPY_FAILURE = 'Fehlerdetails kopieren';

let english: ReportFile | undefined;
let german: ReportFile | undefined;
let germanHistory: ReportFile | undefined;

function report(file: ReportFile | undefined): ReportFile {
  if (!file) throw new Error('report was not written');
  return file;
}

function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

test.beforeAll(async () => {
  english = await writeReport([germanInput], '', 'tolkira-locale-e2e-');
  german = await writeReport([germanInput], '', 'tolkira-locale-e2e-', 'de');
  const historyDir = await writeReport([germanInput], '', 'tolkira-locale-history-');
  const history = path.join(historyDir.dir, 'history.json');
  await copyFile(historyFixture, history);
  germanHistory = await writeReportWithHistory(
    [germanInput],
    history,
    '',
    'tolkira-locale-trends-',
    'de',
  );
  await removeReport(historyDir.dir);
});

test.afterAll(async () => {
  if (english) await removeReport(english.dir);
  if (german) await removeReport(german.dir);
  if (germanHistory) await removeReport(germanHistory.dir);
});

test('keeps German usable at every gate viewport with one tab row', async ({
  page,
}) => {
  const de = report(german);

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(reportUrl(de.output));

    expect(await pageOverflow(page), `${width}px overflow`).toBeLessThanOrEqual(1);

    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.first()).toHaveText('Bericht');
    const tops = await tabs.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().top),
    );
    expect(tops).toHaveLength(2);
    for (const top of tops) {
      expect(Math.abs(top - (tops[0] ?? 0)), `${width}px tab row`).toBeLessThan(
        1.5,
      );
    }
  }

  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(reportUrl(de.output, '#scenario-1-1'));
  await expect(page.locator('#scenario-1-1')).toBeVisible();
  const bar = await page.locator('.topbar').boundingBox();
  expect(bar, 'topbar').not.toBeNull();
  await expect
    .poll(async () => {
      const target = await page.locator('#scenario-1-1').boundingBox();
      return target ? target.y - ((bar?.y ?? 0) + (bar?.height ?? 0)) : -999;
    }, 'anchor below the bar')
    .toBeGreaterThanOrEqual(-1);

  await page.addInitScript(() => {
    document.documentElement.style.fontSize = '32px';
  });
  await page.goto(reportUrl(de.output));
  expect(await pageOverflow(page), '320px at 200% overflow').toBeLessThanOrEqual(
    1,
  );
  await expect(page.getByRole('tab').first()).toHaveText('Bericht');
});

test('keeps the English report English with the same test data', async ({
  page,
}) => {
  const en = report(english);
  await page.goto(reportUrl(en.output));

  await expect(page.getByRole('tab').first()).toHaveText('Report');
  await expect(page.locator('input[data-search]')).toHaveAttribute(
    'placeholder',
    'Search scenario, feature or tag',
  );
  const text = await page
    .locator('#feature-list')
    .evaluate((element) => element.textContent ?? '');
  expect(text).toContain('Überweisung ohne Deckung');
  expect(text).toContain('Angenommen');
});

test('localizes search, filters and copy', async ({ page }) => {
  const de = report(german);
  await stubClipboard(page);
  await page.goto(reportUrl(de.output));

  const search = page.locator('input[data-search]');
  await expect(search).toHaveAttribute(
    'placeholder',
    'Szenario, Feature oder Tag suchen',
  );

  await search.fill('ohne Deckung');
  await expect(page.locator('#tolkira-live')).toHaveText(
    '1 von 2 Szenarien sichtbar',
  );
  await expect(page.locator('#tolkira-live')).not.toContainText(
    'of 2 scenarios',
  );

  await search.fill('gibt es nicht');
  await expect(page.locator('#empty-results')).toHaveText(EMPTY_RESULT);
  await search.fill('');
  await expect(page.locator('#empty-results')).toBeHidden();

  const failedOnly = page.getByRole('button', { name: FAILED_ONLY });
  await failedOnly.click();
  await expect(failedOnly).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tolkira-live')).toHaveText(
    '1 von 2 Szenarien sichtbar',
  );

  await page.getByRole('button', { name: COPY_FAILURE }).click();
  await expect(page.getByRole('button', { name: 'Kopiert' })).toBeVisible();
  const copied = await readClipboard(page);
  expect(copied).toContain('Feature: Kontoeröffnung');
  expect(copied).toContain('Szenario: Überweisung ohne Deckung');
  expect(copied).toContain('Schritt: Wenn ich 250,00 € überweise');
});

test('renders German test data verbatim and never as markup', async ({
  page,
}) => {
  const de = report(german);
  await page.goto(reportUrl(de.output));

  const text = await page
    .locator('#feature-list')
    .evaluate((element) => element.textContent ?? '');
  expect(text).toContain('Überweisung ohne Deckung');
  expect(text).toContain('Überweisung mit ausreichendem Guthaben');
  expect(text).toContain('Angenommen');
  expect(text).toContain('das Konto hat 1.000,00 € Guthaben');
  expect(text).toContain('@konto');
  expect(text).toContain('„Nicht genügend Guthaben“');
  expect(text).toContain('<img src=x onerror="alert(1)">');

  await expect(page.locator('#feature-list img[src="x"]')).toHaveCount(0);
});

test('round-trips the German failed-only URL state', async ({ page }) => {
  const de = report(german);
  await page.goto(reportUrl(de.output, '?hide=passed'));

  const passedFilter = page.locator('button[data-filter-status="passed"]');
  await expect(passedFilter).toContainText('Bestanden');
  await expect(passedFilter).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#tolkira-live')).toHaveText(
    '1 von 2 Szenarien sichtbar',
  );
  await expect(page).toHaveURL(/hide=passed/);
});

test('keeps German Details and Trends usable at 320px and 200% text', async ({
  page,
}) => {
  const de = report(germanHistory);

  for (const view of ['Details', 'Trends']) {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(reportUrl(de.output));
    await page.getByRole('tab', { name: view }).click();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    expect(await pageOverflow(page), `${view} at 320px/200%`).toBeLessThanOrEqual(
      1,
    );
  }

  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(reportUrl(de.output));
  await page.getByRole('tab', { name: 'Details' }).click();
  const matrixName = await page.locator('.featureTable .matrixName').first().boundingBox();
  expect(matrixName, 'matrix feature name').not.toBeNull();
  expect(matrixName!.width, 'matrix feature name width').toBeGreaterThan(96);
  expect(
    await page.locator('.featureTable').evaluate(
      (table) => table.parentElement!.scrollWidth > table.parentElement!.clientWidth,
    ),
    'matrix still scrolls in its region',
  ).toBe(true);

  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(reportUrl(de.output));
    const chip = page.locator('.feature > summary .statusText').first();
    const box = await chip.boundingBox();
    expect(box, `${width}px status chip`).not.toBeNull();
    expect(box!.height, `${width}px status chip height`).toBeLessThan(30);
  }
});

test('keeps the German Report view visible without JavaScript', async ({
  browser,
}) => {
  const de = report(german);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(reportUrl(de.output));
    await expect(page.locator('#report-view')).toBeVisible();
    await expect(page.locator('#analysis-view')).toBeHidden();
    await expect(page.getByRole('tab', { name: 'Bericht' })).toBeVisible();
    await expect(page.locator('#report-view')).toContainText(
      'Erstellt von Tolkira',
    );
  } finally {
    await context.close();
  }
});
