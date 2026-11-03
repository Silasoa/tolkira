import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { generateReport, summarizeReport, version } from './index.js';
import { writeAtomic } from './output.js';
import { ACCENT_PATTERN } from './validation.js';

const DEFAULT_MAX_SIZE_MB = 10;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_MIME: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const USAGE = `Usage: tolkira <input...> [--out <file>] [options]

Generate one self-contained HTML report from Cucumber JSON or Messages.

Options:
  -o, --out <file>     Output HTML file
      --json           Print a stable JSON summary to stdout
      --title <text>   Report title
      --meta key=value Add metadata (repeatable)
      --logo <file>    Embed a PNG, JPEG, GIF, WebP or SVG logo
      --accent <color> Header accent as a hex colour, e.g. #1b5e20
      --max-size <mb>  Warn when the report exceeds this size (default 10)
  -h, --help           Show this help
  -v, --version        Show the version

Without --out, --json is required. With --out, --json prints the summary
instead of the human-readable confirmation. Failing tests do not change the
exit code.`;

export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

function parseCliArgs(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      title: { type: 'string' },
      meta: { type: 'string', multiple: true },
      logo: { type: 'string' },
      accent: { type: 'string' },
      'max-size': { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  } as const);
}

function parseMetadata(values: string[] | undefined): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const entry of values ?? []) {
    const separator = entry.indexOf('=');
    if (separator <= 0) {
      throw new Error(`Invalid metadata entry "${entry}". Use key=value.`);
    }
    metadata[entry.slice(0, separator)] = entry.slice(separator + 1);
  }
  return metadata;
}

function parseMaxSize(value: string | undefined): number {
  if (value === undefined) return DEFAULT_MAX_SIZE_MB;
  const megabytes = Number(value);
  if (!Number.isFinite(megabytes) || megabytes <= 0) {
    throw new Error(`Invalid --max-size "${value}". Use a positive number of MB.`);
  }
  return megabytes;
}

function parseAccent(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!ACCENT_PATTERN.test(value)) {
    throw new Error(`Invalid --accent "${value}". Use a hex colour such as #1b5e20.`);
  }
  return value;
}

async function readLogo(file: string): Promise<string> {
  const extension = path.extname(file).toLowerCase();
  const mime = LOGO_MIME[extension];
  if (!mime) {
    throw new Error(
      `Unsupported logo type "${extension}". Use PNG, JPEG, GIF, WebP or SVG.`,
    );
  }
  const info = await stat(file);
  if (info.size > MAX_LOGO_BYTES) {
    throw new Error('Logo is larger than 2 MB.');
  }
  const data = await readFile(file);
  let valid = false;
  switch (extension) {
    case '.png':
      valid = data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
      break;
    case '.jpg':
    case '.jpeg':
      valid = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
      break;
    case '.gif':
      valid = data.subarray(0, 4).toString('ascii') === 'GIF8';
      break;
    case '.webp':
      valid =
        data.subarray(0, 4).toString('ascii') === 'RIFF' &&
        data.subarray(8, 12).toString('ascii') === 'WEBP';
      break;
    case '.svg':
      valid =
        /^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!DOCTYPE[\s\S]*?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b/i.test(
          data.toString('utf8', 0, 1024),
        );
      break;
  }
  if (!valid) {
    throw new Error(`Logo content does not match the "${extension}" extension.`);
  }
  return `data:${mime};base64,${data.toString('base64')}`;
}

export async function runCli(
  argv: string[],
  io: CliIO = {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  },
): Promise<number> {
  let parsed: ReturnType<typeof parseCliArgs>;

  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    io.stderr(`tolkira: ${detail}\n\n${USAGE}`);
    return 2;
  }

  if (parsed.values.help) {
    io.stdout(USAGE);
    return 0;
  }

  if (parsed.values.version) {
    io.stdout(`${version}\n`);
    return 0;
  }

  const inputs = parsed.positionals;
  const output = parsed.values.out;
  const wantsJson = parsed.values.json;

  if (inputs.length === 0 || (!output && !wantsJson)) {
    io.stderr(USAGE);
    return 2;
  }

  let metadata: Record<string, string>;
  let maxSizeMb: number;
  let accent: string | undefined;
  let logo: string | undefined;
  try {
    metadata = parseMetadata(parsed.values.meta);
    maxSizeMb = parseMaxSize(parsed.values['max-size']);
    accent = parseAccent(parsed.values.accent);
    logo =
      output && parsed.values.logo ? await readLogo(parsed.values.logo) : undefined;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    io.stderr(`tolkira: ${detail}\n\n${USAGE}`);
    return 2;
  }

  try {
    if (!output) {
      const summary = await summarizeReport(inputs);
      io.stdout(`${JSON.stringify(summary, null, 2)}\n`);
      return 0;
    }

    const { html, summary } = await generateReport(inputs, {
      title: parsed.values.title,
      metadata,
      logo,
      accent,
    });

    await writeAtomic(output, html);
    const bytes = Buffer.byteLength(html, 'utf8');
    const maxBytes = maxSizeMb * 1024 * 1024;
    if (bytes > maxBytes) {
      io.stderr(
        `tolkira: warning: report is ${(bytes / 1024 / 1024).toFixed(1)} MB, ` +
          `above the ${maxSizeMb} MB threshold; large screenshots or videos ` +
          `inflate the single-file report.\n`,
      );
    }

    if (wantsJson) {
      io.stdout(`${JSON.stringify(summary, null, 2)}\n`);
    } else {
      io.stdout(`Report written to ${output}\n`);
    }
    return 0;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    io.stderr(`tolkira: ${detail}\n`);
    return 1;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
