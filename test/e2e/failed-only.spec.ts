import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli.js';
import { legacyFixture, messagesFixture } from '../fixtures.js';

const emptyStatusesFixture = messagesFixture('empty-statuses.ndjson');
const allStatusesFixture = messagesFixture('all-statuses.ndjson');
const runRatioFixture = messagesFixture('run-ratio.ndjson');
const tagExpressionsFixture = legacyFixture('tag-expressions.json');

async function writeReport(
  inputs: string[],
  title: string,
  prefix: string,
): Promise<{ dir: string; output: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  const output = path.join(dir, 'report.html');
  const code = await runCli(
    [...inputs, '--out', output, '--title', title],
    { stdout: () => undefined, stderr: () => undefined },
  );
  expect(code).toBe(0);
  return { dir, output };
}

function reportUrl(output: string, search = ''): string {
  return `${pathToFileURL(output).href}${search}`;
}

function preset(page: Page) {
  return page.locator('button[data-filter-preset="failed"]');
}

function statusChip(page: Page, status: string) {
  return page.locator(`button.filter[data-filter-status="${status}"]`);
}

function heading(page: Page, name: string) {
  return page.getByRole('heading', { name });
}

async function hiddenStatuses(page: Page): Promise<string[]> {
  return page.evaluate(() => new URL(location.href).searchParams.getAll('hide'));
}

