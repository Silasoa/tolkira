import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { messagesFixture } from '../fixtures.js';
import {
  removeReport,
  reportUrl,
  writeInput,
  writeReport,
} from './helpers.js';

const rulesOutlineBackgroundFixture = messagesFixture(
  'rules-outline-background.ndjson',
);
const tagsFixture = messagesFixture('tags.ndjson');

test('renders rules, backgrounds and outlines together', async ({ page }) => {
  const { dir, output } = await writeReport(
    [rulesOutlineBackgroundFixture],
    'Rules E2E',
    'tolkira-rules-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const rule = page.locator('section.rule[data-rule]');
    await expect(rule).toHaveCount(1);
    await expect(
      rule.getByRole('heading', { name: /Outline rule/, level: 3 }),
    ).toBeVisible();
    await expect(rule.locator('.ruleTags')).toContainText('@rule-outline');
    await expect(
      page.getByRole('heading', { name: /Feature setup/, level: 3 }),
    ).toBeVisible();
    await expect(page.getByText('Feature background description.')).toBeVisible();
    await expect(
      rule.getByRole('heading', { name: /Rule setup/, level: 3 }),
    ).toBeVisible();
    await expect(rule.getByText('Rule background description.')).toBeVisible();
    await expect(rule.locator('section.outline')).toHaveCount(1);
    await expect(rule.locator('section.outline .outlineTitle')).toContainText(
      'Eating cucumbers',
    );
    await expect(rule.locator('section.examples')).toHaveCount(2);
    await expect(page.locator('section.outline')).toHaveCount(2);
    await expect(page.locator('.exampleNo')).toHaveCount(7);

    const search = page.getByRole('searchbox', { name: /Search/ });
    await search.fill('Rule setup');
    await expect(rule).toBeVisible();
    await expect(page.locator('section.outline:visible')).toHaveCount(1);
    await expect(page.locator('details.scenario:visible')).toHaveCount(4);

    await search.fill('Feature setup');
    await expect(page.locator('section.outline:visible')).toHaveCount(2);
    await expect(page.locator('details.scenario:visible')).toHaveCount(7);
  } finally {
    await removeReport(dir);
  }
});

test('filters rules by search, status and tag', async ({ page }) => {
  const input = await writeFailedTagsFixture();
  const { dir, output } = await writeReport(
    [input.file],
    'Rule filters',
    'tolkira-rule-filter-e2e-',
  );

  try {
    await page.goto(reportUrl(output));
    const ruleOne = page
      .locator('section.rule')
      .filter({ hasText: 'tagged rule' });
    const ruleTwo = page
      .locator('section.rule')
      .filter({ hasText: 'no stock' });
    await expect(ruleOne).toBeVisible();
    await expect(ruleTwo).toBeVisible();

    const search = page.getByRole('searchbox', { name: /Search/ });
    await search.fill('tagged rule');
    await expect(ruleOne).toBeVisible();
    await expect(ruleTwo).toBeHidden();
    await expect(page.locator('details.scenario:visible')).toHaveCount(2);

    await search.fill('@some-tag');
    await expect(ruleTwo).toBeVisible();
    await expect(ruleOne).toBeHidden();
    await expect(page.locator('details.scenario:visible')).toHaveCount(1);

    await search.fill('');
    const tagFilter = page.locator('select[data-tag-filter]');
    await tagFilter.selectOption('@rule-tag');
    await expect(ruleOne).toBeVisible();
    await expect(ruleTwo).toBeHidden();

    await tagFilter.selectOption('@some-tag');
    await expect(ruleTwo).toBeVisible();
    await expect(ruleOne).toBeHidden();
    await expect(page.locator('section.rule:visible')).toHaveCount(1);

    await tagFilter.selectOption('');
    const passedFilter = page.locator('button.filter[data-filter-status="passed"]');
    await passedFilter.click();
    await expect(ruleOne).toBeVisible();
    await expect(ruleTwo).toBeHidden();
    await expect(page.locator('details.scenario:visible')).toHaveCount(1);
    await expect(page.locator('[data-scenario-name="tagged scenario"]')).toBeVisible();

    await passedFilter.click();
    await expect(page.locator('details.scenario:visible')).toHaveCount(3);
    await expect(ruleOne).toBeVisible();
    await expect(ruleTwo).toBeVisible();
  } finally {
    await removeReport(dir);
    await removeReport(input.dir);
  }
});

async function writeFailedTagsFixture(): Promise<{
  dir: string;
  file: string;
}> {
  const lines = (await readFile(tagsFixture, 'utf8'))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, any>);
  const pickle = lines.find((line) => line.pickle?.name === 'tagged scenario')
    ?.pickle;
  const testCase = lines.find(
    (line) => line.testCase?.pickleId === pickle?.id,
  )?.testCase;
  const started = lines.find(
    (line) => line.testCaseStarted?.testCaseId === testCase?.id,
  )?.testCaseStarted;
  const step = testCase?.testSteps.find((entry: { pickleStepId?: string }) =>
    entry.pickleStepId,
  );
  const finished = lines.find(
    (line) =>
      line.testStepFinished?.testCaseStartedId === started?.id &&
      line.testStepFinished.testStepId === step?.id,
  )?.testStepFinished;
  expect(finished).toBeTruthy();
  finished.testStepResult.status = 'FAILED';
  return writeInput(
    'failed-tags.ndjson',
    `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    'tolkira-rule-filter-input-',
  );
}
