import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { messagesFixture } from '../fixtures.js';
import { removeReport, reportUrl, writeInput, writeReport } from './helpers.js';

const undefinedFixture = messagesFixture('undefined.ndjson');
const ambiguousFixture = messagesFixture('ambiguous.ndjson');

test('shows undefined-step snippets and finds them by search', async ({
  page,
}) => {
  const { dir, output } = await writeReport(
    [undefinedFixture],
    'Undefined E2E',
    'tolkira-undefined-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const feature = page.locator('details.feature').first();
    await expect(feature).toHaveAttribute('open', '');
    const scenario = page.locator(
      '[data-scenario-name="Snippets reflect parameter types"]',
    );
    await expect(scenario).toHaveAttribute('open', '');
    await expect(scenario.locator('.diagnosticLead')).toHaveText(
      'No step definition found. Implement with the snippet(s) below:',
    );
    await expect(scenario.locator('.snippet')).toHaveCount(2);
    await expect(scenario.locator('.snippetLang').first()).toHaveText(
      'typescript',
    );
    await expect(scenario.locator('.snippet').first()).toContainText(
      'Given("a list of {int} things"',
    );

    const search = page.getByRole('searchbox', { name: /Search/ });
    await search.fill('{int}');
    await expect(scenario).toBeVisible();
    await expect(scenario).toHaveAttribute('open', '');

    await search.fill('No step definition found.');
    await expect(page.locator('[data-scenario]:visible')).toHaveCount(4);
    await expect(scenario).toBeVisible();
  } finally {
    await removeReport(dir);
  }
});

test('shows ambiguous definitions with relative sources', async ({ page }) => {
  const { dir, output } = await writeReport(
    [ambiguousFixture],
    'Ambiguous E2E',
    'tolkira-ambiguous-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const scenario = page.locator(
      '[data-scenario-name="Multiple step definitions for a step"]',
    );
    const panel = page.locator('#incident');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.diagnosticLead')).toHaveText(
      'Multiple matching step definitions found:',
    );
    await expect(panel.locator('.definitionPattern')).toHaveCount(2);
    await expect(panel.locator('.definitionPattern').first()).toHaveText(
      '^a (.*?) with (.*?)$',
    );
    await expect(panel.locator('.definitionSource').first()).toHaveText(
      'samples/ambiguous/ambiguous.ts:3',
    );
    await expect(panel.locator('.definitionSource').nth(1)).toHaveText(
      'samples/ambiguous/ambiguous.ts:7',
    );

    await page
      .getByRole('searchbox', { name: /Search/ })
      .fill('Multiple matching step definitions found:');
    await expect(page.locator('[data-scenario]:visible')).toHaveCount(1);
    await expect(scenario).toBeVisible();
  } finally {
    await removeReport(dir);
  }
});

test('does not execute markup in snippets, patterns or sources', async ({
  page,
}) => {
  let dialogOpened = false;
  page.on('dialog', async (dialog) => {
    dialogOpened = true;
    await dialog.dismiss();
  });

  const undefinedLines = (await readFile(undefinedFixture, 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, any>);
  for (const line of undefinedLines) {
    if (line.suggestion) {
      line.suggestion.snippets[0].code =
        '<script>window.__tolkiraXss=1</script>';
    }
  }
  const undefinedInput = await writeInput(
    'undefined-xss.ndjson',
    `${undefinedLines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    'tolkira-diagnostic-xss-input-',
  );
  const undefinedReport = await writeReport(
    [undefinedInput.file],
    '',
    'tolkira-diagnostic-xss-',
  );

  const ambiguousLines = (await readFile(ambiguousFixture, 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, any>);
  for (const line of ambiguousLines) {
    if (line.stepDefinition) {
      line.stepDefinition.pattern.source =
        '<img src=x onerror="window.__tolkiraXss=1">';
      line.stepDefinition.sourceReference.uri =
        '"><svg onload="window.__tolkiraXss=1">';
    }
  }
  const ambiguousInput = await writeInput(
    'ambiguous-xss.ndjson',
    `${ambiguousLines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    'tolkira-diagnostic-xss-input-',
  );
  const ambiguousReport = await writeReport(
    [ambiguousInput.file],
    '',
    'tolkira-diagnostic-xss-',
  );

  try {
    await page.goto(reportUrl(undefinedReport.output));
    await expect(page.locator('.snippet').first()).toContainText(
      '<script>window.__tolkiraXss=1</script>',
    );
    expect(await page.locator('.diagnostic script').count()).toBe(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { __tolkiraXss?: number }).__tolkiraXss,
      ),
    ).toBeUndefined();

    await page.goto(reportUrl(ambiguousReport.output));
    await expect(page.locator('.definitionPattern').first()).toContainText(
      '<img src=x onerror="window.__tolkiraXss=1">',
    );
    await expect(page.locator('.definitionSource').first()).toContainText(
      '"><svg onload="window.__tolkiraXss=1">',
    );
    expect(await page.locator('.diagnostic img').count()).toBe(0);
    expect(await page.locator('.diagnostic svg').count()).toBe(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { __tolkiraXss?: number }).__tolkiraXss,
      ),
    ).toBeUndefined();
    expect(dialogOpened).toBe(false);
  } finally {
    await removeReport(undefinedReport.dir);
    await removeReport(undefinedInput.dir);
    await removeReport(ambiguousReport.dir);
    await removeReport(ambiguousInput.dir);
  }
});
