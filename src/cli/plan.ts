import type { CiFormat } from '../ci.js';
import { outputOverwritesInput, samePath } from '../output.js';
import { resolveLocale } from '../render/i18n.js';
import { oneLine } from '../text.js';
import {
  parseAccent,
  parseCiFormat,
  parseCliArgs,
  parseHistoryLimit,
  parseMaxSize,
  parseMetadata,
  parsePdfTimeout,
} from './args.js';
import { readLogo } from './logo.js';
import {
  cannotExpressRelative,
  conflictsWithInputs,
  pathConflicts,
} from './paths.js';

interface CliOptions {
  inputs: string[];
  report?: string;
  pdf?: string;
  email?: string;
  history?: string;
  ciOut?: string;
  manifest?: string;
  baseline?: string;
  json: boolean;
  ci?: CiFormat;
  title?: string;
  locale?: string;
  static: boolean;
  pdfTimeout?: number;
  historyLimit?: number;
  meta?: string[];
  maxSize?: string;
  accent?: string;
  logo?: string;
}

export type CliOptionsResult =
  | { ok: true; action: 'help' | 'version' | 'capabilities' }
  | { ok: true; options: CliOptions }
  | { ok: false; kind: 'message'; message: string }
  | { ok: false; kind: 'usage' };

type CliOutputKind =
  | 'report'
  | 'pdf'
  | 'email'
  | 'history'
  | 'ci-markdown'
  | 'manifest';

type CliConfirmationKind = Extract<
  CliOutputKind,
  'report' | 'pdf' | 'email' | 'manifest'
>;

export interface CliPlan {
  /** 'summary' when no report/PDF is generated, 'generate' otherwise. */
  mode: 'summary' | 'generate';
  inputs: string[];

  report?: string;
  pdf?: string;
  email?: string;
  history?: string;
  ciOut?: string;
  manifest?: string;
  baseline?: string;

  json: boolean;
  ci?: CiFormat;
  title?: string;
  locale?: string;
  metadata: Record<string, string>;
  accent?: string;
  /** Validated data URI, not a path. */
  logoDataUri?: string;
  static: boolean;
  maxSizeMb: number;
  pdfTimeout?: number;
  historyLimit?: number;

  /** Declared file order, stdout excluded. */
  writes: readonly CliOutputKind[];
  /** Who owns stdout, and which confirmations print when it is free. */
  stdout: {
    machine: 'json' | 'ci' | null;
    confirmations: readonly CliConfirmationKind[];
  };
  /** Execute returns success or failure; usage never produces a plan. */
  exitCodes: { readonly success: 0; readonly failure: 1 };
}

type CliAction =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'capabilities' }
  | { kind: 'run'; plan: CliPlan };

type CliPlanResult =
  | { ok: true; action: CliAction }
  | { ok: false; kind: 'message'; message: string }
  | { ok: false; kind: 'usage' };

function message(error: unknown): CliOptionsResult {
  return {
    ok: false,
    kind: 'message',
    message: error instanceof Error ? error.message : String(error),
  };
}

