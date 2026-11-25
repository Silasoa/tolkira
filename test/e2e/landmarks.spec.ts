import { expect, test, type Page } from '@playwright/test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { messagesFixture } from '../fixtures.js';
import {
  removeReport,
  reportUrl,
  writeReportWithHistory,
  type ReportFile,
} from './helpers.js';

const firstInput = messagesFixture('second.ndjson');
const secondInput = messagesFixture('all-statuses.ndjson');

async function capture(
  page: Page,
  engine: string,
  name: string,
): Promise<void> {
  const dir = path.resolve('test-results', 'cmp', engine);
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

async function panelBoxes(
  page: Page,
  id: string,
): Promise<{
  panel: { x: number; width: number };
  shell: { x: number; width: number };
}> {
  const panelLocator = page.locator(`#${id}`);
  await expect(panelLocator).toBeVisible();
  const panel = await panelLocator.boundingBox();
  const shell = await page.locator(`#${id} .shell.analysis`).boundingBox();
  expect(panel, `${id} panel box`).not.toBeNull();
  expect(shell, `${id} shell box`).not.toBeNull();
  const viewport = await page.evaluate(() => window.innerWidth);
  expect(panel!.x, `${id} left`).toBeGreaterThanOrEqual(-0.5);
  expect(panel!.x + panel!.width, `${id} right`).toBeLessThanOrEqual(
    viewport + 1,
  );
  // The inner shell stays inside its panel; at wide widths it is centred.
  expect(shell!.x, `${id} shell left`).toBeGreaterThanOrEqual(panel!.x - 1);
  expect(shell!.x + shell!.width, `${id} shell right`).toBeLessThanOrEqual(
    panel!.x + panel!.width + 1,
  );
  expect(shell!.width, `${id} shell width`).toBeLessThanOrEqual(
    panel!.width + 1,
  );
  return {
    panel: { x: panel!.x, width: panel!.width },
    shell: { x: shell!.x, width: shell!.width },
  };
}

async function landmarkState(
  page: Page,
  label: string,
  panelId: string,
): Promise<void> {
  await expect(page.getByRole('main'), `${label} main role`).toHaveCount(1);
  await expect(page.getByRole('banner'), `${label} banner role`).toHaveCount(1);
  await expect(page.getByRole('banner'), `${label} banner element`).toHaveClass(
    /topbar/,
  );
  expect(await page.locator('main').count(), `${label} main`).toBe(1);
  const state = await page.evaluate((id) => {
    const main = document.querySelector('main');
    const panel = document.getElementById(id);
    const active = document.querySelector('[role="tabpanel"]:not([hidden])');
    return {
      panelInMain: Boolean(main && panel && main.contains(panel)),
      activeInMain: Boolean(main && active && main.contains(active)),
      panelIsActive: panel !== null && panel === active,
    };
  }, panelId);
  expect(state.panelInMain, `${label} ${panelId} in main`).toBe(true);
  expect(state.activeInMain, `${label} active panel in main`).toBe(true);
  expect(state.panelIsActive, `${label} ${panelId} active`).toBe(true);
}

test('keeps one main landmark and the panel boxes at every gate viewport', async ({
  page,
}, testInfo) => {
  const engine = testInfo.project.name;
  const historyDir = await mkdtemp(
    path.join(tmpdir(), 'tolkira-landmark-history-'),
  );
  const history = path.join(historyDir, 'history.json');
  let first: ReportFile | undefined;
  let second: ReportFile | undefined;

  try {
    first = await writeReportWithHistory([firstInput], history, 'Landmarks');
    second = await writeReportWithHistory([secondInput], history, 'Landmarks');

    for (const viewport of [
      { width: 320, height: 700 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1024, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      const label = `${viewport.width}x${viewport.height}`;
      await page.setViewportSize(viewport);
      await page.goto(reportUrl(second.output));
      const zoomed = viewport.width === 320;
      if (zoomed) {
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '32px';
        });
      }

      // Capture before the assertions so a red gate still leaves evidence.
      await capture(
        page,
        engine,
        `landmarks-${label}${zoomed ? '-text-zoom' : ''}`,
      );

      await landmarkState(page, label, 'report-view');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
        `${label} overflow`,
      ).toBeLessThanOrEqual(1);

      await page.getByRole('tab', { name: 'Details' }).click();
      await landmarkState(page, `${label} details`, 'analysis-view');
      const details = await panelBoxes(page, 'analysis-view');
      await capture(page, engine, `landmarks-${label}-details`);

      await page.getByRole('tab', { name: 'Trends' }).click();
      await landmarkState(page, `${label} trends`, 'trends-view');
      const trends = await panelBoxes(page, 'trends-view');
      await capture(page, engine, `landmarks-${label}-trends`);

      expect(
        Math.abs(details.panel.x - trends.panel.x),
        `${label} panel x`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(details.panel.width - trends.panel.width),
        `${label} panel width`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(details.shell.x - trends.shell.x),
        `${label} shell x`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(details.shell.width - trends.shell.width),
        `${label} shell width`,
      ).toBeLessThanOrEqual(1);
    }
  } finally {
    if (first) await removeReport(first.dir);
    if (second) await removeReport(second.dir);
    await rm(historyDir, { recursive: true, force: true });
  }
});
