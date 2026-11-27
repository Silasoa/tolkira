import { expect, test } from '@playwright/test';
import {
  legacyFixture,
  messagesFixture,
  playwrightFixture,
} from '../fixtures.js';
import { removeReport, reportUrl, writeReport } from './helpers.js';

const fixture = messagesFixture('screenshot.ndjson');
const legacyScreenshot = legacyFixture('screenshot.json');
const unhappyFixture = legacyFixture('unhappy.json');
const twoFilesFixture = playwrightFixture('two-files.json');

test('renders a messages report in the browser', async ({ page }) => {
  const { dir, output } = await writeReport(
    [fixture],
    'Tolkira E2E',
    'tolkira-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    await expect(page).toHaveTitle('Tolkira E2E');
    await expect(
      page.getByRole('heading', { name: 'Tolkira E2E', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Report' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible();
    await expect(page.getByText('1 feature')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Screenshot attachment' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Attach a screenshot' }),
    ).toBeVisible();
    await expect(
      page.locator('#report-view').getByText('screenshot.png'),
    ).toBeVisible();
    await expect(
      page.locator('img[src^="data:image/png"]').first(),
    ).toBeVisible();
    await expect(page.locator('.scenarioButton .thumb').first()).toBeVisible();

    await page.locator('.shotButton').first().click();
    const lightbox = page.locator('#tolkira-lightbox');
    await expect(lightbox).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.style.overflow),
    ).toBe('hidden');
    await expect(lightbox.locator('img')).toHaveAttribute(
      'src',
      /^data:image\/png/,
    );
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.overflow))
      .toBe('');
    await expect(page.locator('.shotButton').first()).toBeFocused();

    await page.locator('.shotButton').first().click();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(lightbox).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.overflow))
      .toBe('');
    await expect(page.locator('.shotButton').first()).toBeFocused();

    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeVisible();
    await expect(
      page.locator('.error').filter({ hasText: 'Expected 1 to equal 2' }),
    ).toBeVisible();

    const failedFilter = page.locator(
      'button.filter[data-filter-status="failed"]',
    );
    await page.getByRole('heading', { name: 'Failing scenario' }).click();
    await expect(failedFilter).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeVisible();

    await page.getByRole('searchbox', { name: /Search/ }).fill('Failing');
    await expect(
      page.getByRole('heading', { name: 'Attach a screenshot' }),
    ).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Details' }).click();
    await expect(
      page.getByRole('heading', { name: 'Run details', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Details' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Status distribution')).toBeVisible();
    await page.getByRole('tab', { name: 'Report' }).click();
    await expect(
      page.getByRole('heading', { name: 'Tolkira E2E', level: 1 }),
    ).toBeVisible();
  } finally {
    await removeReport(dir);
  }
});

test('renders a Playwright JSON report in the browser', async ({ page }) => {
  const { dir, output } = await writeReport(
    [playwrightFixture('real-run.json')],
    'Playwright E2E',
    'tolkira-playwright-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    await expect(
      page.getByRole('heading', { name: 'alpha', level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'beta', level: 2 }),
    ).toBeVisible();

    const alphaFeature = page.locator('details.feature').filter({
      has: page.getByRole('heading', { name: 'alpha', level: 2 }),
    });
    await expect(alphaFeature).toHaveCount(1);
    await expect(
      alphaFeature.getByRole('heading', { name: 'passes with steps' }),
    ).toBeVisible();
    await expect(
      alphaFeature.getByRole('heading', { name: 'timed out' }),
    ).toBeVisible();
    const smokeTag = alphaFeature.locator('.tag').filter({ hasText: '@smoke' });
    await expect(smokeTag).toHaveCount(1);
    await expect(smokeTag).toBeVisible();
  } finally {
    await removeReport(dir);
  }
});

