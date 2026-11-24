import { readFile } from 'node:fs/promises';
import { isFeatureLike } from '../input/detect.js';
import { generateReport } from '../index.js';
import { outputOverwritesInput, samePath, writeAtomic } from '../output.js';
import { ATTACHMENT_HINT, attachmentWarning } from '../warnings.js';
import {
  flattenMetadata,
  inputRoot,
  mapTitle,
  requireOutput,
  resolveInputs,
  stripBom,
  warnIgnoredOptions,
} from './options.js';
import type { CompatResult, CucumberHtmlReporterOptions } from './options.js';

export type { CompatResult, CucumberHtmlReporterOptions } from './options.js';

const FALLBACK_URI = 'Feature: URI Not Present';

interface MergedFeature {
  feature: Record<string, unknown>;
  elements: unknown[];
}

function featureKey(feature: Record<string, unknown>): string {
  return typeof feature.uri === 'string' && feature.uri
    ? feature.uri
    : FALLBACK_URI;
}

interface ParsedInput {
  file: string;
  features: Record<string, unknown>[];
}

interface SidecarPlan {
  inputs: string[];
  merged: MergedFeature[];
}

/** A valid legacy feature array, or undefined for parse/shape failure. */
async function readFeatures(
  file: string,
): Promise<Record<string, unknown>[] | undefined> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBom(await readFile(file, 'utf8')));
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed) || !parsed.every(isFeatureLike)) {
    return undefined;
  }
  return parsed as Record<string, unknown>[];
}

function collisionError(sidecar: string, input: string): Error {
  return new Error(
    `compat: sidecar ${sidecar} must not overwrite an input file (${input})`,
  );
}

/** True when every candidate feature key also appears in another input. */
function isPreviousSidecar(
  candidate: ParsedInput,
  others: ParsedInput[],
): boolean {
  if (others.length === 0) return false;
  const represented = new Set<string>();
  for (const { features } of others) {
    for (const feature of features) represented.add(featureKey(feature));
  }
  return candidate.features.every((feature) =>
    represented.has(featureKey(feature)),
  );
}

/** Parses every input once, validates it and plans the merged sidecar. */
async function planSidecar(
  inputs: string[],
  sidecar: string,
): Promise<SidecarPlan> {
  const parsed: ParsedInput[] = [];
  for (const file of inputs) {
    const features = await readFeatures(file);
    if (!features) {
      throw new Error(`compat: ${file} is not a legacy feature array`);
    }
    parsed.push({ file, features });
  }

  const index = parsed.findIndex(({ file }) => samePath(file, sidecar));
  let selected = parsed;
  if (index !== -1) {
    const candidate = parsed[index];
    const others = parsed.filter((_, position) => position !== index);
    if (!isPreviousSidecar(candidate, others)) {
      throw collisionError(sidecar, candidate.file);
    }
    selected = others;
  }

  const merged = new Map<string, MergedFeature>();
  for (const { features } of selected) {
    for (const feature of features) {
      const key = featureKey(feature);
      const elements = (
        Array.isArray(feature.elements) ? feature.elements : []
      ).map((element) => ({ ...(element as object), retried: 0 }));
      const existing = merged.get(key);
      if (existing) {
        for (const element of elements) existing.elements.push(element);
      } else {
        merged.set(key, { feature, elements });
      }
    }
  }

  return {
    inputs: selected.map(({ file }) => file),
    merged: [...merged.values()],
  };
}

/** Writes the planned merged array; a same-path input is refused as defense. */
async function writeMergedJson(
  plan: SidecarPlan,
  sidecar: string,
): Promise<void> {
  for (const input of plan.inputs) {
    if (samePath(input, sidecar)) throw collisionError(sidecar, input);
  }
  const result = plan.merged.map(({ feature, elements }) => ({
    ...feature,
    elements,
  }));
  await writeAtomic(sidecar, JSON.stringify(result, null, 2));
}

async function run(
  options: CucumberHtmlReporterOptions,
): Promise<CompatResult> {
  const warnings: string[] = [];
  const output = requireOutput(options);
  warnIgnoredOptions(options, warnings);
  const hasJsonFile = Boolean(
    typeof options.jsonFile === 'string' && options.jsonFile.trim(),
  );
  const hasJsonDir = Boolean(
    typeof options.jsonDir === 'string' && options.jsonDir.trim(),
  );
  const root = inputRoot(options);
  if (root && (await outputOverwritesInput([root], output))) {
    throw new Error('compat: output must not overwrite an input file');
  }
  const inputs = await resolveInputs(options, warnings);
  const sidecar = `${output}.json`;
  const plan =
    !hasJsonFile && hasJsonDir ? await planSidecar(inputs, sidecar) : undefined;
  const title = mapTitle(options, warnings);
  const metadata = flattenMetadata(options.metadata, warnings);

  const { html, summary, skippedAttachments } = await generateReport(
    plan?.inputs ?? inputs,
    { title, metadata },
  );
  await writeAtomic(output, html);
  if (plan) await writeMergedJson(plan, sidecar);
  if (skippedAttachments > 0) {
    warnings.push(
      `${attachmentWarning(skippedAttachments)} ${ATTACHMENT_HINT}`,
    );
  }

  return { output, warnings, summary };
}

/**
 * Drop-in for `cucumber-html-reporter`'s `generate(options, callback?)`.
 * The returned promise is additive; old callback-only callers still work.
 */
export function generate(
  options: CucumberHtmlReporterOptions,
  callback?: (error?: Error | null) => void,
): Promise<CompatResult> {
  const promise = run(options);
  if (callback) {
    promise.then(
      () => callback(null),
      (error: unknown) =>
        callback(error instanceof Error ? error : new Error(String(error))),
    );
    // Callback-only callers ignore the returned promise; keep its rejection
    // handled without changing what awaiting callers see.
    promise.catch(() => undefined);
  }
  return promise;
}
