// Performance comparison: Tolkira vs established Cucumber HTML reporters.
// Run `npm run build` first. Competitors install into a temp workdir, never the repo.
// Usage: node scripts/bench-compare.mjs [--sizes=123,2000,5000] [--runs=5]
//        [--warmup=1] [--workdir=<dir>] [--out=<results.json>] [--skip-browser]
//        [--only=tolkira-messages,tolkira-legacy,ochf,chr,mchr]
// Inputs are generated deterministically by this file; no network during runs.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const VERSIONS = {
  '@cucumber/html-formatter': '24.4.0',
  'cucumber-html-reporter': '7.2.0',
  'multiple-cucumber-html-reporter': '4.7.0',
};
const DEFAULT_WORKDIR = path.join(os.tmpdir(), 'opencode', 'tolkira-bench');
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sizes = [123, 2000, 5000];

function parseArgv(argv) {
  const out = {};
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (!match) throw new Error(`Unknown argument: ${arg}`);
    out[match[1]] = match[2] ?? true;
  }
  return out;
}

const cli = parseArgv(process.argv.slice(2));
if (cli.sizes) sizes.splice(0, sizes.length, ...String(cli.sizes).split(',').map(Number));
const RUNS = Number(cli.runs ?? 5);
const WARMUPS = Number(cli.warmup ?? 1);
const WORKDIR = path.resolve(cli.workdir ?? DEFAULT_WORKDIR);
const OUT = path.join(WORKDIR, 'out');
const FIXTURES = path.join(WORKDIR, 'fixtures');
const RUNNERS = path.join(WORKDIR, 'runners');
const RESULTS = cli.out ? path.resolve(cli.out) : null;

function scenarioStatus(index) {
  const mod = index % 20;
  if (mod < 16) return 'passed';
  if (mod < 18) return 'failed';
  if (mod === 18) return 'skipped';
  return 'undefined';
}

function stepStatus(scenario, stepIndex) {
  if (scenario === 'passed') return 'passed';
  if (scenario === 'failed') return stepIndex === 0 ? 'passed' : stepIndex === 1 ? 'failed' : 'skipped';
  if (scenario === 'undefined') return stepIndex === 0 ? 'undefined' : 'skipped';
  return 'skipped';
}

function featureCount(n) {
  return Math.ceil(n / 10);
}

function scenarioSpec(index) {
  const status = scenarioStatus(index);
  const name = `Scenario ${String(index + 1).padStart(4, '0')} checks order ${index + 1}`;
  const tags = [index % 3 === 0 ? '@smoke' : '@regression'];
  if (index % 25 === 0) tags.push('@attached');
  const attached = index % 25 === 0 && (status === 'passed' || status === 'failed');
  return { index, status, name, tags, attached };
}

function featureSpec(featureIndex, total) {
  const first = featureIndex * 10;
  const count = Math.min(10, total - first);
  return {
    index: featureIndex,
    name: `Feature ${String(featureIndex + 1).padStart(3, '0')} order handling`,
    tags: ['@feature', `@area-${featureIndex % 5}`],
    scenarios: Array.from({ length: count }, (_, offset) => scenarioSpec(first + offset)),
  };
}

