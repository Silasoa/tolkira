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
      current = header[1]!;
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
  if (text === undefined)
    throw new Error(`release workflow has no ${name} job`);
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

function usesLines(jobText: string): string[] {
  return jobText.split(/\r?\n/).flatMap((line) => {
    if (line.trim().startsWith('#')) return [];
    const match = /^\s*(?:-\s*)?uses:\s+(.+)$/.exec(line);
    return match?.[1] ? [match[1].trim()] : [];
  });
}

function needsOf(jobText: string): string[] {
  const line = jobText
    .split(/\r?\n/)
    .find((entry) => /^ {4}needs:/.test(entry));
  if (line === undefined) return [];
  return line
    .replace(/^ {4}needs:\s*/, '')
    .replaceAll(/[[\]]/g, '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

function permissionsOf(jobText: string): string[] {
  const lines = jobText.split(/\r?\n/);
  const start = lines.findIndex((line) => /^ {4}permissions:\s*$/.test(line));
  if (start === -1) return [];
  const entries: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const entry = /^ {6}([a-z-]+):\s*(\S+)\s*$/.exec(line);
    if (!entry) break;
    entries.push(`${entry[1]}: ${entry[2]}`);
  }
  return entries;
}

function topPermissionsOf(workflow: string): string[] {
  const beforeJobs = workflow.slice(0, workflow.search(/^jobs:/m));
  const lines = beforeJobs.split(/\r?\n/);
  const start = lines.findIndex((line) => line === 'permissions:');
  if (start === -1) return [];
  const entries: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const entry = /^ {2}([a-z-]+):\s*(\S+)\s*$/.exec(line);
    if (!entry) break;
    entries.push(`${entry[1]}: ${entry[2]}`);
  }
  return entries;
}

function withKeysOf(block: string): string[] {
  const lines = block.split(/\r?\n/);
  const start = lines.findIndex((line) => /^\s*with:\s*$/.test(line));
  if (start === -1) return [];
  const indent =
    (lines[start] ?? '').length - (lines[start] ?? '').trimStart().length;
  const keys: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.trim()) continue;
    const lineIndent = line.length - line.trimStart().length;
    if (lineIndent <= indent) break;
    const key = /^\s*([a-z][a-z0-9-]*):/.exec(line);
    if (key?.[1]) keys.push(key[1]);
  }
  return keys;
}

function concurrencyOf(workflow: string): string[] {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => line === 'concurrency:');
  if (start === -1) return [];
  const entries: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!/^ {2}\S/.test(line)) break;
    entries.push(line.trim());
  }
  return entries;
}

// Slice a full step: from its `- ` line to the next one, so a key above the
// `uses:` line (such as an `if:` guard) is part of the block.
function stepBlocks(jobText: string, marker: string): string[] {
  const lines = jobText.split(/\r?\n/);
  return lines.flatMap((line, index) => {
    if (!/^\s*(?:-\s*)?uses:/.test(line) || !line.includes(marker)) return [];
    let start = index;
    while (start > 0 && !/^\s*-\s/.test(lines[start] ?? '')) start -= 1;
    let end = lines.length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^\s*-\s/.test(lines[cursor] ?? '')) {
        end = cursor;
        break;
      }
    }
    return [lines.slice(start, end).join('\n')];
  });
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

    expectStep(linux, 'npm run hygiene');
    expectStep(linux, 'npm run check');
    expectStep(
      linux,
      'npx playwright install --with-deps chromium firefox webkit',
    );
    expectStep(linux, 'npm run test:e2e');
    expect(linux).not.toContain('continue-on-error');
    expect(activeCommands(linux)).not.toContain('|| true');
  });

  it('runs the macOS browser gate', async () => {
    const macos = job(await workflowJobs(), 'gate-macos');

    // The runner OS is this gate's contract: WebKit on the macOS host.
    expect(macos).toContain('runs-on: macos-latest');
    expectStep(macos, 'npm run test:e2e');
    expect(macos).not.toContain('continue-on-error');
    expect(activeCommands(macos)).not.toContain('|| true');
  });
});

