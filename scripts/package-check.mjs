import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const requiredDocsFiles = ['docs/README.md'];

const forbiddenPrefixes = [
  'src/',
  'test/',
  'openspec/',
  'scripts/',
  'node_modules/',
  '.github/',
];

const globCharacters = /[*?[\]{}!]/;

function relativePath(packedPath) {
  return packedPath.startsWith('package/')
    ? packedPath.slice('package/'.length)
    : packedPath;
}

// Globs allow their matches; an entry is a directory only when its contents
// are packed and it is not a known file (LICENSE is extensionless).
function classifyEntries(packageJson, present) {
  const knownFiles = new Set([
    ...requiredRootFiles,
    ...requiredDocsFiles,
    ...requiredEntryFiles,
  ]);
  const files = packageJson.files ?? [];
  const globs = files.filter((entry) => globCharacters.test(entry));
  const entries = files.filter(
    (entry) => !globCharacters.test(entry) && !entry.endsWith('/'),
  );
  const directories = entries.filter(
    (entry) =>
      !knownFiles.has(entry) &&
      !present.has(entry) &&
      [...present].some((file) => file.startsWith(`${entry}/`)),
  );
  const directorySet = new Set(directories);
  const literals = entries.filter((entry) => !directorySet.has(entry));
  return { globs, directories, literals, knownFiles };
}

export function packEntries(packed) {
  const results = Array.isArray(packed) ? packed : Object.values(packed ?? {});
  return results.flatMap((entry) =>
    Array.isArray(entry?.files) ? entry.files.map((file) => file.path) : [],
  );
}

export function verifyPackList(paths, packageJson) {
  const present = new Set();
  const errors = [];
  for (const entry of paths) {
    const relative = relativePath(entry);
    const normalized = path.posix.normalize(relative);
    if (
      path.posix.isAbsolute(relative) ||
      path.win32.isAbsolute(relative) ||
      relative.includes('\\') ||
      relative.split('/').includes('..')
    ) {
      errors.push(`unsafe path in tarball: ${entry}`);
      continue;
    }
    present.add(normalized);
  }
  const { globs, directories, literals, knownFiles } = classifyEntries(
    packageJson,
    present,
  );
  const required = new Set([
    ...requiredRootFiles,
    ...requiredDocsFiles,
    ...requiredEntryFiles,
    ...literals.filter(
      (entry) =>
        knownFiles.has(entry) ||
        present.has(entry) ||
        path.extname(entry) !== '',
    ),
  ]);
  const allowed = new Set([...required, ...literals]);
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
      continue;
    }
    const inAllowedDirectory = directories.some((directory) =>
      file.startsWith(`${directory}/`),
    );
    const matchesGlob = globs.some((glob) => path.matchesGlob(file, glob));
    if (!allowed.has(file) && !inAllowedDirectory && !matchesGlob) {
      errors.push(`unexpected path in tarball: ${file}`);
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
    throw new Error('Run this script through npm: npm run package:check');
  }
  return { command: 'npm', args };
}

function runNpmPack(packDir) {
  const { command, args } = npmInvocation([
    'pack',
    '--json',
    '--pack-destination',
    packDir,
  ]);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
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
    const results = Array.isArray(packed)
      ? packed
      : Object.values(packed ?? {});
    if (results.length !== 1) {
      throw new Error(
        `npm pack returned ${String(results.length)} results, expected one`,
      );
    }
    const entries = packEntries(packed);
    const errors = verifyPackList(entries, packageJson);
    if (errors.length > 0) {
      for (const error of errors) console.error(error);
      process.exitCode = 1;
      return;
    }
    const [result] = results;
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
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  main();
}
