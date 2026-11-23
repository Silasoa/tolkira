// Run `npm run build` first: this measures the built package and CLI.
import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os, { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  HISTORY_LIMIT_MAX,
  HISTORY_MAX_BYTES,
  appendHistory,
  buildHistoryRun,
  writeHistory,
} from '../dist/index.js';

const run = promisify(execFile);
const fixture = 'test/fixtures/messages/second.ndjson';
const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-history-window-'));

function counts(total, passed, failed, skipped) {
  return {
    total,
    passed,
    failed,
    skipped,
    pending: 0,
    undefined: 0,
    ambiguous: 0,
    unknown: 0,
  };
}

// Deterministic synthetic summaries; every seventh run fails.
function summaryFor(index) {
  const failed = index % 7 === 0;
  return {
    schemaVersion: 2,
    status: failed ? 'failed' : 'passed',
    durationMs: 60_000 + index,
    counts: {
      features: 3,
      scenarios: counts(120, failed ? 117 : 118, failed ? 1 : 0, 2),
      steps: counts(360, failed ? 351 : 352, failed ? 1 : 0, 8),
    },
    attachments: { total: 2, bytes: 4096 },
    scenarios: [],
  };
}

function buildHistory(title) {
  let history = [];
  for (let index = 0; index < HISTORY_LIMIT_MAX; index += 1) {
    const now = new Date(Date.UTC(2026, 0, 1, 0, index));
    history = appendHistory(
      history,
      buildHistoryRun(summaryFor(index), title, now),
      HISTORY_LIMIT_MAX,
    );
  }
  return history;
}

async function writeAndMeasure(name, history) {
  const file = path.join(dir, name);
  await writeHistory(file, history, HISTORY_LIMIT_MAX);
  const text = await readFile(file, 'utf8');
  const bytes = Buffer.byteLength(text, 'utf8');
  const stored = JSON.parse(text).runs.length;
  if (bytes > HISTORY_MAX_BYTES) {
    throw new Error(`${name} is ${bytes} bytes, above the ${HISTORY_MAX_BYTES} cap.`);
  }
  return { file, bytes, stored, pruned: stored < HISTORY_LIMIT_MAX };
}

async function reportBytes(name, history, limit) {
  const sidecar = path.join(dir, `${name}.json`);
  await copyFile(history, sidecar);
  const output = path.join(dir, `${name}.html`);
  const args = [
    'dist/cli.js',
    fixture,
    '--out',
    output,
    '--history',
    sidecar,
    ...(limit === undefined ? [] : ['--history-limit', String(limit)]),
  ];
  await run(process.execPath, args, { maxBuffer: 64 * 1024 * 1024 });
  return (await stat(output)).size;
}

try {
  const short = await writeAndMeasure('history-365.json', buildHistory('Nightly'));
  const titled = await writeAndMeasure(
    'history-365-title.json',
    buildHistory('T'.repeat(200)),
  );
  if (short.pruned || titled.pruned) {
    throw new Error('The writer pruned a 365-run sidecar below the window.');
  }

  const byDefault = await reportBytes('report-default', short.file);
  const atMax = await reportBytes('report-365', short.file, HISTORY_LIMIT_MAX);

  console.log(
    JSON.stringify(
      {
        host: `${os.version()} ${os.release()}, Node ${process.version}`,
        runs: HISTORY_LIMIT_MAX,
        reportBytes: {
          default: byDefault,
          atMax,
          delta: atMax - byDefault,
          maxSizeThreshold: 10 * 1024 * 1024,
        },
        sidecar: {
          bytes: short.bytes,
          cap: HISTORY_MAX_BYTES,
          pruned: short.pruned,
          title200Bytes: titled.bytes,
          title200Pruned: titled.pruned,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
