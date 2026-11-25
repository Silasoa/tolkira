import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  removeReport,
  reportUrl,
  writeEmail,
  writeInput,
  type EmailFile,
} from './helpers.js';
import { fixturePath, messagesFixture } from '../fixtures.js';

const screenshotInput = messagesFixture('screenshot.ndjson');
const germanInput = fixturePath('i18n', 'german-testdata.json');
const longFeature = `Feature ${'F'.repeat(300)}`;
const longScenario = `Scenario ${'S'.repeat(300)}`;

let english: EmailFile | undefined;
let standalone: EmailFile | undefined;
let german: EmailFile | undefined;
let long: EmailFile | undefined;
let longInputDir: string | undefined;

function emailFile(file: EmailFile | undefined): EmailFile {
  if (!file) throw new Error('email was not written');
  return file;
}

function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

test.beforeAll(async () => {
  english = await writeEmail(
    [screenshotInput],
    'Mail run',
    'tolkira-email-e2e-',
    '',
    true,
  );
  standalone = await writeEmail(
    [screenshotInput],
    'Standalone',
    'tolkira-email-standalone-',
  );
  german = await writeEmail(
    [germanInput],
    'Monatsbericht',
    'tolkira-email-de-',
    'de',
    true,
  );
  const input = await writeInput(
    'long-name.ndjson',
    (await readFile(screenshotInput, 'utf8'))
      .replaceAll('Screenshot attachment', longFeature)
      .replaceAll('Failing scenario', longScenario),
  );
  longInputDir = input.dir;
  long = await writeEmail([input.file], 'Long names', 'tolkira-email-long-');
});

test.afterAll(async () => {
  for (const file of [english, standalone, german, long]) {
    if (file) await removeReport(file.dir);
  }
  if (longInputDir) await removeReport(longInputDir);
});