test('activates and deactivates the failed-only preset', async ({ page }) => {
  const { dir, output } = await writeReport(
    [emptyStatusesFixture],
    'Failed only preset',
    'tolkira-failed-only-',
  );

  try {
    await page.goto(reportUrl(output));

    await expect(preset(page)).toBeVisible();
    await expect(preset(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(heading(page, 'Passed scenario')).toBeVisible();
    await expect(heading(page, 'Failed scenario')).toBeVisible();
    await expect(heading(page, 'Blank unexecuted scenario')).toBeVisible();
    await expect(page.locator('#report-view .runHead .meta')).toContainText(
      '2 scenarios with results',
    );
    await expect(page.locator('#report-view .runHead .meta')).toContainText(
      '1 unexecuted',
    );

    await preset(page).click();

    await expect(preset(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#report-view .runHead .meta')).toContainText(
      '2 scenarios with results',
    );
    await expect(page.locator('#report-view .runHead .meta')).toContainText(
      '1 unexecuted',
    );
    await expect(heading(page, 'Failed scenario')).toBeVisible();
    await expect(heading(page, 'Passed scenario')).toBeHidden();
    await expect(heading(page, 'Blank unexecuted scenario')).toBeHidden();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 3 scenarios visible',
    );
    await expect(statusChip(page, 'failed')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(statusChip(page, 'passed')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect
      .poll(async () => (await hiddenStatuses(page)).sort())
      .toEqual(['passed', 'unexecuted']);
    await expect(page.locator('[data-triage]')).toBeHidden();

    await preset(page).click();

    await expect(preset(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(heading(page, 'Passed scenario')).toBeVisible();
    await expect(heading(page, 'Failed scenario')).toBeVisible();
    await expect(heading(page, 'Blank unexecuted scenario')).toBeVisible();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '3 of 3 scenarios visible',
    );
    await expect(statusChip(page, 'passed')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(statusChip(page, 'failed')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect.poll(() => hiddenStatuses(page)).toEqual([]);
    await expect(page.locator('[data-triage]')).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a manual chip change clears the unexecuted sentinel', async ({ page }) => {
  const { dir, output } = await writeReport(
    [emptyStatusesFixture],
    'Manual chip after preset',
    'tolkira-failed-only-manual-',
  );

  try {
    await page.goto(reportUrl(output));
    await preset(page).click();
    await statusChip(page, 'passed').click();

    await expect(statusChip(page, 'passed')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(preset(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(heading(page, 'Passed scenario')).toBeVisible();
    await expect(heading(page, 'Failed scenario')).toBeVisible();
    await expect(heading(page, 'Blank unexecuted scenario')).toBeVisible();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '3 of 3 scenarios visible',
    );
    await expect
      .poll(async () => (await hiddenStatuses(page)).includes('unexecuted'))
      .toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a partial chip state does not press the preset', async ({ page }) => {
  const { dir, output } = await writeReport(
    [emptyStatusesFixture],
    'Partial chip state',
    'tolkira-failed-only-partial-',
  );

  try {
    await page.goto(reportUrl(output));
    await statusChip(page, 'passed').click();

    await expect(preset(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(heading(page, 'Passed scenario')).toBeHidden();
    await expect(heading(page, 'Failed scenario')).toBeVisible();
    await expect(heading(page, 'Blank unexecuted scenario')).toBeVisible();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '2 of 3 scenarios visible',
    );
    await expect
      .poll(async () => (await hiddenStatuses(page)).sort())
      .toEqual(['passed']);

    await preset(page).click();

    await expect(preset(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(heading(page, 'Blank unexecuted scenario')).toBeHidden();

    await preset(page).click();

    await expect(preset(page)).toHaveAttribute('aria-pressed', 'false');
    const chips = page.locator('button.filter[data-filter-status]');
    const chipCount = await chips.count();
    for (let index = 0; index < chipCount; index += 1) {
      await expect(chips.nth(index)).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(heading(page, 'Blank unexecuted scenario')).toBeVisible();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '3 of 3 scenarios visible',
    );
    await expect.poll(() => hiddenStatuses(page)).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('restores the preset from the URL and prunes a lone sentinel', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [emptyStatusesFixture],
    'Preset reload',
    'tolkira-failed-only-reload-',
  );

  try {
    await page.goto(reportUrl(output, '?hide=passed&hide=unexecuted'));

    await expect(preset(page)).toBeVisible();
    await expect(preset(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(heading(page, 'Failed scenario')).toBeVisible();
    await expect(heading(page, 'Passed scenario')).toBeHidden();
    await expect(heading(page, 'Blank unexecuted scenario')).toBeHidden();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 3 scenarios visible',
    );
    await expect(statusChip(page, 'failed')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(statusChip(page, 'passed')).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await page.goto(reportUrl(output, '?hide=unexecuted'));

    await expect(page).not.toHaveURL(/unexecuted/);
    await expect(preset(page)).toBeVisible();
    await expect(preset(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(heading(page, 'Passed scenario')).toBeVisible();
    await expect(heading(page, 'Failed scenario')).toBeVisible();
    await expect(heading(page, 'Blank unexecuted scenario')).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('combines the preset with search and keeps blank rows hidden', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [emptyStatusesFixture],
    'Preset search',
    'tolkira-failed-only-search-',
  );

  try {
    await page.goto(reportUrl(output));
    await preset(page).click();
    const search = page.locator('input[data-search]');

    await search.fill('Blank unexecuted');
    await expect(heading(page, 'Blank unexecuted scenario')).toBeHidden();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '0 of 3 scenarios visible',
    );
    await expect(page.locator('#empty-results')).toBeVisible();
    await expect(page.locator('#empty-results')).toHaveText(
      'No failed scenarios match the current search or filters. Unexecuted rows are hidden by Failed only.',
    );

    await search.fill('Failed scenario');
    await expect(heading(page, 'Failed scenario')).toBeVisible();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 3 scenarios visible',
    );
    await expect(page.locator('#empty-results')).toBeHidden();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('combines the preset with a tag on failed rows', async ({ page }) => {
  const { dir, output } = await writeReport(
    [tagExpressionsFixture],
    'Preset tag',
    'tolkira-failed-only-tag-',
  );

  try {
    await page.goto(reportUrl(output));
    await preset(page).click();

    await expect(heading(page, 'beta two')).toBeVisible();
    await expect(heading(page, 'delta four')).toBeVisible();
    await expect(heading(page, 'alpha one')).toBeHidden();
    await expect(heading(page, 'gamma three')).toBeHidden();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '2 of 4 scenarios visible',
    );

    await page.locator('select[data-tag-filter]').selectOption('@b');

    await expect(preset(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(heading(page, 'beta two')).toBeVisible();
    await expect(heading(page, 'delta four')).toBeHidden();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 4 scenarios visible',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('hides and restores the source strip with the preset', async ({ page }) => {
  const { dir, output } = await writeReport(
    [allStatusesFixture, runRatioFixture],
    'Preset sources',
    'tolkira-failed-only-sources-',
  );

  try {
    await page.goto(reportUrl(output));
    const sources = page.locator('[data-sources]');

    await expect(sources).toBeVisible();
    await preset(page).click();
    await expect(sources).toBeHidden();

    await preset(page).click();
    await expect(sources).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('toggles the preset with the keyboard', async ({ page }) => {
  const { dir, output } = await writeReport(
    [emptyStatusesFixture],
    'Preset keyboard',
    'tolkira-failed-only-keyboard-',
  );

  try {
    await page.goto(reportUrl(output));
    await preset(page).focus();
    await expect(preset(page)).toBeFocused();

    await page.keyboard.press('Space');

    await expect(preset(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 3 scenarios visible',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('offers the preset for a derived failed and unexecuted run', async ({
  page,
}) => {
  const dir = await mkdtemp(
    path.join(tmpdir(), 'tolkira-failed-only-derived-'),
  );

  try {
    const lines = (await readFile(emptyStatusesFixture, 'utf8'))
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .filter((line) => {
        const envelope = JSON.parse(line) as {
          pickle?: { name?: string };
        };
        return envelope.pickle?.name !== 'Passed scenario';
      });
    const input = path.join(dir, 'failed-and-unexecuted.ndjson');
    await writeFile(input, lines.join('\n'));
    const output = path.join(dir, 'report.html');
    const code = await runCli(
      [input, '--out', output, '--title', 'Derived failed and unexecuted'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(reportUrl(output));

    await expect(statusChip(page, 'passed')).toHaveCount(0);
    await expect(preset(page)).toBeVisible();
    await expect(heading(page, 'Failed scenario')).toBeVisible();
    await expect(heading(page, 'Blank unexecuted scenario')).toBeVisible();

    await preset(page).click();

    await expect(heading(page, 'Failed scenario')).toBeVisible();
    await expect(heading(page, 'Blank unexecuted scenario')).toBeHidden();
    await expect(page.locator('#tolkira-live')).toHaveText(
      '1 of 2 scenarios visible',
    );

    await preset(page).click();

    await expect(preset(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(heading(page, 'Blank unexecuted scenario')).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('keeps the preset inert without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const { dir, output } = await writeReport(
    [emptyStatusesFixture],
    'Preset no JS',
    'tolkira-failed-only-no-js-',
  );

  try {
    await page.goto(reportUrl(output));

    await expect(preset(page)).toBeVisible();
    await expect(preset(page)).toHaveAttribute('aria-pressed', 'false');
    await preset(page).click();
    await expect(preset(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('details.scenario[hidden]')).toHaveCount(0);
    await expect(heading(page, 'Passed scenario')).toBeVisible();
    await expect(heading(page, 'Failed scenario')).toBeVisible();
    await expect(heading(page, 'Blank unexecuted scenario')).toBeVisible();
    await expect(page.locator('#tolkira-live')).toHaveText('');
  } finally {
    await context.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('fits the preset without horizontal overflow across viewports', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [emptyStatusesFixture],
    'Preset viewports',
    'tolkira-failed-only-viewports-',
  );

  try {
    await page.goto(reportUrl(output));
    await preset(page).click();

    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(preset(page)).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(1);
    }

    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    const zoomedOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(zoomedOverflow, 'overflow at 320px with 200% text').toBeLessThanOrEqual(
      1,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
