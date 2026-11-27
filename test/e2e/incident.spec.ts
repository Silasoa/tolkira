import { expect, test, type Page } from '@playwright/test';
import { rm } from 'node:fs/promises';
import {
  readPdf,
  readClipboard,
  removeReport,
  reportUrl,
  stubClipboard,
  writeInput,
  writeReport,
  type ReportFile,
} from './helpers.js';
import {
  incidentJson,
  LOG_BODY,
  step,
  type IncidentRunSpec,
} from '../render-incident-fixtures.js';

const TITLE = 'Incident E2E';
const HEADING = 'What happened';
const ROW_LABEL = 'Shown above';
const EMPTY_COPY =
  'No scenarios in the list match the current search or filters.';
const LONG_ERROR = `AssertionError: expected the request to settle\n${'  at frame\n'.repeat(30)}`;

function mainRun(): IncidentRunSpec {
  return {
    features: [
      {
        name: 'Checkout',
        uri: 'features/checkout.feature',
        tags: ['@shop'],
        scenarios: [
          {
            name: 'pays an invoice',
            tags: ['@billing'],
            before: [{ at: 'before' }],
            steps: [
              step('opens the checkout page', { durationMs: 1000 }),
              step('the payment fails', {
                keyword: 'Then',
                status: 'failed',
                durationMs: 500,
                message: 'Expected 200 but got 500\n  at checkout.ts:42',
                attachments: [
                  {
                    fileName: 'server.log',
                    mediaType: 'text/x.cucumber.log+plain',
                    body: LOG_BODY,
                  },
                ],
              }),
            ],
          },
          { name: 'second failure', status: 'failed' },
          { name: 'skipped row', status: 'skipped' },
        ],
      },
    ],
  };
}

function longRun(count = 8): IncidentRunSpec {
  return {
    features: [
      {
        name: 'Long scenario',
        uri: 'features/long.feature',
        scenarios: [
          {
            name: 'many steps',
            steps: [
              ...Array.from({ length: count - 1 }, (_, index) =>
                step(`opens panel ${index + 1}`),
              ),
              step('the final check fails', {
                status: 'failed',
                message: LONG_ERROR,
              }),
            ],
          },
        ],
      },
    ],
  };
}

function germanRun(): IncidentRunSpec {
  return {
    features: [
      {
        name: 'Kasse',
        uri: 'features/kasse.feature',
        scenarios: [
          { name: 'erste Zahlung', status: 'failed' },
          { name: 'zweite Zahlung', status: 'failed' },
        ],
      },
    ],
  };
}

let main: { report: ReportFile; inputDir: string } | undefined;
let long: { report: ReportFile; inputDir: string } | undefined;
let longSeven: { report: ReportFile; inputDir: string } | undefined;
let german: { report: ReportFile; inputDir: string } | undefined;
let staticReport: { report: ReportFile; inputDir: string } | undefined;

async function writeIncident(
  spec: IncidentRunSpec,
  options: { title?: string; locale?: string; extraArgs?: string[] } = {},
): Promise<{ report: ReportFile; inputDir: string }> {
  const input = await writeInput(
    'incident.json',
    incidentJson(spec),
    'tolkira-incident-input-',
  );
  const written = await writeReport(
    [input.file],
    options.title ?? TITLE,
    'tolkira-incident-e2e-',
    options.locale ?? '',
    options.extraArgs ?? [],
  );
  return { report: written, inputDir: input.dir };
}

function report(file: { report: ReportFile } | undefined): ReportFile {
  if (!file) throw new Error('report was not written');
  return file.report;
}

test.beforeAll(async () => {
  main = await writeIncident(mainRun());
  long = await writeIncident(longRun(8), { title: 'Long incident' });
  longSeven = await writeIncident(longRun(7), {
    title: 'Seven step incident',
  });
  german = await writeIncident(germanRun(), {
    title: 'Vorfall',
    locale: 'de',
  });
  staticReport = await writeIncident(mainRun(), {
    title: 'Static incident',
    extraArgs: ['--static'],
  });
});

test.afterAll(async () => {
  for (const file of [main, long, longSeven, german, staticReport]) {
    if (!file) continue;
    await removeReport(file.report.dir);
    await rm(file.inputDir, { recursive: true, force: true });
  }
});

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