describe('release job graph', () => {
  it('builds and checks in a package job after both gate jobs', async () => {
    const packageJob = job(await workflowJobs(), 'package');

    expect(needsOf(packageJob).sort()).toEqual(['gate-linux', 'gate-macos']);
    expect(packageJob).not.toContain('id-token');
    expect(packageJob).not.toContain('NPM_TOKEN');
    expect(packageJob).not.toContain('NODE_AUTH_TOKEN');
    expect(activeCommands(packageJob)).not.toMatch(/npm stage publish/);
    expect(packageJob).not.toContain('continue-on-error');
    expect(activeCommands(packageJob)).not.toContain('|| true');
  });

  it('runs the tag guards before any install in the package job', async () => {
    const packageJob = job(await workflowJobs(), 'package');
    const commands = runCommands(packageJob);
    const guard = commands.indexOf(
      `test "v$(node -p "require('./package.json').version")" = "$GITHUB_REF_NAME"`,
    );
    const tagOnMain = commands.indexOf(
      [
        'git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main',
        'git merge-base --is-ancestor HEAD refs/remotes/origin/main',
      ].join('\n'),
    );
    const ci = commands.indexOf('npm ci');

    expect(guard, 'tag/version guard').toBeGreaterThanOrEqual(0);
    expect(tagOnMain, 'tag-on-main guard').toBeGreaterThanOrEqual(0);
    expect(tagOnMain, 'tag-on-main guard').toBeGreaterThan(guard);
    expect(ci, 'npm ci step').toBeGreaterThan(tagOnMain);
    // A shallow clone cannot prove the ancestor relation; the fetch is full.
    expect(packageJob).toContain('fetch-depth: 0');
    expect(activeCommands(packageJob)).not.toContain('--depth');
  });

  it('gives the package job and the workflow only contents read', async () => {
    const workflow = await readFile(workflowFile, 'utf8');
    const packageJob = job(await workflowJobs(), 'package');

    expect(permissionsOf(packageJob)).toEqual(['contents: read']);
    expect(topPermissionsOf(workflow)).toEqual(['contents: read']);
    expect(workflow.slice(0, workflow.search(/^jobs:/m))).not.toContain(
      'id-token',
    );
  });

  it('uploads both artifacts after signatures, check, smoke and SBOM', async () => {
    const packageJob = job(await workflowJobs(), 'package');
    const anchor = (needle: string): number => {
      const index = packageJob.indexOf(needle);
      expect(index, needle).toBeGreaterThanOrEqual(0);
      return index;
    };
    const signatures = anchor('npm audit signatures');
    const check = anchor('TOLKIRA_PACK_DIR=/tmp/pack npm run package:check');
    const smoke = anchor(
      'test/fixtures/legacy/minimal.json --out /tmp/report.html',
    );
    const sbom = anchor('npm sbom --sbom-format cyclonedx');
    const lastGate = Math.max(signatures, check, smoke, sbom);

    for (const marker of ['name: tolkira-release', 'name: tolkira-sbom']) {
      expect(anchor(marker), marker).toBeGreaterThan(lastGate);
    }
  });

  it('triggers on tags only, packs once and never runs npm pack', async () => {
    const workflow = await readFile(workflowFile, 'utf8');
    const commands = [...(await workflowJobs()).values()].flatMap((text) =>
      runCommands(text),
    );

    expect(workflow).not.toMatch(/^\s*schedule:/m);
    expect(
      commands.filter((command) => command.includes('npm run package:check')),
    ).toHaveLength(1);
    expect(commands.filter((command) => /\bnpm pack\b/.test(command))).toEqual(
      [],
    );
  });

  it('checks, smokes and records the digest in order', async () => {
    const commands = runCommands(job(await workflowJobs(), 'package'));
    const at = (label: string, match: (command: string) => boolean): number => {
      const index = commands.findIndex((command) => match(command));
      expect(index, label).toBeGreaterThanOrEqual(0);
      return index;
    };
    const ci = at('npm ci step', (command) => command === 'npm ci');
    const pin = at(
      'npm pin',
      (command) => command === 'npm install -g npm@12.2.3',
    );
    const signatures = at(
      'signature check',
      (command) => command === 'npm audit signatures',
    );
    const check = at(
      'package check',
      (command) =>
        command === 'TOLKIRA_PACK_DIR=/tmp/pack npm run package:check',
    );
    const digest = at('digest', (command) =>
      command.startsWith(
        'cd /tmp/pack\nsha256sum "tolkira-$TOLKIRA_VERSION.tgz"',
      ),
    );
    const install = at(
      'tarball install',
      (command) =>
        command ===
        'npm install -g --prefix /tmp/global /tmp/pack/tolkira-$TOLKIRA_VERSION.tgz',
    );
    const smoke = at('smoke report', (command) =>
      /^node "\$TOLKIRA_ROOT\/tolkira\/dist\/cli\.js" test\/fixtures\/legacy\/minimal\.json --out \S+ --title "Package smoke test"$/.test(
        command,
      ),
    );
    const sbom = at(
      'sbom',
      (command) =>
        command ===
        'npm sbom --sbom-format cyclonedx --omit=dev --package-lock-only > /tmp/pack/tolkira-sbom.cdx.json',
    );

    expect(pin).toBeGreaterThan(ci);
    expect(signatures).toBeGreaterThan(pin);
    expect(check).toBeGreaterThan(signatures);
    expect(digest).toBeGreaterThan(check);
    expect(install).toBeGreaterThan(digest);
    expect(smoke).toBeGreaterThan(install);
    expect(sbom).toBeGreaterThan(smoke);

    // The digest stays valid after the artifact round trip: bare file name.
    expect(commands).toContain(
      [
        'cd /tmp/pack',
        'sha256sum "tolkira-$TOLKIRA_VERSION.tgz" > "tolkira-$TOLKIRA_VERSION.sha256"',
        `echo "value=$(cut -d' ' -f1 "tolkira-$TOLKIRA_VERSION.sha256")" >> "$GITHUB_OUTPUT"`,
      ].join('\n'),
    );
  });

  it('declares version and digest outputs for the publish job', async () => {
    const packageJob = job(await workflowJobs(), 'package');

    expect(packageJob).toMatch(/^ {4}outputs:\s*$/m);
    expect(packageJob).toContain('version: ${{ steps.version.outputs.value }}');
    expect(packageJob).toContain('sha256: ${{ steps.digest.outputs.value }}');
    expect(packageJob).toContain('id: version');
    expect(packageJob).toContain('id: digest');
  });

  it('uploads the checked tarball and digest as tolkira-release', async () => {
    const packageJob = job(await workflowJobs(), 'package');
    const uploads = stepBlocks(packageJob, 'actions/upload-artifact');

    const releaseArtifact = uploads.find((block) =>
      block.includes('name: tolkira-release'),
    );
    expect(releaseArtifact, 'tolkira-release upload').toBeDefined();
    expect(releaseArtifact).toContain(
      'tolkira-${{ steps.version.outputs.value }}.tgz',
    );
    expect(releaseArtifact).toContain(
      'tolkira-${{ steps.version.outputs.value }}.sha256',
    );
    expect(releaseArtifact).toContain('if-no-files-found: error');
    expect(releaseArtifact).toContain('retention-days: 14');

    const sbom = uploads.find((block) => block.includes('name: tolkira-sbom'));
    expect(sbom, 'tolkira-sbom upload').toBeDefined();
    expect(sbom).toContain('path: /tmp/pack/tolkira-sbom.cdx.json');
    expect(sbom).toContain('if-no-files-found: error');
    expect(sbom).toContain('retention-days: 14');

    // `if-no-files-found` is not a condition; a disabled upload must fail.
    for (const block of [releaseArtifact, sbom]) {
      expect(block, 'upload if').not.toMatch(/^\s*if:/m);
    }
  });
});

