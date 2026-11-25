import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const USAGE = `Usage: node scripts/bench-ansi.mjs [--quick] [--budget-ms <n>] [--ratio-floor <n>]

Benchmark the production stripAnsi over fixed clean and escape-laden corpora.

  --quick            use the small corpus (default: full)
  --budget-ms <n>    production median budget in ms (default: 500)
  --ratio-floor <n>  fast-path keep/review threshold (default: 1.5)
  --help, -h         show this usage`;

class CliError extends Error {
  constructor(message, exitCode, showUsage = false) {
    super(message);
    this.exitCode = exitCode;
    this.showUsage = showUsage;
  }
}

function parseNumber(args, index, option) {
  const value = args[index + 1];
  const parsed = Number(value);
  if (
    value === undefined ||
    value.trim() === '' ||
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    throw new CliError(`${option} needs a non-negative number`, 2, true);
  }
  return parsed;
}

function parseArgs(args) {
  let quick = false;
  let budgetMs = 500;
  let ratioFloor = 1.5;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--quick') {
      quick = true;
    } else if (arg === '--help' || arg === '-h') {
      return { help: true };
    } else if (arg === '--budget-ms') {
      budgetMs = parseNumber(args, index, arg);
      index += 1;
    } else if (arg === '--ratio-floor') {
      ratioFloor = parseNumber(args, index, arg);
      index += 1;
    } else {
      throw new CliError(`unknown argument: ${JSON.stringify(arg)}`, 2, true);
    }
  }

  return { help: false, quick, budgetMs, ratioFloor };
}

async function loadProductionText() {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/text.ts', import.meta.url))],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    sourcemap: false,
    logLevel: 'silent',
  });
  const source = bundle.outputFiles?.[0]?.text;
  if (!source) throw new Error('esbuild produced no output for src/text.ts');

  const dataUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(dataUrl);
}

// Mirrors isControl in src/text.ts, which is not exported.
function isControl(code) {
  return (
    code === 0x7f ||
    (code >= 0x80 && code <= 0x9f) ||
    (code < 0x20 && code !== 0x09 && code !== 0x0a)
  );
}

function makeReferences({ scanEscape, isEscapeIntroducer }) {
  // Same loop as the production scan, without the no-escape early return.
  function stripAnsiScanOnly(text) {
    let output = '';
    let chunkStart = 0;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.codePointAt(index) ?? 0;
      const escape = isEscapeIntroducer(code);
      if (escape || isControl(code)) {
        if (index > chunkStart) output += text.slice(chunkStart, index);
        if (escape) index = scanEscape(text, index).end - 1;
        chunkStart = index + 1;
      }
    }
    return output + text.slice(chunkStart);
  }

  // Same scan, but appends visible characters one by one instead of slicing.
  function stripAnsiCharAppend(text) {
    let output = '';
    for (let index = 0; index < text.length; index += 1) {
      const code = text.codePointAt(index) ?? 0;
      if (isEscapeIntroducer(code)) {
        index = scanEscape(text, index).end - 1;
      } else if (!isControl(code)) {
        output += text[index];
      }
    }
    return output;
  }

  return { stripAnsiScanOnly, stripAnsiCharAppend };
}

const CLEAN_LINE =
  'Verified the checkout flow end to end; totals, taxes and receipts matched.\tstatus passed\n';
const ESCAPED_UNIT = [
  '\u001b[1;31m',
  'error text',
  '\u001b[0m',
  '\u001b]8;;https://example.test/report\u0007',
  'report link',
  '\u001b]8;;\u0007',
  '\u001b]52;c;SGVsbG8gd29ybGQ=\u0007',
  '\u001bP1;2|dcs payload\u001b\\',
  '\u001b_apc payload\u001b\\',
  '\u009b32m',
  'green text',
  '\u009b0m',
  '\u009d0;title\u0007',
  '\u001b(B',
  'designator',
  '\u0000',
  '\u0001',
  '\u0007',
  '\u007f',
  '\u0085',
  'visible text\n',
].join('');

const EDGE_CASES = [
  ['empty string', ''],
  ['one character', 'a'],
  ['control-only', '\u0000\u0001\u0007\u007f\u0085\u009b\u009d'],
  ['unterminated OSC', '\u001b]8;;https://example.test/unterminated'],
  ['unterminated DCS', '\u001bP1;2|unterminated'],
  ['unterminated APC', '\u001b_apc unterminated'],
  ['SGR', '\u001b[1;31mred\u001b[0m'],
  ['C1 CSI', '\u009b32mgreen\u009b0m'],
  ['C1 OSC', '\u009d0;title\u0007after'],
  ['two-byte designator', '\u001b(Btext'],
  ['newline and tab', 'line one\nline\ttwo'],
  ['trailing escape', 'text\u001b'],
];

function buildCorpora({ messages, bytesPerMessage }) {
  const clean = Array.from({ length: messages }, (_, index) => {
    let message = `scenario ${index + 1}: order ${1000 + index}\n`;
    while (message.length < bytesPerMessage) message += CLEAN_LINE;
    return message.slice(0, bytesPerMessage);
  });

  const escaped = Array.from({ length: messages }, (_, index) => {
    let message = `scenario ${index + 1}: order ${1000 + index}\t`;
    while (message.length < bytesPerMessage) message += ESCAPED_UNIT;
    return message;
  });

  return [
    { name: 'clean', messages: clean },
    { name: 'escaped', messages: escaped },
  ].map((corpus) => ({
    ...corpus,
    bytes: corpus.messages.reduce(
      (total, message) => total + Buffer.byteLength(message, 'utf8'),
      0,
    ),
  }));
}

