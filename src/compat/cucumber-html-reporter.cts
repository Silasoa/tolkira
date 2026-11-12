import type { CompatResult, CucumberHtmlReporterOptions } from './options.js';

async function generate(
  options: CucumberHtmlReporterOptions,
  callback?: (error?: Error | null) => void,
): Promise<CompatResult> {
  const mod = await import('./cucumber-html-reporter.js');
  return mod.generate(options, callback);
}

export = { generate };
