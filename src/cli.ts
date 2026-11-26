import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRunManifest,
  serializeRunManifest,
  type ManifestArtifact,
} from './artifacts.js';
import { readBaseline, type BaselineSummary } from './baseline.js';
import { capabilitiesJson } from './capabilities.js';
import { formatCiOutput } from './ci.js';
import { renderEmail, type EmailOptions } from './email.js';
import {
  readHistory,
  writeHistory,
  HISTORY_LIMIT,
  HISTORY_LIMIT_MAX,
  type HistoryRun,
} from './history.js';
import { version } from './index.js';
import { resolveInputFiles, scanInputBytes } from './input/load.js';
import { outputOverwritesInput, samePath, writeAtomic } from './output.js';
import { renderPdf } from './pdf.js';
import { generateReportFromResolved, summarizeRunFromResolved } from './run.js';
import type { ReportSummary } from './summary.js';
import { oneLine } from './text.js';
import {
  ATTACHMENT_HINT,
  INPUT_WARN_BYTES,
  attachmentWarning,
  earlyInputWarning,
  formatMegabytes,
} from './warnings.js';
import {
  parseAccent,
  parseMaxSize,
  parseMetadata,
} from './cli/args.js';
import { planOptions } from './cli/plan.js';
import { readLogo } from './cli/logo.js';
import {
  cannotExpressRelative,
  conflictsWithInputs,
  pathConflicts,
} from './cli/paths.js';

const USAGE = `Usage: tolkira <input...> [--out <file>] [--pdf <file>] [--email <file>] [options]

Generate one self-contained HTML report from Cucumber JSON, Messages, JUnit XML or Playwright JSON.

Options:
  -o, --out <file>     Output HTML file
      --static         Script-free static report with every view and detail open; needs --out or --pdf
      --pdf <file>     Write an A4 PDF through the optional Playwright engine
      --pdf-timeout <ms> PDF render deadline in milliseconds (default 300000); needs --pdf
      --email <file>   Write an HTML email summary
      --json           Print a stable JSON summary to stdout
      --ci <format>    Print a CI summary: github, azure or markdown
      --ci-out <file>  Write the markdown CI summary to a file
      --history <file> Read and append an aggregate run history; needs --out
      --history-limit <n> Runs kept in that history (default ${HISTORY_LIMIT}, range 1 to ${HISTORY_LIMIT_MAX}); needs --history
      --baseline <file> Compare with an earlier schema-2 summary; needs --out, --pdf, --json or --ci markdown
      --manifest <file> Write a JSON manifest of the run
      --title <text>   Report title, email subject/heading and Markdown CI heading
      --locale <tag>   Report, PDF and email language: en or de (default en); needs --out, --pdf or --email
      --meta key=value Add metadata (repeatable)
      --logo <file>    Embed a PNG, JPEG, GIF, WebP or SVG logo; needs --out
      --accent <color> Header accent as a hex colour, e.g. #1b5e20
      --max-size <mb>  Warn when the report exceeds this size (default 10)
      --capabilities   Print the JSON capabilities document and exit
  -h, --help           Show this help
  -v, --version        Show the version

At least one of --out, --pdf, --json, --ci, --email or --manifest is required. --ci-out requires
--ci markdown. --history requires --out. Without --ci-out, --ci writes only the
CI summary to stdout. --json and --ci markdown share stdout only with --ci-out;
--ci github and --ci azure always own stdout. Failing tests do not change the
exit code.`;

export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const DEFAULT_IO: CliIO = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

function errorCode(error: unknown): string | undefined {
  return error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
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
    const code = errorCode(error);
    throw new Error(
      `Cannot write email to ${oneLine(file)}${code ? ` (${code})` : ''}`,
      { cause: error },
    );
  }
}

async function writeReport(file: string, html: string): Promise<void> {
  try {
    await writeAtomic(file, html);
  } catch (error) {
    const code = errorCode(error);
    throw new Error(
      `Cannot write report to ${oneLine(file)}${code ? ` (${code})` : ''}`,
      { cause: error },
    );
  }
}

async function writeCiOutput(file: string, text: string): Promise<void> {
  try {
    await writeAtomic(file, text);
  } catch (error) {
    const code = errorCode(error);
    throw new Error(
      `Cannot write CI output to ${oneLine(file)}${code ? ` (${code})` : ''}`,
      { cause: error },
    );
  }
}

async function writeManifest(file: string, text: string): Promise<void> {
  try {
    await writeAtomic(file, text);
  } catch (error) {
    // Name the target, never the atomic temporary file.
    throw new Error(`Cannot write manifest to ${oneLine(file)}`, {
      cause: error,
    });
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
      { cause: error },
    );
  }
  try {
    await writeAtomic(file, bytes);
  } catch (error) {
    const code = errorCode(error);
    throw new Error(
      `Cannot write PDF to ${oneLine(file)}${code ? ` (${code})` : ''}`,
      { cause: error },
    );
  }
}

