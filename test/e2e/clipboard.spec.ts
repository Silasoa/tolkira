import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { ESC, HOSTILE_ANSI, VISIBLE_ANSI } from '../ansi-payload.js';
import { legacyFixture, messagesFixture } from '../fixtures.js';
import {
  readClipboard,
  removeReport,
  reportUrl,
  stubClipboard,
  stubClipboardFailure,
  writeInput,
  writeReport,
} from './helpers.js';

const fixture = messagesFixture('screenshot.ndjson');
const parametersFixture = messagesFixture('parameters.ndjson');
const noMessageFixture = legacyFixture('failed-no-message.json');
const examplesFixture = messagesFixture('examples-tables.ndjson');

test('copies failure details', async ({ page }) => {
  await stubClipboard(page);
  const { dir, output } = await writeReport(
    [fixture],
    'Tolkira copy',
    'tolkira-copy-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const failed = page.locator(
      'details[data-scenario][data-status="failed"]',
    );
    const copy = failed.locator('[data-copy-failure]');
    await expect(copy).toBeVisible();
    await copy.click();
    await expect(copy).toHaveText('Copied');
    await expect(page.locator('#tolkira-copy-live')).toHaveText(
      'Failure details copied to clipboard.',
    );

    const copied = await readClipboard(page);
    expect(copied).toContain('Feature: Screenshot attachment');
    expect(copied).toContain('Scenario: Failing scenario');
    expect(copied).toContain('URI: features/screenshot.feature');
    expect(copied).toContain('Step: Then the assertion fails');
    expect(copied).toContain('Error:\nExpected 1 to equal 2');
  } finally {
    await removeReport(dir);
  }
});

test('copies parameterised failure details with the matched argument', async ({
  page,
}) => {
  await stubClipboard(page);
  const lines = (await readFile(parametersFixture, 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, any>);
  const pickle = lines.find((line) => line.pickle?.name === 'Numbers')?.pickle;
  const testCase = lines.find(
    (line) => line.testCase?.pickleId === pickle?.id,
  )?.testCase;
  const stepIds = new Set<string>(
    (testCase?.testSteps ?? []).map((step: { id: string }) => step.id),
  );
  for (const line of lines) {
    if (
      line.testStepFinished &&
      stepIds.has(line.testStepFinished.testStepId)
    ) {
      line.testStepFinished.testStepResult.status = 'FAILED';
      line.testStepFinished.testStepResult.message = 'Expected 12 cucumbers';
    }
  }
  const input = await writeInput(
    'parameters.ndjson',
    `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    'tolkira-copy-param-input-',
  );
  const { dir, output } = await writeReport(
    [input.file],
    'Parameter copy',
    'tolkira-copy-param-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const failed = page.locator(
      'details[data-scenario][data-status="failed"]',
    );
    await expect(failed.locator('.param')).toHaveText('12');
    const copy = failed.locator('[data-copy-failure]');
    await expect(copy).toBeVisible();
    await copy.click();
    await expect(copy).toHaveText('Copied');

    const copied = await readClipboard(page);
    expect(copied).toContain('Step: Given I have 12 cucumbers');
    expect(copied).toContain('Expected 12 cucumbers');
  } finally {
    await removeReport(dir);
    await removeReport(input.dir);
  }
});

test('copies failure details without terminal escape sequences', async ({
  page,
}) => {
  await stubClipboard(page);
  const lines = (await readFile(fixture, 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, any>);
  const failed = lines.find(
    (line) => line.testStepFinished?.testStepResult?.status === 'FAILED',
  );
  if (!failed) throw new Error('fixture has no failed test step');
  failed.testStepFinished.testStepResult.message = HOSTILE_ANSI;
  failed.testStepFinished.testStepResult.exception = {
    type: 'Error',
    message: HOSTILE_ANSI,
  };
  const input = await writeInput(
    'ansi.ndjson',
    `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    'tolkira-copy-ansi-input-',
  );
  const { dir, output } = await writeReport(
    [input.file],
    'ANSI copy',
    'tolkira-copy-ansi-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const copy = page.locator(
      'details[data-scenario][data-status="failed"] [data-copy-failure]',
    );
    await expect(copy).toBeVisible();
    await copy.click();
    await expect(copy).toHaveText('Copied');

    const copied = await readClipboard(page);
    expect(copied).toContain(VISIBLE_ANSI);
    expect(copied).not.toContain(ESC);
    expect(copied).not.toContain(']52;');
    expect(copied).not.toContain(']8;;');
    expect(copied).not.toContain('dcs payload');
    expect(copied).not.toContain('apc payload');
    expect(copied).not.toMatch(
      // oxlint-disable-next-line no-control-regex
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/,
    );
  } finally {
    await removeReport(dir);
    await removeReport(input.dir);
  }
});