function gherkinSource(feature) {
  const lines = [`@feature @area-${feature.index % 5}`, `Feature: ${feature.name}`, ''];
  for (const scenario of feature.scenarios) {
    lines.push(`  ${scenario.tags.join(' ')}`, `  Scenario: ${scenario.name}`);
    const keywords = ['Given ', 'When ', 'Then '];
    for (let step = 0; step < 3; step += 1) {
      lines.push(`    ${keywords[step]}the ${['setup', 'action', 'check'][step]} for order ${scenario.index + 1} works`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function resultStatus(status) {
  return status.toUpperCase();
}

function nanos(index, step) {
  return { seconds: 1793631530 + Math.floor(index / 100), nanos: ((index * 3 + step) % 1000) * 1_000_000 };
}

function generateMessages(total) {
  const lines = [];
  const featureTotal = featureCount(total);
  lines.push(JSON.stringify({
    meta: {
      protocolVersion: '27.0.2',
      implementation: { name: 'bench-compare', version: '1.0.0' },
      cpu: { name: os.arch() },
      os: { name: os.platform(), version: os.release() },
      runtime: { name: 'node.js', version: process.version },
    },
  }));
  for (let f = 0; f < featureTotal; f += 1) {
    const feature = featureSpec(f, total);
    const uri = `features/feature-${String(f + 1).padStart(3, '0')}.feature`;
    lines.push(JSON.stringify({ source: { data: gherkinSource(feature), uri, mediaType: 'text/x.cucumber.gherkin+plain' } }));
    let line = 1;
    const children = feature.scenarios.map((scenario) => {
      const scenarioLine = line + 2;
      const steps = [0, 1, 2].map((step) => ({
        id: `st-${scenario.index + 1}-${step + 1}`,
        location: { line: scenarioLine + 1 + step, column: 5 },
        keyword: ['Given ', 'When ', 'Then '][step],
        keywordType: ['Context', 'Action', 'Outcome'][step],
        text: `the ${['setup', 'action', 'check'][step]} for order ${scenario.index + 1} works`,
      }));
      line = scenarioLine + 4;
      return {
        scenario: {
          id: `s-${scenario.index + 1}`,
          tags: scenario.tags.map((name, tagIndex) => ({
            id: `t-${scenario.index + 1}-${tagIndex}`,
            name,
            location: { line: scenarioLine - 1, column: 3 },
          })),
          location: { line: scenarioLine, column: 3 },
          keyword: 'Scenario',
          name: scenario.name,
          description: '',
          steps,
          examples: [],
        },
      };
    });
    lines.push(JSON.stringify({
      gherkinDocument: {
        feature: {
          tags: feature.tags.map((name, tagIndex) => ({ id: `ft-${f + 1}-${tagIndex}`, name, location: { line: 1, column: 1 } })),
          location: { line: 2, column: 1 },
          language: 'en',
          keyword: 'Feature',
          name: feature.name,
          description: '',
          children,
        },
        comments: [],
        uri,
      },
    }));
    for (const scenario of feature.scenarios) {
      lines.push(JSON.stringify({
        pickle: {
          id: `p-${scenario.index + 1}`,
          uri,
          astNodeIds: [`s-${scenario.index + 1}`],
          tags: scenario.tags.map((name, tagIndex) => ({ name, astNodeId: `t-${scenario.index + 1}-${tagIndex}` })),
          name: scenario.name,
          language: 'en',
          steps: [0, 1, 2].map((step) => ({
            id: `ps-${scenario.index + 1}-${step + 1}`,
            text: `the ${['setup', 'action', 'check'][step]} for order ${scenario.index + 1} works`,
            type: ['Context', 'Action', 'Outcome'][step],
            astNodeIds: [`st-${scenario.index + 1}-${step + 1}`],
          })),
        },
      }));
    }
  }
  lines.push(JSON.stringify({ testRunStarted: { id: 'run-1', timestamp: { seconds: 1793631530, nanos: 0 } } }));
  let attachments = 0;
  for (let i = 0; i < total; i += 1) {
    const scenario = scenarioSpec(i);
    const status = scenario.status;
    const testCaseId = `tc-${i + 1}`;
    const startedId = `tcs-${i + 1}`;
    lines.push(JSON.stringify({
      testCase: {
        testRunStartedId: 'run-1',
        pickleId: `p-${i + 1}`,
        id: testCaseId,
        testSteps: [0, 1, 2].map((step) => {
          const stepStatusName = stepStatus(status, step);
          const testStep = {
            id: `tst-${i + 1}-${step + 1}`,
            pickleStepId: `ps-${i + 1}-${step + 1}`,
            stepMatchArgumentsLists: [{ stepMatchArguments: [] }],
          };
          if (stepStatusName !== 'undefined') testStep.stepDefinitionIds = ['sd-1'];
          return testStep;
        }),
      },
    }));
    lines.push(JSON.stringify({
      testCaseStarted: { attempt: 0, testCaseId, id: startedId, timestamp: nanos(i, 0) },
    }));
    for (let step = 0; step < 3; step += 1) {
      const stepStatusName = stepStatus(status, step);
      lines.push(JSON.stringify({
        testStepStarted: { testCaseStartedId: startedId, testStepId: `tst-${i + 1}-${step + 1}`, timestamp: nanos(i, step) },
      }));
      if (scenario.attached && step === 0) {
        attachments += 1;
        lines.push(JSON.stringify({
          attachment: {
            body: TINY_PNG,
            contentEncoding: 'BASE64',
            mediaType: 'image/png',
            testCaseStartedId: startedId,
            testStepId: `tst-${i + 1}-${step + 1}`,
            fileName: `shot-${String(i + 1).padStart(4, '0')}.png`,
          },
        }));
      }
      const testStepResult = { duration: { seconds: 0, nanos: 1_000_000 + (i % 50) * 1_000_000 }, status: resultStatus(stepStatusName) };
      if (stepStatusName === 'failed') {
        testStepResult.message = `Expected order ${i + 1} to be accepted`;
        testStepResult.exception = { type: 'AssertionError', message: testStepResult.message };
      }
      lines.push(JSON.stringify({
        testStepFinished: {
          testCaseStartedId: startedId,
          testStepId: `tst-${i + 1}-${step + 1}`,
          testStepResult,
          timestamp: nanos(i, step + 1),
        },
      }));
    }
    lines.push(JSON.stringify({
      testCaseFinished: { testCaseStartedId: startedId, timestamp: nanos(i, 4), willBeRetried: false },
    }));
  }
  lines.push(JSON.stringify({
    testRunFinished: { testRunStartedId: 'run-1', timestamp: nanos(total, 5), success: false },
  }));
  return { text: `${lines.join('\n')}\n`, attachments };
}

function generateLegacy(total) {
  const features = [];
  let attachments = 0;
  for (let f = 0; f < featureCount(total); f += 1) {
    const feature = featureSpec(f, total);
    const elements = feature.scenarios.map((scenario) => {
      const attached = scenario.attached;
      const steps = [0, 1, 2].map((step) => {
        const status = stepStatus(scenario.status, step);
        const result = { status, duration: 1_000_000 + (scenario.index % 50) * 1_000_000 };
        if (status === 'failed') result.error_message = `Expected order ${scenario.index + 1} to be accepted`;
        const stepOut = {
          keyword: ['Given ', 'When ', 'Then '][step],
          name: `the ${['setup', 'action', 'check'][step]} for order ${scenario.index + 1} works`,
          line: 4 + (scenario.index % 10) * 4 + step,
          result,
          arguments: [],
        };
        if (status !== 'undefined') stepOut.match = { location: `features/steps.js:${10 + (scenario.index % 40)}` };
        if (attached && step === 0) {
          attachments += 1;
          stepOut.embeddings = [{ mime_type: 'image/png', data: TINY_PNG, name: `shot-${String(scenario.index + 1).padStart(4, '0')}.png` }];
        }
        return stepOut;
      });
      return {
        id: `feature-${f + 1};scenario-${scenario.index + 1}`,
        keyword: 'Scenario',
        type: 'scenario',
        name: scenario.name,
        description: '',
        line: 4 + (scenario.index % 10) * 4,
        tags: scenario.tags.map((name) => ({ name, line: 3 })),
        steps,
      };
    });
    features.push({
      uri: `features/feature-${String(f + 1).padStart(3, '0')}.feature`,
      id: `feature-${f + 1}`,
      keyword: 'Feature',
      name: feature.name,
      description: '',
      line: 2,
      tags: feature.tags.map((name) => ({ name, line: 1 })),
      elements,
    });
  }
  return { text: `${JSON.stringify(features, null, 2)}\n`, attachments };
}

async function ensureFixtures(total) {
  const dir = path.join(FIXTURES, String(total));
  const legacyDir = path.join(dir, 'legacy');
  await mkdir(legacyDir, { recursive: true });
  const messages = generateMessages(total);
  const legacy = generateLegacy(total);
  const messagesFile = path.join(dir, 'messages.ndjson');
  const legacyFile = path.join(legacyDir, 'legacy.json');
  await writeFile(messagesFile, messages.text);
  await writeFile(legacyFile, legacy.text);
  return {
    total,
    messagesFile,
    legacyFile,
    legacyDir,
    messagesBytes: Buffer.byteLength(messages.text),
    legacyBytes: Buffer.byteLength(legacy.text),
    attachments: messages.attachments,
    sha256: {
      messages: createHash('sha256').update(messages.text).digest('hex'),
      legacy: createHash('sha256').update(legacy.text).digest('hex'),
    },
  };
}

async function ensureCompetitors() {
  const specs = Object.entries(VERSIONS).map(([name, version]) => `${name}@${version}`);
  const missing = [];
  for (const [name, version] of Object.entries(VERSIONS)) {
    try {
      const installed = JSON.parse(await readFile(path.join(WORKDIR, 'node_modules', name, 'package.json'), 'utf8'));
      if (installed.version !== version) missing.push(name);
    } catch {
      missing.push(name);
    }
  }
  if (missing.length === 0) return;
  console.error(`Installing competitors into ${WORKDIR} (network, before any measurement)`);
  await new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['install', '--prefix', WORKDIR, '--no-audit', '--no-fund', '--no-package-lock', ...specs],
      { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`npm install exited ${code}`))));
  });
}