export async function planOptions(argv: string[]): Promise<CliOptionsResult> {
  let parsed: ReturnType<typeof parseCliArgs>;

  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    return message(error);
  }

  if (parsed.values.help) {
    return { ok: true, action: 'help' };
  }

  if (parsed.values.version) {
    return { ok: true, action: 'version' };
  }

  if (parsed.values.capabilities) {
    const combined =
      parsed.positionals.length > 0 ||
      Object.keys(parsed.values).some((key) => key !== 'capabilities');
    if (combined) {
      return {
        ok: false,
        kind: 'message',
        message:
          '--capabilities takes no input and no other option; ' +
          'run tolkira --capabilities alone',
      };
    }
    return { ok: true, action: 'capabilities' };
  }

  const inputs = parsed.positionals;
  const report = parsed.values.out;
  const pdf = parsed.values.pdf;
  const email = parsed.values.email;
  const json = parsed.values.json;
  const ciOut = parsed.values['ci-out'];
  const history = parsed.values.history;
  const baseline = parsed.values.baseline;
  const manifest = parsed.values.manifest;

  if (report === '') {
    return { ok: false, kind: 'message', message: '--out requires a file path' };
  }

  if (pdf === '') {
    return { ok: false, kind: 'message', message: '--pdf requires a file path' };
  }

  if (baseline === '') {
    return {
      ok: false,
      kind: 'message',
      message: '--baseline requires a file path',
    };
  }

  if (manifest === '') {
    return {
      ok: false,
      kind: 'message',
      message: '--manifest requires a file path',
    };
  }

  if (parsed.values.static && !report && pdf === undefined) {
    return {
      ok: false,
      kind: 'message',
      message: '--static requires --out or --pdf',
    };
  }

  if (parsed.values['pdf-timeout'] !== undefined && pdf === undefined) {
    return {
      ok: false,
      kind: 'message',
      message: '--pdf-timeout requires --pdf',
    };
  }

  let pdfTimeout: number | undefined;
  try {
    pdfTimeout = parsePdfTimeout(parsed.values['pdf-timeout']);
  } catch (error) {
    return message(error);
  }

  if (email === '') {
    return {
      ok: false,
      kind: 'message',
      message: '--email requires a file path',
    };
  }

  let locale: string | undefined;
  if (parsed.values.locale !== undefined) {
    try {
      locale = resolveLocale(parsed.values.locale).requested;
    } catch (error) {
      return message(error);
    }
  }

  if (locale !== undefined && !report && email === undefined && pdf === undefined) {
    return {
      ok: false,
      kind: 'message',
      message: '--locale requires --out, --pdf or --email',
    };
  }

  let ci: CiFormat | undefined;
  try {
    ci = parseCiFormat(parsed.values.ci);
  } catch (error) {
    return message(error);
  }

  if (ciOut === '') {
    return {
      ok: false,
      kind: 'message',
      message: '--ci-out requires a file path',
    };
  }

  if (ciOut !== undefined && ci === undefined) {
    return { ok: false, kind: 'message', message: '--ci-out requires --ci' };
  }

  if ((ci === 'github' || ci === 'azure') && ciOut !== undefined) {
    return {
      ok: false,
      kind: 'message',
      message:
        `--ci ${ci} writes annotations to stdout; ` +
        '--ci-out is only for --ci markdown',
    };
  }

  if (json && ci !== undefined && ciOut === undefined) {
    const alternative =
      ci === 'github'
        ? 'drop --json or --ci github'
        : ci === 'azure'
          ? 'drop --json or --ci azure, or use --ci markdown with --ci-out'
          : 'add --ci-out for the Markdown summary or drop one';
    return {
      ok: false,
      kind: 'message',
      message:
        `--json and --ci ${ci} both write to stdout; ` +
        `${alternative}`,
    };
  }

  if (
    baseline !== undefined &&
    !report &&
    !json &&
    pdf === undefined &&
    ci !== 'markdown'
  ) {
    return {
      ok: false,
      kind: 'message',
      message: '--baseline requires --out, --pdf, --json or --ci markdown',
    };
  }

  if (parsed.values['history-limit'] !== undefined && history === undefined) {
    return {
      ok: false,
      kind: 'message',
      message: '--history-limit requires --history',
    };
  }

  if (history !== undefined && history !== '' && !report) {
    return { ok: false, kind: 'message', message: '--history requires --out' };
  }

  if (
    inputs.length === 0 ||
    (!report &&
      !json &&
      ci === undefined &&
      email === undefined &&
      pdf === undefined &&
      manifest === undefined)
  ) {
    return { ok: false, kind: 'usage' };
  }

  if (parsed.values.logo === '') {
    return {
      ok: false,
      kind: 'message',
      message: '--logo requires a file path',
    };
  }

  if (!report && parsed.values.logo) {
    return { ok: false, kind: 'message', message: '--logo requires --out' };
  }

  if (history === '') {
    return {
      ok: false,
      kind: 'message',
      message: '--history requires a file path',
    };
  }

  let historyLimit: number | undefined;
  try {
    historyLimit = parseHistoryLimit(parsed.values['history-limit']);
  } catch (error) {
    return message(error);
  }

  return {
    ok: true,
    options: {
      inputs,
      ...(report === undefined ? {} : { report }),
      ...(pdf === undefined ? {} : { pdf }),
      ...(email === undefined ? {} : { email }),
      ...(history === undefined ? {} : { history }),
      ...(ciOut === undefined ? {} : { ciOut }),
      ...(manifest === undefined ? {} : { manifest }),
      ...(baseline === undefined ? {} : { baseline }),
      json: json ?? false,
      ...(ci === undefined ? {} : { ci }),
      ...(parsed.values.title === undefined
        ? {}
        : { title: parsed.values.title }),
      ...(locale === undefined ? {} : { locale }),
      static: parsed.values.static ?? false,
      ...(pdfTimeout === undefined ? {} : { pdfTimeout }),
      ...(historyLimit === undefined ? {} : { historyLimit }),
      ...(parsed.values.meta === undefined
        ? {}
        : { meta: parsed.values.meta }),
      ...(parsed.values['max-size'] === undefined
        ? {}
        : { maxSize: parsed.values['max-size'] }),
      ...(parsed.values.accent === undefined
        ? {}
        : { accent: parsed.values.accent }),
      ...(parsed.values.logo === undefined
        ? {}
        : { logo: parsed.values.logo }),
    },
  };
}

