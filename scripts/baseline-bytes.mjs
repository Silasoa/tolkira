// Run `npm run build` first: this measures the built CLI.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os, { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const dir = await mkdtemp(path.join(tmpdir(), 'tolkira-baseline-bytes-'));
const title = 'Byte check';
const fixtures = [
  'test/fixtures/messages/examples-tables.ndjson',
  'test/fixtures/legacy/failed.json',
];

async function cli(args) {
  const { stdout } = await run(process.execPath, ['dist/cli.js', ...args], {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

function stripExamples(json) {
  const document = JSON.parse(json);
  for (const scenario of document.scenarios ?? []) delete scenario.example;
  return `${JSON.stringify(document, null, 2)}\n`;
}

const size = async (file) => (await stat(file)).size;
const bytes = (text) => Buffer.byteLength(text);

const results = [];
try {
  for (const fixture of fixtures) {
    const stem = path.basename(fixture).replace(/\W+/g, '-');
    const baselineFile = path.join(dir, `${stem}-baseline.json`);
    const baseline = JSON.parse(await cli([fixture, '--json']));
    // Flip one status and drop one row so the panel shows a badge and a list.
    const [first, ...rest] = baseline.scenarios;
    if (first) first.status = first.status === 'failed' ? 'passed' : 'failed';
    baseline.scenarios = rest;
    await writeFile(baselineFile, JSON.stringify(baseline, null, 2));

    const defaultJson = await cli([fixture, '--json']);
    const baselineJson = await cli([fixture, '--baseline', baselineFile, '--json']);
    const out = (name) => path.join(dir, `${stem}-${name}.html`);
    const plain = (name) => [fixture, '--out', out(name), '--title', title];
    const compared = (name) => [...plain(name), '--baseline', baselineFile];
    await cli(plain('default'));
    await cli(compared('baseline'));
    await cli([...plain('static'), '--static']);
    await cli([...compared('static-baseline'), '--static']);

    const defaultCi = await cli([fixture, '--ci', 'markdown']);
    const baselineCi = await cli([fixture, '--baseline', baselineFile, '--ci', 'markdown']);
    const stripped = stripExamples(defaultJson);
    const html = { default: await size(out('default')), baseline: await size(out('baseline')) };
    const staticHtml = await size(out('static'));
    const staticBaseline = await size(out('static-baseline'));
    results.push({
      fixture,
      html: { ...html, delta: html.baseline - html.default, static: staticHtml, staticBaseline, staticDelta: staticBaseline - staticHtml },
      json: { default: bytes(defaultJson), baseline: bytes(baselineJson), delta: bytes(baselineJson) - bytes(defaultJson), stripped: bytes(stripped), strippedSha256: createHash('sha256').update(stripped, 'utf8').digest('hex') },
      ci: { default: bytes(defaultCi), baseline: bytes(baselineCi), delta: bytes(baselineCi) - bytes(defaultCi) },
    });
  }
  console.log(JSON.stringify({ host: `${os.version()} ${os.release()}, Node ${process.version}`, date: new Date().toISOString(), title, note: 'Reports embed the generation date; compare byte deltas from this one run.', results }, null, 2));
} finally {
  await rm(dir, { recursive: true, force: true });
}
