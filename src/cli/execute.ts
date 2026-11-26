import path from 'node:path';
import {
  buildRunManifest,
  serializeRunManifest,
  type ManifestArtifact,
} from '../artifacts.js';
import { readBaseline, type BaselineSummary } from '../baseline.js';
import { formatCiOutput } from '../ci.js';
import { renderEmail, type EmailOptions } from '../email.js';
import { readHistory, writeHistory, type HistoryRun } from '../history.js';
import { resolveInputFiles, scanInputBytes } from '../input/load.js';
import { writeAtomic } from '../output.js';
import { renderPdf } from '../pdf.js';
import {
  generateReportFromResolved,
  summarizeRunFromResolved,
} from '../run.js';
import type { ReportSummary } from '../summary.js';
import { oneLine } from '../text.js';
import {
  ATTACHMENT_HINT,
  INPUT_WARN_BYTES,
  attachmentWarning,
  earlyInputWarning,
  formatMegabytes,
} from '../warnings.js';
import type { CliPlan } from './plan.js';

export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

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

function ciTextFor(summary: ReportSummary, plan: CliPlan): string | undefined {
  return plan.ci !== undefined
    ? formatCiOutput(
        summary,
        plan.ci,
        plan.title === undefined ? {} : { title: plan.title },
      )
    : undefined;
}

function printConfirmations(plan: CliPlan, io: CliIO): void {
  for (const kind of plan.stdout.confirmations) {
    switch (kind) {
      case 'report':
        if (plan.report !== undefined) {
          io.stdout(`Report written to ${oneLine(plan.report)}\n`);
        }
        break;
      case 'pdf':
        if (plan.pdf !== undefined) {
          io.stdout(`PDF written to ${oneLine(plan.pdf)}\n`);
        }
        break;
      case 'email':
        if (plan.email !== undefined) {
          io.stdout(`Email written to ${oneLine(plan.email)}\n`);
        }
        break;
      case 'manifest':
        if (plan.manifest !== undefined) {
          io.stdout(`Manifest written to ${oneLine(plan.manifest)}\n`);
        }
        break;
    }
  }
}

function printMachine(
  plan: CliPlan,
  summary: ReportSummary,
  ciText: string | undefined,
  io: CliIO,
): void {
  if (plan.stdout.machine === 'json') {
    io.stdout(`${JSON.stringify(summary, null, 2)}\n`);
  } else if (plan.stdout.machine === 'ci' && ciText !== undefined) {
    io.stdout(ciText);
  }
}