test('shows the flaky badge and tagged run count at 1440 and 320', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [playwrightFixture('real-run.json')],
    'Playwright flaky E2E',
    'tolkira-flaky-e2e-',
  );

  try {
    const flakyRow = page.locator('[data-scenario]:has(.flakyBadge)');
    const flakyMeta = page.locator('#report-view .meta .flakyMeta');
    const counts = page.locator('#report-view .counts');

    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 700 : 900 });
      await page.goto(reportUrl(output));

      await expect(flakyRow).toHaveCount(1);
      await expect(flakyRow.locator('.flakyBadge')).toHaveText('flaky');
      await expect(flakyRow.locator('.flakyBadge')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
      await expect(flakyRow.locator('.scenarioButton .statusText')).toHaveText(
        'Passed',
      );
      await expect(
        flakyRow.locator('.tag').filter({ hasText: '@flaky' }),
      ).toBeVisible();
      await expect(flakyMeta).toHaveText('1 tagged @flaky');
      await expect(counts.locator('.pass')).toContainText('7 passed');
      await expect(counts).not.toContainText('flaky');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
        `${width}px overflow`,
      ).toBeLessThanOrEqual(1);
    }
  } finally {
    await removeReport(dir);
  }
});

test('renders a legacy screenshot in the browser', async ({ page }) => {
  const { dir, output } = await writeReport(
    [legacyScreenshot],
    'Legacy E2E',
    'tolkira-legacy-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    await expect(page).toHaveTitle('Legacy E2E');
    await expect(
      page.getByRole('heading', { name: 'Happy HTML reporting' }),
    ).toBeVisible();
    await expect(
      page.locator('#report-view').getByText('attachment.png'),
    ).toBeVisible();
    const hookGroup = page.locator('details.hookGroup').first();
    await expect(hookGroup).toBeVisible();
    await hookGroup.locator('summary').click();
    await expect(hookGroup.locator('.hookLabel').first()).toContainText(
      'Before',
    );
    await expect(
      page.locator('img[src^="data:image/png"]').first(),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Collapse all scenarios' }).click();
    await expect(
      page.locator('#report-view').getByText('attachment.png'),
    ).toBeHidden();
    await page.getByRole('button', { name: 'Expand all scenarios' }).click();
    await expect(
      page.locator('#report-view').getByText('attachment.png'),
    ).toBeVisible();
  } finally {
    await removeReport(dir);
  }
});

test('survives a malformed URL hash', async ({ page }) => {
  const { dir, output } = await writeReport(
    [unhappyFixture],
    'Triage E2E',
    'tolkira-e2e-',
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await page.goto(reportUrl(output, '#%E0%A4%A'));
    await expect(page.locator('#report-view')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await removeReport(dir);
  }
});

test('labels a feature from two spec files at every width', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [twoFilesFixture],
    'Two files',
    'tolkira-two-files-e2e-',
  );

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(reportUrl(output));
    const rowSource = page.locator('details.feature .featureUri').first();
    const triageTitle = page
      .getByRole('navigation', { name: 'Needs attention' })
      .locator('a.triageFeature')
      .first();

    await expect(rowSource).toBeVisible();
    await expect(rowSource).toHaveText('2 spec files');
    await expect(triageTitle).toHaveAttribute('title', '2 spec files');
    await expect(rowSource).not.toContainText('sample-a.spec.ts');
    await expect(rowSource).not.toContainText('sample-b.spec.ts');

    await page.getByRole('tab', { name: 'Details' }).click();
    const matrixSource = page.locator('.matrixUri').first();
    await expect(matrixSource).toBeVisible();
    await expect(matrixSource).toHaveText('2 spec files');

    await page.setViewportSize({ width: 1024, height: 900 });
    await page.getByRole('tab', { name: 'Report' }).click();
    await expect(rowSource).toBeVisible();

    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await page.getByRole('tab', { name: 'Report' }).click();
      await expect(rowSource).toBeHidden();
      await page.getByRole('tab', { name: 'Details' }).click();
      await expect(matrixSource).toBeVisible();
      await expect(matrixSource).toHaveText('2 spec files');
    }
  } finally {
    await removeReport(dir);
  }
});
