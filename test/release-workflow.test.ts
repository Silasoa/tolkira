import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const workflowFile = fileURLToPath(
  new URL('../.github/workflows/release.yml', import.meta.url),
);

function jobsOf(text: string): Map<string, string> {
  const lines = text.split(/\r?\n/);
  const jobsAt = lines.findIndex((line) => line === 'jobs:');
  const body = jobsAt === -1 ? [] : lines.slice(jobsAt + 1);
  const jobs = new Map<string, string>();
  let current: string | undefined;
  for (const line of body) {
    const header = /^  ([a-z][a-z0-9-]*):\s*$/.exec(line);
    if (header) {
      current = header[1];
      jobs.set(current, '');
      continue;
    }
    if (current) jobs.set(current, `${jobs.get(current) ?? ''}${line}\n`);
  }
  return jobs;
}

async function workflowJobs(): Promise<Map<string, string>> {
  return jobsOf(await readFile(workflowFile, 'utf8'));
}

function job(jobs: Map<string, string>, name: string): string {
  const text = jobs.get(name);
  if (text === undefined) throw new Error(`release workflow has no ${name} job`);
  return text;
}

function expectStep(jobText: string, command: string): void {
  expect(jobText).toContain(command);
}

describe('release workflow gate', () => {
  it('runs the Linux gate with hygiene, check and the browser suite', async () => {
    const linux = job(await workflowJobs(), 'gate-linux');

    expect(linux).toContain('runs-on: ubuntu-latest');
    expectStep(linux, 'npm run hygiene');
    expectStep(linux, 'npm run check');
    expect(linux).toContain('npx playwright install --with-deps chromium firefox webkit');
    expectStep(linux, 'npm run test:e2e');
    expect(linux).not.toContain('continue-on-error');
  });

  it('runs the macOS browser gate', async () => {
    const macos = job(await workflowJobs(), 'gate-macos');

    expect(macos).toContain('runs-on: macos-latest');
    expectStep(macos, 'npm run test:e2e');
    expect(macos).not.toContain('continue-on-error');
  });

  it('starts publish only after both gates', async () => {
    const publish = job(await workflowJobs(), 'publish');

    expect(publish).toMatch(/needs:\s*\[gate-linux,\s*gate-macos\]/);
    expect(publish).not.toContain('continue-on-error');
  });

  it('fails the decision table on a tag/version mismatch', async () => {
    const publish = job(await workflowJobs(), 'publish');

    expect(publish).toContain(
      '- name: Require the tag to match the package version',
    );
    expect(publish).toContain(
      `test "v$(node -p "require('./package.json').version")" = "$GITHUB_REF_NAME"`,
    );
  });

  it('fails the decision table when the tag is not on main', async () => {
    const publish = job(await workflowJobs(), 'publish');

    expect(publish).toContain('- name: Require the tag to be on main');
    expect(publish).toContain('git fetch origin main');
    expect(publish).toContain('git merge-base --is-ancestor HEAD FETCH_HEAD');
    // A shallow clone cannot prove the ancestor relation; the fetch is full.
    expect(publish).toContain('fetch-depth: 0');
    expect(publish).not.toContain('--depth');
  });

  it('reaches the package smoke and stage step on a green tag', async () => {
    const publish = job(await workflowJobs(), 'publish');
    const order = [
      'npm pack --pack-destination /tmp',
      'npm install -g --prefix /tmp/global',
      'test -x /tmp/global/bin/tolkira',
      'tolkira --help | grep -q "Usage: tolkira"',
      '$TOLKIRA_ROOT/tolkira/dist/cli.js" --help',
      'test/fixtures/legacy/minimal.json --out /tmp/report.html',
      'test -s /tmp/report.html && grep -q "Minimal feature" /tmp/report.html',
      'npm stage publish . --provenance --access public',
    ];
    let previous = -1;
    for (const step of order) {
      const index = publish.indexOf(step);
      expect(index, step).toBeGreaterThan(previous);
      previous = index;
    }
  });
});