export async function executePlan(plan: CliPlan, io: CliIO): Promise<number> {
  try {
    const resolvedInputs = await resolveInputFiles(plan.inputs);
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
    if (plan.history !== undefined) {
      history = await readHistory(plan.history, plan.historyLimit);
    }

    let baseline: BaselineSummary | undefined;
    if (plan.baseline !== undefined) {
      baseline = await readBaseline(plan.baseline);
    }

    if (plan.mode === 'summary') {
      const { summary, skippedAttachments } = await summarizeRunFromResolved(
        resolvedInputs,
        baseline,
      );
      if (plan.email !== undefined) {
        await writeEmailSummary(plan.email, summary, {
          ...(plan.title === undefined ? {} : { title: plan.title }),
          ...(plan.locale === undefined ? {} : { locale: plan.locale }),
          ...(plan.accent === undefined ? {} : { accent: plan.accent }),
          now: new Date(),
        });
      }
      const ciText = ciTextFor(summary, plan);
      if (ciText !== undefined && plan.ciOut !== undefined) {
        await writeCiOutput(plan.ciOut, ciText);
      }
      if (plan.manifest !== undefined) {
        const artifacts: ManifestArtifact[] = [];
        if (plan.email !== undefined) {
          artifacts.push({ kind: 'email', path: plan.email });
        }
        if (ciText !== undefined && plan.ciOut !== undefined) {
          artifacts.push({ kind: 'ci-markdown', path: plan.ciOut });
        }
        await writeManifest(
          plan.manifest,
          serializeRunManifest(
            buildRunManifest(
              summary,
              skippedAttachments,
              artifacts,
              plan.manifest,
            ),
          ),
        );
      }
      printMachine(plan, summary, ciText, io);
      if (plan.stdout.machine === null) printConfirmations(plan, io);
      return plan.exitCodes.success;
    }

    const generated = await generateReportFromResolved(resolvedInputs, {
      ...(plan.title === undefined ? {} : { title: plan.title }),
      metadata: plan.metadata,
      ...(plan.logoDataUri === undefined ? {} : { logo: plan.logoDataUri }),
      ...(plan.accent === undefined ? {} : { accent: plan.accent }),
      ...(plan.historyLimit === undefined
        ? {}
        : { historyLimit: plan.historyLimit }),
      ...(plan.static ? { static: true } : {}),
      ...(plan.locale === undefined ? {} : { locale: plan.locale }),
      ...(history === undefined ? {} : { history }),
      ...(baseline === undefined ? {} : { baseline }),
    });
    const { html, summary, skippedAttachments } = generated;

    if (plan.report !== undefined) {
      await writeReport(plan.report, html);
    }
    if (plan.pdf !== undefined) {
      await writePdf(plan.pdf, html, plan.pdfTimeout);
    }
    if (plan.email !== undefined) {
      await writeEmailSummary(plan.email, summary, {
        ...(plan.title === undefined ? {} : { title: plan.title }),
        ...(plan.locale === undefined ? {} : { locale: plan.locale }),
        reportName: path.basename(plan.report ?? plan.pdf ?? ''),
        ...(plan.accent === undefined ? {} : { accent: plan.accent }),
        now: new Date(),
      });
    }
    if (plan.history !== undefined && generated.history) {
      await writeHistory(plan.history, generated.history, plan.historyLimit);
    }
    if (plan.report !== undefined || plan.pdf !== undefined) {
      const bytes = Buffer.byteLength(html, 'utf8');
      const maxBytes = plan.maxSizeMb * 1024 * 1024;
      if (bytes > maxBytes) {
        io.stderr(
          `tolkira: warning: report HTML is ${formatMegabytes(bytes)} MB ` +
            `(input ${formatMegabytes(generated.inputBytes)} MB, ` +
            `attachments ${formatMegabytes(summary.attachments.bytes)} MB decoded), ` +
            `above the ${plan.maxSizeMb} MB threshold; large screenshots or videos ` +
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

    const ciText = ciTextFor(summary, plan);
    if (ciText !== undefined && plan.ciOut !== undefined) {
      await writeCiOutput(plan.ciOut, ciText);
    }

    if (plan.manifest !== undefined) {
      const artifacts: ManifestArtifact[] = [];
      if (plan.report !== undefined) {
        artifacts.push({ kind: 'report', path: plan.report });
      }
      if (plan.pdf !== undefined) {
        artifacts.push({ kind: 'pdf', path: plan.pdf });
      }
      if (plan.email !== undefined) {
        artifacts.push({ kind: 'email', path: plan.email });
      }
      if (plan.history !== undefined && generated.history) {
        artifacts.push({ kind: 'history', path: plan.history });
      }
      if (ciText !== undefined && plan.ciOut !== undefined) {
        artifacts.push({ kind: 'ci-markdown', path: plan.ciOut });
      }
      await writeManifest(
        plan.manifest,
        serializeRunManifest(
          buildRunManifest(
            summary,
            skippedAttachments,
            artifacts,
            plan.manifest,
          ),
        ),
      );
    }

    printMachine(plan, summary, ciText, io);
    if (plan.stdout.machine === null) printConfirmations(plan, io);
    return plan.exitCodes.success;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    io.stderr(`tolkira: ${detail}\n`);
    return plan.exitCodes.failure;
  }
}
