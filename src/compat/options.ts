import { readFile, stat } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import path from 'node:path';
import type { ReportSummary } from '../summary.js';
import { collectReportFiles } from '../input/files.js';
import { addInputBytes, MAX_TOTAL_INPUT_BYTES } from '../input/load.js';

export interface CompatResult {
  output: string;
  warnings: string[];
  summary: ReportSummary;
}

export interface CucumberHtmlReporterOptions {
  jsonFile?: string;
  jsonDir?: string;
  output?: string;
  theme?: string;
  name?: string;
  brandTitle?: string;
  metadata?: Record<string, unknown>;
  storeScreenshots?: boolean;
  screenshotsDirectory?: string;
  noInlineScreenshots?: boolean;
  launchReport?: boolean;
  ignoreBadJsonFile?: boolean;
  reportSuiteAsScenarios?: boolean;
  scenarioTimestamp?: boolean;
  columnLayout?: boolean;
  failedSummaryReport?: boolean;
  [key: string]: unknown;
}

const HANDLED_OPTIONS = new Set([
  'jsonFile',
  'jsonDir',
  'output',
  'name',
  'brandTitle',
  'metadata',
  'ignoreBadJsonFile',
]);

const IGNORED_OPTIONS: Record<string, string> = {
  theme: 'ignored; Tolkira uses its own theme',
  reportSuiteAsScenarios: 'ignored; Tolkira uses its own scenario grouping',
  scenarioTimestamp: 'ignored; Tolkira shows the run timestamp',
  columnLayout: 'ignored; Tolkira uses its own layout',
  failedSummaryReport: 'ignored; Tolkira has its own failed-first view',
  storeScreenshots: 'ignored; attachments stay inline',
  screenshotsDirectory: 'ignored; attachments stay inline',
  noInlineScreenshots: 'ignored; attachments stay inline',
  launchReport: 'ignored; Tolkira never opens a browser',
};

export function warnIgnoredOptions(
  options: CucumberHtmlReporterOptions,
  warnings: string[],
): void {
  for (const key of Object.keys(options)) {
    if (HANDLED_OPTIONS.has(key)) continue;
    const value = options[key];
    if (value === undefined || value === false || value === '') continue;
    warnings.push(
      `${key}: ${IGNORED_OPTIONS[key] ?? 'not supported by Tolkira; ignored'}`,
    );
  }
}

/** The configured input root: jsonFile wins over jsonDir, as in resolveInputs. */
export function inputRoot(
  options: CucumberHtmlReporterOptions,
): string | undefined {
  const jsonFile =
    typeof options.jsonFile === 'string' && options.jsonFile.trim()
      ? options.jsonFile.trim()
      : undefined;
  if (jsonFile) return jsonFile;
  return typeof options.jsonDir === 'string' && options.jsonDir.trim()
    ? options.jsonDir.trim()
    : undefined;
}

export function requireOutput(options: CucumberHtmlReporterOptions): string {
  const output =
    typeof options.output === 'string' ? options.output.trim() : '';
  if (!output) throw new Error('compat: output is required');
  return output;
}

export function mapTitle(
  options: CucumberHtmlReporterOptions,
  warnings: string[],
): string {
  const brand =
    typeof options.brandTitle === 'string' ? options.brandTitle.trim() : '';
  const name = typeof options.name === 'string' ? options.name.trim() : '';
  if (brand && name && brand !== name) {
    warnings.push('brandTitle and name differ; using brandTitle');
  }
  return brand || name || 'Tolkira report';
}

export function flattenMetadata(
  value: unknown,
  warnings: string[],
): Record<string, string> {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    warnings.push('metadata: expected an object; ignored');
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string') {
      result[key] = raw;
    } else if (typeof raw === 'number' || typeof raw === 'boolean') {
      result[key] = String(raw);
    } else {
      warnings.push(
        `metadata.${key}: only string, number or boolean values are supported; ignored`,
      );
    }
  }
  return result;
}

export async function resolveInputs(
  options: CucumberHtmlReporterOptions,
  warnings: string[],
): Promise<string[]> {
  const jsonFile =
    typeof options.jsonFile === 'string' && options.jsonFile.trim()
      ? options.jsonFile.trim()
      : undefined;
  const jsonDir =
    typeof options.jsonDir === 'string' && options.jsonDir.trim()
      ? options.jsonDir.trim()
      : undefined;

  if (jsonFile && jsonDir) {
    warnings.push('jsonFile and jsonDir are both set; using jsonFile');
  }
  if (!jsonFile && !jsonDir) {
    throw new Error('compat: jsonFile or jsonDir is required');
  }
  if (jsonFile) return [jsonFile];

  const files = (await collectReportFiles(jsonDir!)).filter(
    (file) => path.extname(file).toLowerCase() === '.json',
  );
  if (files.length === 0) {
    throw new Error('No supported report files found.');
  }
  if (!options.ignoreBadJsonFile) return files;

  const valid: string[] = [];
  let totalBytes = 0;
  for (const file of files) {
    let info: Stats;
    try {
      info = await stat(file);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      warnings.push(`skipped invalid JSON file ${file}: ${detail}`);
      continue;
    }
    if (info.size > MAX_TOTAL_INPUT_BYTES) {
      warnings.push(`skipped oversized JSON file ${file}: over 100 MB`);
      continue;
    }
    totalBytes = addInputBytes(totalBytes, info.size);
    try {
      const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('not a feature array');
      valid.push(file);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      warnings.push(`skipped invalid JSON file ${file}: ${detail}`);
    }
  }
  if (valid.length === 0) {
    throw new Error(`No valid JSON reports in ${jsonDir}.`);
  }
  return valid;
}