export async function planCli(argv: string[]): Promise<CliPlanResult> {
  const planned = await planOptions(argv);
  if (!planned.ok) {
    return planned;
  }
  if ('action' in planned) {
    return { ok: true, action: { kind: planned.action } };
  }

  const options = planned.options;
  const inputs = options.inputs;
  const report = options.report;
  const pdf = options.pdf;
  const email = options.email;
  const history = options.history;
  const ciOut = options.ciOut;
  const manifest = options.manifest;
  const baseline = options.baseline;
  const logo = options.logo;

  if (manifest !== undefined) {
    const collides =
      (await pathConflicts(
        manifest,
        inputs,
        logo,
        report,
        pdf,
        ciOut,
        email,
        history,
      )) ||
      (baseline !== undefined && samePath(manifest, baseline));
    if (collides) {
      return {
        ok: false,
        kind: 'message',
        message:
          '--manifest must not overwrite an input file, the logo, ' +
          '--out, --pdf, --email, --history, --ci-out or --baseline',
      };
    }

    const artifacts: Array<[string, string | undefined]> = [
      ['--out', report],
      ['--pdf', pdf],
      ['--email', email],
      ['--history', history],
      ['--ci-out', ciOut],
    ];
    for (const [flag, artifact] of artifacts) {
      if (artifact !== undefined && cannotExpressRelative(manifest, artifact)) {
        return {
          ok: false,
          kind: 'message',
          message:
            `${flag} ${oneLine(artifact)} cannot be expressed relative ` +
            `to --manifest; pass an absolute ${flag} path`,
        };
      }
    }
  }

  if (
    history !== undefined &&
    (await pathConflicts(
      history,
      inputs,
      logo,
      report,
      pdf,
      ciOut,
      email,
      baseline,
    ))
  ) {
    return {
      ok: false,
      kind: 'message',
      message:
        '--history must not overwrite an input file, the logo, ' +
        '--out, --pdf, --ci-out, --email or --baseline',
    };
  }

  if (
    baseline !== undefined &&
    (await pathConflicts(
      baseline,
      inputs,
      logo,
      report,
      pdf,
      ciOut,
      email,
      history,
    ))
  ) {
    return {
      ok: false,
      kind: 'message',
      message:
        '--baseline must not name an input file, the logo, ' +
        '--out, --pdf, --email, --history or --ci-out',
    };
  }

  if (report && (await outputOverwritesInput(inputs, report, logo))) {
    return {
      ok: false,
      kind: 'message',
      message: '--out must not overwrite an input file',
    };
  }

  if (ciOut !== undefined) {
    if (report && samePath(ciOut, report)) {
      return {
        ok: false,
        kind: 'message',
        message: '--ci-out must not overwrite --out',
      };
    }
    if (await outputOverwritesInput(inputs, ciOut, logo)) {
      return {
        ok: false,
        kind: 'message',
        message: '--ci-out must not overwrite an input file or the logo',
      };
    }
  }

  if (email !== undefined) {
    if (report && samePath(email, report)) {
      return {
        ok: false,
        kind: 'message',
        message: '--email must not overwrite --out',
      };
    }
    if (ciOut !== undefined && samePath(email, ciOut)) {
      return {
        ok: false,
        kind: 'message',
        message: '--email must not overwrite --ci-out',
      };
    }
    if (await conflictsWithInputs(email, inputs)) {
      return {
        ok: false,
        kind: 'message',
        message: '--email must not overwrite an input file or directory',
      };
    }
    if (await outputOverwritesInput(inputs, email, logo)) {
      return {
        ok: false,
        kind: 'message',
        message: '--email must not overwrite an input file or the logo',
      };
    }
  }

  if (pdf !== undefined) {
    if (report && samePath(pdf, report)) {
      return {
        ok: false,
        kind: 'message',
        message: '--pdf must not overwrite --out',
      };
    }
    if (ciOut !== undefined && samePath(pdf, ciOut)) {
      return {
        ok: false,
        kind: 'message',
        message: '--pdf must not overwrite --ci-out',
      };
    }
    if (email !== undefined && samePath(pdf, email)) {
      return {
        ok: false,
        kind: 'message',
        message: '--pdf must not overwrite --email',
      };
    }
    if (logo !== undefined && samePath(pdf, logo)) {
      return {
        ok: false,
        kind: 'message',
        message: '--pdf must not overwrite the logo',
      };
    }
    if (await conflictsWithInputs(pdf, inputs)) {
      return {
        ok: false,
        kind: 'message',
        message: '--pdf must not overwrite an input file or directory',
      };
    }
  }

  let metadata: Record<string, string>;
  let maxSizeMb: number;
  let accent: string | undefined;
  let logoDataUri: string | undefined;
  try {
    metadata = parseMetadata(options.meta);
    maxSizeMb = parseMaxSize(options.maxSize);
    accent = parseAccent(options.accent);
    logoDataUri = logo ? await readLogo(logo) : undefined;
  } catch (error) {
    return {
      ok: false,
      kind: 'message',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const mode =
    report === undefined && pdf === undefined ? 'summary' : 'generate';
  const writes: CliOutputKind[] = [];
  if (mode === 'generate') {
    if (report !== undefined) writes.push('report');
    if (pdf !== undefined) writes.push('pdf');
  }
  if (email !== undefined) writes.push('email');
  if (mode === 'generate' && history !== undefined) writes.push('history');
  if (ciOut !== undefined) writes.push('ci-markdown');
  if (manifest !== undefined) writes.push('manifest');

  const machine = options.json
    ? 'json'
    : options.ci !== undefined && ciOut === undefined
      ? 'ci'
      : null;
  const confirmations: CliConfirmationKind[] = [];
  if (machine === null) {
    if (mode === 'generate' && report !== undefined) {
      confirmations.push('report');
    }
    if (mode === 'generate' && pdf !== undefined) {
      confirmations.push('pdf');
    }
    if (email !== undefined) confirmations.push('email');
    if (manifest !== undefined) confirmations.push('manifest');
  }

  return {
    ok: true,
    action: {
      kind: 'run',
      plan: {
        mode,
        inputs,
        ...(report === undefined ? {} : { report }),
        ...(pdf === undefined ? {} : { pdf }),
        ...(email === undefined ? {} : { email }),
        ...(history === undefined ? {} : { history }),
        ...(ciOut === undefined ? {} : { ciOut }),
        ...(manifest === undefined ? {} : { manifest }),
        ...(baseline === undefined ? {} : { baseline }),
        json: options.json,
        ...(options.ci === undefined ? {} : { ci: options.ci }),
        ...(options.title === undefined ? {} : { title: options.title }),
        ...(options.locale === undefined ? {} : { locale: options.locale }),
        metadata,
        ...(accent === undefined ? {} : { accent }),
        ...(logoDataUri === undefined ? {} : { logoDataUri }),
        static: options.static,
        maxSizeMb,
        ...(options.pdfTimeout === undefined
          ? {}
          : { pdfTimeout: options.pdfTimeout }),
        ...(options.historyLimit === undefined
          ? {}
          : { historyLimit: options.historyLimit }),
        writes,
        stdout: { machine, confirmations },
        exitCodes: { success: 0, failure: 1 },
      },
    },
  };
}