function winQuote(value) {
  if (!/[\s"]/.test(value)) return value;
  return `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`;
}

const PS_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  '$psi=New-Object System.Diagnostics.ProcessStartInfo',
  '$psi.FileName=$env:BENCH_FILE',
  '$psi.Arguments=$env:BENCH_ARGS_CMD',
  '$psi.WorkingDirectory=$env:BENCH_CWD',
  '$psi.UseShellExecute=$false',
  '$psi.RedirectStandardOutput=$true',
  '$psi.RedirectStandardError=$true',
  '$p=New-Object System.Diagnostics.Process',
  '$p.StartInfo=$psi',
  '$sw=[Diagnostics.Stopwatch]::StartNew()',
  '[void]$p.Start()',
  '$oTask=$p.StandardOutput.ReadToEndAsync()',
  '$eTask=$p.StandardError.ReadToEndAsync()',
  '$peak=0',
  'while(-not $p.HasExited){try{$p.Refresh();$m=$p.PeakWorkingSet64;if($m -gt $peak){$peak=$m}}catch{};Start-Sleep -Milliseconds 20}',
  '$p.WaitForExit()',
  '$sw.Stop()',
  '$o=$oTask.GetAwaiter().GetResult()',
  '$e=$eTask.GetAwaiter().GetResult()',
  '@{wallMs=[math]::Round($sw.Elapsed.TotalMilliseconds,1);peakRss=[int64]$peak;exitCode=$p.ExitCode;stdout=$o;stderr=$e}|ConvertTo-Json -Compress',
].join(';');

function measureProcess(file, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT], {
      cwd: ROOT,
      env: { ...process.env, BENCH_FILE: file, BENCH_ARGS_CMD: args.map(winQuote).join(' '), BENCH_CWD: cwd },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => {
      const line = stdout.split(/\r?\n/).find((item) => item.startsWith('{'));
      if (!line) return reject(new Error(`Measurement wrapper failed (${code}): ${stderr || stdout}`));
      try { resolve(JSON.parse(line)); } catch (error) { reject(error); }
    });
  });
}

