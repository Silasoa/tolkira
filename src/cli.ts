import { realpathSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { formatCiOutput, type CiFormat } from './ci.js';
import { generateReport, summarizeReport, version } from './index.js';
import { outputOverwritesInput, samePath, writeAtomic } from './output.js';
import { ACCENT_PATTERN } from './validation.js';
import { ATTACHMENT_HINT, attachmentWarning } from './warnings.js';

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

Generate one self-contained HTML report from Cucumber JSON, Messages, JUnit XML or Playwright JSON.

Options:
  -o, --out <file>     Output HTML file
      --json           Print a stable JSON summary to stdout
      --ci <format>    Print a CI summary: github or markdown
      --ci-out <file>  Write the markdown CI summary to a file
      --title <text>   Report title and Markdown CI heading
      --meta key=value Add metadata (repeatable)
      --logo <file>    Embed a PNG, JPEG, GIF, WebP or SVG logo; needs --out
      --accent <color> Header accent as a hex colour, e.g. #1b5e20
      --max-size <mb>  Warn when the report exceeds this size (default 10)
  -h, --help           Show this help
  -v, --version        Show the version

Without --out, --json or --ci is required. --ci-out requires --ci markdown.
Without --ci-out, --ci writes only the CI summary to stdout. --json and --ci
share stdout only with --ci-out. Failing tests do not change the exit code.`;

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
      ci: { type: 'string' },
      'ci-out': { type: 'string' },
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

function parseCiFormat(value: string | undefined): CiFormat | undefined {
  if (value === undefined) return undefined;
  if (value === 'github' || value === 'markdown') return value;
  throw new Error(`Invalid --ci "${value}". Use github or markdown.`);
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
  const ciOut = parsed.values['ci-out'];

  if (parsed.values.out === '') {
    io.stderr(`tolkira: --out requires a file path\n\n${USAGE}`);
    return 2;
  }

  let ci: CiFormat | undefined;
  try {
    ci = parseCiFormat(parsed.values.ci);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    io.stderr(`tolkira: ${detail}\n\n${USAGE}`);
    return 2;
  }

  if (ciOut === '') {
    io.stderr(`tolkira: --ci-out requires a file path\n\n${USAGE}`);
    return 2;
  }

  if (ciOut !== undefined && ci === undefined) {
    io.stderr(`tolkira: --ci-out requires --ci\n\n${USAGE}`);
    return 2;
  }

  if (ci === 'github' && ciOut !== undefined) {
    io.stderr(
      `tolkira: --ci github writes annotations to stdout; ` +
        `--ci-out is only for --ci markdown\n\n${USAGE}`,
    );
    return 2;
  }

  if (wantsJson && ci !== undefined && ciOut === undefined) {
    const alternative =
      ci === 'github'
        ? 'drop --json or --ci github'
        : 'add --ci-out for the Markdown summary or drop one';
    io.stderr(
      `tolkira: --json and --ci ${ci} both write to stdout; ` +
        `${alternative}\n\n${USAGE}`,
    );
    return 2;
  }

  if (inputs.length === 0 || (!output && !wantsJson && ci === undefined)) {
    io.stderr(USAGE);
    return 2;
  }

  if (parsed.values.logo === '') {
    io.stderr(`tolkira: --logo requires a file path\n\n${USAGE}`);
    return 2;
  }

  if (!output && parsed.values.logo) {
    io.stderr(`tolkira: --logo requires --out\n\n${USAGE}`);
    return 2;
  }

  if (output && (await outputOverwritesInput(inputs, output, parsed.values.logo))) {
    io.stderr(`tolkira: --out must not overwrite an input file\n\n${USAGE}`);
    return 2;
  }

  if (ciOut !== undefined) {
    if (output && samePath(ciOut, output)) {
      io.stderr(`tolkira: --ci-out must not overwrite --out\n\n${USAGE}`);
      return 2;
    }
    if (await outputOverwritesInput(inputs, ciOut, parsed.values.logo)) {
      io.stderr(
        `tolkira: --ci-out must not overwrite an input file or the logo` +
          `\n\n${USAGE}`,
      );
      return 2;
    }
  }

  let metadata: Record<string, string>;
  let maxSizeMb: number;
  let accent: string | undefined;
  let logo: string | undefined;
  try {
    metadata = parseMetadata(parsed.values.meta);
    maxSizeMb = parseMaxSize(parsed.values['max-size']);
    accent = parseAccent(parsed.values.accent);
    logo = parsed.values.logo ? await readLogo(parsed.values.logo) : undefined;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    io.stderr(`tolkira: ${detail}\n\n${USAGE}`);
    return 2;
  }

  try {
    if (!output) {
      const summary = await summarizeReport(inputs);
      const ciText =
        ci !== undefined
          ? formatCiOutput(summary, ci, { title: parsed.values.title })
          : undefined;
      if (ciText !== undefined && ciOut !== undefined) {
        await writeAtomic(ciOut, ciText);
      }
      if (wantsJson) {
        io.stdout(`${JSON.stringify(summary, null, 2)}\n`);
      } else if (ciText !== undefined && ciOut === undefined) {
        io.stdout(ciText);
      }
      return 0;
    }

    const { html, summary, skippedAttachments } = await generateReport(inputs, {
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
    if (skippedAttachments > 0) {
      io.stderr(
        `tolkira: warning: ${attachmentWarning(skippedAttachments)} ` +
          `${ATTACHMENT_HINT}\n`,
      );
    }

    const ciText =
      ci !== undefined
        ? formatCiOutput(summary, ci, { title: parsed.values.title })
        : undefined;
    if (ciText !== undefined && ciOut !== undefined) {
      await writeAtomic(ciOut, ciText);
    }

    if (wantsJson) {
      io.stdout(`${JSON.stringify(summary, null, 2)}\n`);
    } else if (ciText !== undefined && ciOut === undefined) {
      io.stdout(ciText);
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

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry)
    );
  } catch {
    return false;
  }
}

if (isMainModule()) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
