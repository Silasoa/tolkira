#!/usr/bin/env node
// Repository hygiene gate. Only tracked files and reachable commits are read;
// values that may be sensitive (local paths, trailers) are reported by category,
// never echoed.
import { execFileSync, spawnSync } from 'node:child_process';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const files = git('ls-files', '-z').split('\0').filter(Boolean);
const findings = [];

function report(file, line, rule) {
  findings.push(line ? `${file}:${line}  ${rule}` : `${file}  ${rule}`);
}

// Generated, local or secret-bearing files must never be tracked. Keep this list
// high-signal: test fixtures are legitimate content, generated output is not.
const forbidden = [
  [/(^|\/)model\.diff$/, 'local model diff'],
  [/\.official\.html$/i, 'generated official formatter output'],
  [
    /^(test-results|playwright-report|blob-report|coverage|dist|node_modules)\//,
    'generated or installed directory',
  ],
  [
    (f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example'),
    'environment file (use .env.example)',
  ],
  [/(^|\/)\.npmrc$/, 'npm config may contain a token'],
  [/\.(pem|key|p12|pfx|jks|keystore)$/i, 'key material'],
  [/(^|\/)(id_rsa|id_ed25519)$/, 'private key'],
  [/\.(tgz|tsbuildinfo)$/i, 'generated artifact'],
  [/(^|\/)(\.DS_Store|Thumbs\.db)$/i, 'OS metadata'],
];

for (const file of files) {
  for (const [pattern, rule] of forbidden) {
    const hit = typeof pattern === 'function' ? pattern(file) : pattern.test(file);
    if (hit) report(file, 0, rule);
  }
}

// Absolute home paths leak machine and user names. Fixtures may legitimately
// contain producer paths, so they are excluded. Placeholders such as
// C:\Users\<user>\... are fine: a named user plus another separator is required.
const localPath =
  "[A-Za-z]:\\\\Users\\\\[A-Za-z0-9._-]+\\\\|[A-Za-z]:/Users/[A-Za-z0-9._-]+/|(^|[[:space:](\"'`])/(Users|home)/[A-Za-z0-9._-]+/";
const grep = spawnSync(
  'git',
  [
    'grep',
    '-n',
    '-I',
    '-E',
    localPath,
    '--',
    '*.md',
    '*.mdx',
    '*.txt',
    ':(exclude)test/fixtures/**',
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

if (grep.status === 0) {
  for (const line of grep.stdout.split('\n')) {
    const match = /^(.*?):(\d+):/.exec(line);
    if (match) report(match[1], Number(match[2]), 'absolute local path (use a relative path or placeholder)');
  }
} else if (grep.status !== 1) {
  console.error(grep.stderr || 'hygiene: git grep failed');
  process.exit(2);
}

// One commit must not carry a Co-authored-by trailer: the usual tool address
// belongs to an unrelated GitHub user. HYGIENE_COMMIT_RANGE limits the scan.
const range = process.env.HYGIENE_COMMIT_RANGE;
const logArgs = ['log', '--format=%H%x1f%B%x1e'];
if (range) logArgs.push(range);
const records = git(...logArgs)
  .split('\x1e')
  .map((record) => record.trim())
  .filter(Boolean);
let commits = 0;

for (const record of records) {
  const [hashLine, ...body] = record.split('\x1f');
  if (!hashLine) continue;
  commits += 1;
  if (/^co-authored-by\s*:/im.test(body.join('\x1f'))) {
    report(`commit ${hashLine.slice(0, 12)}`, 0, 'Co-authored-by trailer is not allowed');
  }
}

console.log(`hygiene: checked ${files.length} tracked files and ${commits} commits`);
if (findings.length > 0) {
  console.error(`hygiene: ${findings.length} finding(s)`);
  for (const finding of findings) console.error(`  ${finding}`);
  console.error('hygiene: fix the finding; do not bypass the gate.');
  process.exit(1);
}
console.log('hygiene: ok');
