import { expect, test } from '@playwright/test';
import { legacyFixture, messagesFixture } from '../fixtures.js';
import { removeReport, reportUrl, writeInput, writeReport } from './helpers.js';

const fixture = messagesFixture('screenshot.ndjson');
const tableFixture = legacyFixture('happy.json');
const minimalFixture = legacyFixture('minimal.json');

test('filters by status', async ({ page }) => {
  const { dir, output } = await writeReport(
    [fixture],
    'Tolkira filter',
    'tolkira-filter-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const failedFilter = page.locator(
      'button.filter[data-filter-status="failed"]',
    );
    await expect(failedFilter).toBeVisible();
    await expect(failedFilter).toHaveAttribute('aria-pressed', 'true');
    const pressedColour = await failedFilter.evaluate((element) => {
      const style = getComputedStyle(element);
      const probe = document.createElement('div');
      probe.style.color = style.getPropertyValue('--fail').trim();
      document.body.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return { actual: style.color, expected };
    });
    expect(pressedColour.actual).toBe(pressedColour.expected);
    await failedFilter.focus();
    await page.keyboard.press('Space');
    await expect(failedFilter).toHaveAttribute('aria-pressed', 'false');
    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'Attach a screenshot' }),
    ).toBeVisible();
    await expect(page.getByRole('status')).toContainText(
      '1 of 2 scenarios visible',
    );

    await page.setViewportSize({ width: 375, height: 800 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  } finally {
    await removeReport(dir);
  }
});

test('filters by tag', async ({ page }) => {
  const { dir, output } = await writeReport(
    [tableFixture],
    'Tolkira tag filter',
    'tolkira-tag-filter-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const tagFilter = page.locator('select[data-tag-filter]');
    await expect(tagFilter).toBeVisible();
    await expect(tagFilter.locator('option')).toHaveCount(6);

    await tagFilter.selectOption('@testScenarioOutline');
    await expect(page.locator('details.scenario:visible')).toHaveCount(2);
    await expect(page.getByRole('status')).toContainText(
      '2 of 6 scenarios visible',
    );
    const feature = page
      .locator('details.feature')
      .filter({ hasText: 'Happy HTML reporting' });
    await expect(feature).toHaveAttribute('open', '');
    await expect(page.locator('details.scenario:visible[open]')).toHaveCount(0);

    await tagFilter.selectOption('');
    await expect(page.locator('details.scenario:visible')).toHaveCount(6);
    await expect(page.getByRole('status')).toContainText(
      '6 of 6 scenarios visible',
    );
  } finally {
    await removeReport(dir);
  }
});

test('highlights search matches when the browser supports the Highlight API', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [fixture],
    'Tolkira highlight',
    'tolkira-highlight-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const search = page.getByRole('searchbox', { name: /Search/ });
    const supportsHighlight = await page.evaluate(() => {
      const css = (globalThis as unknown as { CSS?: { highlights?: unknown } })
        .CSS;
      const HighlightCtor = (globalThis as unknown as { Highlight?: unknown })
        .Highlight;
      return Boolean(css?.highlights) && typeof HighlightCtor === 'function';
    });

    await search.fill('Failing');
    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeVisible();
    if (!supportsHighlight) return;

    const rangeCount = await page.evaluate(() => {
      const css = (
        globalThis as unknown as {
          CSS?: { highlights?: Map<string, Set<Range>> };
        }
      ).CSS;
      return css?.highlights?.get('tolkira-search')?.size ?? 0;
    });
    expect(rangeCount).toBeGreaterThan(0);

    const rangeText = await page.evaluate(() => {
      const css = (
        globalThis as unknown as {
          CSS?: { highlights?: Map<string, Set<Range>> };
        }
      ).CSS;
      const highlight = css?.highlights?.get('tolkira-search');
      return highlight
        ? Array.from(highlight).map((range) => range.toString())
        : [];
    });
    expect(rangeText).toContain('Failing');

    await search.fill('F');
    const hasHighlight = await page.evaluate(() => {
      const css = (
        globalThis as unknown as {
          CSS?: { highlights?: Map<string, Set<Range>> };
        }
      ).CSS;
      return Boolean(css?.highlights?.has('tolkira-search'));
    });
    expect(hasHighlight).toBe(false);
  } finally {
    await removeReport(dir);
  }
});

