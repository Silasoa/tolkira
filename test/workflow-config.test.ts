import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function readText(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const ci = readText('.github/workflows/ci.yml');
const release = readText('.github/workflows/release.yml');
const dependabot = readText('.github/dependabot.yml');

const pinnedUse =
  /^\s*(?:-\s*)?uses:\s+[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*@[0-9a-f]{40}\s+#\s+v\d+\.\d+\.\d+\s*$/;

function actionUses(workflow: string): string[] {
  return workflow
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:-\s*)?uses:\s+/.test(line))
    .filter((line) => !/^\s*(?:-\s*)?uses:\s+\.\//.test(line));
}

function isPinnedUse(line: string): boolean {
  return pinnedUse.test(line);
}

// Slice a job from its two-space `name:` line to the next job declaration.
function jobBlock(workflow: string, name: string): string {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${name}:`);
  if (start === -1) return '';
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[index] ?? '')) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

// Slice a step from the line that carries the marker to the next `- ` step.
function stepBlocks(workflow: string, marker: string): string[] {
  const lines = workflow.split(/\r?\n/);
  return lines.flatMap((line, start) => {
    if (!line.includes(marker)) return [];
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      if (/^\s*-\s/.test(lines[index] ?? '')) {
        end = index;
        break;
      }
    }
    return [lines.slice(start, end).join('\n')];
  });
}

describe('action pins', () => {
  it('pins every action to a 40-hex commit with a version comment', () => {
    const uses = [...actionUses(ci), ...actionUses(release)];
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.filter((line) => !isPinnedUse(line))).toEqual([]);
  });

  it('rejects a mutable major tag and a pin without a comment', () => {
    expect(isPinnedUse('      - uses: actions/checkout@v7')).toBe(false);
    expect(
      isPinnedUse(
        '      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
      ),
    ).toBe(false);
    expect(
      isPinnedUse(
        '      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1',
      ),
    ).toBe(true);
  });
});

describe('checkout credentials', () => {
  it('disables persisted credentials on every checkout', () => {
    const checkouts = [
      ...stepBlocks(ci, 'actions/checkout'),
      ...stepBlocks(release, 'actions/checkout'),
    ];
    expect(checkouts.length).toBeGreaterThan(0);
    expect(
      checkouts.filter(
        (block) => !block.includes('persist-credentials: false'),
      ),
    ).toEqual([]);
  });
});

describe('release artifact', () => {
  it('resolves one version in the package job and stages the packed tarball', () => {
    const releasePackage = jobBlock(release, 'package');
    const publish = jobBlock(release, 'publish');
    expect(releasePackage).not.toBe('');
    expect(publish).not.toBe('');
    expect(releasePackage).toContain('TOLKIRA_VERSION');
    expect(releasePackage).toContain(
      `echo "TOLKIRA_VERSION=$(node -p "require('./package.json').version")" >> "$GITHUB_ENV"`,
    );
    expect(publish).toContain('tolkira-$TOLKIRA_VERSION.tgz');
    expect(release).not.toMatch(/npm stage publish \./);
  });

  it('pins npm 12.2.3 in the CI package and release publish jobs', () => {
    const ciPackage = jobBlock(ci, 'package');
    const releasePublish = jobBlock(release, 'publish');
    expect(ciPackage).not.toBe('');
    expect(releasePublish).not.toBe('');
    for (const block of [ciPackage, releasePublish]) {
      expect(block).toMatch(
        /npm\s+(?:install|i)\s+(?:--global|-g)\s+npm@12\.2\.3\b/,
      );
    }
    expect(ci).not.toContain('npm@latest');
    expect(release).not.toContain('npm@latest');
  });

  it('verifies dependency signatures and uploads a CycloneDX SBOM', () => {
    const releasePackage = jobBlock(release, 'package');
    expect(releasePackage).toContain('npm audit signatures');
    expect(releasePackage).toContain('npm sbom --sbom-format cyclonedx');
    expect(releasePackage).toContain('--package-lock-only');
    expect(releasePackage).toContain('tolkira-sbom.cdx.json');
    const uploads = stepBlocks(releasePackage, 'actions/upload-artifact');
    expect(uploads.length).toBeGreaterThan(0);
    const sbom = uploads.find((block) => block.includes('name: tolkira-sbom'));
    expect(sbom, 'sbom upload step').toBeDefined();
    expect(sbom).toContain('path: /tmp/pack/tolkira-sbom.cdx.json');
    expect(sbom).toContain('if-no-files-found: error');

    const publish = jobBlock(release, 'publish');
    expect(publish).not.toContain('npm audit signatures');
    expect(publish).not.toContain('npm sbom');
  });
});

describe('npm token isolation', () => {
  it('maps NPM_TOKEN once and only in the release publish job', () => {
    const workflowDir = path.join(repoRoot, '.github', 'workflows');
    const occurrences = readdirSync(workflowDir)
      .filter((name) => /\.ya?ml$/.test(name))
      .flatMap((name) =>
        readText(path.join('.github', 'workflows', name))
          .split('NPM_TOKEN')
          .slice(1),
      );

    expect(occurrences).toHaveLength(1);
    const publish = jobBlock(release, 'publish');
    expect(publish).toContain('secrets.NPM_TOKEN');
    expect(jobBlock(release, 'package')).not.toContain('NPM_TOKEN');
  });
});

describe('workflow lint job', () => {
  it('runs actionlint and zizmor in CI', () => {
    const block = jobBlock(ci, 'workflows');
    expect(block).not.toBe('');
    expect(block).toContain('actionlint_1.7.12_linux_amd64.tar.gz');
    expect(block).toContain(
      '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8',
    );
    expect(block).toContain('sha256sum -c -');
    expect(block).toContain('zizmor==1.33.1');
    expect(block).toContain('--offline');
    expect(block).toContain('--persona=regular');
  });
});

describe('dependabot', () => {
  it('waits seven days before opening an update for both entries', () => {
    expect(dependabot).toContain('package-ecosystem: npm');
    expect(dependabot).toContain('package-ecosystem: github-actions');
    const entries = dependabot.split(/^ {2}- package-ecosystem:/m).slice(1);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry).toContain('cooldown:');
      expect(entry).toMatch(/default-days:\s*7\b/);
    }
  });
});

describe('release cache', () => {
  it('does not restore a package-manager cache in the release workflow', () => {
    const setups = stepBlocks(release, 'actions/setup-node');
    expect(setups.length).toBeGreaterThan(0);
    for (const block of setups) {
      expect(block).toContain('package-manager-cache: false');
    }
    expect(release).not.toMatch(/cache:\s*npm/);
  });
});

describe('CI pack directory', () => {
  it('hands the package job a stable pack directory', () => {
    const ciPackage = jobBlock(ci, 'package');
    expect(ciPackage).not.toBe('');
    expect(ciPackage).toContain('TOLKIRA_PACK_DIR');
    expect(ciPackage).toContain('/tmp/pack');
  });
});