async function writeRunners() {
  await mkdir(RUNNERS, { recursive: true });
  const pkg = (name) => pathToFileURL(path.join(WORKDIR, 'node_modules', name)).href;
  const files = {
    'formatter.mjs': `
import { createReadStream, createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { CucumberHtmlStream } from '${pkg('@cucumber/html-formatter')}/dist/src/index.js';
const [input, output] = process.argv.slice(2);
const stream = new CucumberHtmlStream();
const outputStream = createWriteStream(output);
stream.pipe(outputStream);
for await (const line of createInterface({ input: createReadStream(input), crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  if (!stream.write(JSON.parse(line))) await once(stream, 'drain');
}
stream.end();
await once(outputStream, 'finish');
`,
    'reporter.cjs': `
const reporter = require(${JSON.stringify(fileURLToPath(pkg('cucumber-html-reporter')))});
const [input, output] = process.argv.slice(2);
reporter.generate({ jsonFile: input, output, theme: 'bootstrap', reportSuiteAsScenarios: false, launchReport: false,
  metadata: { 'Benchmark': 'identical fixture' } }, (error) => {
  if (error) { console.error(error); process.exit(1); }
});
`,
    'multiple.mjs': `
import { generate } from '${pkg('multiple-cucumber-html-reporter')}/dist/generate-report.js';
const [jsonDir, reportPath] = process.argv.slice(2);
await generate({ jsonDir, reportPath, reportName: 'Benchmark', openReportInBrowser: false, logging: 'silent' });
`,
  };
  for (const [name, body] of Object.entries(files)) await writeFile(path.join(RUNNERS, name), body);
}

