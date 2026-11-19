import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { messagesFixture } from '../fixtures.js';
import {
  readClipboard,
  removeReport,
  reportUrl,
  stubClipboard,
  writeInput,
  writeReport,
} from './helpers.js';

const hooksFixture = messagesFixture('hooks.ndjson');
const globalHooksFixture = messagesFixture('global-hooks.ndjson');
const globalHookAttachments = messagesFixture('global-hooks-attachments.ndjson');

test('shows per-scenario hooks separately and opens passed hooks', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [hooksFixture],
    'Hooks',
    'tolkira-hooks-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const group = page.locator('details.hookGroup').first();
    await expect(group).toBeVisible();
    await expect(group.locator('summary')).toContainText('hook');
    await group.locator('summary').click();
    await expect(group.locator('.hook').first()).toBeVisible();
    await expect(page.locator('.scenarioSub').first()).toContainText('hook');
    await expect(page.locator('[data-run-hooks]')).toHaveCount(0);
  } finally {
    await removeReport(dir);
  }
});

test('shows test-run hooks below the features', async ({ page }) => {
  const { dir, output } = await writeReport(
    [globalHooksFixture],
    'Run hooks',
    'tolkira-run-hooks-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const section = page.locator('[data-run-hooks]');
    await expect(section).toBeVisible();
    await expect(section).toContainText('BeforeAll');
    await expect(section).toContainText('AfterAll');
  } finally {
    await removeReport(dir);
  }
});

test('shows a failed run-hook error', async ({ page }) => {
  const lines = (await readFile(globalHooksFixture, 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, any>);
  const finished = lines.find((line) => line.testRunHookFinished)
    ?.testRunHookFinished;
  expect(finished).toBeTruthy();
  if (!finished) return;
  finished.result.status = 'FAILED';
  finished.result.message = 'run hook boom';
  const input = await writeInput(
    'failed-run-hook.ndjson',
    `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    'tolkira-run-hook-fail-input-',
  );
  const { dir, output } = await writeReport(
    [input.file],
    'Failed run hook',
    'tolkira-run-hook-fail-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    await expect(page.locator('[data-run-hooks]')).toContainText('run hook boom');
    await expect(
      page.locator('[data-run-hooks] .hook[data-status="failed"]'),
    ).toBeVisible();
  } finally {
    await removeReport(dir);
    await removeReport(input.dir);
  }
});

test('shows run-hook attachments in the Hooks section', async ({ page }) => {
  const { dir, output } = await writeReport(
    [globalHookAttachments],
    'Run hook attachments',
    'tolkira-run-hook-attach-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    await expect(page.locator('[data-run-hooks]')).toContainText(
      'Attachment from BeforeAll hook',
    );
    await expect(page.locator('[data-run-hooks]')).toContainText(
      'Attachment from AfterAll hook',
    );
  } finally {
    await removeReport(dir);
  }
});

test('searching a hook name opens its hook group', async ({ page }) => {
  const lines = (await readFile(hooksFixture, 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, any>);
  const hook = lines.find((line) => line.hook)?.hook;
  expect(hook).toBeTruthy();
  hook.name = 'seed database';
  const input = await writeInput(
    'named-hooks.ndjson',
    `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    'tolkira-hook-search-input-',
  );
  const { dir, output } = await writeReport(
    [input.file],
    'Hook search',
    'tolkira-hook-search-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    await page.getByRole('searchbox', { name: /Search/ }).fill('seed database');
    const group = page.locator('details.hookGroup[open]').first();
    await expect(group).toBeVisible();
    await expect(group.locator('.hookLabel').first()).toContainText(
      'Before: seed database',
    );
  } finally {
    await removeReport(dir);
    await removeReport(input.dir);
  }
});

test('shows a failed hook inline', async ({ page }) => {
  await stubClipboard(page);
  const lines = (await readFile(hooksFixture, 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, any>);
  const hookStepIds = new Set<string>(
    lines.flatMap((line) =>
      (line.testCase?.testSteps ?? [])
        .filter((step: { hookId?: string }) => step.hookId)
        .map((step: { id: string }) => step.id),
    ),
  );
  for (const line of lines) {
    if (
      line.testStepFinished &&
      hookStepIds.has(line.testStepFinished.testStepId)
    ) {
      line.testStepFinished.testStepResult.status = 'FAILED';
      line.testStepFinished.testStepResult.message = 'hook boom';
    }
  }
  const input = await writeInput(
    'failed-hook.ndjson',
    `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    'tolkira-hook-fail-input-',
  );
  const { dir, output } = await writeReport(
    [input.file],
    'Hook failure',
    'tolkira-hook-fail-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const failed = page.locator('.hook[data-status="failed"]').first();
    await expect(failed).toBeVisible();
    await expect(failed).toContainText('hook boom');
    const copy = page.locator('[data-copy-failure]').first();
    await expect(copy).toBeVisible();
    await copy.click();
    const copied = await readClipboard(page);
    expect(copied).toContain('Hook: Before');
    expect(copied).toContain('hook boom');
  } finally {
    await removeReport(dir);
    await removeReport(input.dir);
  }
});
