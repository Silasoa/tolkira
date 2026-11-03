import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const count = Number(process.argv[2] ?? 1000);

if (!Number.isInteger(count) || count < 1) {
  throw new Error('Usage: node scripts/stress.mjs [scenario-count]');
}

const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-stress-'));
const input = path.join(dir, 'stress.json');
const output = path.join(dir, 'stress.html');

const elements = Array.from({ length: count }, (_, index) => ({
  keyword: 'Scenario',
  type: 'scenario',
  name: `Stress scenario ${index + 1}`,
  steps: [
    {
      keyword: 'Given ',
      name: 'step one',
      result: { status: 'passed', duration: 1000 },
    },
    {
      keyword: 'When ',
      name: 'step two',
      result: { status: 'passed', duration: 2000 },
    },
    {
      keyword: 'Then ',
      name: 'step three',
      result: { status: 'passed', duration: 3000 },
    },
  ],
}));

try {
  await writeFile(
    input,
    `${JSON.stringify([{ uri: 'features/stress.feature', name: 'Stress feature', elements }])}\n`,
    'utf8',
  );

  const started = performance.now();
  const { stdout } = await run(
    process.execPath,
    ['dist/cli.js', input, '--out', output, '--json'],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const elapsedMs = Math.round(performance.now() - started);
  const summary = JSON.parse(stdout);
  const htmlBytes = (await stat(output)).size;
  const maxMs = count <= 1000 ? 1000 : 3000;
  const maxBytes = count <= 1000 ? 5 * 1024 * 1024 : 20 * 1024 * 1024;

  if (summary.counts.scenarios.total !== count) {
    throw new Error(`Expected ${count} scenarios, got ${summary.counts.scenarios.total}`);
  }
  if (summary.counts.steps.total !== count * 3) {
    throw new Error(`Expected ${count * 3} steps, got ${summary.counts.steps.total}`);
  }
  if (elapsedMs > maxMs) {
    throw new Error(`Stress run took ${elapsedMs} ms, above the ${maxMs} ms budget.`);
  }
  if (htmlBytes > maxBytes) {
    throw new Error(`Stress report is ${htmlBytes} bytes, above the ${maxBytes} byte budget.`);
  }

  console.log(
    JSON.stringify(
      {
        scenarios: count,
        steps: count * 3,
        elapsedMs,
        htmlBytes,
        htmlMb: Math.round((htmlBytes / 1024 / 1024) * 10) / 10,
        status: summary.status,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