test('opens the email at 600 and 320 px without overflow or remote assets', async ({
  page,
}) => {
  const file = emailFile(english);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  for (const width of [600, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(reportUrl(file.email));

    expect(await pageOverflow(page), `${width}px overflow`).toBeLessThanOrEqual(
      1,
    );
    await expect(page).toHaveTitle('Mail run — Failed');
    await expect(page.locator('h1')).toHaveText('Mail run — Failed');

    const body = page.locator('body');
    await expect(body).toContainText('Pass rate');
    await expect(body).toContainText('50%');
    await expect(body).toContainText('2 scenarios with results');
    await expect(body).toContainText(/1\s+feature/);
    await expect(body).toContainText(/2\s+steps/);
    await expect(body).toContainText('Attachments in the run');
    await expect(body).toContainText(/1\s+attachment/);
    await expect(body).toContainText('8,509 bytes');
    await expect(body).toContainText('Generated:');
    await expect(body).toContainText('Failed');
    await expect(body).toContainText('Screenshot attachment');
    await expect(body).toContainText('Failing scenario');
    await expect(body).toContainText('report.html');
    await expect(body).toContainText('Full report');

    const font = await body.evaluate(
      (element) => getComputedStyle(element).fontFamily,
    );
    expect(font).toMatch(/sans-serif/i);

    const metricTops = await page
      .locator('td.metric')
      .evaluateAll((cells) =>
        cells.map((cell) => Math.round(cell.getBoundingClientRect().top)),
      );
    expect(metricTops, `${width}px metric rows`).toHaveLength(4);
    if (width === 600) {
      expect(metricTops[0]).toBe(metricTops[1]);
      expect(metricTops[2]).toBeGreaterThan(metricTops[0]!);
    } else {
      expect(metricTops[0]).not.toBe(metricTops[1]);
      expect(metricTops[1]).not.toBe(metricTops[2]);
    }

    expect(await page.locator('script').count(), 'scripts').toBe(0);
    expect(
      await page.locator('img, picture, svg, image').count(),
      'images',
    ).toBe(0);
    expect(await page.locator('a[href]').count(), 'links').toBe(0);
    expect(
      await page.evaluate(() => performance.getEntriesByType('resource')),
      'subresources',
    ).toEqual([]);
  }

  const remote = requests.filter((url) => !url.startsWith('file:'));
  expect(remote, 'remote requests').toEqual([]);
});

test('writes the report and the email from one run', async () => {
  const file = emailFile(english);
  expect(file.report, 'report path').toBeDefined();
  await expect(readFile(file.report as string, 'utf8')).resolves.toContain(
    '<html',
  );
  await expect(readFile(file.email, 'utf8')).resolves.toContain('<html');
});

test('states that the standalone email has no full report', async ({
  page,
}) => {
  const file = emailFile(standalone);
  expect(file.report).toBeUndefined();

  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto(reportUrl(file.email));

  const body = page.locator('body');
  await expect(body).toContainText('No full report is attached.');
  await expect(body).not.toContainText('Full report:');
  expect(await page.locator('script').count(), 'scripts').toBe(0);
});

test('renders German labels and escaped test data at 600 and 320 px', async ({
  page,
}) => {
  const file = emailFile(german);
  const feature = 'Kontoeröffnung <img src=x onerror="alert(1)"> & "Zitat"';

  for (const width of [600, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(reportUrl(file.email));

    expect(await pageOverflow(page), `${width}px overflow`).toBeLessThanOrEqual(
      1,
    );
    await expect(page).toHaveTitle('Monatsbericht — Fehlgeschlagen');
    await expect(page.locator('h1')).toHaveText(
      'Monatsbericht — Fehlgeschlagen',
    );
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    const body = page.locator('body');
    await expect(body).toContainText('Fehlgeschlagen');
    await expect(body).toContainText('Szenarien mit Ergebnissen');
    await expect(body).toContainText('Überweisung ohne Deckung');
    await expect(body).toContainText(feature);
    await expect(body).toContainText(/\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} UTC/);
    await expect(body).toContainText(/50\s*%/);
    await expect(body).toContainText('Erstellt:');
    await expect(body).toContainText('Fehlgeschlagene Szenarien');
    await expect(body).toContainText('Erfolgsquote');
    await expect(body).toContainText(
      'Die Erfolgsquote zählt nur ausgeführte (nicht übersprungene) Szenarien.',
    );
    await expect(body).toContainText('Schritte');
    await expect(body).toContainText('Dauer');
    await expect(body).toContainText('Anhänge im Lauf');
    await expect(body).toContainText('report.html');
    await expect(body).toContainText(
      'Vollständiger Bericht: report.html. Bitte separat anhängen oder teilen.',
    );
    await expect(body).toContainText(
      'Erstellt von Tolkira. Eine Datei. Keine Netzwerkanfragen. Kein Tracking.',
    );
    await expect(body).not.toContainText('Pass rate');
    await expect(body).not.toContainText('Full report');

    expect(await page.locator('img, svg').count(), 'images').toBe(0);
    expect(await page.locator('[onerror]').count(), 'event attributes').toBe(0);
    expect(await page.locator('script').count(), 'scripts').toBe(0);
  }
});

test('caps and wraps long names at 320 px', async ({ page }) => {
  const file = emailFile(long);

  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(reportUrl(file.email));

  expect(await pageOverflow(page), '320px overflow').toBeLessThanOrEqual(1);
  const body = page.locator('body');
  await expect(body).toContainText(longFeature.slice(0, 199));
  await expect(body).toContainText(longScenario.slice(0, 199));
  await expect(body).toContainText('…');
  await expect(body).not.toContainText(longFeature);
  await expect(body).not.toContainText(longScenario);
  await expect(body).toContainText('No full report is attached.');

  const wrap = await page
    .locator('h1')
    .evaluate((element) => getComputedStyle(element).overflowWrap);
  expect(['anywhere', 'break-word']).toContain(wrap);
  expect(await page.locator('script').count(), 'scripts').toBe(0);
});
