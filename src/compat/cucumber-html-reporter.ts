import { generateReport } from '../index.js';
import { writeAtomic } from '../output.js';
import {
  flattenMetadata,
  mapTitle,
  requireOutput,
  resolveInputs,
  warnIgnoredOptions,
} from './options.js';
import type { CompatResult, CucumberHtmlReporterOptions } from './options.js';

export type { CompatResult, CucumberHtmlReporterOptions } from './options.js';

async function run(
  options: CucumberHtmlReporterOptions,
): Promise<CompatResult> {
  const warnings: string[] = [];
  const output = requireOutput(options);
  warnIgnoredOptions(options, warnings);
  const inputs = await resolveInputs(options, warnings);
  const title = mapTitle(options, warnings);
  const metadata = flattenMetadata(options.metadata, warnings);

  const { html, summary } = await generateReport(inputs, { title, metadata });
  await writeAtomic(output, html);

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
