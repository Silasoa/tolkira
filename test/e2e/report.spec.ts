import { expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runCli } from '../../src/cli.js';

const fixture = fileURLToPath(
  new URL('../fixtures/messages/screenshot.ndjson', import.meta.url),
);
const legacyFixture = fileURLToPath(
  new URL('../fixtures/legacy/screenshot.json', import.meta.url),
);
const minimalFixture = fileURLToPath(
  new URL('../fixtures/legacy/minimal.json', import.meta.url),
);
const xssFixture = fileURLToPath(
  new URL('../fixtures/legacy/xss.json', import.meta.url),
);

test('renders a messages report in the browser', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-e2e-'));
  const output = path.join(dir, 'report.html');

  try {
    const code = await runCli(
      [fixture, '--out', output, '--title', 'Tolkira E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
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
    await expect(page.getByText('screenshot.png')).toBeVisible();
    await expect(
      page.locator('img[src^="data:image/png"]').first(),
    ).toBeVisible();
    await expect(page.locator('.scenarioButton .thumb').first()).toBeVisible();

    await page.locator('.shotButton').first().click();
    const lightbox = page.locator('#tolkira-lightbox');
    await expect(lightbox).toBeVisible();
    await expect(lightbox.locator('img')).toHaveAttribute(
      'src',
      /^data:image\/png/,
    );
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();

    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeVisible();
    await expect(page.getByText('Expected 1 to equal 2')).toBeVisible();

    const failedFilter = page.locator('button.filter[data-status="failed"]');
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
    await rm(dir, { recursive: true, force: true });
  }
});

test('filters by status', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-filter-e2e-'));
  const output = path.join(dir, 'filter.html');

  try {
    const code = await runCli(
      [fixture, '--out', output, '--title', 'Tolkira filter'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const failedFilter = page.locator('button.filter[data-status="failed"]');
    await expect(failedFilter).toBeVisible();
    await expect(failedFilter).toHaveAttribute('aria-pressed', 'true');
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
    await rm(dir, { recursive: true, force: true });
  }
});

test('searches by tag', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-tag-e2e-'));
  const output = path.join(dir, 'tag.html');

  try {
    const code = await runCli(
      [fixture, '--out', output, '--title', 'Tolkira tag'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await page.getByRole('searchbox', { name: /Search/ }).fill('@failing');
    await expect(
      page.getByRole('heading', { name: 'Failing scenario' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Attach a screenshot' }),
    ).toBeHidden();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('renders a legacy screenshot in the browser', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-legacy-e2e-'));
  const output = path.join(dir, 'legacy.html');

  try {
    const code = await runCli(
      [legacyFixture, '--out', output, '--title', 'Legacy E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await expect(page).toHaveTitle('Legacy E2E');
    await expect(
      page.getByRole('heading', { name: 'Happy HTML reporting' }),
    ).toBeVisible();
    await expect(page.getByText('attachment-1.png')).toBeVisible();
    await expect(page.getByText('Before hook').first()).toBeVisible();
    await expect(
      page.locator('img[src^="data:image/png"]').first(),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Collapse all' }).click();
    await expect(page.getByText('attachment-1.png')).toBeHidden();
    await page.getByRole('button', { name: 'Expand all' }).click();
    await expect(page.getByText('attachment-1.png')).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('does not execute HTML attachments', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-xss-e2e-'));
  const output = path.join(dir, 'xss.html');
  let dialogOpened = false;
  page.on('dialog', async (dialog) => {
    dialogOpened = true;
    await dialog.dismiss();
  });

  try {
    const code = await runCli(
      [xssFixture, '--out', output, '--title', 'XSS E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    await page.getByRole('button', { name: 'Expand all' }).click();
    const attachment = page.getByText(/attachment-1\.html/).first();
    await expect(attachment).toBeVisible();
    await attachment.click();

    const executed = await page.evaluate(
      () => (window as unknown as { __tolkiraXss?: number }).__tolkiraXss,
    );
    expect(executed).toBeUndefined();
    expect(dialogOpened).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('opens a collapsed feature when searching', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-search-e2e-'));
  const output = path.join(dir, 'search.html');

  try {
    const code = await runCli(
      [fixture, minimalFixture, '--out', output, '--title', 'Search E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.goto(pathToFileURL(output).href);
    const minimal = page.getByRole('heading', { name: 'Minimal scenario' });
    await expect(minimal).toBeHidden();

    await page.getByRole('searchbox', { name: /Search/ }).fill('Minimal scenario');
    await expect(minimal).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('reflows at 200% page zoom', async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-zoom-e2e-'));
  const output = path.join(dir, 'zoom.html');

  try {
    const code = await runCli(
      [fixture, '--out', output, '--title', 'Zoom E2E'],
      { stdout: () => undefined, stderr: () => undefined },
    );
    expect(code).toBe(0);

    await page.setViewportSize({ width: 720, height: 450 });
    await page.goto(pathToFileURL(output).href);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );

    expect(overflow).toBeLessThanOrEqual(1);
    await expect(
      page.getByRole('heading', { name: 'Zoom E2E', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    const textOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );

    expect(textOverflow).toBeLessThanOrEqual(1);
    await expect(
      page.getByRole('heading', { name: 'Zoom E2E', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
