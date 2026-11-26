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
type CliFailure =
  | { ok: false; kind: 'message'; message: string }
  | { ok: false; kind: 'usage' };
function fail(message: string): CliFailure {
  return { ok: false, kind: 'message', message };
}
function fromError(error: unknown): CliFailure {
  return fail(error instanceof Error ? error.message : String(error));
}
export function planOptions(argv: string[]): CliOptionsResult {
  let parsed: ReturnType<typeof parseCliArgs>;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    return fromError(error);
  }
  if (parsed.values.help) return { ok: true, action: 'help' };
  if (parsed.values.version) return { ok: true, action: 'version' };
  if (parsed.values.capabilities) {
    const combined =
      parsed.positionals.length > 0 ||
      Object.keys(parsed.values).some((key) => key !== 'capabilities');
    if (combined) {
      return fail(
        '--capabilities takes no input and no other option; ' +
          'run tolkira --capabilities alone',
      );
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

  if (report === '') return fail('--out requires a file path');
  if (pdf === '') return fail('--pdf requires a file path');
  if (baseline === '') return fail('--baseline requires a file path');
  if (manifest === '') return fail('--manifest requires a file path');
  if (parsed.values.static && !report && pdf === undefined) {
    return fail('--static requires --out or --pdf');
  }
  if (parsed.values['pdf-timeout'] !== undefined && pdf === undefined) {
    return fail('--pdf-timeout requires --pdf');
  }

  let pdfTimeout: number | undefined;
  try {
    pdfTimeout = parsePdfTimeout(parsed.values['pdf-timeout']);
  } catch (error) {
    return fromError(error);
  }

  if (email === '') return fail('--email requires a file path');

  let locale: string | undefined;
  if (parsed.values.locale !== undefined) {
    try {
      locale = resolveLocale(parsed.values.locale).requested;
    } catch (error) {
      return fromError(error);
    }
  }
  if (
    locale !== undefined &&
    !report &&
    email === undefined &&
    pdf === undefined
  ) {
    return fail('--locale requires --out, --pdf or --email');
  }

  let ci: CiFormat | undefined;
  try {
    ci = parseCiFormat(parsed.values.ci);
  } catch (error) {
    return fromError(error);
  }
  if (ciOut === '') return fail('--ci-out requires a file path');
  if (ciOut !== undefined && ci === undefined) {
    return fail('--ci-out requires --ci');
  }
  if ((ci === 'github' || ci === 'azure') && ciOut !== undefined) {
    return fail(
      `--ci ${ci} writes annotations to stdout; ` +
        '--ci-out is only for --ci markdown',
    );
  }
  if (json && ci !== undefined && ciOut === undefined) {
    const alternative =
      ci === 'github'
        ? 'drop --json or --ci github'
        : ci === 'azure'
          ? 'drop --json or --ci azure, or use --ci markdown with --ci-out'
          : 'add --ci-out for the Markdown summary or drop one';
    return fail(`--json and --ci ${ci} both write to stdout; ` + alternative);
  }
  if (
    baseline !== undefined &&
    !report &&
    !json &&
    pdf === undefined &&
    ci !== 'markdown'
  ) {
    return fail('--baseline requires --out, --pdf, --json or --ci markdown');
  }
  if (parsed.values['history-limit'] !== undefined && history === undefined) {
    return fail('--history-limit requires --history');
  }
  if (history !== undefined && history !== '' && !report) {
    return fail('--history requires --out');
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
  if (parsed.values.logo === '') return fail('--logo requires a file path');
  if (!report && parsed.values.logo) return fail('--logo requires --out');
  if (history === '') return fail('--history requires a file path');

  let historyLimit: number | undefined;
  try {
    historyLimit = parseHistoryLimit(parsed.values['history-limit']);
  } catch (error) {
    return fromError(error);
  }

  const options: CliOptions = {
    inputs,
    json: json ?? false,
    static: parsed.values.static ?? false,
  };
  if (report !== undefined) options.report = report;
  if (pdf !== undefined) options.pdf = pdf;
  if (email !== undefined) options.email = email;
  if (history !== undefined) options.history = history;
  if (ciOut !== undefined) options.ciOut = ciOut;
  if (manifest !== undefined) options.manifest = manifest;
  if (baseline !== undefined) options.baseline = baseline;
  if (ci !== undefined) options.ci = ci;
  if (parsed.values.title !== undefined) options.title = parsed.values.title;
  if (locale !== undefined) options.locale = locale;
  if (pdfTimeout !== undefined) options.pdfTimeout = pdfTimeout;
  if (historyLimit !== undefined) options.historyLimit = historyLimit;
  if (parsed.values.meta !== undefined) options.meta = parsed.values.meta;
  if (parsed.values['max-size'] !== undefined) {
    options.maxSize = parsed.values['max-size'];
  }
  if (parsed.values.accent !== undefined) options.accent = parsed.values.accent;
  if (parsed.values.logo !== undefined) options.logo = parsed.values.logo;
  return { ok: true, options };
}

export async function planCli(argv: string[]): Promise<CliPlanResult> {
  const planned = planOptions(argv);
  if (!planned.ok) {
    return planned.kind === 'usage'
      ? { ok: false, kind: 'usage' }
      : { ok: false, kind: 'message', message: planned.message };
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
  const conflicts = (file: string, peer?: string) =>
    pathConflicts(file, inputs, logo, report, pdf, ciOut, email, peer);
  const same = (a?: string, b?: string) =>
    a !== undefined && b !== undefined && samePath(a, b);

  if (manifest !== undefined) {
    if ((await conflicts(manifest, history)) || same(manifest, baseline)) {
      return fail(
        '--manifest must not overwrite an input file, the logo, ' +
          '--out, --pdf, --email, --history, --ci-out or --baseline',
      );
    }
    for (const [flag, artifact] of [
      ['--out', report],
      ['--pdf', pdf],
      ['--email', email],
      ['--history', history],
      ['--ci-out', ciOut],
    ] as const) {
      if (artifact !== undefined && cannotExpressRelative(manifest, artifact)) {
        return fail(
          `${flag} ${oneLine(artifact)} cannot be expressed relative ` +
            `to --manifest; pass an absolute ${flag} path`,
        );
      }
    }
  }
  if (history !== undefined && (await conflicts(history, baseline))) {
    return fail(
      '--history must not overwrite an input file, the logo, ' +
        '--out, --pdf, --ci-out, --email or --baseline',
    );
  }
  if (baseline !== undefined && (await conflicts(baseline, history))) {
    return fail(
      '--baseline must not name an input file, the logo, ' +
        '--out, --pdf, --email, --history or --ci-out',
    );
  }
  if (report && (await outputOverwritesInput(inputs, report, logo))) {
    return fail('--out must not overwrite an input file');
  }
  if (ciOut !== undefined) {
    if (same(ciOut, report)) return fail('--ci-out must not overwrite --out');
    if (await outputOverwritesInput(inputs, ciOut, logo)) {
      return fail('--ci-out must not overwrite an input file or the logo');
    }
  }
  if (email !== undefined) {
    if (same(email, report)) return fail('--email must not overwrite --out');
    if (same(email, ciOut)) return fail('--email must not overwrite --ci-out');
    if (await conflictsWithInputs(email, inputs)) {
      return fail('--email must not overwrite an input file or directory');
    }
    if (await outputOverwritesInput(inputs, email, logo)) {
      return fail('--email must not overwrite an input file or the logo');
    }
  }
  if (pdf !== undefined) {
    if (same(pdf, report)) return fail('--pdf must not overwrite --out');
    if (same(pdf, ciOut)) return fail('--pdf must not overwrite --ci-out');
    if (same(pdf, email)) return fail('--pdf must not overwrite --email');
    if (same(pdf, logo)) return fail('--pdf must not overwrite the logo');
    if (await conflictsWithInputs(pdf, inputs)) {
      return fail('--pdf must not overwrite an input file or directory');
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
    return fromError(error);
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

  const plan: CliPlan = {
    mode,
    inputs,
    json: options.json,
    metadata,
    static: options.static,
    maxSizeMb,
    writes,
    stdout: { machine, confirmations },
    exitCodes: { success: 0, failure: 1 },
  };
  if (report !== undefined) plan.report = report;
  if (pdf !== undefined) plan.pdf = pdf;
  if (email !== undefined) plan.email = email;
  if (history !== undefined) plan.history = history;
  if (ciOut !== undefined) plan.ciOut = ciOut;
  if (manifest !== undefined) plan.manifest = manifest;
  if (baseline !== undefined) plan.baseline = baseline;
  if (options.ci !== undefined) plan.ci = options.ci;
  if (options.title !== undefined) plan.title = options.title;
  if (options.locale !== undefined) plan.locale = options.locale;
  if (accent !== undefined) plan.accent = accent;
  if (logoDataUri !== undefined) plan.logoDataUri = logoDataUri;
  if (options.pdfTimeout !== undefined) plan.pdfTimeout = options.pdfTimeout;
  if (options.historyLimit !== undefined) {
    plan.historyLimit = options.historyLimit;
  }
  return { ok: true, action: { kind: 'run', plan } };
}