function toolDefinitions() {
  const node = process.execPath;
  return [
    {
      key: 'tolkira-messages',
      label: 'Tolkira 0.6.0 (Messages)',
      format: 'messages',
      entry: 'report.html',
      command: (input, out) => ({ file: node, args: [path.join(ROOT, 'dist', 'cli.js'), input.messagesFile, '--out', path.join(out, 'report.html')] }),
    },
    {
      key: 'tolkira-legacy',
      label: 'Tolkira 0.6.0 (legacy JSON)',
      format: 'legacy',
      entry: 'report.html',
      command: (input, out) => ({ file: node, args: [path.join(ROOT, 'dist', 'cli.js'), input.legacyFile, '--out', path.join(out, 'report.html')] }),
    },
    {
      key: 'ochf',
      label: '@cucumber/html-formatter 24.4.0',
      format: 'messages',
      entry: 'report.html',
      command: (input, out) => ({ file: node, args: [path.join(RUNNERS, 'formatter.mjs'), input.messagesFile, path.join(out, 'report.html')] }),
    },
    {
      key: 'chr',
      label: 'cucumber-html-reporter 7.2.0',
      format: 'legacy',
      entry: 'report.html',
      command: (input, out) => ({ file: node, args: [path.join(RUNNERS, 'reporter.cjs'), input.legacyFile, path.join(out, 'report.html')] }),
    },
    {
      key: 'mchr',
      label: 'multiple-cucumber-html-reporter 4.7.0',
      format: 'legacy',
      entry: 'index.html',
      command: (input, out) => ({ file: node, args: [path.join(RUNNERS, 'multiple.mjs'), input.legacyDir, out] }),
    },
  ];
}

async function walk(dir) {
  let total = 0;
  let files = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walk(full);
      total += nested.total;
      files += nested.files;
    } else if (entry.isFile()) {
      total += (await stat(full)).size;
      files += 1;
    }
  }
  return { total, files };
}

async function outputBytes(dir, entry) {
  const info = await stat(dir);
  const result = info.isDirectory() ? await walk(dir) : { total: info.size, files: 1 };
  return { ...result, entryBytes: (await stat(path.join(dir, entry))).size };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function range(values) {
  return { median: median(values), min: Math.min(...values), max: Math.max(...values) };
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function serve(root) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      let file = path.join(root, decodeURIComponent(url.pathname));
      if (!path.resolve(file).startsWith(path.resolve(root))) throw new Error('outside root');
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function measurePage(browser, url, runs, warmups) {
  const samples = [];
  let externalRequests = 0;
  for (let run = 0; run < warmups + runs; run += 1) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('**/*', (route) => {
      const target = new URL(route.request().url());
      if (target.hostname === '127.0.0.1' || target.hostname === 'localhost') return route.continue();
      externalRequests += 1;
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 180000 });
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      const resources = performance.getEntriesByType('resource');
      return {
        fcp: fcp ? fcp.startTime : null,
        domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
        load: nav ? nav.loadEventEnd : null,
        heap: performance.memory ? performance.memory.usedJSHeapSize : null,
        requests: 1 + resources.length,
        transferBytes: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
        nodes: document.getElementsByTagName('*').length,
      };
    });
    await context.close();
    if (run >= warmups) samples.push(metrics);
  }
  return { samples, externalRequests };
}

function summarizePage({ samples, externalRequests }) {
  return {
    externalRequests,
    fcp: range(samples.map((item) => item.fcp)),
    domContentLoaded: range(samples.map((item) => item.domContentLoaded)),
    load: range(samples.map((item) => item.load)),
    heap: range(samples.map((item) => item.heap)),
    requests: median(samples.map((item) => item.requests)),
    transferBytes: median(samples.map((item) => item.transferBytes)),
    nodes: median(samples.map((item) => item.nodes)),
    samples,
  };
}

async function largestFeaturePage(entry) {
  const dir = path.join(path.dirname(entry), 'features');
  let best = null;
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.html')) continue;
    const file = path.join(dir, name);
    const size = (await stat(file)).size;
    if (!best || size > best.size) best = { file, size };
  }
  return best?.file;
}

