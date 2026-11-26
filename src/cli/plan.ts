import type { CiFormat } from '../ci.js';
import { resolveLocale } from '../render/i18n.js';
import {
  parseCiFormat,
  parseCliArgs,
  parseHistoryLimit,
  parsePdfTimeout,
} from './args.js';

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
