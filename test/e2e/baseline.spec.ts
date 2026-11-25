import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli.js';
import {
  removeReport,
  reportUrl,
  writeInput,
  writeReport,
  type ReportFile,
} from './helpers.js';

interface LegacyScenario {
  name: string;
  status: string;
}

interface LegacyFeature {
  name: string;
  uri: string;
  scenarios: LegacyScenario[];
}

function legacyRun(features: LegacyFeature[]): string {
  return JSON.stringify(
    features.map((feature) => ({
      uri: feature.uri,
      name: feature.name,
      keyword: 'Feature',
      elements: feature.scenarios.map((scenario, index) => ({
        keyword: 'Scenario',
        type: 'scenario',
        name: scenario.name,
        line: index + 3,
        steps: [
          {
            keyword: 'Given ',
            name: 'a step',
            result: { status: scenario.status, duration: 1 },
          },
        ],
      })),
    })),
  );
}

const OLD = legacyRun([
  {
    name: 'Checkout',
    uri: 'features/checkout-old.feature',
    scenarios: [
      { name: 'pays by card', status: 'passed' },
      { name: 'pays by cash', status: 'failed' },
      { name: 'uses a coupon', status: 'passed' },
      { name: 'refunds', status: 'failed' },
    ],
  },
]);

const CURRENT = legacyRun([
  {
    name: 'Checkout',
    uri: 'features/checkout-new.feature',
    scenarios: [
      { name: 'pays by card', status: 'failed' },
      { name: 'pays by cash', status: 'passed' },
      { name: 'uses a coupon', status: 'passed' },
      { name: 'applies a discount', status: 'passed' },
    ],
  },
]);

let compared: ReportFile | undefined;
let staticReport: ReportFile | undefined;
let multiInput: ReportFile | undefined;
const cleanup: string[] = [];

function report(file: ReportFile | undefined): ReportFile {
  if (!file) throw new Error('the baseline report was not written');
  return file;
}

function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

function row(page: Page, name: string): Locator {
  return page.locator(
    `[data-scenario][data-uri="features/checkout-new.feature"][data-scenario-name="${name}"]`,
  );
}

test.beforeAll(async () => {
  const old = await writeInput('old.json', OLD, 'tolkira-baseline-old-');
  const current = await writeInput(
    'current.json',
    CURRENT,
    'tolkira-baseline-current-',
  );
  cleanup.push(old.dir, current.dir);
  const baselineDir = await mkdtemp(
    path.join(tmpdir(), 'tolkira-baseline-run-'),
  );
  cleanup.push(baselineDir);
  const baseline = path.join(baselineDir, 'baseline.json');

  let stdout = '';
  let stderr = '';
  const first = await runCli([old.file, '--json'], {
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  expect(first, stderr).toBe(0);
  await writeFile(baseline, stdout, 'utf8');

  compared = await writeReport(
    [current.file],
    'Baseline comparison',
    'tolkira-baseline-e2e-',
    '',
    ['--baseline', baseline],
  );
  staticReport = await writeReport(
    [current.file],
    'Static baseline',
    'tolkira-baseline-static-',
    '',
    ['--baseline', baseline, '--static'],
  );
  const extra = await writeInput(
    'extras.json',
    legacyRun([
      {
        name: 'Extras',
        uri: 'features/extras.feature',
        scenarios: [{ name: 'extra passes', status: 'passed' }],
      },
    ]),
    'tolkira-baseline-extra-',
  );
  cleanup.push(extra.dir);
  multiInput = await writeReport(
    [current.file, extra.file],
    'Baseline sources',
    'tolkira-baseline-sources-',
    '',
    ['--baseline', baseline],
  );
});

test.afterAll(async () => {
  for (const file of [compared, staticReport, multiInput]) {
    if (file) await removeReport(file.dir);
  }
  for (const dir of cleanup) {
    await rm(dir, { recursive: true, force: true });
  }
});

test.describe('baseline comparison in the browser', () => {
  test('shows the panel, the not-in-this-run row and the badges at 320 and 1440 px', async ({
    page,
  }) => {
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(reportUrl(report(compared).output));

      await expect(
        page.getByText('Compared with baseline').first(),
      ).toBeVisible();
      await expect(page.getByText('Not in this run').first()).toBeVisible();
      await expect(page.getByText('refunds').first()).toBeVisible();
      await expect(row(page, 'pays by card').locator('summary')).toContainText(
        /new failure/i,
      );
      await expect(row(page, 'pays by cash').locator('summary')).toContainText(
        /fixed/i,
      );
      expect(
        await pageOverflow(page),
        `${width}px overflow`,
      ).toBeLessThanOrEqual(1);
    }
  });

  test('wraps at 320 px and 200% text without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(reportUrl(report(compared).output));
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });

    await expect(
      page.getByText('Compared with baseline').first(),
    ).toBeVisible();
    await expect(page.getByText('refunds').first()).toBeVisible();
    expect(
      await pageOverflow(page),
      '320px at 200% text overflow',
    ).toBeLessThanOrEqual(1);
  });

  test('keeps the panel while the triage and source strip hide for a filter', async ({
    page,
  }) => {
    await page.goto(reportUrl(report(multiInput).output));
    await expect(page.locator('[data-triage]')).toBeVisible();
    await expect(page.locator('[data-sources]')).toBeVisible();

    await page.locator('input[data-search]').fill('zzz-no-such-scenario');

    await expect(page.locator('[data-triage]')).toBeHidden();
    await expect(page.locator('[data-sources]')).toBeHidden();
    await expect(
      page.getByText('Compared with baseline').first(),
    ).toBeVisible();
    await expect(page.getByText('refunds').first()).toBeVisible();
  });

  test('prints the panel', async ({ page }) => {
    await page.setViewportSize({ width: 794, height: 1200 });
    await page.emulateMedia({ media: 'print' });
    await page.goto(reportUrl(report(compared).output));

    await expect(
      page.getByText('Compared with baseline').first(),
    ).toBeVisible();
    await expect(page.getByText('refunds').first()).toBeVisible();
  });
});

test.describe('static report with a baseline', () => {
  test.use({ javaScriptEnabled: false });

  test('renders the panel without a script or a second main', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(reportUrl(report(staticReport).output));

    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('script')).toHaveCount(0);
    await expect(
      page.getByText('Compared with baseline').first(),
    ).toBeVisible();
    await expect(page.getByText('Not in this run').first()).toBeVisible();
    await expect(page.getByText('refunds').first()).toBeVisible();
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
  });
});
