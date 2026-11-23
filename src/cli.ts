import { realpathSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { formatCiOutput, type CiFormat } from './ci.js';
import { renderEmail, type EmailOptions } from './email.js';
import {
  readHistory,
  writeHistory,
  HISTORY_LIMIT_MAX,
  type HistoryRun,
} from './history.js';
import { version } from './index.js';
import { resolveInputFiles, scanInputBytes } from './input/load.js';
import { outputOverwritesInput, samePath, writeAtomic } from './output.js';
import { renderPdf } from './pdf.js';
import { resolveLocale } from './render/i18n.js';
import { generateReportFromResolved } from './run.js';
import { summarizeResolvedReport, type ReportSummary } from './summary.js';
import { ACCENT_PATTERN } from './validation.js';
import {
  ATTACHMENT_HINT,
  INPUT_WARN_BYTES,
  attachmentWarning,
  earlyInputWarning,
  formatMegabytes,
} from './warnings.js';

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

const USAGE = `Usage: tolkira <input...> [--out <file>] [--pdf <file>] [--email <file>] [options]

Generate one self-contained HTML report from Cucumber JSON, Messages, JUnit XML or Playwright JSON.

Options:
  -o, --out <file>     Output HTML file
      --pdf <file>     Write an A4 PDF through the optional Playwright engine
      --pdf-timeout <ms> PDF render deadline in milliseconds (default 300000); needs --pdf
      --email <file>   Write an HTML email summary
      --json           Print a stable JSON summary to stdout
      --ci <format>    Print a CI summary: github, azure or markdown
      --ci-out <file>  Write the markdown CI summary to a file
      --history <file> Read and append an aggregate run history; needs --out
      --history-limit <n> Runs kept in that history (default 30, range 1 to 365); needs --history
      --title <text>   Report title, email subject/heading and Markdown CI heading
      --locale <tag>   Report, PDF and email language: en or de (default en); needs --out, --pdf or --email
      --meta key=value Add metadata (repeatable)
      --logo <file>    Embed a PNG, JPEG, GIF, WebP or SVG logo; needs --out
      --accent <color> Header accent as a hex colour, e.g. #1b5e20
      --max-size <mb>  Warn when the report exceeds this size (default 10)
  -h, --help           Show this help
  -v, --version        Show the version

At least one of --out, --pdf, --json, --ci or --email is required. --ci-out requires
--ci markdown. --history requires --out. Without --ci-out, --ci writes only the
CI summary to stdout. --json and --ci markdown share stdout only with --ci-out;
--ci github and --ci azure always own stdout. Failing tests do not change the
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
      pdf: { type: 'string' },
      'pdf-timeout': { type: 'string' },
      email: { type: 'string' },
      title: { type: 'string' },
      locale: { type: 'string' },
      meta: { type: 'string', multiple: true },
      logo: { type: 'string' },
      accent: { type: 'string' },
      'max-size': { type: 'string' },
      json: { type: 'boolean' },
      ci: { type: 'string' },
      'ci-out': { type: 'string' },
      history: { type: 'string' },
      'history-limit': { type: 'string' },
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

function parsePdfTimeout(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  // Leading zeros, signs, fractions and exponents are usage errors, not aliases.
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 2_147_483_647) {
    throw new Error(
      `Invalid --pdf-timeout "${value}". Use a positive integer of milliseconds.`,
    );
  }
  return Number(value);
}

function parseHistoryLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  // Leading zeros, signs, fractions and whitespace are usage errors, not aliases.
  if (!/^[1-9]\d*$/.test(value) || Number(value) > HISTORY_LIMIT_MAX) {
    throw new Error(
      `Invalid --history-limit "${value}". Use an integer from 1 to ${HISTORY_LIMIT_MAX}.`,
    );
  }
  return Number(value);
}

function parseCiFormat(value: string | undefined): CiFormat | undefined {
  if (value === undefined) return undefined;
  if (value === 'github' || value === 'azure' || value === 'markdown') {
    return value;
  }
  throw new Error(`Invalid --ci "${value}". Use github, azure or markdown.`);
}

function parseAccent(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!ACCENT_PATTERN.test(value)) {
    throw new Error(`Invalid --accent "${value}". Use a hex colour such as #1b5e20.`);
  }
  return value;
}

/** True when `file` names `parent` or sits inside it, even when `file` is missing. */
function isInside(parent: string, file: string): boolean {
  let current = path.resolve(file);
  for (;;) {
    if (samePath(current, parent)) return true;
    const next = path.dirname(current);
    if (next === current) return false;
    current = next;
  }
}

/** True when `file` would replace or join any input, file or directory. */
async function conflictsWithInputs(
  file: string,
  inputs: string[],
): Promise<boolean> {
  for (const input of inputs) {
    if (samePath(file, input)) return true;
    const info = await stat(input).catch(() => undefined);
    if (info?.isDirectory() && isInside(input, file)) return true;
  }
  return false;
}