test('reports a failed clipboard copy', async ({ page }) => {
  await stubClipboardFailure(page);
  const { dir, output } = await writeReport(
    [fixture],
    'Tolkira copy failure',
    'tolkira-copy-fail-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const copy = page.locator(
      'details[data-scenario][data-status="failed"] [data-copy-failure]',
    );
    await expect(copy).toBeVisible();
    await copy.click();
    await expect(copy).toHaveText('Copy failed');
    await expect(page.locator('#tolkira-copy-live')).toHaveText(
      'Could not copy failure details.',
    );
    await expect(copy).toBeFocused();
  } finally {
    await removeReport(dir);
  }
});

test('copies a failure without an error message', async ({ page }) => {
  await stubClipboard(page);
  const { dir, output } = await writeReport(
    [noMessageFixture],
    'Tolkira empty copy',
    'tolkira-copy-empty-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const copy = page.locator('[data-copy-failure]');
    await expect(copy).toBeVisible();
    await copy.click();
    await expect(copy).toHaveText('Copied');

    const copied = await readClipboard(page);
    expect(copied).toContain('Step: Given a failing step');
    expect(copied).not.toContain('Error:');
  } finally {
    await removeReport(dir);
  }
});

test('copies a grouped failure with example context', async ({ page }) => {
  await stubClipboard(page);
  const { dir, output } = await writeReport(
    [examplesFixture],
    'Outlines copy',
    'tolkira-outline-copy-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const row = page.locator('[data-scenario][data-example="#2.1"]');
    await row.locator('[data-copy-failure]').click();
    const copied = await readClipboard(page);

    expect(copied).toContain('Scenario: Eating cucumbers');
    expect(copied).toContain('Example: #2.1 (These are failing)');
    expect(copied).toContain('URI:');
    expect(copied).toContain('Step:');
  } finally {
    await removeReport(dir);
  }
});

const privacyUriCases = [
  {
    name: 'file URL',
    uri: 'file:///home/alice/proj/features/login.feature',
    expected: 'features/login.feature',
  },
  {
    name: 'localhost file URL',
    uri: 'file://localhost/home/alice/proj/features/login.feature',
    expected: 'features/login.feature',
  },
  {
    name: 'percent-encoded leading separator',
    uri: 'file:%2Fhome%2Falice%2Fproj%2Ffeatures%2Flogin.feature',
    expected: 'features/login.feature',
  },
];

for (const { name, uri, expected } of privacyUriCases) {
  test(`copies a failure without a local user name in the URI (${name})`, async ({
    page,
  }) => {
    await stubClipboard(page);
    const lines = (await readFile(fixture, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, any>);
    for (const line of lines) {
      if (line.gherkinDocument) line.gherkinDocument.uri = uri;
      if (line.pickle) line.pickle.uri = uri;
    }
    const input = await writeInput(
      'home-uri.ndjson',
      `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
      'tolkira-copy-uri-input-',
    );
    const { dir, output } = await writeReport(
      [input.file],
      'Home URI copy',
      'tolkira-copy-uri-e2e-',
    );

    try {
      await page.goto(reportUrl(output));
      const copy = page.locator(
        'details[data-scenario][data-status="failed"] [data-copy-failure]',
      );
      await expect(copy).toBeVisible();
      await copy.click();
      await expect(copy).toHaveText('Copied');

      const copied = await readClipboard(page);
      expect(copied).toContain(`URI: ${expected}`);
      expect(copied).not.toContain('alice');
      expect(copied).not.toContain('/home/');
    } finally {
      await removeReport(dir);
      await removeReport(input.dir);
    }
  });
}