export async function runCli(
  argv: string[],
  io: CliIO = DEFAULT_IO,
): Promise<number> {
  const planned = await planOptions(argv);
  if (!planned.ok) {
    io.stderr(
      planned.kind === 'usage'
        ? USAGE
        : `tolkira: ${planned.message}\n\n${USAGE}`,
    );
    return 2;
  }

  if ('action' in planned) {
    switch (planned.action) {
      case 'help':
        io.stdout(USAGE);
        return 0;
      case 'version':
        io.stdout(`${version}\n`);
        return 0;
      case 'capabilities':
        io.stdout(capabilitiesJson());
        return 0;
    }
  }

  const options = planned.options;
  const inputs = options.inputs;
  const output = options.report;
  const pdfPath = options.pdf;
  const emailPath = options.email;
  const wantsJson = options.json;
  const ciOut = options.ciOut;
  const historyFile = options.history;
  const baselineFile = options.baseline;
  const manifestFile = options.manifest;
  const logoFile = options.logo;
  const title = options.title;
  const staticReport = options.static;
  const locale = options.locale;
  const ci = options.ci;
  const pdfTimeout = options.pdfTimeout;
  const historyLimit = options.historyLimit;

  if (manifestFile !== undefined) {
    const collides =
      (await pathConflicts(
        manifestFile,
        inputs,
        logoFile,
        output,
        pdfPath,
        ciOut,
        emailPath,
        historyFile,
      )) ||
      (baselineFile !== undefined && samePath(manifestFile, baselineFile));
    if (collides) {
      io.stderr(
        `tolkira: --manifest must not overwrite an input file, the logo, ` +
          `--out, --pdf, --email, --history, --ci-out or --baseline` +
          `\n\n${USAGE}`,
      );
      return 2;
    }

    const artifacts: Array<[string, string | undefined]> = [
      ['--out', output],
      ['--pdf', pdfPath],
      ['--email', emailPath],
      ['--history', historyFile],
      ['--ci-out', ciOut],
    ];
    for (const [flag, artifact] of artifacts) {
      if (
        artifact !== undefined &&
        cannotExpressRelative(manifestFile, artifact)
      ) {
        io.stderr(
          `tolkira: ${flag} ${oneLine(artifact)} cannot be expressed relative ` +
            `to --manifest; pass an absolute ${flag} path\n\n${USAGE}`,
        );
        return 2;
      }
    }
  }

  if (
    historyFile !== undefined &&
    (await pathConflicts(
      historyFile,
      inputs,
      logoFile,
      output,
      pdfPath,
      ciOut,
      emailPath,
      baselineFile,
    ))
  ) {
    io.stderr(
      `tolkira: --history must not overwrite an input file, the logo, ` +
        `--out, --pdf, --ci-out, --email or --baseline\n\n${USAGE}`,
    );
    return 2;
  }

  if (
    baselineFile !== undefined &&
    (await pathConflicts(
      baselineFile,
      inputs,
      logoFile,
      output,
      pdfPath,
      ciOut,
      emailPath,
      historyFile,
    ))
  ) {
    io.stderr(
      `tolkira: --baseline must not name an input file, the logo, ` +
        `--out, --pdf, --email, --history or --ci-out\n\n${USAGE}`,
    );
    return 2;
  }

  if (
    output &&
    (await outputOverwritesInput(inputs, output, logoFile))
  ) {
    io.stderr(`tolkira: --out must not overwrite an input file\n\n${USAGE}`);
    return 2;
  }

  if (ciOut !== undefined) {
    if (output && samePath(ciOut, output)) {
      io.stderr(`tolkira: --ci-out must not overwrite --out\n\n${USAGE}`);
      return 2;
    }
    if (await outputOverwritesInput(inputs, ciOut, logoFile)) {
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
    if (await outputOverwritesInput(inputs, emailPath, logoFile)) {
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
    if (emailPath !== undefined && samePath(pdfPath, emailPath)) {
      io.stderr(`tolkira: --pdf must not overwrite --email\n\n${USAGE}`);
      return 2;
    }
    if (
      logoFile !== undefined &&
      samePath(pdfPath, logoFile)
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
    metadata = parseMetadata(options.meta);
    maxSizeMb = parseMaxSize(options.maxSize);
    accent = parseAccent(options.accent);
    logo = logoFile ? await readLogo(logoFile) : undefined;
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

    let baseline: BaselineSummary | undefined;
    if (baselineFile !== undefined) {
      baseline = await readBaseline(baselineFile);
    }

    if (!output && pdfPath === undefined) {
      const { summary, skippedAttachments } = await summarizeRunFromResolved(
        resolvedInputs,
        baseline,
      );
      if (emailPath !== undefined) {
        await writeEmailSummary(emailPath, summary, {
          ...(title === undefined
            ? {}
            : { title: title }),
          ...(locale === undefined ? {} : { locale }),
          ...(accent === undefined ? {} : { accent }),
          now: new Date(),
        });
      }
      const ciText =
        ci !== undefined
          ? formatCiOutput(
              summary,
              ci,
              title === undefined
                ? {}
                : { title: title },
            )
          : undefined;
      if (ciText !== undefined && ciOut !== undefined) {
        await writeCiOutput(ciOut, ciText);
      }
      if (manifestFile !== undefined) {
        const artifacts: ManifestArtifact[] = [];
        if (emailPath !== undefined) {
          artifacts.push({ kind: 'email', path: emailPath });
        }
        if (ciText !== undefined && ciOut !== undefined) {
          artifacts.push({ kind: 'ci-markdown', path: ciOut });
        }
        await writeManifest(
          manifestFile,
          serializeRunManifest(
            buildRunManifest(
              summary,
              skippedAttachments,
              artifacts,
              manifestFile,
            ),
          ),
        );
      }
      const stdoutOwned =
        wantsJson || (ciText !== undefined && ciOut === undefined);
      if (wantsJson) {
        io.stdout(`${JSON.stringify(summary, null, 2)}\n`);
      } else if (ciText !== undefined && ciOut === undefined) {
        io.stdout(ciText);
      } else if (emailPath !== undefined) {
        io.stdout(`Email written to ${oneLine(emailPath)}\n`);
      }
      if (manifestFile !== undefined && !stdoutOwned) {
        io.stdout(`Manifest written to ${oneLine(manifestFile)}\n`);
      }
      return 0;
    }

    const generated = await generateReportFromResolved(resolvedInputs, {
      ...(title === undefined
        ? {}
        : { title: title }),
      metadata,
      ...(logo === undefined ? {} : { logo }),
      ...(accent === undefined ? {} : { accent }),
      ...(historyLimit === undefined ? {} : { historyLimit }),
      ...(staticReport ? { static: true } : {}),
      ...(locale === undefined ? {} : { locale }),
      ...(history === undefined ? {} : { history }),
      ...(baseline === undefined ? {} : { baseline }),
    });
    const { html, summary, skippedAttachments } = generated;

    if (output) {
      await writeReport(output, html);
    }
    if (pdfPath !== undefined) {
      await writePdf(pdfPath, html, pdfTimeout);
    }
    if (emailPath !== undefined) {
      await writeEmailSummary(emailPath, summary, {
        ...(title === undefined
          ? {}
          : { title: title }),
        ...(locale === undefined ? {} : { locale }),
        reportName: path.basename(output ?? pdfPath ?? ''),
        ...(accent === undefined ? {} : { accent }),
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
        ? formatCiOutput(
            summary,
            ci,
            title === undefined
              ? {}
              : { title: title },
          )
        : undefined;
    if (ciText !== undefined && ciOut !== undefined) {
      await writeCiOutput(ciOut, ciText);
    }

    if (manifestFile !== undefined) {
      const artifacts: ManifestArtifact[] = [];
      if (output) artifacts.push({ kind: 'report', path: output });
      if (pdfPath !== undefined) artifacts.push({ kind: 'pdf', path: pdfPath });
      if (emailPath !== undefined) {
        artifacts.push({ kind: 'email', path: emailPath });
      }
      if (historyFile !== undefined && generated.history) {
        artifacts.push({ kind: 'history', path: historyFile });
      }
      if (ciText !== undefined && ciOut !== undefined) {
        artifacts.push({ kind: 'ci-markdown', path: ciOut });
      }
      await writeManifest(
        manifestFile,
        serializeRunManifest(
          buildRunManifest(
            summary,
            skippedAttachments,
            artifacts,
            manifestFile,
          ),
        ),
      );
    }

    if (wantsJson) {
      io.stdout(`${JSON.stringify(summary, null, 2)}\n`);
    } else if (ciText !== undefined && ciOut === undefined) {
      io.stdout(ciText);
    } else {
      if (output) {
        io.stdout(`Report written to ${oneLine(output)}\n`);
      }
      if (pdfPath !== undefined) {
        io.stdout(`PDF written to ${oneLine(pdfPath)}\n`);
      }
      if (emailPath !== undefined) {
        io.stdout(`Email written to ${oneLine(emailPath)}\n`);
      }
      if (manifestFile !== undefined) {
        io.stdout(`Manifest written to ${oneLine(manifestFile)}\n`);
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
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  void runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
    return code;
  });
}