test('searches by tag', async ({ page }) => {
  const { dir, output } = await writeReport(
    [fixture],
    'Tolkira tag',
    'tolkira-tag-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    await page.getByRole('searchbox', { name: /Search/ }).fill('@failing');
    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Attach a screenshot' }),
    ).toBeHidden();
  } finally {
    await removeReport(dir);
  }
});

test('opens a collapsed feature when searching', async ({ page }) => {
  const { dir, output } = await writeReport(
    [fixture, minimalFixture],
    'Search E2E',
    'tolkira-search-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const minimal = page.getByRole('heading', { name: 'Minimal scenario' });
    await expect(minimal).toBeHidden();

    await page
      .getByRole('searchbox', { name: /Search/ })
      .fill('Minimal scenario');
    await expect(minimal).toBeVisible();
    await expect(
      page.locator('details.scenario').filter({ hasText: 'Minimal scenario' }),
    ).toHaveAttribute('open', '');
  } finally {
    await removeReport(dir);
  }
});

test('caps search auto-open at 20 scenarios', async ({ page }) => {
  const elements = Array.from({ length: 30 }, (_, index) => ({
    keyword: 'Scenario',
    type: 'scenario',
    name: `Scenario ${index + 1}`,
    steps: [
      {
        keyword: 'Given ',
        name: 'a step',
        result: { status: 'passed', duration: 1 },
      },
    ],
  }));
  const input = await writeInput(
    'many.json',
    JSON.stringify([{ name: 'Many scenarios', elements }]),
    'tolkira-search-cap-input-',
  );
  const { dir, output } = await writeReport(
    [input.file],
    '',
    'tolkira-search-cap-',
  );

  try {
    await page.goto(reportUrl(output));
    const search = page.getByRole('searchbox', { name: 'Search scenarios' });
    await search.fill('Scenario');
    await expect(page.locator('[data-scenario][open]')).toHaveCount(20);
    await expect(page.locator('#tolkira-search-note')).toContainText(
      '20 of 30 matches expanded',
    );
    await search.fill('');
    await expect(page.locator('[data-scenario][open]')).toHaveCount(0);
    await expect(page.locator('#tolkira-search-note')).toBeHidden();
  } finally {
    await removeReport(dir);
    await removeReport(input.dir);
  }
});

test('caps search auto-open at 20 newly opened rows', async ({ page }) => {
  const elements = Array.from({ length: 30 }, (_, index) => ({
    keyword: 'Scenario',
    type: 'scenario',
    name: `Scenario ${index + 1}`,
    steps: [
      {
        keyword: 'Given ',
        name: 'a step',
        result: {
          status: index < 5 ? 'failed' : 'passed',
          duration: 1,
        },
      },
    ],
  }));
  const input = await writeInput(
    'mixed.json',
    JSON.stringify([{ name: 'Mixed scenarios', elements }]),
    'tolkira-search-cap-new-input-',
  );
  const { dir, output } = await writeReport(
    [input.file],
    '',
    'tolkira-search-cap-new-',
  );

  try {
    await page.goto(reportUrl(output));
    await expect(page.locator('[data-scenario][open]')).toHaveCount(5);
    await page
      .getByRole('searchbox', { name: 'Search scenarios' })
      .fill('Scenario');
    await expect(page.locator('[data-scenario][open]')).toHaveCount(25);
    await expect(page.locator('[data-scenario]:not([open])')).toHaveCount(5);
    await expect(page.locator('#tolkira-search-note')).toHaveText(
      '20 of 30 matches expanded. Use Expand all to open the rest.',
    );
    await page.getByRole('searchbox', { name: 'Search scenarios' }).fill('');
    await expect(page.locator('[data-scenario][open]')).toHaveCount(5);
  } finally {
    await removeReport(dir);
    await removeReport(input.dir);
  }
});