async function main() {
  await mkdir(WORKDIR, { recursive: true });
  await mkdir(OUT, { recursive: true });
  await ensureCompetitors();
  await writeRunners();
  const fixtures = [];
  for (const size of sizes) fixtures.push(await ensureFixtures(size));
  const tools = toolDefinitions().filter((tool) => !cli.only || String(cli.only).split(',').includes(tool.key));

  const generation = {};
  for (const input of fixtures) {
    generation[input.total] = {};
    const states = tools.map((tool) => {
      const outDir = path.join(OUT, `${tool.key}-${input.total}`);
      return {
        tool,
        outDir,
        runs: [],
        error: null,
        clean: () => rm(outDir, { recursive: true, force: true }),
        execute: async () => {
          await mkdir(outDir, { recursive: true });
          const { file, args } = tool.command(input, outDir);
          const measured = await measureProcess(file, args, ROOT);
          if (measured.exitCode !== 0) throw new Error(`${tool.key} exited ${measured.exitCode}: ${(measured.stderr || measured.stdout).slice(0, 500)}`);
          return { wallMs: measured.wallMs, peakRss: measured.peakRss, exitCode: measured.exitCode, bytes: await outputBytes(outDir, tool.entry) };
        },
      };
    });
    for (const state of states) {
      try { await state.clean(); await state.execute(); } catch (error) { state.error = String(error); }
    }
    // Rotate the tool order per round so host drift does not favour one entry point.
    for (let round = 0; round < RUNS; round += 1) {
      for (let k = 0; k < states.length; k += 1) {
        const state = states[(k + round) % states.length];
        if (state.error) continue;
        try { await state.clean(); state.runs.push(await state.execute()); } catch (error) { state.error = String(error); }
      }
    }
    for (const state of states) {
      const { tool } = state;
      if (state.error || state.runs.length === 0) {
        generation[input.total][tool.key] = { label: tool.label, format: tool.format, error: state.error ?? 'no successful runs' };
        console.error(`${input.total} ${tool.key}: FAILED ${state.error}`);
        continue;
      }
      const runs = state.runs;
      const last = runs.at(-1);
      generation[input.total][tool.key] = {
        label: tool.label,
        format: tool.format,
        entry: path.join(state.outDir, tool.entry),
        runs,
        wallMs: range(runs.map((item) => item.wallMs)),
        peakRss: range(runs.map((item) => item.peakRss)),
        outputBytes: range(runs.map((item) => item.bytes.total)),
        entryBytes: range(runs.map((item) => item.bytes.entryBytes)),
        files: last.bytes.files,
      };
      console.error(`${input.total} ${tool.key}: ${median(runs.map((item) => item.wallMs))} ms, ${last.bytes.total} B`);
    }
  }

  let browser = null;
  let server = null;
  const lcp = {};
  if (!cli['skip-browser']) {
    server = await serve(OUT);
    browser = await chromium.launch({
      headless: true,
      args: ['--enable-precise-memory-info', '--disable-background-networking', '--disable-component-update', '--no-default-browser-check'],
    });
    const chromiumVersion = browser.version();
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [size, toolResults] of Object.entries(generation)) {
      lcp[size] = {};
      for (const [key, result] of Object.entries(toolResults)) {
        if (result.error) continue;
        const urlFor = (file) => `${base}/${path.relative(OUT, file).split(path.sep).join('/')}`;
        try {
          lcp[size][key] = summarizePage(await measurePage(browser, urlFor(result.entry), RUNS, WARMUPS));
          // The MCHR entry is an overview; its scenario content lives on feature pages.
          if (key === 'mchr') {
            try {
              const deep = await largestFeaturePage(result.entry);
              if (deep) lcp[size][key].deep = { file: path.basename(deep), ...summarizePage(await measurePage(browser, urlFor(deep), RUNS, WARMUPS)) };
            } catch (error) {
              lcp[size][key].deep = { error: String(error) };
            }
          }
          console.error(`${size} ${key}: FCP ${lcp[size][key].fcp.median} ms, load ${lcp[size][key].load.median} ms`);
        } catch (error) {
          lcp[size][key] = { error: String(error) };
          console.error(`${size} ${key}: browser FAILED ${error}`);
        }
      }
    }
    await browser.close();
    server.close();
    lcp.chromium = chromiumVersion;
  }

  const npmVersion = await new Promise((resolve) => {
    const child = process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', 'npm --version'], { windowsHide: true })
      : spawn('npm', ['--version']);
    let text = '';
    child.stdout.on('data', (chunk) => { text += chunk; });
    child.on('close', () => resolve(text.trim()));
    child.on('error', () => resolve(null));
  });
  const software = {
    node: process.version,
    npm: npmVersion,
    os: `${os.version()} ${os.release()}`,
    platform: `${os.platform()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model,
    cores: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    chromium: lcp.chromium ?? null,
    tools: {
      tolkira: JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8')).version,
      ...Object.fromEntries(await Promise.all(Object.keys(VERSIONS).map(async (name) => [
        name, JSON.parse(await readFile(path.join(WORKDIR, 'node_modules', name, 'package.json'), 'utf8')).version,
      ]))),
    },
  };
  const report = { generatedAt: new Date().toISOString(), host: os.hostname(), protocol: { runs: RUNS, warmups: WARMUPS, viewport: [1440, 900], server: '127.0.0.1 static, Cache-Control: no-store, fresh browser context per load' }, software, fixtures, generation, browser: lcp };
  if (RESULTS) await writeFile(RESULTS, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
