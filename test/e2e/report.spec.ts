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
    await expect(page.getByText('2 scenarios')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /features\/screenshot\.feature/ }),
    ).toBeVisible();

    await expect(
      page.getByRole('heading', { name: /features\/screenshot\.feature/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Scenario: Attach a screenshot' }),
    ).toBeVisible();
    await expect(page.getByText('screenshot.png')).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Scenario: Failing scenario' }),
    ).toBeVisible();
    await expect(page.getByText('Expected 1 to equal 2')).toBeVisible();

    await page.getByRole('textbox', { name: 'Search' }).fill('Failing');
    await expect(
      page.getByRole('heading', { name: 'Scenario: Attach a screenshot' }),
    ).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'Scenario: Failing scenario' }),
    ).toBeVisible();
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
    await page.getByRole('button', { name: /happy\.feature/ }).click();
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
    await page.getByRole('button', { name: /happy\.feature/ }).click();
    const attachment = page.getByText('attachment-1.html');
    if (await attachment.count()) await attachment.click();

    const executed = await page.evaluate(
      () => (window as unknown as { __tolkiraXss?: number }).__tolkiraXss,
    );
    expect(executed).toBeUndefined();
    expect(dialogOpened).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
