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

// Collects every command actually run by the job. Comments and inactive keys
// never count, so a commented-out gate cannot satisfy the contract.
function runCommands(jobText: string): string[] {
  const lines = jobText.split(/\r?\n/);
  const commands: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.trim().startsWith('#')) continue;
    const match = /^\s*(?:-\s*)?run:\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[1]?.trim() ?? '';
    if (value === '|' || value === '|-' || value === '>' || value === '>-') {
      const baseIndent = line.length - line.trimStart().length;
      const block: string[] = [];
      let cursor = index + 1;
      while (cursor < lines.length) {
        const next = lines[cursor] ?? '';
        const indent = next.length - next.trimStart().length;
        if (next.trim() !== '' && indent <= baseIndent) break;
        if (!next.trim().startsWith('#')) block.push(next.trim());
        cursor += 1;
      }
      index = cursor - 1;
      commands.push(block.filter(Boolean).join('\n'));
    } else if (value) {
      commands.push(value);
    }
  }
  return commands;
}

function activeCommands(jobText: string): string {
  return runCommands(jobText).join('\n');
}

function expectStep(jobText: string, command: string): void {
  expect(runCommands(jobText)).toContain(command);
}

describe('release workflow gate', () => {
  it('reads only active run lines', () => {
    const sample = [
      '    steps:',
      '      # - run: npm run hygiene',
      '      - run: npm run check',
      '      - name: Commented gate',
      '        run: |',
      '          git fetch origin main',
      '          # git merge-base --is-ancestor HEAD FETCH_HEAD',
      '          git merge-base --is-ancestor HEAD FETCH_HEAD',
    ].join('\n');

    expect(runCommands(sample)).toEqual([
      'npm run check',
      'git fetch origin main\ngit merge-base --is-ancestor HEAD FETCH_HEAD',
    ]);
  });

  it('runs the Linux gate with hygiene, check and the browser suite', async () => {
    const linux = job(await workflowJobs(), 'gate-linux');

    expect(linux).toContain('runs-on: ubuntu-latest');
    expectStep(linux, 'npm run hygiene');
    expectStep(linux, 'npm run check');
    expectStep(linux, 'npx playwright install --with-deps chromium firefox webkit');
    expectStep(linux, 'npm run test:e2e');
    expect(linux).not.toContain('continue-on-error');
    expect(activeCommands(linux)).not.toContain('|| true');
  });

  it('runs the macOS browser gate', async () => {
    const macos = job(await workflowJobs(), 'gate-macos');

    expect(macos).toContain('runs-on: macos-latest');
    expectStep(macos, 'npm run test:e2e');
    expect(macos).not.toContain('continue-on-error');
    expect(activeCommands(macos)).not.toContain('|| true');
  });

  it('starts publish only after both gates', async () => {
    const publish = job(await workflowJobs(), 'publish');

    expect(publish).toMatch(/needs:\s*\[gate-linux,\s*gate-macos\]/);
    expect(publish).not.toContain('continue-on-error');
    expect(activeCommands(publish)).not.toContain('|| true');
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
    const commands = runCommands(job(await workflowJobs(), 'publish'));
    const order: Array<[string, RegExp]> = [
      ['pack', /^npm pack --pack-destination \S+$/],
      [
        'install',
        /^npm install -g --prefix \S+ \S*tolkira-.*\.tgz$/,
      ],
      ['binary', /^test -x \S+\/bin\/tolkira$/],
      ['global help', /^\/\S+\/bin\/tolkira --help \| grep -q "Usage: tolkira"$/],
      ['package help', /^node "\$TOLKIRA_ROOT\/tolkira\/dist\/cli\.js" --help$/],
      [
        'smoke report',
        /^node "\$TOLKIRA_ROOT\/tolkira\/dist\/cli\.js" test\/fixtures\/legacy\/minimal\.json --out \S+report\.html --title "Package smoke test"$/,
      ],
      [
        'smoke output',
        /^test -s \S+report\.html && grep -q "Minimal feature" \S+report\.html$/,
      ],
      ['stage', /^npm stage publish \. --provenance --access public$/],
    ];
    let previous = -1;
    for (const [label, pattern] of order) {
      const index = commands.findIndex((command) => pattern.test(command));
      expect(index, label).toBeGreaterThan(previous);
      previous = index;
    }
  });
});