test('shows the incident above the fold and links its row to the panel', async ({
  page,
}) => {
  await page.goto(reportUrl(report(main).output));
  const panel = page.locator('#incident');

  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole('heading', { name: HEADING, level: 2 }),
  ).toBeInViewport();
  await expect(
    panel.getByText('Checkout', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    panel.getByText('pays an invoice', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    panel.getByText('Failed', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    panel.getByText('Run failed', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    panel.getByText('the payment fails', { exact: false }).first(),
  ).toBeInViewport();
  await expect(
    panel.getByText('Expected 200 but got 500', { exact: false }).first(),
  ).toBeInViewport();
  await expect(panel).toContainText('server.log');

  const rowLink = page.locator('#scenario-1-1 a[href="#incident"]');
  await expect(rowLink).toHaveText(ROW_LABEL);
  const rowLinkBox = await rowLink.boundingBox();
  expect(rowLinkBox?.width, 'row link width').toBeGreaterThanOrEqual(60);
  expect(rowLinkBox?.height, 'row link height').toBeLessThan(40);
  await expect(page.locator('#scenario-1-1')).toHaveAttribute(
    'data-scenario',
    '',
  );
  await expect(page.locator('#scenario-1-1 .chev')).toHaveCount(0);
  await expect(page.locator('#scenario-1-1')).not.toHaveJSProperty(
    'tagName',
    'DETAILS',
  );

  await rowLink.focus();
  await expect(rowLink).toBeFocused();
  await rowLink.press('Enter');
  expect(new URL(page.url()).hash).toBe('#incident');
  await expect(panel).toBeFocused();

  await page.goto(reportUrl(report(main).output));
  const triageLink = page.locator('.triageScenario[href="#incident"]');
  await expect(triageLink).toHaveCount(1);
  await triageLink.focus();
  await triageLink.press('Enter');
  expect(new URL(page.url()).hash).toBe('#incident');
  await expect(panel).toBeFocused();

  // The second failed row keeps its own disclosure.
  const second = page.locator('details.scenario#scenario-1-2');
  await expect(second).toBeVisible();
  await expect(second.locator('[data-copy-failure]')).toHaveCount(1);
  await expect(page.locator('[data-copy-failure]')).toHaveCount(2);
  await expect(page.locator('.detailInline')).toHaveCount(2);
});

test('copies the failure and keeps the log copy on its attachment', async ({
  page,
}) => {
  await stubClipboard(page);
  await page.goto(reportUrl(report(main).output));

  const copy = page.locator('#incident [data-copy-failure]');
  await expect(copy).toBeVisible();
  await copy.click();
  await expect(copy).toHaveText('Copied');
  await expect(page.locator('#tolkira-copy-live')).toHaveText(
    'Failure details copied to clipboard.',
  );

  const failure = await readClipboard(page);
  expect(failure).toContain('Feature: Checkout');
  expect(failure).toContain('Scenario: pays an invoice');
  expect(failure).toContain('URI: features/checkout.feature');
  expect(failure).toContain('Step: Then the payment fails');
  expect(failure).toContain('Error:\nExpected 200 but got 500');

  const log = page.locator('#incident [data-copy-log]');
  await expect(log).toBeVisible();
  await log.click();
  await expect(log).toHaveText('Copied');
  expect(await readClipboard(page)).toBe(LOG_BODY);
});

test('scopes collapse and expand to scenario rows and keeps the panel open', async ({
  page,
}) => {
  await page.goto(reportUrl(report(main).output));
  const panel = page.locator('#incident');
  const second = page.locator('details.scenario#scenario-1-2');

  await expect(second).toHaveJSProperty('open', true);
  await page.getByRole('button', { name: 'Collapse all scenarios' }).click();
  await expect(panel).toBeVisible();
  await expect(second).toHaveJSProperty('open', false);
  await expect(page.locator('#scenario-1-1 a[href="#incident"]')).toBeVisible();

  await page.getByRole('button', { name: 'Expand all scenarios' }).click();
  await expect(second).toHaveJSProperty('open', true);
  await expect(panel).toBeVisible();
});

test('keeps the panel and its triage link under an active filter', async ({
  page,
}) => {
  await page.goto(reportUrl(report(main).output));
  const panel = page.locator('#incident');
  const triageLink = page.locator('.triageScenario[href="#incident"]');
  const search = page.getByRole('searchbox', { name: 'Search scenarios' });

  await expect(triageLink).toHaveCount(1);
  await search.fill('no-such-scenario-matches');
  await expect(page.locator('#empty-results')).toBeVisible();
  await expect(page.locator('#empty-results')).toHaveText(EMPTY_COPY);
  await expect(panel).toBeVisible();
  await expect(page.locator('[data-triage]')).toBeHidden();
  await expect(triageLink).toHaveCount(1);
  await expect(panel.locator('a[href^="#scenario-"]')).toHaveCount(0);

  await search.fill('');
  await expect(page.locator('[data-triage]')).toBeVisible();
  await expect(panel).toBeVisible();
});

test('keeps the panel under the failed-only and tag filters', async ({
  page,
}) => {
  await page.goto(reportUrl(report(main).output));
  const panel = page.locator('#incident');

  await page.getByRole('button', { name: 'Failed only' }).click();
  await expect(panel).toBeVisible();
  await expect(page.locator('#scenario-1-1')).toBeVisible();
  await expect(page.locator('details.scenario#scenario-1-2')).toBeVisible();
  await expect(page.locator('#scenario-1-3')).toBeHidden();
  await expect(panel.locator('a[href^="#scenario-"]')).toHaveCount(0);

  await page.reload();
  await page.locator('[data-tag-filter]').selectOption('@billing');
  await expect(panel).toBeVisible();
  await expect(page.locator('#scenario-1-1')).toBeVisible();
  await expect(page.locator('#scenario-1-2')).toBeHidden();
  await expect(panel.locator('a[href^="#scenario-"]')).toHaveCount(0);
});

test('keeps the row link inside its cell at 1440, 390 and 320 px at 200 %', async ({
  page,
}) => {
  for (const [width, zoom] of [
    [1440, false],
    [390, false],
    [320, true],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(reportUrl(report(main).output));
    if (zoom) {
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '32px';
      });
    }
    const fits = await page
      .locator('#scenario-1-1 .scenarioButton')
      .evaluate((button) => {
        const link = button.querySelector<HTMLElement>('.scenarioLink');
        if (!link) return false;
        const linkBox = link.getBoundingClientRect();
        const buttonBox = button.getBoundingClientRect();
        return (
          linkBox.left >= buttonBox.left - 1 &&
          linkBox.right <= buttonBox.right + 1 &&
          link.scrollWidth <= link.clientWidth + 1
        );
      });
    expect(fits, `row link at ${width} px`).toBe(true);
    const overlap = await page
      .locator('#scenario-1-1 .scenarioButton')
      .evaluate((button) => {
        const link = button.querySelector<HTMLElement>('.scenarioLink');
        const status = button.querySelector<HTMLElement>('.statusCell');
        if (!link || !status) return false;
        const a = link.getBoundingClientRect();
        const b = status.getBoundingClientRect();
        return !(
          a.right <= b.left + 1 ||
          a.left >= b.right - 1 ||
          a.bottom <= b.top + 1 ||
          a.top >= b.bottom - 1
        );
      });
    expect(overlap, `row link overlap at ${width} px`).toBe(false);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
      `page overflow at ${width} px`,
    ).toBeLessThanOrEqual(1);
  }
});

test('renders the static form without controls or a lightbox', async ({
  page,
}) => {
  await page.goto(reportUrl(report(staticReport).output));
  const panel = page.locator('#incident');

  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: HEADING })).toBeVisible();
  await expect(panel).toContainText('server.log');
  await expect(page.locator('[data-copy-failure]')).toHaveCount(0);
  await expect(page.locator('[data-copy-log]')).toHaveCount(0);
  await expect(page.locator('#tolkira-lightbox')).toHaveCount(0);
  await expect(page.locator('.shotButton')).toHaveCount(0);
  await expect(page.locator('#scenario-1-1 a[href="#incident"]')).toBeVisible();
  await expect(page.locator('script')).toHaveCount(0);
});