async function historyConflicts(
  file: string,
  inputs: string[],
  logo: string | undefined,
  output: string | undefined,
  ciOut: string | undefined,
  email: string | undefined,
): Promise<boolean> {
  if (output && samePath(file, output)) return true;
  if (ciOut && samePath(file, ciOut)) return true;
  if (email && samePath(file, email)) return true;
  if (logo && samePath(file, logo)) return true;
  return conflictsWithInputs(file, inputs);
}

/** Keeps a path on one line in confirmations and error output. */
function oneLine(value: string): string {
  let output = '';
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    output += code < 0x20 || code === 0x7f ? ' ' : character;
  }
  return output;
}

async function writeEmailSummary(
  file: string,
  summary: ReportSummary,
  options: EmailOptions,
): Promise<void> {
  const html = renderEmail(summary, options);
  try {
    await writeAtomic(file, html);
  } catch (error) {
    // Name the target, never the atomic temporary file.
    const code = (error as NodeJS.ErrnoException).code;
    throw new Error(
      `Cannot write email to ${oneLine(file)}${code ? ` (${code})` : ''}`,
    );
  }
}

async function writePdf(
  file: string,
  html: string,
  timeoutMs?: number,
): Promise<void> {
  let bytes: Uint8Array;
  try {
    bytes = await renderPdf(
      html,
      timeoutMs === undefined ? undefined : { timeoutMs },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // Raw Chromium errors can carry the command line and the home directory.
    throw new Error(
      `Cannot render PDF for ${oneLine(file)}: ${oneLine(detail).slice(0, 500)}`,
    );
  }
  try {
    await writeAtomic(file, bytes);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    throw new Error(
      `Cannot write PDF to ${oneLine(file)}${code ? ` (${code})` : ''}`,
    );
  }
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
  const pdfPath = parsed.values.pdf;
  const emailPath = parsed.values.email;
  const wantsJson = parsed.values.json;
  const ciOut = parsed.values['ci-out'];
  const historyFile = parsed.values.history;

  if (parsed.values.out === '') {
    io.stderr(`tolkira: --out requires a file path\n\n${USAGE}`);
    return 2;
  }

  if (pdfPath === '') {
    io.stderr(`tolkira: --pdf requires a file path\n\n${USAGE}`);
    return 2;
  }

  if (parsed.values['pdf-timeout'] !== undefined && pdfPath === undefined) {
    io.stderr(`tolkira: --pdf-timeout requires --pdf\n\n${USAGE}`);
    return 2;
  }

  let pdfTimeout: number | undefined;
  try {
    pdfTimeout = parsePdfTimeout(parsed.values['pdf-timeout']);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    io.stderr(`tolkira: ${detail}\n\n${USAGE}`);
    return 2;
  }

  if (emailPath === '') {
    io.stderr(`tolkira: --email requires a file path\n\n${USAGE}`);
    return 2;
  }

  let locale: string | undefined;
  if (parsed.values.locale !== undefined) {
    try {
      locale = resolveLocale(parsed.values.locale).requested;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      io.stderr(`tolkira: ${detail}\n\n${USAGE}`);
      return 2;
    }
  }

  if (
    locale !== undefined &&
    !output &&
    emailPath === undefined &&
    pdfPath === undefined
  ) {
    io.stderr(`tolkira: --locale requires --out, --pdf or --email\n\n${USAGE}`);
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

  if ((ci === 'github' || ci === 'azure') && ciOut !== undefined) {
    io.stderr(
      `tolkira: --ci ${ci} writes annotations to stdout; ` +
        `--ci-out is only for --ci markdown\n\n${USAGE}`,
    );
    return 2;
  }

  if (wantsJson && ci !== undefined && ciOut === undefined) {
    const alternative =
      ci === 'github'
        ? 'drop --json or --ci github'
        : ci === 'azure'
          ? 'drop --json or --ci azure, or use --ci markdown with --ci-out'
          : 'add --ci-out for the Markdown summary or drop one';
    io.stderr(
      `tolkira: --json and --ci ${ci} both write to stdout; ` +
        `${alternative}\n\n${USAGE}`,
    );
    return 2;
  }

  if (
    inputs.length === 0 ||
    (!output &&
      !wantsJson &&
      ci === undefined &&
      emailPath === undefined &&
      pdfPath === undefined)
  ) {
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

  if (historyFile === '') {
    io.stderr(`tolkira: --history requires a file path\n\n${USAGE}`);
    return 2;
  }

  let historyLimit: number | undefined;
  try {
    historyLimit = parseHistoryLimit(parsed.values['history-limit']);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    io.stderr(`tolkira: ${detail}\n\n${USAGE}`);
    return 2;
  }

  if (historyLimit !== undefined && historyFile === undefined) {
    io.stderr(`tolkira: --history-limit requires --history\n\n${USAGE}`);
    return 2;
  }

  if (historyFile !== undefined && !output) {
    io.stderr(`tolkira: --history requires --out\n\n${USAGE}`);
    return 2;
  }

  if (
    historyFile !== undefined &&
    (await historyConflicts(
      historyFile,
      inputs,
      parsed.values.logo,
      output,
      ciOut,
      emailPath,
    ))
  ) {
    io.stderr(
      `tolkira: --history must not overwrite an input file, the logo, ` +
        `--out, --ci-out or --email\n\n${USAGE}`,
    );
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

  if (emailPath !== undefined) {
    if (output && samePath(emailPath, output)) {
      io.stderr(`tolkira: --email must not overwrite --out\n\n${USAGE}`);
      return 2;
    }
    if (ciOut !== undefined && samePath(emailPath, ciOut)) {
      io.stderr(`tolkira: --email must not overwrite --ci-out\n\n${USAGE}`);
      return 2;
    }
    if (await conflictsWithInputs(emailPath, inputs)) {
      io.stderr(
        `tolkira: --email must not overwrite an input file or directory` +
          `\n\n${USAGE}`,
      );
      return 2;
    }
    if (await outputOverwritesInput(inputs, emailPath, parsed.values.logo)) {
      io.stderr(
        `tolkira: --email must not overwrite an input file or the logo` +
          `\n\n${USAGE}`,
      );
      return 2;
    }
  }

  if (pdfPath !== undefined) {
    if (output && samePath(pdfPath, output)) {
      io.stderr(`tolkira: --pdf must not overwrite --out\n\n${USAGE}`);
      return 2;
    }
    if (ciOut !== undefined && samePath(pdfPath, ciOut)) {
      io.stderr(`tolkira: --pdf must not overwrite --ci-out\n\n${USAGE}`);
      return 2;
    }
    if (historyFile !== undefined && samePath(pdfPath, historyFile)) {
      io.stderr(`tolkira: --pdf must not overwrite --history\n\n${USAGE}`);
      return 2;
    }
    if (emailPath !== undefined && samePath(pdfPath, emailPath)) {
      io.stderr(`tolkira: --pdf must not overwrite --email\n\n${USAGE}`);
      return 2;
    }
    if (
      parsed.values.logo !== undefined &&
      samePath(pdfPath, parsed.values.logo)
    ) {
      io.stderr(`tolkira: --pdf must not overwrite the logo\n\n${USAGE}`);
      return 2;
    }
    if (await conflictsWithInputs(pdfPath, inputs)) {
      io.stderr(
        `tolkira: --pdf must not overwrite an input file or directory` +
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
    const resolvedInputs = await resolveInputFiles(inputs);
    let scannedBytes: number | undefined;
    try {
      scannedBytes = (await scanInputBytes(resolvedInputs.files)).bytes;
    } catch {
      // A stat error is reported by the loader, which re-stats each file.
    }
    if (scannedBytes !== undefined && scannedBytes >= INPUT_WARN_BYTES) {
      io.stderr(`tolkira: warning: ${earlyInputWarning(scannedBytes)}\n`);
    }

    let history: HistoryRun[] | undefined;
    if (historyFile !== undefined) {
      history = await readHistory(historyFile, historyLimit);
    }

    if (!output && pdfPath === undefined) {
      const summary = await summarizeResolvedReport(resolvedInputs);
      if (emailPath !== undefined) {
        await writeEmailSummary(emailPath, summary, {
          title: parsed.values.title,
          locale,
          accent,
          now: new Date(),
        });
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
      } else if (emailPath !== undefined) {
        io.stdout(`Email written to ${oneLine(emailPath)}\n`);
      }
      return 0;
    }

    const generated = await generateReportFromResolved(resolvedInputs, {
      title: parsed.values.title,
      metadata,
      logo,
      accent,
      historyLimit,
      ...(locale === undefined ? {} : { locale }),
      ...(history === undefined ? {} : { history }),
    });
    const { html, summary, skippedAttachments } = generated;

    if (output) {
      await writeAtomic(output, html);
    }
    if (pdfPath !== undefined) {
      await writePdf(pdfPath, html, pdfTimeout);
    }
    if (emailPath !== undefined) {
      await writeEmailSummary(emailPath, summary, {
        title: parsed.values.title,
        locale,
        reportName: path.basename(output ?? pdfPath ?? ''),
        accent,
        now: new Date(),
      });
    }
    if (historyFile !== undefined && generated.history) {
      await writeHistory(historyFile, generated.history, historyLimit);
    }
    if (output || pdfPath !== undefined) {
      const bytes = Buffer.byteLength(html, 'utf8');
      const maxBytes = maxSizeMb * 1024 * 1024;
      if (bytes > maxBytes) {
        io.stderr(
          `tolkira: warning: report HTML is ${formatMegabytes(bytes)} MB ` +
            `(input ${formatMegabytes(generated.inputBytes)} MB, ` +
            `attachments ${formatMegabytes(summary.attachments.bytes)} MB decoded), ` +
            `above the ${maxSizeMb} MB threshold; large screenshots or videos ` +
            `inflate the HTML and the PDF.\n`,
        );
      }
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
      if (output) {
        io.stdout(`Report written to ${output}\n`);
      }
      if (pdfPath !== undefined) {
        io.stdout(`PDF written to ${oneLine(pdfPath)}\n`);
      }
      if (emailPath !== undefined) {
        io.stdout(`Email written to ${oneLine(emailPath)}\n`);
      }
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
