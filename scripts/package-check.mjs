import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const requiredRootFiles = [
  'package.json',
  'README.md',
  'LICENSE',
  'llms.txt',
  'DESIGN.md',
  'SECURITY.md',
  'GLOSSARY.md',
];

const requiredEntryFiles = [
  'dist/index.js',
  'dist/index.d.ts',
  'dist/cli.js',
  'dist/compat/cucumber-html-reporter.js',
  'dist/compat/cucumber-html-reporter.cjs',
  'dist/compat/cucumber-html-reporter.d.ts',
  'dist/compat/cucumber-html-reporter.d.cts',
];

const forbiddenPrefixes = [
  'src/',
  'test/',
  'openspec/',
  'scripts/',
  'node_modules/',
  '.github/',
];

function relativePath(packedPath) {
  return packedPath.startsWith('package/')
    ? packedPath.slice('package/'.length)
    : packedPath;
}

// Directories such as "dist" are packed by their contents, not as one entry.
function listedFiles(packageJson) {
  return (packageJson.files ?? []).filter(
    (entry) => path.extname(entry) !== '',
  );
}

export function packEntries(packed) {
  const results = Array.isArray(packed) ? packed : Object.values(packed ?? {});
  return results.flatMap((entry) =>
    Array.isArray(entry?.files) ? entry.files.map((file) => file.path) : [],
  );
}

export function verifyPackList(paths, packageJson) {
  const present = new Set(paths.map((entry) => relativePath(entry)));
  const required = new Set([
    ...requiredRootFiles,
    ...listedFiles(packageJson),
    ...requiredEntryFiles,
  ]);
  const errors = [];
  for (const file of required) {
    if (!present.has(file)) {
      errors.push(`missing required path: ${file}`);
    }
  }
  for (const file of present) {
    const forbidden = forbiddenPrefixes.find((prefix) =>
      file.startsWith(prefix),
    );
    if (forbidden !== undefined) {
      errors.push(`forbidden path in tarball: ${file}`);
    }
  }
  return errors;
}

function npmInvocation(args) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath !== undefined && npmExecPath.length > 0) {
    return { command: process.execPath, args: [npmExecPath, ...args] };
  }
  if (process.platform === 'win32') {
    return { command: 'npm.cmd', args, shell: true };
  }
  return { command: 'npm', args };
}

function runNpmPack(packDir) {
  const { command, args, shell } = npmInvocation([
    'pack',
    '--json',
    '--pack-destination',
    packDir,
  ]);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm pack exited ${result.status}: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function packageBin(name, binary) {
  const manifest = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'node_modules', name, 'package.json'),
      'utf8',
    ),
  );
  const bin =
    typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[binary];
  if (bin === undefined) {
    throw new Error(`${name} declares no ${binary} binary`);
  }
  return path.join(repoRoot, 'node_modules', name, bin);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited ${result.status}`);
  }
}

function main() {
  const packageJson = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
  );
  const configuredDir = process.env.TOLKIRA_PACK_DIR;
  const packDir =
    configuredDir ?? mkdtempSync(path.join(os.tmpdir(), 'tolkira-pack-'));
  try {
    mkdirSync(packDir, { recursive: true });
    const packed = runNpmPack(packDir);
    const entries = packEntries(packed);
    const errors = verifyPackList(entries, packageJson);
    if (errors.length > 0) {
      for (const error of errors) console.error(error);
      process.exitCode = 1;
      return;
    }
    const [result] = Array.isArray(packed)
      ? packed
      : Object.values(packed ?? {});
    const tarball = path.join(packDir, result.filename);
    run(process.execPath, [
      packageBin('publint', 'publint'),
      'run',
      tarball,
      '--strict',
    ]);
    run(process.execPath, [
      packageBin('@arethetypeswrong/cli', 'attw'),
      tarball,
    ]);
    console.log(`${tarball} (${entries.length} entries)`);
  } finally {
    if (configuredDir === undefined) {
      rmSync(packDir, { recursive: true, force: true });
    }
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