test('keeps the panel in print and in the PDF text', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'page.pdf is Chromium-only');
  await page.setViewportSize({ width: 794, height: 1200 });
  await page.goto(reportUrl(report(main).output));
  await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
  });
  await page.emulateMedia({ media: 'print' });

  await expect(page.locator('#incident')).toBeVisible();
  await expect(page.locator('#incident h2')).toContainText(HEADING);
  await expect(page.locator('#incident')).toContainText(
    'Expected 200 but got 500',
  );
  await expect(page.locator('.toolbar:visible')).toHaveCount(0);
  await expect(page.getByRole('link', { name: ROW_LABEL })).toBeVisible();
  await expect(page.locator('[data-copy-failure]:visible')).toHaveCount(0);
  await expect(page.locator('[data-copy-log]:visible')).toHaveCount(0);

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  const text = readPdf(pdf).text.replaceAll(/\s+/g, '');
  expect(text).toContain('Whathappened');
  expect(text).toContain('Expected200butgot500');
});

test('shows German labels and plurals with verbatim test data', async ({
  page,
}) => {
  await page.goto(reportUrl(report(german).output));
  const panel = page.locator('#incident');

  await expect(
    panel.getByRole('heading', { name: 'Was passiert ist' }),
  ).toBeVisible();
  await expect(panel).toContainText('Lauf fehlgeschlagen');
  await expect(panel).toContainText('erste Zahlung');
  await expect(panel).toContainText('Kein Nachweis angehängt.');
  await expect(panel).toContainText('1 weiterer Zwischenfall in der Liste');
  await expect(page.locator('#scenario-1-1 a[href="#incident"]')).toHaveText(
    'Oben angezeigt',
  );
  await expect(
    panel.getByText('Fehlgeschlagen', { exact: true }).first(),
  ).toBeVisible();

  await page.setViewportSize({ width: 320, height: 700 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  const overlap = await page
    .locator('#scenario-1-1 .scenarioButton')
    .evaluate((button) => {
      const link = button.querySelector<HTMLElement>('.scenarioLink');
      const status = button.querySelector<HTMLElement>('.statusCell');
      if (!link || !status) return false;
      const a = link.getBoundingClientRect();
      const b = status.getBoundingClientRect();
      return !(
        a.right <= b.left + 1 ||
        a.left >= b.right - 1 ||
        a.bottom <= b.top + 1 ||
        a.top >= b.bottom - 1
      );
    });
  expect(overlap, 'German row link overlap at 320 px / 200 %').toBe(false);
});

test('renders dark mode with readable panel text', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(reportUrl(report(main).output));
  const panel = page.locator('#incident');

  await expect(panel).toBeVisible();
  const body = await luminance(page, 'body', 'backgroundColor');
  expect(body, 'dark body').toBeLessThan(0.2);
  expect(
    await panel.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
    'panel background',
  ).not.toBe('rgba(0, 0, 0, 0)');
  const background = await luminance(page, '#incident', 'backgroundColor');
  const text = await luminance(page, '#incident', 'color');
  const lighter = Math.max(background, text);
  const darker = Math.min(background, text);
  expect(
    (lighter + 0.05) / (darker + 0.05),
    'panel text contrast',
  ).toBeGreaterThanOrEqual(4.5);
});

test('wraps the long incident at 320 px and 200 % text without page scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const [file, count] of [
    [longSeven, 7],
    [long, 8],
  ] as const) {
    await page.goto(reportUrl(report(file).output));
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });

    const panel = page.locator('#incident');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.step')).toHaveCount(count);
    await expect(
      panel.getByText('the final check fails').first(),
    ).toBeVisible();
    await expect(panel.locator('.step').last()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
      `${count}-step page overflow`,
    ).toBeLessThanOrEqual(1);
    expect(
      await panel.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      ),
      `${count}-step panel overflow`,
    ).toBeLessThanOrEqual(1);

    const rowLink = page.locator('#scenario-1-1 a[href="#incident"]');
    await rowLink.focus();
    await rowLink.press('Enter');
    await expect(panel).toBeFocused();
  }
});

test('shows the plural at 1 remaining and wraps at 320 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(reportUrl(report(main).output));
  const panel = page.locator('#incident');

  await expect(panel).toContainText('1 more incident in the list');
  await expect(panel).not.toContainText('more incidents in the list');
  const rowLink = page.locator('#scenario-1-1 a[href="#incident"]');
  await expect(rowLink).toBeVisible();
  await expect(rowLink).toHaveText(ROW_LABEL);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test('keeps the German no-evidence line at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(reportUrl(report(german).output));

  await expect(page.locator('#incident')).toContainText(
    'Kein Nachweis angehängt.',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
});