describe('release publish job', () => {
  it('starts only after the package job', async () => {
    const publish = job(await workflowJobs(), 'publish');

    expect(needsOf(publish)).toEqual(['package']);
    expect(publish).not.toContain('continue-on-error');
    expect(activeCommands(publish)).not.toContain('|| true');
  });

  it('runs in the release environment with token-only permissions', async () => {
    const publish = job(await workflowJobs(), 'publish');

    expect(publish).toMatch(
      /(?:environment:\s*release\b|environment:\s*\n\s+name:\s*release\b)/,
    );
    expect(permissionsOf(publish).sort()).toEqual([
      'contents: read',
      'id-token: write',
    ]);
    expect(publish).toContain(
      'TOLKIRA_VERSION: ${{ needs.package.outputs.version }}',
    );
    expect(publish).toContain(
      'TOLKIRA_SHA256: ${{ needs.package.outputs.sha256 }}',
    );
  });

  it('downloads the release artifact into the pack directory', async () => {
    const publish = job(await workflowJobs(), 'publish');
    const downloads = stepBlocks(publish, 'actions/download-artifact');

    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toContain('name: tolkira-release');
    expect(downloads[0]).toContain('path: /tmp/pack');
    // Same-run artifact only: any other input would fetch another run.
    expect(withKeysOf(downloads[0] ?? '')).toEqual(['name', 'path']);
    expect(downloads[0]).not.toMatch(
      /\b(run-id|github-token|repository|workflow)\s*:/,
    );

    const stages = runCommands(publish).filter((command) =>
      /^npm stage publish\b/.test(command),
    );
    expect(stages).toHaveLength(1);
  });

  it('allows only setup-node and the pinned download action', async () => {
    const publish = job(await workflowJobs(), 'publish');
    const uses = usesLines(publish);

    expect(uses.map((line) => line.split('@')[0])).toEqual([
      'actions/setup-node',
      'actions/download-artifact',
    ]);
    expect(uses[0]).toMatch(/^actions\/setup-node@[0-9a-f]{40}\b/);
    expect(uses[1]).toBe(
      'actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7.0.0',
    );
  });

  it('stages the downloaded tarball with the exact command list', async () => {
    const publish = job(await workflowJobs(), 'publish');

    expect(runCommands(publish)).toEqual([
      'test "v$TOLKIRA_VERSION" = "$GITHUB_REF_NAME"',
      'npm install -g npm@12.2.3',
      'cd /tmp/pack\necho "$TOLKIRA_SHA256  tolkira-$TOLKIRA_VERSION.tgz" | sha256sum -c -',
      'npm stage publish "/tmp/pack/tolkira-$TOLKIRA_VERSION.tgz" --provenance --access public',
    ]);
  });

  it('has no build, check or SBOM step in the token job', async () => {
    const publish = job(await workflowJobs(), 'publish');
    const commands = activeCommands(publish);
    const forbidden: Array<[string, RegExp]> = [
      ['checkout', /actions\/checkout/],
      ['npm ci', /\bnpm ci\b/],
      ['build', /npm run build/],
      ['package check', /package:check/],
      ['tarball install', /npm install -g --prefix/],
      ['signature check', /npm audit signatures/],
      ['sbom', /npm sbom/],
      ['upload artifact', /actions\/upload-artifact/],
      ['pack', /\bnpm pack\b/],
    ];

    for (const [label, pattern] of forbidden) {
      expect(commands, label).not.toMatch(pattern);
    }
    expect(publish).not.toContain('actions/checkout');
    expect(publish).not.toContain('actions/upload-artifact');
  });
});

describe('release serialization', () => {
  it('queues runs per tag instead of cancelling them', async () => {
    const workflow = await readFile(workflowFile, 'utf8');

    expect(concurrencyOf(workflow)).toEqual([
      'group: release-${{ github.ref }}',
      'cancel-in-progress: false',
    ]);
  });
});
