import { expect, test } from '@playwright/test';
import { messagesFixture } from '../fixtures.js';
import { removeReport, reportUrl, writeReport } from './helpers.js';

const emptyFixture = messagesFixture('empty.ndjson');
const emptyMixedFixture = messagesFixture('empty-mixed.ndjson');
const emptyStatusesFixture = messagesFixture('empty-statuses.ndjson');
const runRatioFixture = messagesFixture('run-ratio.ndjson');
const emptyNoneFixture = messagesFixture('empty-none.ndjson');

test('renders an empty run without outcomes or triage', async ({ page }) => {
  const { dir, output } = await writeReport(
    [emptyFixture],
    'Empty run',
    'tolkira-empty-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    await expect(
      page.getByRole('heading', { name: 'Empty Scenarios' }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('tabpanel', { name: 'Report' })
        .getByText('0 / 0', { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('tabpanel', { name: 'Report' })
        .locator('.healthTop')
        .getByText('0 of 0 passed'),
    ).toHaveCount(0);
    await expect(
      page.getByRole('tabpanel', { name: 'Report' }).locator('.healthTop .sr'),
    ).toHaveText('0 / 0 passed');
    await expect(
      page
        .getByRole('tabpanel', { name: 'Report' })
        .locator('.runHead .meta'),
    ).toContainText('0 scenarios with results');
    await expect(page.locator('details.feature')).toHaveAttribute('open', '');
    await expect(
      page.getByRole('navigation', { name: 'Needs attention' }),
    ).toHaveCount(0);
    await expect(page.locator('button.filter')).toHaveCount(0);

    const row = page.locator('[data-scenario-name="Blank Scenario"]');
    await expect(row).toBeVisible();
    expect(await row.getAttribute('data-status')).toBeNull();
    await expect(row).not.toHaveAttribute('open', '');
    await expect(row.locator('.statusText')).toHaveCount(0);
    await expect(row.locator('.statusCell .sr')).toHaveText('Not executed');
    await expect(row).not.toContainText('Unknown');
  } finally {
    await removeReport(dir);
  }
});

test('keeps a blank row searchable in a mixed run', async ({ page }) => {
  const { dir, output } = await writeReport(
    [emptyMixedFixture],
    'Mixed run',
    'tolkira-empty-mixed-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    await expect(
      page
        .getByRole('tabpanel', { name: 'Report' })
        .getByText('1 / 1 attempted', { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('tabpanel', { name: 'Report' })
        .locator('.runHead .meta'),
    ).toContainText('1 scenario with results');
    await expect(
      page
        .getByRole('tabpanel', { name: 'Report' })
        .locator('.runHead .meta'),
    ).toContainText('1 unexecuted');
    const feature = page.locator('details.feature');
    await expect(feature).not.toHaveAttribute('open', '');
    await expect(
      page.getByRole('navigation', { name: 'Needs attention' }),
    ).toHaveCount(0);

    const blank = page.locator('[data-scenario-name="Blank started scenario"]');
    const passed = page.locator('[data-scenario-name="Passed scenario"]');
    await expect(blank).toBeHidden();
    await expect(passed).toBeHidden();
    await page.locator('details.feature > summary').click();
    await expect(blank).toBeVisible();
    await expect(blank).not.toHaveAttribute('open', '');
    expect(await blank.getAttribute('data-status')).toBeNull();
    await expect(blank.locator('.statusText')).toHaveCount(0);
    await expect(blank.locator('.statusCell .sr')).toHaveText('Not executed');

    const search = page.getByRole('searchbox', { name: /Search/ });
    await search.fill('Blank started');
    await expect(blank).toBeVisible();
    await expect(blank).toHaveAttribute('open', '');
    await expect(passed).toBeHidden();
    await expect(blank.locator('.statusText')).toHaveCount(0);

    await search.fill('Passed scenario');
    await expect(blank).toBeHidden();
    await expect(passed).toBeVisible();
  } finally {
    await removeReport(dir);
  }
});

test('counts only executed scenarios in a mixed-status run', async ({ page }) => {
  const { dir, output } = await writeReport(
    [emptyStatusesFixture],
    'Mixed statuses',
    'tolkira-empty-statuses-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const report = page.getByRole('tabpanel', { name: 'Report' });
    await expect(
      report.getByText('1 / 2 attempted', { exact: true }),
    ).toBeVisible();
    await expect(report.getByText('50%', { exact: true })).toBeVisible();
    await expect(report.locator('.runHead .meta')).toContainText(
      '2 scenarios with results',
    );
    await expect(report.locator('.runHead .meta')).toContainText(
      '1 unexecuted',
    );
    await expect(
      page.getByText('1 passed of 2 attempted · 1 failed'),
    ).toBeVisible();
    await expect(page.locator('button.filter[data-filter-status="unknown"]')).toHaveCount(
      0,
    );

    const triage = page.getByRole('navigation', { name: 'Needs attention' });
    await expect(triage).toBeVisible();
    await expect(triage).toContainText('1 of 2 scenarios need attention.');
    await expect(triage).toContainText('Failed scenario');
    await expect(triage).not.toContainText('Blank unexecuted scenario');

    const blank = page.locator(
      '[data-scenario-name="Blank unexecuted scenario"]',
    );
    await expect(blank).toBeVisible();
    await expect(blank.locator('.statusText')).toHaveCount(0);
    await expect(blank.locator('.statusCell .sr')).toHaveText('Not executed');
  } finally {
    await removeReport(dir);
  }
});

test('computes the attempted scenario ratio for a run with a skip', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [runRatioFixture],
    'Run ratio',
    'tolkira-run-ratio-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const report = page.getByRole('tabpanel', { name: 'Report' });
    const health = report.locator('.healthTop');

    await expect(health.locator('strong')).toHaveText('50%');
    await expect(health).toContainText('1 / 2 attempted');
    await expect(health.locator('.sr')).toHaveText(
      '1 of 2 attempted scenarios passed',
    );
    await expect(report.locator('.runHead .meta')).toContainText(
      '3 scenarios with results',
    );
    await expect(report.locator('.runHead .meta')).not.toContainText(
      'executed scenario',
    );
    await expect(report.locator('.featureCounts')).toHaveText(
      '1 passed of 2 attempted · 1 failed, 1 skipped',
    );
    await expect(report.locator('.counts')).toContainText('1 skipped');
    await expect(report.locator('.health .bar i.skipped')).toHaveCount(1);

    await page.getByRole('tab', { name: 'Details' }).click();
    const details = page.locator('#analysis-view');
    await expect(details.locator('.healthTop strong')).toHaveText('50%');
    await expect(details.locator('.healthTop')).toContainText('1 / 2 attempted');
    await expect(details).toContainText(
      'Pass rate counts attempted (non-skipped) scenarios; counts and bars include skipped.',
    );

    await page.getByRole('tab', { name: 'Report' }).click();
    await page.setViewportSize({ width: 320, height: 700 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    await expect(health).toBeVisible();
    await expect(health).toContainText('1 / 2 attempted');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  } finally {
    await removeReport(dir);
  }
});

test('renders the empty state when there are no scenarios', async ({ page }) => {
  const { dir, output } = await writeReport(
    [emptyNoneFixture],
    'No scenarios',
    'tolkira-empty-none-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    await expect(
      page
        .getByRole('tabpanel', { name: 'Report' })
        .getByText('0 / 0', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('No scenarios in this report.')).toBeVisible();
    await expect(
      page
        .getByRole('tabpanel', { name: 'Report' })
        .locator('.runHead .meta'),
    ).toContainText('0 scenarios with results');
    await expect(page.locator('details.feature')).toHaveCount(0);
    await expect(
      page.getByRole('navigation', { name: 'Needs attention' }),
    ).toHaveCount(0);
  } finally {
    await removeReport(dir);
  }
});