function checkIdentical(stripAnsi, references, label, text) {
  const expected = stripAnsi(text);
  if (
    references.stripAnsiScanOnly(text) !== expected ||
    references.stripAnsiCharAppend(text) !== expected
  ) {
    throw new Error(
      `output mismatch between production and references: ${label}`,
    );
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// Kept alive so the stripped strings cannot be treated as unused work.
let sink = 0;

function timePass(strip, messages) {
  const started = performance.now();
  let total = 0;
  for (const message of messages) total += strip(message).length;
  sink += total;
  return performance.now() - started;
}

function measure(strip, messages, warmup, iterations) {
  for (let pass = 0; pass < warmup; pass += 1) timePass(strip, messages);
  const samples = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    samples.push(timePass(strip, messages));
  }
  return median(samples);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const { stripAnsi, scanEscape, isEscapeIntroducer } =
    await loadProductionText();
  const references = makeReferences({ scanEscape, isEscapeIntroducer });

  const { quick, budgetMs, ratioFloor } = options;
  const iterations = quick ? 5 : 9;
  const warmup = quick ? 1 : 2;
  const corpora = buildCorpora(
    quick
      ? { messages: 500, bytesPerMessage: 1024 }
      : { messages: 2000, bytesPerMessage: 2048 },
  );

  for (const corpus of corpora) {
    for (let index = 0; index < corpus.messages.length; index += 1) {
      checkIdentical(
        stripAnsi,
        references,
        `${corpus.name} message ${index + 1}`,
        corpus.messages[index],
      );
    }
  }
  for (const [label, text] of EDGE_CASES) {
    checkIdentical(stripAnsi, references, label, text);
  }

  // All production passes run before the character-append references: the
  // references build large cons/rope strings that can trigger a GC and distort
  // a later production median. The scan-only reference stays adjacent to the
  // clean production pass so that fast-path comparison is measured under the
  // same conditions.
  const [cleanCorpus, escapedCorpus] = corpora;
  const cleanProductionMs = measure(
    stripAnsi,
    cleanCorpus.messages,
    warmup,
    iterations,
  );
  const cleanScanOnlyMs = measure(
    references.stripAnsiScanOnly,
    cleanCorpus.messages,
    warmup,
    iterations,
  );
  const escapedProductionMs = measure(
    stripAnsi,
    escapedCorpus.messages,
    warmup,
    iterations,
  );
  const productionMedian = measure(
    stripAnsi,
    [...cleanCorpus.messages, ...escapedCorpus.messages],
    warmup,
    iterations,
  );
  const escapedScanOnlyMs = measure(
    references.stripAnsiScanOnly,
    escapedCorpus.messages,
    warmup,
    iterations,
  );
  const cleanCharAppendMs = measure(
    references.stripAnsiCharAppend,
    cleanCorpus.messages,
    warmup,
    iterations,
  );
  const escapedCharAppendMs = measure(
    references.stripAnsiCharAppend,
    escapedCorpus.messages,
    warmup,
    iterations,
  );

  const results = [
    {
      corpus: cleanCorpus,
      productionMs: cleanProductionMs,
      scanOnlyMs: cleanScanOnlyMs,
      charAppendMs: cleanCharAppendMs,
    },
    {
      corpus: escapedCorpus,
      productionMs: escapedProductionMs,
      scanOnlyMs: escapedScanOnlyMs,
      charAppendMs: escapedCharAppendMs,
    },
  ].map(({ corpus, productionMs, scanOnlyMs, charAppendMs }) => ({
    name: corpus.name,
    messages: corpus.messages.length,
    bytes: corpus.bytes,
    medianMs: round(productionMs),
    mibPerSecond: round(
      corpus.bytes / (productionMs / 1000) / (1024 * 1024),
      1,
    ),
    scanOnlyMs: round(scanOnlyMs),
    charAppendMs: round(charAppendMs),
  }));

  const clean = results.find((corpus) => corpus.name === 'clean');
  const escaped = results.find((corpus) => corpus.name === 'escaped');
  const productionMedianMs = round(productionMedian);
  const fastPathRatio = round(clean.scanOnlyMs / clean.medianMs);
  const slicingRatio = round(escaped.charAppendMs / escaped.medianMs);
  const decision = fastPathRatio >= ratioFloor ? 'keep' : 'review';

  // Quick mode is too small for a stable component comparison; full mode is
  // where the published coherence evidence lives.
  if (!quick) {
    const largestCorpusMedian = Math.max(clean.medianMs, escaped.medianMs);
    if (productionMedianMs < 0.75 * largestCorpusMedian) {
      throw new Error(
        `production median ${productionMedianMs} ms is below 0.75x the largest corpus median ${largestCorpusMedian} ms`,
      );
    }
  }

  if (sink <= 0) throw new Error('no stripped output was accumulated');

  const document = {
    benchmark: 'stripAnsi',
    mode: quick ? 'quick' : 'full',
    iterations,
    warmup,
    budgetMs,
    ratioFloor,
    corpora: results,
    productionMedianMs,
    fastPathRatio,
    decision,
    slicingRatio,
    outputIdentical: true,
  };
  console.log(JSON.stringify(document, null, 2));

  if (productionMedianMs > budgetMs) {
    console.error(
      `bench:ansi budget exceeded: production median ${productionMedianMs} ms is above the ${budgetMs} ms budget.`,
    );
    process.exitCode = 1;
  } else if (decision === 'review') {
    console.error(
      `bench:ansi fast-path review: ${document.fastPathRatio}x is below the ${ratioFloor}x floor.`,
    );
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof CliError) {
    console.error(`bench-ansi: ${error.message}`);
    if (error.showUsage) console.error(USAGE);
    process.exitCode = error.exitCode;
  } else {
    console.error(
      `bench-ansi: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
