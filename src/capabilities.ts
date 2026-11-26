import {
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
} from './attachment.js';
import { BASELINE_MAX_BYTES } from './baseline.js';
import type { CiFormat } from './ci.js';
import {
  HISTORY_LIMIT,
  HISTORY_LIMIT_MAX,
  HISTORY_MAX_BYTES,
} from './history.js';
import { MAX_TOTAL_INPUT_BYTES } from './input/load.js';
import { DEFAULT_TIMEOUT_MS } from './pdf.js';
import { SUPPORTED_LOCALES } from './render/i18n.js';
import { SUMMARY_SCHEMA_VERSION } from './summary.js';
import { version } from './version.js';
import { DEFAULT_MAX_SIZE_MB, INPUT_WARN_BYTES } from './warnings.js';

const CAPABILITIES_SCHEMA_VERSION = 1;
const TOOL_NAME = 'tolkira';
/** The package's Node range; `package.json#engines.node` pins it by test. */
const NODE_RANGE = '>=22';

/** Accepted input kinds, in the order the input interface documents them. */
const INPUT_KINDS = [
  'cucumber-legacy-json',
  'junit-xml',
  'cucumber-messages',
  'playwright-json',
] as const;

// Typing the map as a complete record makes a new CiFormat a compile error
// until the capabilities document lists its flag.
const CI_FLAGS: Record<CiFormat, string> = {
  github: '--ci github',
  azure: '--ci azure',
  markdown: '--ci markdown',
};

interface CapabilitiesOutput {
  kind: string;
  flag: string;
  fileFlag?: string;
}

const OUTPUTS: readonly CapabilitiesOutput[] = [
  { kind: 'report', flag: '--out' },
  { kind: 'pdf', flag: '--pdf' },
  { kind: 'email', flag: '--email' },
  { kind: 'json-summary', flag: '--json' },
  { kind: 'ci-github', flag: CI_FLAGS.github },
  { kind: 'ci-azure', flag: CI_FLAGS.azure },
  { kind: 'ci-markdown', flag: CI_FLAGS.markdown, fileFlag: '--ci-out' },
  { kind: 'history', flag: '--history' },
  { kind: 'manifest', flag: '--manifest' },
];

interface CapabilitiesDocument {
  schemaVersion: number;
  name: string;
  version: string;
  node: string;
  inputs: readonly string[];
  outputs: readonly CapabilitiesOutput[];
  summarySchemaVersion: number;
  locales: readonly string[];
  limits: {
    inputTotalBytes: number;
    inputWarnBytes: number;
    attachmentBytes: number;
    totalAttachmentBytes: number;
    baselineBytes: number;
    historyBytes: number;
    historyLimitMax: number;
  };
  defaults: {
    reportWarnMb: number;
    pdfTimeoutMs: number;
    historyLimit: number;
  };
  exitCodes: {
    generated: number;
    inputOrWriteFailure: number;
    usage: number;
  };
}

/**
 * The schema-1 capabilities document. Every value comes from the module that
 * enforces it, so the machine surface cannot drift from the runtime.
 */
function capabilitiesDocument(): CapabilitiesDocument {
  return {
    schemaVersion: CAPABILITIES_SCHEMA_VERSION,
    name: TOOL_NAME,
    version,
    node: NODE_RANGE,
    inputs: [...INPUT_KINDS],
    outputs: OUTPUTS,
    summarySchemaVersion: SUMMARY_SCHEMA_VERSION,
    locales: [...SUPPORTED_LOCALES],
    limits: {
      inputTotalBytes: MAX_TOTAL_INPUT_BYTES,
      inputWarnBytes: INPUT_WARN_BYTES,
      attachmentBytes: MAX_ATTACHMENT_BYTES,
      totalAttachmentBytes: MAX_TOTAL_ATTACHMENT_BYTES,
      baselineBytes: BASELINE_MAX_BYTES,
      historyBytes: HISTORY_MAX_BYTES,
      historyLimitMax: HISTORY_LIMIT_MAX,
    },
    defaults: {
      reportWarnMb: DEFAULT_MAX_SIZE_MB,
      pdfTimeoutMs: DEFAULT_TIMEOUT_MS,
      historyLimit: HISTORY_LIMIT,
    },
    exitCodes: {
      generated: 0,
      inputOrWriteFailure: 1,
      usage: 2,
    },
  };
}

/** Two-space JSON with one trailing newline, like the summary and history. */
export function capabilitiesJson(): string {
  return `${JSON.stringify(capabilitiesDocument(), null, 2)}\n`;
}
